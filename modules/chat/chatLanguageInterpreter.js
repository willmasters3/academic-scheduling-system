'use strict';

const VERSION = 1;
const MAX_OUTPUT_CHARS = 6000;
const MAX_ENTITY_CHARS = 160;
const MAX_SALAS = 30;

const MESSAGE_TYPES = new Set(['nova_intencao', 'continuacao', 'pergunta_geral', 'desconhecida']);
const INTENTS = new Set([
    'localizar_professor',
    'buscar_salas_disponiveis',
    'verificar_ocupacao_sala',
    'listar_agendamentos_sala',
    'consultar_caracteristicas_sala',
    'listar_meus_agendamentos',
    'listar_unidades',
    'listar_salas',
    'nenhuma'
]);
const OPERATIONS = new Set(['manter', 'substituir', 'adicionar', 'remover', 'limpar', 'ausente']);
const PERIOD_TYPES = new Set(['agora', 'manha', 'tarde', 'noite', 'personalizado', 'dia_inteiro']);
const ENTITY_KEYS = new Set(['professor', 'unidade', 'salas', 'data', 'periodo', 'recurso']);
const RESOURCES = new Set(['computador', 'projetor', 'cadeiras', 'tv', 'quadro_branco', 'tela_projetor', 'maquinario']);
const REFERENCE_KEYS = new Set(['pessoaAnterior', 'salasAnteriores', 'unidadeAnterior', 'periodoAnterior', 'salaAnterior']);
const ROOT_KEYS = new Set(['version', 'tipoMensagem', 'intencao', 'entidades', 'referencias']);

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(object, allowed) {
    return Object.keys(object).every((key) => allowed.has(key));
}

function cleanText(value, label) {
    if (typeof value !== 'string') throw new Error(`${label} deve ser texto.`);
    const text = value.trim();
    if (!text || text.length > MAX_ENTITY_CHARS) throw new Error(`${label} possui tamanho inválido.`);
    return text;
}

function validateIsoDate(value) {
    const text = cleanText(value, 'data');
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error('Data inválida.');
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
        throw new Error('Data inválida.');
    }
    return text;
}

function validateTime(value, label) {
    const text = cleanText(value, label);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error(`${label} inválido.`);
    return text;
}

function validateOperationEntity(value, label) {
    if (!isPlainObject(value) || !hasOnlyKeys(value, new Set(['operacao', 'valor']))) throw new Error(`${label} inválido.`);
    if (!OPERATIONS.has(value.operacao)) throw new Error(`Operação inválida em ${label}.`);
    const result = { operacao: value.operacao, valor: null };
    if (['substituir', 'adicionar', 'remover'].includes(value.operacao)) result.valor = cleanText(value.valor, label);
    return result;
}

function validateRoomsEntity(value) {
    if (!isPlainObject(value) || !hasOnlyKeys(value, new Set(['operacao', 'valores']))) throw new Error('salas inválido.');
    if (!OPERATIONS.has(value.operacao)) throw new Error('Operação inválida em salas.');
    const raw = value.valores === undefined ? [] : value.valores;
    if (!Array.isArray(raw) || raw.length > MAX_SALAS) throw new Error('Lista de salas inválida.');
    const valores = Array.from(new Set(raw.map((item) => cleanText(item, 'sala'))));
    if (['substituir', 'adicionar', 'remover'].includes(value.operacao) && !valores.length) throw new Error('Lista de salas vazia.');
    return { operacao: value.operacao, valores };
}

function validateDateEntity(value) {
    if (!isPlainObject(value) || !hasOnlyKeys(value, new Set(['operacao', 'valor']))) throw new Error('data inválida.');
    if (!OPERATIONS.has(value.operacao)) throw new Error('Operação inválida em data.');
    return {
        operacao: value.operacao,
        valor: ['substituir', 'adicionar', 'remover'].includes(value.operacao) ? validateIsoDate(value.valor) : null
    };
}

