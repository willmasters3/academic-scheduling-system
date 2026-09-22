'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const interpreter = require('../modules/chat/chatLanguageInterpreter');
const chatService = require('../modules/chat/chatService');
const functionalKnowledge = require('../modules/chat/chatFunctionalKnowledge');

function interpretation(overrides = {}) {
    return {
        version: 1,
        tipoMensagem: 'nova_intencao',
        intencao: 'localizar_professor',
        entidades: {},
        referencias: {},
        ...overrides
    };
}

function publicRequest(completed = null) {
    return {
        body: {},
        session: {
            ...(completed ? { jeysonLastCompletedQuery: completed } : {}),
            jeysonConversationContext: {
                unidade: 'UC001', authenticationMode: 'public', updatedAt: Date.now()
            }
        }
    };
}

function authenticatedRequest(completed = null, permission = 'user') {
    const req = publicRequest(completed);
    req.session.user = { id_professor: 10, nome: 'Teste', permissao: permission, unidades: ['UC001'] };
    req.session.jeysonConversationContext.authenticationMode = 'authenticated';
    return req;
}

test('validador aceita intenção estruturada mínima e normaliza referências', () => {
    const result = interpreter.validateInterpretation(interpretation({
        entidades: {
            professor: { operacao: 'substituir', valor: 'Gilberto' },
            data: { operacao: 'substituir', valor: '2026-08-20' }
        }
    }));
    assert.equal(result.intencao, 'localizar_professor');
    assert.equal(result.entidades.professor.valor, 'Gilberto');
    assert.equal(result.referencias.pessoaAnterior, false);
});

test('validador rejeita intenção, propriedade e data fora do contrato', () => {
    assert.throws(() => interpreter.validateInterpretation(interpretation({ intencao: 'executar_sql' })), /Intenção inválida/);
    assert.throws(() => interpreter.validateInterpretation({ ...interpretation(), ferramenta: 'qualquer' }), /Estrutura raiz inválida/);
    assert.throws(() => interpreter.validateInterpretation(interpretation({
        entidades: { data: { operacao: 'substituir', valor: '2026-02-30' } }
    })), /Data inválida/);
});

test('interpretador não corrige texto livre nem JSON envolvido em Markdown', async () => {
    await assert.rejects(() => interpreter.interpretMessage({
        message: 'Cadê o Gilberto?', currentDate: '2026-08-20', mode: 'public', context: {},
        generate: async () => '```json\n{"version":1}\n```'
    }), /não é JSON válido/);
});

