'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../public/js/agendamentos-voice-core');
const voice = require('../public/js/agendamentos-voice');

const records = [
    { voiceIndex: 0, id_professor: 1, id_sala: 10, data_reservas: '2026-08-20', nome_sala: 'Sala 503', tipo_aula: 'Robótica', nome: 'Edison Pereira', motivo: '1422B', hora_inicio: '13:15:00', hora_fim: '17:15:00' },
    { voiceIndex: 1, id_professor: 2, id_sala: 11, data_reservas: '2026-08-20', nome_sala: 'Laboratório CNC', tipo_aula: 'Usinagem', nome: 'Emanuele Costa', motivo: '14-23 A', hora_inicio: '13:15:00', hora_fim: '17:15:00' },
    { voiceIndex: 2, id_professor: 3, id_sala: 12, data_reservas: '2026-08-20', nome_sala: 'Sala 410', tipo_aula: 'Matemática', nome: 'João Pereira', motivo: '1001A', hora_inicio: '07:45:00', hora_fim: '11:45:00' },
    { voiceIndex: 3, id_professor: 4, id_sala: 13, data_reservas: '2026-08-20', nome_sala: 'Sala 411', tipo_aula: 'Física', nome: 'João Santos', motivo: '1002A', hora_inicio: '07:45:00', hora_fim: '11:45:00' },
    { voiceIndex: 4, id_professor: 5, id_sala: 14, data_reservas: '2026-08-20', nome_sala: 'Sala 512', tipo_aula: 'Automação', nome: 'Maria Silva', motivo: '2742', hora_inicio: '13:15:00', hora_fim: '17:15:00' }
];
const catalog = core.buildCatalog(records);

test('wake word é tolerante às grafias comuns sem aceitar palavra distante', () => {
    for (const value of ['Jason onde está Edison', 'Jeyson onde está Edison', 'Jayson onde está Edison', 'Jeison onde está Edison']) {
        assert.equal(core.resolveWakeWord(value).matched, true, value);
    }
    assert.equal(core.resolveWakeWord('conversa sobre o Jason').matched, false);
    assert.equal(core.resolveWakeWord('Jackson onde está Edison').matched, false);
});

test('turma preserva extração estrutural com espaço e hífen', () => {
    for (const value of ['turma 1422B', 'turma 14 22 B', 'turma 14-22 B', '1422B']) {
        assert.deepEqual(core.extractClassCodes(value), ['1422b'], value);
    }
});

test('catálogo indexa turma puramente numérica a partir do motivo real', () => {
    assert.ok(catalog.classes.some((item) => item.code === '2742'));
    for (const phrase of ['2742', 'onde está o 2742', 'procura 2742', 'onde fica 2742']) {
        const parsed = core.interpretDeterministic(phrase, catalog)[0];
        assert.equal(parsed.intent, core.INTENTS.FIND_CLASS, phrase);
        assert.equal(parsed.entities.class, '2742', phrase);
        assert.deepEqual(core.searchAppointments(records, parsed, { date: '2026-08-20', currentShift: 'tarde' }).map((item) => item.voiceIndex), [4]);
    }
});

test('número exclusivo de sala não vira turma e valor compartilhado pede esclarecimento', () => {
    assert.equal(core.interpretDeterministic('503', catalog)[0].intent, core.INTENTS.QUERY_ROOM);
    const sharedCatalog = core.buildCatalog([
        { id_sala: 90, nome_sala: 'Sala 2742' },
        { id_sala: 91, nome_sala: 'Sala 900', motivo: '2742', nome: 'Pessoa', id_professor: 90 }
    ]);
    assert.equal(core.interpretDeterministic('2742', sharedCatalog)[0].intent, core.INTENTS.CLARIFY_ENTITY);
    assert.equal(core.interpretDeterministic('turma 2742', sharedCatalog)[0].intent, core.INTENTS.FIND_CLASS);
    assert.equal(core.interpretDeterministic('sala 2742', sharedCatalog)[0].intent, core.INTENTS.QUERY_ROOM);
    assert.equal(core.interpretDeterministic('turma', sharedCatalog, { pending: { intent: core.INTENTS.CLARIFY_ENTITY, value: '2742' } })[0].intent, core.INTENTS.FIND_CLASS);
});