function validatePeriodEntity(value) {
    const allowed = new Set(['operacao', 'tipo', 'horaInicio', 'horaFim']);
    if (!isPlainObject(value) || !hasOnlyKeys(value, allowed)) throw new Error('período inválido.');
    if (!OPERATIONS.has(value.operacao)) throw new Error('Operação inválida em período.');
    if (!['substituir', 'adicionar'].includes(value.operacao)) {
        return { operacao: value.operacao, tipo: null, horaInicio: null, horaFim: null };
    }
    if (!PERIOD_TYPES.has(value.tipo)) throw new Error('Tipo de período inválido.');
    const horaInicio = value.horaInicio === null || value.horaInicio === undefined ? null : validateTime(value.horaInicio, 'horaInicio');
    const horaFim = value.horaFim === null || value.horaFim === undefined ? null : validateTime(value.horaFim, 'horaFim');
    if ((horaInicio && !horaFim) || (!horaInicio && horaFim)) throw new Error('Período incompleto.');
    if (horaInicio && horaFim && horaFim <= horaInicio) throw new Error('Intervalo de período inválido.');
    return { operacao: value.operacao, tipo: value.tipo, horaInicio, horaFim };
}

function validateInterpretation(input) {
    if (!isPlainObject(input) || !hasOnlyKeys(input, ROOT_KEYS)) throw new Error('Estrutura raiz inválida.');
    if (input.version !== VERSION) throw new Error('Versão de interpretação inválida.');
    if (!MESSAGE_TYPES.has(input.tipoMensagem)) throw new Error('Tipo de mensagem inválido.');
    if (!INTENTS.has(input.intencao)) throw new Error('Intenção inválida.');
    if (!isPlainObject(input.entidades) || !hasOnlyKeys(input.entidades, ENTITY_KEYS)) throw new Error('Entidades inválidas.');
    if (!isPlainObject(input.referencias) || !hasOnlyKeys(input.referencias, REFERENCE_KEYS)) throw new Error('Referências inválidas.');

    const entidades = {};
    if (input.entidades.professor) entidades.professor = validateOperationEntity(input.entidades.professor, 'professor');
    if (input.entidades.unidade) entidades.unidade = validateOperationEntity(input.entidades.unidade, 'unidade');
    if (input.entidades.salas) entidades.salas = validateRoomsEntity(input.entidades.salas);
    if (input.entidades.data) entidades.data = validateDateEntity(input.entidades.data);
    if (input.entidades.periodo) entidades.periodo = validatePeriodEntity(input.entidades.periodo);
    if (input.entidades.recurso) {
        entidades.recurso = validateOperationEntity(input.entidades.recurso, 'recurso');
        if (entidades.recurso.valor && !RESOURCES.has(entidades.recurso.valor)) throw new Error('Recurso inválido.');
    }

    const referencias = {};
    for (const key of REFERENCE_KEYS) {
        const value = input.referencias[key] ?? false;
        if (typeof value !== 'boolean') throw new Error(`Referência ${key} inválida.`);
        referencias[key] = value;
    }
    if (input.tipoMensagem === 'pergunta_geral' && input.intencao !== 'nenhuma') throw new Error('Pergunta geral não pode selecionar intenção operacional.');
    if (input.tipoMensagem === 'desconhecida' && input.intencao !== 'nenhuma') throw new Error('Mensagem desconhecida não pode selecionar intenção operacional.');

    return { version: VERSION, tipoMensagem: input.tipoMensagem, intencao: input.intencao, entidades, referencias };
}