test('continuação altera somente data e preserva professor, unidade e período', () => {
    const req = publicRequest({
        tool: 'localizar_agendamentos_professor_publico',
        arguments: { professor: 'Gilberto Muller Beck', unidade: 'UC001', data: '2026-08-20', horaInicio: '13:15', horaFim: '17:15' },
        resultSummary: { professor: 'Gilberto Muller Beck', salas: ['501'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    const parsed = interpreter.validateInterpretation(interpretation({
        tipoMensagem: 'continuacao',
        entidades: { data: { operacao: 'substituir', valor: '2026-08-21' } }
    }));
    const mapped = chatService.__test.buildToolCallFromInterpretation(req, parsed);
    assert.deepEqual(mapped.toolCall, {
        tool: 'localizar_agendamentos_professor_publico',
        arguments: { professor: 'Gilberto Muller Beck', unidade: 'UC001', data: '2026-08-21', horaInicio: '13:15', horaFim: '17:15' }
    });
});

test('nova intenção de disponibilidade não carrega professor e usa referência de período', () => {
    const req = publicRequest({
        tool: 'localizar_agendamentos_professor_publico',
        arguments: { professor: 'Gilberto Muller Beck', unidade: 'UC001', data: '2026-08-20', horaInicio: '13:15', horaFim: '17:15' },
        resultSummary: { professor: 'Gilberto Muller Beck', salas: ['501'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    const parsed = interpreter.validateInterpretation(interpretation({
        tipoMensagem: 'nova_intencao', intencao: 'buscar_salas_disponiveis',
        referencias: { periodoAnterior: true }, entidades: {}
    }));
    const mapped = chatService.__test.buildToolCallFromInterpretation(req, parsed);
    assert.equal(mapped.toolCall.tool, 'listar_salas_disponiveis_publicas');
    assert.equal(mapped.toolCall.arguments.professor, undefined);
    assert.equal(mapped.toolCall.arguments.unidade, 'UC001');
    assert.equal(mapped.toolCall.arguments.horaInicio, '13:15');
    assert.equal(mapped.toolCall.arguments.horaFim, '17:15');
});

test('referência dessas salas usa somente resumo compacto anterior', () => {
    const req = publicRequest({
        tool: 'listar_salas_disponiveis_publicas',
        arguments: { unidade: 'UC001', data: '2026-08-20', horaInicio: '06:00', horaFim: '12:59' },
        resultSummary: { professor: null, salas: ['501', '503'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    const parsed = interpreter.validateInterpretation(interpretation({
        tipoMensagem: 'nova_intencao', intencao: 'consultar_caracteristicas_sala',
        referencias: { salasAnteriores: true }, entidades: {}
    }));
    const mapped = chatService.__test.buildToolCallFromInterpretation(req, parsed);
    assert.deepEqual(mapped.toolCall.arguments.salas, ['501', '503']);
});

test('frases operacionais reconhecidas como candidatas não seguem direto para conversa livre', () => {
    const req = publicRequest();
    for (const message of ['Gilberto está onde hoje?', 'Cadê o Gilberto?', 'Procura o Gilberto pra mim.', 'Quais dessas têm computadores?']) {
        assert.equal(chatService.__test.looksPotentiallyOperational(message, req), true, message);
    }
});

test('extrator rápido não inclui auxiliares ou expressões temporais no professor', () => {
    assert.equal(chatService.__test.extractProfessorSelector('Onde o Gilberto vai estar hoje à tarde?'), 'Gilberto');
    assert.equal(chatService.__test.extractProfessorSelector('Agora quero saber do Edgar.'), 'Edgar');
    assert.equal(chatService.__test.extractProfessorSelector('E amanhã?'), null);
    assert.equal(chatService.__test.extractProfessorSelector('E de manhã?'), null);
});

test('continuação de ocupação troca sala e preserva período no delta sem inventar professor', () => {
    const req = publicRequest({
        tool: 'verificar_ocupacao_sala_publica',
        arguments: { unidade: 'UC001', sala: '501', data: '2026-08-20', horaInicio: '13:15', horaFim: '17:15' },
        resultSummary: { professor: null, salas: ['501'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    const parsed = interpreter.validateInterpretation(interpretation({
        tipoMensagem: 'continuacao', intencao: 'verificar_ocupacao_sala',
        entidades: { salas: { operacao: 'substituir', valores: ['503'] } }
    }));
    const mapped = chatService.__test.buildToolCallFromInterpretation(req, parsed);
    assert.equal(mapped.toolCall.arguments.data, '2026-08-20');
    assert.equal(mapped.toolCall.arguments.horaInicio, '13:15');
    assert.deepEqual(mapped.toolCall.arguments.salas, ['503']);
    assert.equal(mapped.toolCall.arguments.professor, undefined);
});

test('modo autenticado mapeia intenção para catálogo autenticado', () => {
    const req = publicRequest();
    req.session.user = { id_professor: 10, unidades: ['UC001'] };
    req.session.jeysonConversationContext.authenticationMode = 'authenticated';
    const parsed = interpreter.validateInterpretation(interpretation({
        entidades: { professor: { operacao: 'substituir', valor: 'Gilberto' }, data: { operacao: 'substituir', valor: '2026-08-20' } }
    }));
    const mapped = chatService.__test.buildToolCallFromInterpretation(req, parsed);
    assert.equal(mapped.toolCall.tool, 'localizar_agendamentos_professor');
});

test('consulta geral de uma sala seleciona características deterministicamente', async () => {
    const result = await chatService.__test.classifyAuthorizedQuery(publicRequest(), 'Quero saber mais sobre a sala 501');
    assert.equal(result.tool, 'consultar_informacoes_sala_publica');
    assert.equal(result.arguments.sala, '501');
});

test('recursos e sinônimos de sala são extraídos sem depender do modelo', async () => {
    const cases = [
        ['Quantos computadores tem na 501?', 'computador', '501'],
        ['A 501 tem projetor?', 'projetor', '501'],
        ['A sala 501 tem PC?', 'computador', '501'],
        ['Quantas cadeiras tem a 501?', 'cadeiras', '501']
    ];
    for (const [message, resource, room] of cases) {
        const result = await chatService.__test.classifyAuthorizedQuery(publicRequest(), message);
        assert.equal(result.tool, 'consultar_informacoes_sala_publica', message);
        assert.equal(result.arguments.recurso, resource, message);
        assert.equal(result.arguments.sala, room, message);
    }
});

test('consulta completa encontra salas por característica', async () => {
    const result = await chatService.__test.classifyAuthorizedQuery(publicRequest(), 'Quais salas têm computadores?');
    assert.equal(result.tool, 'consultar_informacoes_sala_publica');
    assert.equal(result.arguments.recurso, 'computador');
});

test('delas reutiliza somente salas validadas do último resultado', async () => {
    const req = publicRequest({
        tool: 'listar_salas_disponiveis_publicas',
        arguments: { unidade: 'UC001', data: '2026-08-20', horaInicio: '06:00', horaFim: '12:59' },
        resultSummary: { professor: null, salas: ['501', '503'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    const result = await chatService.__test.classifyAuthorizedQuery(req, 'Quais delas têm computadores?');
    assert.deepEqual(result.arguments.salas, ['501', '503']);
    assert.equal(result.arguments.recurso, 'computador');
});

test('continuação de característica preserva o conjunto anterior', async () => {
    const req = publicRequest({
        tool: 'consultar_informacoes_sala_publica',
        arguments: { unidade: 'UC001', salas: ['501', '503'], recurso: 'computador' },
        resultSummary: { professor: null, salas: ['501', '503'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    const result = await chatService.__test.classifyAuthorizedQuery(req, 'E quais têm projetor?');
    assert.deepEqual(result.arguments.salas, ['501', '503']);
    assert.equal(result.arguments.recurso, 'projetor');
});

test('Sala 501 isolada é reconhecida como ambígua contextual, não como falta de sala', () => {
    assert.equal(chatService.__test.isStandaloneRoomMessage('Sala 501'), true);
    assert.equal(chatService.__test.isStandaloneRoomMessage('Quero saber da sala 501'), false);
});

test('parte da manhã é período e nunca unidade ou professor', () => {
    const filters = chatService.__test.extractDeterministicFilters('E na parte da manhã?', 'localizar_agendamentos_professor_publico');
    assert.equal(filters.turno, 'manha');
    assert.equal(filters.horaInicio, '06:00');
    assert.equal(filters.horaFim, '12:59');
    assert.equal(filters.unidade, null);
    assert.equal(filters.professor, null);
    assert.equal(chatService.__test.extractProfessorSelector('E na parte da manhã?'), null);
});

test('resposta de características não expõe campos administrativos injetados', () => {
    for (const ferramenta of ['consultar_informacoes_sala_publica', 'consultar_informacoes_sala']) {
        const reply = chatService.__test.buildDeterministicToolReply({
            ferramenta,
            resultado: {
                sala: '501', unidade: 'Unidade Centro', computadoresDeclarados: 16,
                ip: '192.0.2.10', mac: 'MAC-DEMO-001', serial: 'SER-DEMO-001', lastLoggedUser: 'usuario_demo'
            }
        });
        assert.match(reply, /16 computador/);
        assert.doesNotMatch(reply, /192\.0\.2\.10|MAC-DEMO|SER-DEMO|usuario_demo/);
    }
});

test('resposta determinística não inventa característica ausente', () => {
    const reply = chatService.__test.buildDeterministicToolReply({
        ferramenta: 'consultar_informacoes_sala_publica',
        resultado: { sala: '501', unidade: 'Unidade Centro', recurso: 'projetor', projetor: false }
    });
    assert.match(reply, /não possui projetor cadastrado/);
    assert.doesNotMatch(reply, /possui projetor\./);
});

test('base funcional reconhece orientações reais do sistema', () => {
    const req = publicRequest();
    req.session.user = { permissao: 'user', unidades: ['UC001'] };
    for (const [message, topic] of [
        ['Como faço para agendar uma sala?', 'booking'],
        ['Onde faço o agendamento?', 'booking'],
        ['Como vejo meus agendamentos?', 'my_schedule'],
        ['Como funciona a troca de sala?', 'swap'],
        ['Onde vejo informações da sala?', 'rooms'],
        ['Me ajuda a usar o sistema.', 'overview']
    ]) {
        assert.equal(functionalKnowledge.resolveHelp(req, message)?.topic, topic, message);
    }
});

test('capacidades reconhecem formulações naturais', () => {
    for (const message of ['O que você pode fazer?', 'O que você sabe fazer?', 'Quais informações você pode me dar?', 'Como você pode me ajudar?']) {
        assert.equal(chatService.__test.isCapabilitiesIntent(message), true, message);
    }
});

test('ajuda é filtrada pelo perfil da sessão', () => {
    const visitor = publicRequest();
    assert.equal(functionalKnowledge.resolveHelp(visitor, 'Quais são as funções administrativas?'), null);
    assert.match(functionalKnowledge.resolveHelp(visitor, 'Como faço para agendar uma sala?').reply, /exige login/);

    const professor = publicRequest();
    professor.session.user = { permissao: 'user', unidades: ['UC001'] };
    assert.equal(functionalKnowledge.resolveHelp(professor, 'Quais são as funções administrativas?'), null);

    const coordinator = publicRequest();
    coordinator.session.user = { permissao: 'coordenador', unidades: ['UC001'] };
    assert.equal(functionalKnowledge.resolveHelp(coordinator, 'Quais são as funções administrativas?').topic, 'administration');

    const admin = publicRequest();
    admin.session.user = { permissao: 'admin', unidades: ['UC001'] };
    assert.equal(functionalKnowledge.resolveHelp(admin, 'Onde gerenciar programas?').topic, 'programs');
});

test('contexto de ajuda é separado e respeita perfil e expiração', () => {
    const req = publicRequest();
    req.session.user = { permissao: 'user', unidades: ['UC001'] };
    functionalKnowledge.storeContext(req, 'booking');
    assert.equal(functionalKnowledge.resolveHelpFollowUp(req, 'E como funciona?')?.topic, 'booking');
    req.session.user.permissao = 'coordenador';
    assert.equal(functionalKnowledge.resolveHelpFollowUp(req, 'E como funciona?'), null);
});

test('fluxo principal responde ajuda por tópico e preserva continuação sem chamar gerador', async () => {
    const req = publicRequest();
    req.session.user = { permissao: 'user', unidades: ['UC001'] };
    const first = await chatService.handleChatMessage(req, 'Como faço para agendar uma sala?');
    assert.equal(first.statusCode, 200);
    assert.match(first.body.reply, /Dashboard do Professor/);
    assert.equal(req.session.jeysonHelpContext.topic, 'booking');
    const followUp = await chatService.handleChatMessage(req, 'E como funciona?');
    assert.match(followUp.body.reply, /Dashboard do Professor/);
    assert.equal(req.session.jeysonHelpContext.topic, 'booking');
});

test('turno da manhã continua a consulta anterior preservando professor e data', () => {
    const completed = {
        tool: 'localizar_agendamentos_professor_publico',
        arguments: { professor: 'Edgar', unidade: 'UC001', data: '2026-08-20' },
        completedAt: Date.now(), authenticationMode: 'public'
    };
    const morning = chatService.__test.buildCompletedFollowUpToolCall(completed, 'turno da manhã?');
    assert.equal(morning.arguments.professor, 'Edgar');
    assert.equal(morning.arguments.data, '2026-08-20');
    assert.equal(morning.arguments.horaInicio, '06:00');
    assert.equal(morning.arguments.horaFim, '12:59');
    const afternoon = chatService.__test.buildCompletedFollowUpToolCall({ ...completed, arguments: morning.arguments }, 'e de tarde?');
    assert.equal(afternoon.arguments.horaInicio, '13:15');
    assert.equal(afternoon.arguments.horaFim, '17:15');
});

test('ela referencia a última sala estruturada e cada pergunta consulta novamente', async () => {
    const req = publicRequest({
        tool: 'consultar_informacoes_sala_publica',
        arguments: { unidade: 'UC001', sala: '501' },
        resultSummary: { professor: null, salas: ['501'] },
        completedAt: Date.now(), authenticationMode: 'public'
    });
    for (const [message, resource] of [
        ['Quantos computadores ela tem?', 'computador'],
        ['Ela tem projetor?', 'projetor'],
        ['E TV?', 'tv'],
        ['Quantas cadeiras ela tem?', 'cadeiras']
    ]) {
        const result = await chatService.__test.classifyAuthorizedQuery(req, message);
        assert.equal(result.tool, 'consultar_informacoes_sala_publica', message);
        const selectedRooms = result.arguments.salas || [result.arguments.sala];
        assert.deepEqual(selectedRooms, ['501'], message);
        assert.equal(result.arguments.recurso, resource, message);
    }
});

test('vocativo JSON é removido somente no início de pedidos ao assistente', () => {
    assert.equal(chatService.__test.stripAssistantVocative('JSON, onde está o professor Gilberto?'), 'onde está o professor Gilberto?');
    assert.equal(chatService.__test.stripAssistantVocative('json onde está o Gilberto?'), 'onde está o Gilberto?');
    assert.equal(chatService.__test.stripAssistantVocative('Json me diga onde está o Edgar'), 'me diga onde está o Edgar');
    assert.equal(chatService.__test.stripAssistantVocative('O que significa JSON em uma API?'), 'O que significa JSON em uma API?');
    assert.equal(chatService.__test.stripAssistantVocative('JSON é um formato de dados?'), 'JSON é um formato de dados?');
});

test('regressão: localização de professor tem a mesma intenção no público e autenticado', async () => {
    const message = chatService.__test.stripAssistantVocative('JSON, onde está o professor Gilberto?');
    const publicResult = await chatService.__test.classifyAuthorizedQuery(publicRequest(), message);
    const authenticatedResult = await chatService.__test.classifyAuthorizedQuery(authenticatedRequest(), message);
    assert.equal(chatService.__test.getToolSemanticIntent(publicResult.tool), 'localizar_professor');
    assert.equal(chatService.__test.getToolSemanticIntent(authenticatedResult.tool), 'localizar_professor');
    assert.equal(publicResult.arguments.professor, authenticatedResult.arguments.professor);
    assert.equal(publicResult.arguments.data, authenticatedResult.arguments.data);
    assert.equal(publicResult.tool, 'localizar_agendamentos_professor_publico');
    assert.equal(authenticatedResult.tool, 'localizar_agendamentos_professor');
});

test('parser determinístico mantém paridade de intenção e entidades nos dois modos', async () => {
    for (const message of [
        'Onde está o Edgar?',
        'Cadê o Gilberto?',
        'Quais salas estão disponíveis hoje de manhã?',
        'Quero saber sobre a sala 501.'
    ]) {
        const publicResult = await chatService.__test.classifyAuthorizedQuery(publicRequest(), message);
        const authenticatedResult = await chatService.__test.classifyAuthorizedQuery(authenticatedRequest(), message);
        assert.ok(publicResult, message);
        assert.ok(authenticatedResult, message);
        assert.equal(chatService.__test.getToolSemanticIntent(publicResult.tool), chatService.__test.getToolSemanticIntent(authenticatedResult.tool), message);
        assert.deepEqual(publicResult.arguments, authenticatedResult.arguments, message);
    }
});

test('contexto estruturado produz continuações equivalentes nos dois modos', async () => {
    const publicCompleted = {
        tool: 'localizar_agendamentos_professor_publico',
        arguments: { professor: 'Gilberto Muller Beck', unidade: 'UC001', data: '2026-08-20' },
        resultSummary: { professor: 'Gilberto Muller Beck', salas: ['501'] },
        completedAt: Date.now(), authenticationMode: 'public'
    };
    const authenticatedCompleted = { ...publicCompleted, tool: 'localizar_agendamentos_professor', authenticationMode: 'authenticated' };
    const publicReq = publicRequest(publicCompleted);
    const authenticatedReq = authenticatedRequest(authenticatedCompleted);

    const publicPerson = await chatService.__test.classifyAuthorizedQuery(publicReq, 'Onde ele está hoje?');
    const authenticatedPerson = await chatService.__test.classifyAuthorizedQuery(authenticatedReq, 'Onde ele está hoje?');
    assert.equal(publicPerson.arguments.professor, 'Gilberto Muller Beck');
    assert.deepEqual(publicPerson.arguments, authenticatedPerson.arguments);

    for (const followUp of ['E de manhã?', 'E à tarde?', 'E amanhã?']) {
        const publicCall = chatService.__test.buildCompletedFollowUpToolCall(publicCompleted, followUp);
        const authenticatedCall = chatService.__test.buildCompletedFollowUpToolCall(authenticatedCompleted, followUp);
        assert.deepEqual(publicCall.arguments, authenticatedCall.arguments, followUp);
        assert.equal(chatService.__test.getToolSemanticIntent(publicCall.tool), chatService.__test.getToolSemanticIntent(authenticatedCall.tool), followUp);
    }
});

test('características, capacidades e ajuda têm compreensão paritária', async () => {
    const publicCompleted = {
        tool: 'consultar_informacoes_sala_publica', arguments: { unidade: 'UC001', sala: '501' },
        resultSummary: { professor: null, salas: ['501'] }, completedAt: Date.now(), authenticationMode: 'public'
    };
    const authenticatedCompleted = { ...publicCompleted, tool: 'consultar_informacoes_sala', authenticationMode: 'authenticated' };
    for (const message of ['Quantos computadores ela tem?', 'Ela tem projetor?']) {
        const publicResult = await chatService.__test.classifyAuthorizedQuery(publicRequest(publicCompleted), message);
        const authenticatedResult = await chatService.__test.classifyAuthorizedQuery(authenticatedRequest(authenticatedCompleted), message);
        assert.equal(chatService.__test.getToolSemanticIntent(publicResult.tool), 'consultar_caracteristicas_sala');
        assert.equal(chatService.__test.getToolSemanticIntent(authenticatedResult.tool), 'consultar_caracteristicas_sala');
        assert.deepEqual(publicResult.arguments, authenticatedResult.arguments, message);
    }
    assert.equal(chatService.__test.isCapabilitiesIntent('O que você consegue fazer?'), true);
    assert.equal(functionalKnowledge.resolveHelp(publicRequest(), 'Como faço para agendar uma sala?').topic, 'booking');
    assert.equal(functionalKnowledge.resolveHelp(authenticatedRequest(), 'Como faço para agendar uma sala?').topic, 'booking');
});

test('prompt semântico é idêntico nos modos público e autenticado', () => {
    const base = { currentDate: '2026-08-20', context: { professor: 'Gilberto' } };
    assert.equal(
        interpreter.buildInterpreterPrompt({ ...base, mode: 'public' }),
        interpreter.buildInterpreterPrompt({ ...base, mode: 'authenticated' })
    );
});

test('datas numéricas brasileiras são convertidas deterministicamente sem inverter dia e mês', () => {
    const cases = [
        ['26/08/2026', '2026-08-26'],
        ['26/08/26', '2026-08-26'],
        ['dia 26/08/2026', '2026-08-26'],
        ['no dia 26/08/2026', '2026-08-26'],
        ['em 26/08/2026', '2026-08-26'],
        ['para 26/08/2026', '2026-08-26'],
        ['05/09/2026', '2026-09-05'],
        ['09/05/2026', '2026-05-09'],
        ['12/11/2026', '2026-11-12'],
        ['11/12/2026', '2026-12-11'],
        ['31/08/2026', '2026-08-31']
    ];
    for (const [message, expected] of cases) {
        const parsed = chatService.__test.extractExplicitBrazilianDate(message);
        assert.equal(parsed.present, true, message);
        assert.equal(parsed.valid, true, message);
        assert.equal(parsed.value, expected, message);
    }
});

test('datas impossíveis são rejeitadas antes da ferramenta', async () => {
    for (const date of ['32/08/2026', '31/02/2026', '29/02/2026']) {
        const parsed = chatService.__test.extractExplicitBrazilianDate(date);
        assert.equal(parsed.present, true, date);
        assert.equal(parsed.valid, false, date);
        const classified = await chatService.__test.classifyAuthorizedQuery(publicRequest(), `Onde está o professor Felipe no dia ${date}?`);
        assert.match(classified.validationReply, /data informada é inválida/, date);
    }
});

test('professor é extraído sem incorporar a expressão de data', () => {
    for (const message of [
        'onde está o professor Felipe?',
        'onde está o Felipe?',
        'cadê o Felipe?',
        'professor Felipe dia 26/08/2026',
        'onde está o professor Felipe no dia 26/08/2026?'
    ]) {
        assert.equal(chatService.__test.extractProfessorSelector(message), 'Felipe', message);
    }
});

test('caso combinado produz Felipe e 2026-08-26 nos modos público e autenticado', async () => {
    const message = 'onde está o professor Felipe no dia 26/08/2026?';
    const publicResult = await chatService.__test.classifyAuthorizedQuery(publicRequest(), message);
    const authenticatedResult = await chatService.__test.classifyAuthorizedQuery(authenticatedRequest(), message);
    for (const result of [publicResult, authenticatedResult]) {
        assert.equal(chatService.__test.getToolSemanticIntent(result.tool), 'localizar_professor');
        assert.equal(result.arguments.professor, 'Felipe');
        assert.equal(result.arguments.data, '2026-08-26');
    }
    assert.deepEqual(publicResult.arguments, authenticatedResult.arguments);
});

test('entidades explícitas atuais substituem professor e data do contexto anterior', () => {
    const publicCompleted = {
        tool: 'localizar_agendamentos_professor_publico',
        arguments: { professor: 'Gilberto', unidade: 'UC001', data: '2026-08-20' },
        completedAt: Date.now(), authenticationMode: 'public'
    };
    const authenticatedCompleted = { ...publicCompleted, tool: 'localizar_agendamentos_professor', authenticationMode: 'authenticated' };
    const message = 'E o Felipe dia 26/08/2026?';
    const publicCall = chatService.__test.buildCompletedFollowUpToolCall(publicCompleted, message);
    const authenticatedCall = chatService.__test.buildCompletedFollowUpToolCall(authenticatedCompleted, message);
    for (const call of [publicCall, authenticatedCall]) {
        assert.equal(call.arguments.professor, 'Felipe');
        assert.equal(call.arguments.data, '2026-08-26');
        assert.equal(call.arguments.unidade, 'UC001');
    }
    assert.deepEqual(publicCall.arguments, authenticatedCall.arguments);
});