test('catálogo é dinâmico e resolve sala numérica ou nomeada sem substring', () => {
    assert.equal(core.resolveRoom('503', catalog).value.name, 'Sala 503');
    assert.equal(core.resolveRoom('Laboratório CNC', catalog).value.name, 'Laboratório CNC');
    assert.equal(core.resolveRoom('50', catalog).state, core.RESULT_STATES.NOT_FOUND);
});

test('nome exato, primeiro nome, sobrenome e fuzzy conservador', () => {
    assert.equal(core.resolvePerson('Edison Pereira', catalog).state, core.RESULT_STATES.EXACT_MATCH);
    assert.equal(core.resolvePerson('Edison', catalog).value.name, 'Edison Pereira');
    assert.equal(core.resolvePerson('Costa', catalog).value.name, 'Emanuele Costa');
    assert.equal(core.resolvePerson('Emanuel', catalog).state, core.RESULT_STATES.STRONG_MATCH);
    assert.equal(core.resolvePerson('Emanuel', catalog).value.name, 'Emanuele Costa');
});

test('primeiro nome duplicado é ambíguo e não escolhe arbitrariamente', () => {
    const result = core.resolvePerson('João', catalog);
    assert.equal(result.state, core.RESULT_STATES.AMBIGUOUS);
    assert.deepEqual(result.candidates.map((item) => item.name), ['João Pereira', 'João Santos']);
});

test('alternativa do STT com match exato vence primeira hipótese incorreta', () => {
    const result = core.resolvePersonFromAlternatives([
        { text: 'Edson', confidence: 0.74 },
        { text: 'Edison', confidence: 0.64 }
    ], catalog);
    assert.equal(result.value.name, 'Edison Pereira');
    assert.equal(result.state, core.RESULT_STATES.EXACT_MATCH);
});

test('intérprete produz contrato explícito de pessoa, sala e turma', () => {
    const person = core.interpretDeterministic('eu queria saber onde está Edison', catalog)[0];
    assert.equal(person.intent, core.INTENTS.FIND_PERSON);
    assert.equal(person.entities.person, 'edison');
    const room = core.interpretDeterministic('quero saber da sala 503', catalog)[0];
    assert.equal(room.intent, core.INTENTS.QUERY_ROOM);
    assert.equal(room.resolved.room.name, 'Sala 503');
    const turma = core.interpretDeterministic('qual sala da 14 22 B', catalog)[0];
    assert.equal(turma.intent, core.INTENTS.FIND_CLASS);
});

test('intenções específicas distinguem pessoa e turma dentro da sala', () => {
    assert.equal(core.interpretDeterministic('quem está na sala 503', catalog)[0].intent, core.INTENTS.ROOM_PERSON);
    assert.equal(core.interpretDeterministic('qual turma está na sala 503', catalog)[0].intent, core.INTENTS.ROOM_CLASS);
});

test('follow-up reutiliza intenção de pessoa e sala', () => {
    const person = core.interpretDeterministic('e o Edison', catalog, { lastIntent: core.INTENTS.FIND_PERSON })[0];
    assert.equal(person.intent, core.INTENTS.FIND_PERSON);
    const room = core.interpretDeterministic('e na 503', catalog, { lastIntent: core.INTENTS.ROOM_CLASS })[0];
    assert.equal(room.intent, core.INTENTS.ROOM_CLASS);
});

test('duas solicitações geram múltiplos contratos', () => {
    const result = core.interpretDeterministic('onde está Edison e onde está João', catalog);
    assert.equal(result.length, 2);
    assert.ok(result.every((item) => item.intent === core.INTENTS.FIND_PERSON));
});