function buildInterpreterPrompt({ currentDate, context }) {
    return [
        'Você é somente um interpretador de português para o Sistema de Agendamentos Demo.',
        'Responda exclusivamente com um único objeto JSON válido. Não use Markdown nem texto fora do JSON.',
        'Você não executa consultas, não escolhe ferramentas internas, não decide permissões e não responde dados ao usuário.',
        `Data atual em America/Sao_Paulo: ${currentDate}.`,
        `Contexto compacto validado pelo backend: ${JSON.stringify(context || {})}.`,
        `Intenções fechadas: ${Array.from(INTENTS).join(', ')}.`,
        `Tipos de mensagem: ${Array.from(MESSAGE_TYPES).join(', ')}.`,
        `Operações: ${Array.from(OPERATIONS).join(', ')}.`,
        'Use localizar_professor para perguntas equivalentes a onde/cadê/procura uma pessoa ou professor em sala agendada.',
        'Use buscar_salas_disponiveis para sala livre, disponível, sobrando ou que possa ser usada.',
        'Use verificar_ocupacao_sala para quem/o que está ou estará usando uma sala.',
        'Use consultar_caracteristicas_sala para computadores, projetor, cadeiras ou recursos de salas.',
        `Recursos fechados: ${Array.from(RESOURCES).join(', ')}.`,
        'Uma continuação deve conter somente alterações explicitamente ditas. Nunca transforme hoje, amanhã, manhã, tarde, noite, agora, vai, está, estará, dia, período ou turno em professor/unidade.',
        'ele/ela/dele/dela referenciam pessoaAnterior; delas/deles/dessas/essas salas/as que você mostrou/as que estão livres referenciam salasAnteriores; nessa unidade referencia unidadeAnterior; nesse/naquele horário ou período referencia periodoAnterior.',
        'PC/PCs significa computador; data show/datashow significa projetor; lugares/capacidade significa cadeiras; televisão significa TV; tela de projeção/tela do projetor significa tela_projetor.',
        'Converta hoje/amanhã/depois de amanhã para data ISO. Períodos: manhã 06:00-12:59, tarde 13:15-17:15, noite 17:16-23:59.',
        'Parte da manhã, durante a manhã e período da manhã significam manhã; aplique a mesma regra para tarde e noite. A palavra parte nunca é professor, unidade ou sala.',
        'Para horário pontual, use um intervalo de um minuto. Para dia inteiro, tipo dia_inteiro e horas nulas.',
        'Schema obrigatório: {"version":1,"tipoMensagem":"nova_intencao|continuacao|pergunta_geral|desconhecida","intencao":"...","entidades":{"professor":{"operacao":"...","valor":"..."},"unidade":{"operacao":"...","valor":"..."},"salas":{"operacao":"...","valores":[]},"data":{"operacao":"...","valor":"AAAA-MM-DD"},"periodo":{"operacao":"...","tipo":"agora|manha|tarde|noite|personalizado|dia_inteiro","horaInicio":"HH:mm|null","horaFim":"HH:mm|null"},"recurso":{"operacao":"...","valor":"computador|projetor|cadeiras|tv|quadro_branco|tela_projetor|maquinario"}},"referencias":{"pessoaAnterior":false,"salasAnteriores":false,"unidadeAnterior":false,"periodoAnterior":false,"salaAnterior":false}}.',
        'Inclua somente entidades relevantes, mas sempre inclua entidades e referencias como objetos.'
    ].join('\n');
}

async function interpretMessage({ message, currentDate, mode, context, generate }) {
    if (typeof generate !== 'function') throw new Error('Gerador do interpretador não configurado.');
    const prompt = buildInterpreterPrompt({ currentDate, mode, context });
    const raw = await generate(prompt, String(message || '').slice(0, 1200));
    const text = String(raw || '').trim();
    if (!text || text.length > MAX_OUTPUT_CHARS) throw new Error('Saída do interpretador vazia ou muito longa.');
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (_) {
        throw new Error('Saída do interpretador não é JSON válido.');
    }
    return validateInterpretation(parsed);
}

module.exports = {
    interpretMessage,
    validateInterpretation,
    buildInterpreterPrompt,
    INTENTS: Array.from(INTENTS),
    MESSAGE_TYPES: Array.from(MESSAGE_TYPES),
    OPERATIONS: Array.from(OPERATIONS)
};