test('busca respeita turno atual e turno explícito', () => {
    const parsed = core.interpretDeterministic('onde está Edison', catalog)[0];
    assert.deepEqual(core.searchAppointments(records, parsed, { date: '2026-08-20', currentShift: 'tarde' }).map((item) => item.voiceIndex), [0]);
    assert.deepEqual(core.searchAppointments(records, parsed, { date: '2026-08-20', currentShift: 'manha' }), []);
    const explicit = core.interpretDeterministic('onde está Edison de tarde', catalog)[0];
    assert.deepEqual(core.searchAppointments(records, explicit, { date: '2026-08-20', currentShift: 'manha' }).map((item) => item.voiceIndex), [0]);
});

test('buffer une segmentos finais e só conclui após silêncio configurado', async () => {
    const completed = new Promise((resolve) => {
        const buffer = voice.createUtteranceBuffer({ ...core.CONFIG, utteranceSilenceMs: 5 }, resolve);
        buffer.append([{ text: 'Jason onde está o professor', confidence: 0.8 }]);
        buffer.append([{ text: 'Edison', confidence: 0.9 }]);
    });
    const result = await completed;
    assert.equal(result[0].text, 'Jason onde está o professor Edison');
});

test('limpeza do buffer invalida texto e timer da utterance anterior', async () => {
    let completed = false;
    const buffer = voice.createUtteranceBuffer({ ...core.CONFIG, utteranceSilenceMs: 5 }, () => { completed = true; });
    buffer.append([{ text: 'turma residual', confidence: 0.2 }]);
    buffer.clear();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(completed, false);
    assert.deepEqual(buffer.snapshot(), []);
});

test('gate aceita entidade contextual forte e rejeita fragmento inexistente', () => {
    const conversation = { ...core.createConversationContext(), lastIntent: core.INTENTS.FIND_CLASS, lastEntities: { class: '1422b' }, expiresAt: Date.now() + 9000 };
    assert.equal(voice.evaluateConversationFollowUp([{ text: 'e 2742', confidence: 0.7 }], catalog, conversation, core.CONFIG).accepted, true);
    const rejected = voice.evaluateConversationFollowUp([{ text: 'turma 101', confidence: 0.2 }], catalog, conversation, core.CONFIG);
    assert.equal(rejected.accepted, false);
    assert.equal(rejected.reason, 'NO_STRONG_CONTEXT_OR_ENTITY');
});

test('gate prioriza resposta válida para clarificação pendente', () => {
    const conversation = { ...core.createConversationContext(), lastIntent: core.INTENTS.FIND_PERSON, pending: { intent: core.INTENTS.FIND_PERSON }, expiresAt: Date.now() + 9000 };
    assert.equal(voice.evaluateConversationFollowUp([{ text: 'João Santos', confidence: 0.3 }], catalog, conversation, core.CONFIG).accepted, true);
    assert.equal(voice.evaluateConversationFollowUp([{ text: 'conversa aleatória', confidence: 0.8 }], catalog, conversation, core.CONFIG).accepted, false);
});

test('resposta de ambiguidade solicita desambiguação', () => {
    const parsed = core.interpretDeterministic('onde está João', catalog)[0];
    assert.match(voice.buildResponse(parsed, [], {}), /João Pereira.*João Santos/);
});

test('diagnóstico do ambiente preserva erros de microfone', () => {
    const complete = { secureContext: true, policyAllowed: true, mediaDevices: {}, getUserMedia() {}, Recognition() {} };
    assert.equal(voice.diagnoseVoiceEnvironment({ ...complete, secureContext: false }).code, 'insecure-context');
    assert.equal(voice.diagnoseVoiceEnvironment({ ...complete, Recognition: null }).code, 'speech-recognition-unavailable');
    assert.equal(voice.diagnoseVoiceEnvironment(complete).code, 'ready');
});
