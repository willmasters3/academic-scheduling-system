const sql = require('mssql');
const config = require('../../dbConfig');
const salasService = require('../salas/salasService');
const unidadesService = require('../unidades/unidadesService');
const agendamentosService = require('../agendamentos/agendamentosService');

const AUTHENTICATED_TOOL_CATALOG = Object.freeze({
    listar_minhas_unidades: {
        description: 'Lista exclusivamente as unidades permitidas pela sessão autenticada.',
        publicCapability: 'listar as unidades às quais o usuário autenticado possui acesso',
        allowedArguments: [],
        classifierExample: '{}',
        requiredArguments: []
    },
    listar_salas_visiveis: {
        description: 'Lista salas pertencentes às unidades permitidas pela sessão.',
        publicCapability: 'listar as salas visíveis nas unidades permitidas',
        allowedArguments: ['unidade'],
        classifierExample: '{"unidade":"nome ou código opcional"}',
        requiredArguments: []
    },
    listar_salas_disponiveis: {
        description: 'Lista salas disponíveis em unidade, data e intervalo autorizados.',
        publicCapability: 'consultar salas disponíveis por unidade, data e horário',
        allowedArguments: ['unidade', 'data', 'datas', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"nome ou código opcional","data":"AAAA-MM-DD","horaInicio":"HH:mm","horaFim":"HH:mm opcional"}',
        requiredArguments: ['data', 'horaInicio']
    },
    verificar_ocupacao_sala: {
        description: 'Verifica ocupação de uma sala autorizada em data e horário.',
        publicCapability: 'verificar se uma sala está livre ou ocupada e quem a utiliza no horário consultado',
        allowedArguments: ['unidade', 'sala', 'salas', 'data', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"opcional","sala":"nome ou salas como lista","data":"AAAA-MM-DD","horaInicio":"HH:mm","horaFim":"HH:mm opcional"}',
        requiredArguments: ['sala', 'data', 'horaInicio']
    },
    listar_meus_agendamentos: {
        description: 'Lista agendamentos do professor identificado exclusivamente pela sessão.',
        publicCapability: 'consultar os próprios agendamentos por data ou período',
        allowedArguments: ['dataInicio', 'dataFim'],
        classifierExample: '{"dataInicio":"AAAA-MM-DD opcional","dataFim":"AAAA-MM-DD opcional"}',
        requiredArguments: []
    },
    listar_agendamentos_sala_data: {
        description: 'Lista agendamentos de uma sala autorizada em uma data.',
        publicCapability: 'consultar os agendamentos de uma sala em determinada data',
        allowedArguments: ['unidade', 'sala', 'data', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"opcional","sala":"nome","data":"AAAA-MM-DD","horaInicio":"HH:mm opcional","horaFim":"HH:mm opcional"}',
        requiredArguments: ['sala', 'data']
    },
    localizar_agendamentos_professor: {
        description: 'Localiza agendamentos de professor somente nas unidades visíveis para a sessão autenticada.',
        publicCapability: 'localizar em qual sala um professor possui agendamento nas unidades permitidas',
        allowedArguments: ['unidade', 'professor', 'data', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"opcional","professor":"nome","data":"AAAA-MM-DD","horaInicio":"HH:mm opcional","horaFim":"HH:mm opcional"}',
        requiredArguments: ['professor', 'data']
    },
    consultar_informacoes_sala: {
        description: 'Consulta somente características públicas e operacionais de uma sala autorizada.',
        publicCapability: 'consultar cadeiras, quantidade declarada de computadores e recursos públicos de uma sala',
        allowedArguments: ['unidade', 'sala', 'salas', 'recurso'],
        classifierExample: '{"unidade":"opcional","sala":"nome ou salas como lista"}',
        requiredArguments: []
    }
});

const PUBLIC_TOOL_CATALOG = Object.freeze({
    listar_unidades_publicas: {
        description: 'Lista as unidades já expostas pela página pública do sistema.',
        publicCapability: 'listar unidades públicas do sistema',
        allowedArguments: [],
        classifierExample: '{}',
        requiredArguments: []
    },
    listar_salas_publicas: {
        description: 'Lista as salas públicas de uma unidade validada pelo backend.',
        publicCapability: 'listar salas públicas por unidade',
        allowedArguments: ['unidade'],
        classifierExample: '{"unidade":"nome ou código opcional"}',
        requiredArguments: []
    },
    listar_salas_disponiveis_publicas: {
        description: 'Consulta salas disponíveis usando salas e agendamentos já expostos publicamente.',
        publicCapability: 'consultar salas disponíveis por unidade, data e horário',
        allowedArguments: ['unidade', 'data', 'datas', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"nome ou código opcional","data":"AAAA-MM-DD","horaInicio":"HH:mm","horaFim":"HH:mm opcional"}',
        requiredArguments: ['data', 'horaInicio']
    },
    verificar_ocupacao_sala_publica: {
        description: 'Verifica a ocupação pública de uma sala em data e horário.',
        publicCapability: 'verificar ocupação pública de sala e o responsável exibido publicamente',
        allowedArguments: ['unidade', 'sala', 'salas', 'data', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"opcional","sala":"nome ou salas como lista","data":"AAAA-MM-DD","horaInicio":"HH:mm","horaFim":"HH:mm opcional"}',
        requiredArguments: ['sala', 'data', 'horaInicio']
    },
    listar_agendamentos_sala_data_publicos: {
        description: 'Lista os agendamentos públicos de uma sala em uma data.',
        publicCapability: 'consultar agendamentos públicos de uma sala por data',
        allowedArguments: ['unidade', 'sala', 'data', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"opcional","sala":"nome","data":"AAAA-MM-DD","horaInicio":"HH:mm opcional","horaFim":"HH:mm opcional"}',
        requiredArguments: ['sala', 'data']
    },
    localizar_agendamentos_professor_publico: {
        description: 'Localiza agendamentos públicos de um professor por nome, data e horário, sem expor dados cadastrais.',
        publicCapability: 'localizar em qual sala um professor possui agendamento público por data e horário',
        allowedArguments: ['unidade', 'professor', 'data', 'horaInicio', 'horaFim'],
        classifierExample: '{"unidade":"opcional","professor":"nome","data":"AAAA-MM-DD","horaInicio":"HH:mm opcional","horaFim":"HH:mm opcional"}',
        requiredArguments: ['professor', 'data']
    },
    consultar_informacoes_sala_publica: {
        description: 'Consulta somente os campos de sala já exibidos na página pública.',
        publicCapability: 'consultar características públicas de uma sala',
        allowedArguments: ['unidade', 'sala', 'salas', 'recurso'],
        classifierExample: '{"unidade":"opcional","sala":"nome ou salas como lista"}',
        requiredArguments: []
    }
});

const TOOL_CATALOG = Object.freeze({
    ...AUTHENTICATED_TOOL_CATALOG,
    ...PUBLIC_TOOL_CATALOG
});

const ALLOWED_TOOLS = new Set(Object.keys(TOOL_CATALOG));
const PUBLIC_TOOLS = new Set(Object.keys(PUBLIC_TOOL_CATALOG));
const AUTHENTICATED_TOOLS = new Set(Object.keys(AUTHENTICATED_TOOL_CATALOG));

const MAX_AGENDAMENTOS = 20;
const MAX_SALAS = 30;
const MAX_DIAS_PERIODO = 31;
const MAX_DATAS_DISPONIBILIDADE = 7;

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

function validationError(message, details = {}) {
    const error = new Error(message);
    error.isChatQueryValidation = true;
    error.publicMessage = message;
    Object.assign(error, details);
    return error;
}

function requireUser(req) {
    const user = req.session?.user;
    const idProfessor = Number(user?.id_professor);
    const unidades = Array.isArray(user?.unidades)
        ? Array.from(new Set(user.unidades.map((item) => String(item || '').trim()).filter(Boolean)))
        : [];

    if (!user || !Number.isInteger(idProfessor) || idProfessor <= 0) {
        throw validationError('Você precisa estar autenticado para realizar essa consulta.');
    }

    return { idProfessor, unidades };
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseIsoDate(value, label, argumentName = 'data') {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        throw validationError(`${label} deve ser informada no formato AAAA-MM-DD.`, { missingArgument: argumentName });
    }

    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw validationError(`${label} é inválida.`);
    }

    return { text, date };
}

function parseTime(value, label, required = true, argumentName = null) {
    const text = String(value || '').trim();
    if (!text && !required) return null;
    const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
        throw validationError(`${label} deve ser informado no formato HH:mm.`, text ? {} : { missingArgument: argumentName });
    }

    return {
        text,
        minutes: Number(match[1]) * 60 + Number(match[2])
    };
}

function addOneMinute(time) {
    const next = Math.min(time.minutes + 1, 24 * 60 - 1);
    return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
}

function validateTimeRange(horaInicio, horaFim, allowPoint = false) {
    const inicio = parseTime(horaInicio, 'O horário inicial', true, 'horaInicio');
    const fim = parseTime(horaFim, 'O horário final', allowPoint, 'horaFim');
    const finalText = fim ? fim.text : addOneMinute(inicio);
    const finalMinutes = fim ? fim.minutes : inicio.minutes + 1;

    if (finalMinutes <= inicio.minutes) {
        throw validationError('O horário final deve ser posterior ao horário inicial.');
    }

    return { horaInicio: inicio.text, horaFim: finalText };
}

function validatePeriod(dataInicioValue, dataFimValue) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const padraoFim = new Date(hoje);
    padraoFim.setDate(padraoFim.getDate() + 6);

    const inicio = dataInicioValue ? parseIsoDate(dataInicioValue, 'A data inicial') : { text: formatDateLocal(hoje), date: hoje };
    const fim = dataFimValue ? parseIsoDate(dataFimValue, 'A data final') : { text: formatDateLocal(padraoFim), date: padraoFim };

    const quantidadeDias = Math.floor((fim.date - inicio.date) / 86400000) + 1;
    if (quantidadeDias <= 0) {
        throw validationError('A data final deve ser igual ou posterior à data inicial.');
    }
    if (quantidadeDias > MAX_DIAS_PERIODO) {
        throw validationError(`Consulte um período de no máximo ${MAX_DIAS_PERIODO} dias.`);
    }

    return { dataInicio: inicio.text, dataFim: fim.text };
}

function validateArguments(tool, args) {
    if (!ALLOWED_TOOLS.has(tool)) {
        throw validationError('Essa consulta não é permitida pelo JEYSON.');
    }

    if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw validationError('Os parâmetros da consulta são inválidos.');
    }

    const allowed = new Set(TOOL_CATALOG[tool].allowedArguments);
    const extras = Object.keys(args).filter((key) => !allowed.has(key));
    if (extras.length) {
        throw validationError('A consulta contém parâmetros não permitidos.');
    }
}

function analyzeToolCall(toolCall) {
    const tool = String(toolCall?.tool || '').trim();
    const args = toolCall?.arguments && typeof toolCall.arguments === 'object' && !Array.isArray(toolCall.arguments)
        ? toolCall.arguments
        : {};
    validateArguments(tool, args);

    const missingArguments = (TOOL_CATALOG[tool].requiredArguments || []).filter((name) => {
        if (name === 'sala' && Array.isArray(args.salas) && args.salas.some((item) => String(item || '').trim())) {
            return false;
        }
        const value = args[name];
        return value === null || value === undefined || String(value).trim() === '';
    });

    return {
        sufficient: missingArguments.length === 0,
        missingArguments
    };
}

async function getVisibleRooms(req) {
    const result = await salasService.listarSalasDoUsuario(req);
    if (result.error) {
        throw validationError(result.error);
    }

    return Array.isArray(result.data) ? result.data : [];
}

async function getPublicUnits() {
    const units = await unidadesService.listarUnidadesPublicas();
    return (Array.isArray(units) ? units : []).map((unit) => ({
        codigo: String(unit.codigo || ''),
        nome: String(unit.nome || unit.codigo || '')
    })).filter((unit) => unit.codigo && unit.nome);
}

function resolvePublicUnit(units, selector, requireWhenMultiple = true) {
    const roomsShape = units.map((unit) => ({
        codigo_unidade: unit.codigo,
        nome_unidade: unit.nome
    }));
    return resolveUnit(roomsShape, selector, requireWhenMultiple);
}

async function getPublicRooms(req, unit) {
    const result = await salasService.getSalasByCodigoUnidade(req, unit.codigo);
    if (result.error) throw validationError(result.error);
    return (Array.isArray(result.data) ? result.data : []).map((room) => ({
        id_sala: Number(room.id_sala),
        nome_sala: String(room.nome_sala || ''),
        codigo_unidade: String(room.codigo_unidade || unit.codigo),
        nome_unidade: String(room.nome_unidade || unit.nome)
    })).filter((room) => Number.isInteger(room.id_sala) && room.nome_sala);
}

function resolveUnit(rooms, selector, requireWhenMultiple = true) {
    const units = Array.from(new Map(rooms.map((room) => [String(room.codigo_unidade), {
        codigo: String(room.codigo_unidade),
        nome: String(room.nome_unidade || room.codigo_unidade)
    }])).values());

    if (!units.length) {
        throw validationError('Não encontrei unidades com salas vinculadas ao seu usuário.');
    }

    const normalizedSelector = normalizeText(selector);
    if (!normalizedSelector) {
        if (units.length === 1 || !requireWhenMultiple) return units[0];
        throw validationError(
            'Qual unidade você deseja consultar?',
            { missingArgument: 'unidade', unitOptions: units }
        );
    }

    const selectorTokens = normalizedSelector.split(/\s+/).filter(Boolean);
    const significantTokens = selectorTokens.filter((token) => !['demo', 'unidade', 'escola'].includes(token));
    const unitDetails = units.map((unit) => {
        const code = normalizeText(unit.codigo);
        const name = normalizeText(unit.nome);
        const nameTokens = new Set(name.split(/\s+/).filter(Boolean));
        const allTokensMatch = significantTokens.length > 0
            && significantTokens.every((token) => nameTokens.has(token) || code === token);
        let score = 0;
        if (code === normalizedSelector) score = 4;
        else if (name === normalizedSelector) score = 3;
        else if (name.includes(normalizedSelector)) score = 2;
        else if (allTokensMatch) score = 1;
        return { unit, score };
    });
    const bestScore = Math.max(0, ...unitDetails.map((item) => item.score));
    const matches = bestScore > 0
        ? unitDetails.filter((item) => item.score === bestScore).map((item) => item.unit)
        : [];

    if (matches.length !== 1) {
        throw validationError(
            matches.length
                ? `Encontrei mais de uma unidade correspondente a "${String(selector).trim()}". Qual deseja consultar?`
                : `Não encontrei "${String(selector).trim()}" entre as unidades disponíveis para esta consulta. Qual unidade você deseja consultar?`,
            { missingArgument: 'unidade', unitOptions: matches.length ? matches : units }
        );
    }

    return matches[0];
}

function resolveRoom(rooms, roomSelector, unitSelector) {
    if (!normalizeText(roomSelector)) {
        throw validationError('Informe qual sala deseja consultar.', { missingArgument: 'sala' });
    }

    let candidates = rooms;
    if (normalizeText(unitSelector)) {
        const unit = resolveUnit(rooms, unitSelector);
        candidates = rooms.filter((room) => String(room.codigo_unidade) === unit.codigo);
    }

    const selector = normalizeText(roomSelector).replace(/^sala\s+/, '');
    const exact = candidates.filter((room) => normalizeText(room.nome_sala).replace(/^sala\s+/, '') === selector);
    const matches = exact.length ? exact : candidates.filter((room) => normalizeText(room.nome_sala).includes(selector));

    if (matches.length !== 1) {
        throw validationError(matches.length
            ? `Encontrei mais de uma sala correspondente. Informe a unidade ou o nome completo: ${matches.slice(0, 5).map((room) => `${room.nome_sala} (${room.nome_unidade})`).join('; ')}.`
            : 'Não encontrei essa sala entre as unidades permitidas para sua sessão.',
        { missingArgument: matches.length ? 'unidade' : 'sala' });
    }

    return matches[0];
}

function timeValueToMinutes(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.getUTCHours() * 60 + value.getUTCMinutes();
    }
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function appointmentOverlaps(item, range) {
    const start = timeValueToMinutes(item.hora_inicio);
    const end = timeValueToMinutes(item.hora_fim);
    const queryStart = timeValueToMinutes(range.horaInicio);
    const queryEnd = timeValueToMinutes(range.horaFim);
    return start !== null && end !== null && queryStart !== null && queryEnd !== null
        && start < queryEnd && end > queryStart;
}

function publicDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : String(value || '');
}

function publicTimeValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
    }
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(value || '');
}

function mapPublicAppointment(item, roomName = null) {
    return {
        sala: roomName || item.nome_sala,
        data: publicDateValue(item.data_reservas),
        horaInicio: publicTimeValue(item.hora_inicio),
        horaFim: publicTimeValue(item.hora_fim),
        professor: item.nome,
        tipoAtividade: item.tipo_aula || null,
        motivo: item.motivo || null
    };
}

async function getPublicQueryContext(req, unitSelector) {
    const units = await getPublicUnits();
    const unit = resolvePublicUnit(units, unitSelector);
    const rooms = await getPublicRooms(req, unit);
    return { unit, rooms };
}

async function listarUnidadesPublicas() {
    const units = await getPublicUnits();
    return {
        unidades: units.slice(0, MAX_SALAS),
        total: units.length,
        limitado: units.length > MAX_SALAS
    };
}

async function listarSalasPublicas(req, args) {
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    return {
        unidade: unit,
        salas: rooms.slice(0, MAX_SALAS).map((room) => ({
            sala: room.nome_sala,
            unidade: room.nome_unidade,
            codigoUnidade: room.codigo_unidade
        })),
        total: rooms.length,
        limitado: rooms.length > MAX_SALAS
    };
}

async function getPublicAppointments(unit, date, room = '') {
    const appointments = await agendamentosService.listarAgendamentosFiltrados({
        unidadeCodigo: unit.codigo,
        professor: '',
        dataInicio: date,
        dataFim: date,
        sala: room
    });
    return Array.isArray(appointments) ? appointments : [];
}

async function listarSalasDisponiveisPublicas(req, args) {
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    const rawDates = Array.isArray(args.datas) ? args.datas : [args.data];
    const dates = Array.from(new Set(rawDates.filter(Boolean).map((value) => parseIsoDate(value, 'A data').text)));
    if (!dates.length) throw validationError('Informe a data que deseja consultar.', { missingArgument: 'data' });
    if (dates.length > MAX_DATAS_DISPONIBILIDADE) {
        throw validationError(`Consulte no máximo ${MAX_DATAS_DISPONIBILIDADE} datas por vez.`);
    }
    const range = validateTimeRange(args.horaInicio, args.horaFim);
    const appointmentsByDate = new Map();
    for (const date of dates) {
        appointmentsByDate.set(date, await getPublicAppointments(unit, date));
    }
    const available = rooms.map((room) => {
        const availableDates = dates.filter((date) => !(appointmentsByDate.get(date) || []).some((item) => (
            normalizeText(item.nome_sala) === normalizeText(room.nome_sala) && appointmentOverlaps(item, range)
        )));
        return { room, availableDates };
    }).filter((item) => item.availableDates.length === dates.length);

    return {
        unidade: { nome: unit.nome, codigo: unit.codigo },
        datas: dates,
        horaInicio: range.horaInicio,
        horaFim: range.horaFim,
        salas: available.slice(0, MAX_SALAS).map((item) => ({
            sala: item.room.nome_sala,
            datasDisponiveis: item.availableDates
        })),
        total: available.length,
        limitado: available.length > MAX_SALAS
    };
}

async function verificarOcupacaoSalaPublica(req, args) {
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    const room = resolveRoom(rooms, args.sala, unit.codigo);
    const date = parseIsoDate(args.data, 'A data').text;
    const range = validateTimeRange(args.horaInicio, args.horaFim, false);
    const appointments = (await getPublicAppointments(unit, date, room.nome_sala))
        .filter((item) => normalizeText(item.nome_sala) === normalizeText(room.nome_sala) && appointmentOverlaps(item, range));
    const items = appointments.slice(0, MAX_AGENDAMENTOS).map((item) => mapPublicAppointment(item, room.nome_sala));
    return {
        sala: room.nome_sala,
        unidade: room.nome_unidade,
        data: date,
        horaInicioConsultada: range.horaInicio,
        horaFimConsultada: range.horaFim,
        ocupada: items.length > 0,
        ocupacoes: items,
        limitado: appointments.length > MAX_AGENDAMENTOS
    };
}

async function verificarOcupacaoSalasPublicas(req, args) {
    const selectors = Array.from(new Set((args.salas || []).map((item) => String(item || '').trim()).filter(Boolean)));
    if (!selectors.length) return verificarOcupacaoSalaPublica(req, args);
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    const date = parseIsoDate(args.data, 'A data').text;
    const range = validateTimeRange(args.horaInicio, args.horaFim, false);
    const appointments = await getPublicAppointments(unit, date);
    const consultas = selectors.slice(0, MAX_SALAS).map((selector) => {
        try {
            const room = resolveRoom(rooms, selector, unit.codigo);
            const matches = appointments.filter((item) => normalizeText(item.nome_sala) === normalizeText(room.nome_sala) && appointmentOverlaps(item, range));
            return {
                solicitada: selector,
                encontrada: true,
                sala: room.nome_sala,
                unidade: room.nome_unidade,
                ocupacoes: matches.slice(0, MAX_AGENDAMENTOS).map((item) => mapPublicAppointment(item, room.nome_sala)),
                limitado: matches.length > MAX_AGENDAMENTOS
            };
        } catch (error) {
            if (!error?.isChatQueryValidation) throw error;
            return { solicitada: selector, encontrada: false, mensagem: `Não encontrei a sala ${selector} nessa unidade.` };
        }
    });
    return {
        unidade: unit.nome,
        codigoUnidade: unit.codigo,
        data: date,
        horaInicioConsultada: range.horaInicio,
        horaFimConsultada: range.horaFim,
        consultasSalas: consultas,
        limitado: selectors.length > MAX_SALAS
    };
}

async function listarAgendamentosSalaDataPublicos(req, args) {
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    const room = resolveRoom(rooms, args.sala, unit.codigo);
    const date = parseIsoDate(args.data, 'A data').text;
    const hasTime = Boolean(args.horaInicio || args.horaFim);
    const range = hasTime ? validateTimeRange(args.horaInicio, args.horaFim, false) : null;
    const appointments = (await getPublicAppointments(unit, date, room.nome_sala)).filter((item) => (
        normalizeText(item.nome_sala) === normalizeText(room.nome_sala) && (!range || appointmentOverlaps(item, range))
    ));
    return {
        sala: room.nome_sala,
        unidade: room.nome_unidade,
        data: date,
        agendamentos: appointments.slice(0, MAX_AGENDAMENTOS).map((item) => mapPublicAppointment(item, room.nome_sala)),
        totalExibido: Math.min(appointments.length, MAX_AGENDAMENTOS),
        limitado: appointments.length > MAX_AGENDAMENTOS
    };
}

async function localizarAgendamentosProfessorEmUnidades(units, args) {
    const selectedUnits = normalizeText(args.unidade)
        ? [resolvePublicUnit(units, args.unidade)]
        : units;
    const professorSelector = String(args.professor || '').trim();
    if (!normalizeText(professorSelector)) {
        throw validationError('Informe o nome do professor que deseja localizar.', { missingArgument: 'professor' });
    }
    const date = parseIsoDate(args.data, 'A data').text;
    const hasTime = Boolean(args.horaInicio || args.horaFim);
    const range = hasTime ? validateTimeRange(args.horaInicio, args.horaFim, true) : null;
    const occurrences = [];

    for (const unit of selectedUnits) {
        const appointments = await agendamentosService.listarAgendamentosFiltrados({
            unidadeCodigo: unit.codigo,
            professor: professorSelector,
            dataInicio: date,
            dataFim: date,
            sala: ''
        });
        (Array.isArray(appointments) ? appointments : []).forEach((item) => {
            if (range && !appointmentOverlaps(item, range)) return;
            occurrences.push({ item, unit });
        });
    }

    const normalizedSelector = normalizeText(professorSelector);
    const names = Array.from(new Map(occurrences.map(({ item }) => [normalizeText(item.nome), String(item.nome || '').trim()])).values());
    const exactNames = names.filter((name) => normalizeText(name) === normalizedSelector);
    const matchedNames = exactNames.length ? exactNames : names;
    if (matchedNames.length > 1) {
        throw validationError(
            `Encontrei mais de um professor correspondente a "${professorSelector}". Qual deles você procura?`,
            { missingArgument: 'professor', professorOptions: matchedNames.slice(0, MAX_AGENDAMENTOS) }
        );
    }

    const resolvedProfessor = matchedNames[0] || professorSelector;
    const filtered = matchedNames.length
        ? occurrences.filter(({ item }) => normalizeText(item.nome) === normalizeText(resolvedProfessor))
        : [];
    return {
        professor: resolvedProfessor,
        data: date,
        horaInicioConsultada: range?.horaInicio || null,
        horaFimConsultada: range?.horaFim || null,
        agendamentos: filtered.slice(0, MAX_AGENDAMENTOS).map(({ item, unit }) => ({
            professor: String(item.nome || ''),
            sala: String(item.nome_sala || ''),
            unidade: unit.nome,
            codigoUnidade: unit.codigo,
            data: publicDateValue(item.data_reservas),
            horaInicio: publicTimeValue(item.hora_inicio),
            horaFim: publicTimeValue(item.hora_fim),
            tipoAtividade: item.tipo_aula || null,
            motivo: item.motivo || null
        })),
        totalExibido: Math.min(filtered.length, MAX_AGENDAMENTOS),
        limitado: filtered.length > MAX_AGENDAMENTOS
    };
}

async function localizarAgendamentosProfessorPublico(args) {
    return localizarAgendamentosProfessorEmUnidades(await getPublicUnits(), args);
}

async function localizarAgendamentosProfessor(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const units = Array.from(new Map(rooms.map((room) => [String(room.codigo_unidade), {
        codigo: String(room.codigo_unidade),
        nome: String(room.nome_unidade || room.codigo_unidade)
    }])).values());
    return localizarAgendamentosProfessorEmUnidades(units, args);
}

async function consultarInformacoesSalaPublica(req, args) {
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    const room = resolveRoom(rooms, args.sala, unit.codigo);
    const result = await salasService.getSalaById(req, room.id_sala);
    if (result.error || !result.data) throw validationError(result.error || 'Não encontrei informações públicas para essa sala.');
    const item = result.data;
    return {
        sala: item.nome_sala,
        unidade: room.nome_unidade,
        codigoUnidade: item.codigo_unidade,
        cadeiras: item.cadeiras ?? null,
        computadoresDeclarados: item.computadores ?? null,
        quadroBranco: item.quadro_branco ?? null,
        telaProjetor: item.tela_projetor ?? null,
        tv: item.tv ?? null,
        area: item.area ?? null,
        projetor: item.projetor ?? null,
        maquinario: item.maquinario ?? null,
        recurso: args.recurso || null
    };
}

async function consultarInformacoesSalasPublicas(req, args) {
    const { unit, rooms } = await getPublicQueryContext(req, args.unidade);
    const requested = Array.isArray(args.salas) && args.salas.length ? args.salas : rooms.map((room) => room.nome_sala);
    const selectors = Array.from(new Set(requested.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, MAX_SALAS);
    const consultas = [];
    for (const selector of selectors) {
        try {
            const room = resolveRoom(rooms, selector, unit.codigo);
            const result = await salasService.getSalaById(req, room.id_sala);
            if (result.error || !result.data) throw validationError(result.error || 'Não encontrei informações públicas para essa sala.');
            const item = result.data;
            consultas.push({
                solicitada: selector,
                encontrada: true,
                sala: item.nome_sala,
                unidade: room.nome_unidade,
                codigoUnidade: item.codigo_unidade,
                computadoresDeclarados: item.computadores ?? null,
                projetor: item.projetor ?? null,
                cadeiras: item.cadeiras ?? null,
                tv: item.tv ?? null,
                quadroBranco: item.quadro_branco ?? null,
                telaProjetor: item.tela_projetor ?? null,
                area: item.area ?? null,
                maquinario: item.maquinario ?? null
            });
        } catch (error) {
            if (!error?.isChatQueryValidation) throw error;
            consultas.push({ solicitada: selector, encontrada: false, mensagem: `Não encontrei a sala ${selector} nessa unidade.` });
        }
    }
    return { unidade: unit.nome, codigoUnidade: unit.codigo, recurso: args.recurso || null, consultasSalas: consultas };
}

async function listarMinhasUnidades(req) {
    const { unidades } = requireUser(req);
    return {
        unidades: unidades.slice(0, MAX_SALAS),
        total: unidades.length,
        limitado: unidades.length > MAX_SALAS
    };
}

async function listarSalasVisiveis(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    let filtered = rooms;

    if (normalizeText(args.unidade)) {
        const unit = resolveUnit(rooms, args.unidade);
        filtered = rooms.filter((room) => String(room.codigo_unidade) === unit.codigo);
    } else {
        const distinctUnits = new Set(rooms.map((room) => String(room.codigo_unidade)));
        if (distinctUnits.size > 1) {
            resolveUnit(rooms, null);
        }
    }

    return {
        salas: filtered.slice(0, MAX_SALAS).map((room) => ({
            sala: room.nome_sala,
            unidade: room.nome_unidade,
            codigoUnidade: room.codigo_unidade
        })),
        total: filtered.length,
        limitado: filtered.length > MAX_SALAS
    };
}

async function listarSalasDisponiveis(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const unit = resolveUnit(rooms, args.unidade);
    const rawDates = Array.isArray(args.datas) ? args.datas : [args.data];
    const dates = Array.from(new Set(rawDates.filter(Boolean).map((value) => parseIsoDate(value, 'A data').text)));
    if (!dates.length) throw validationError('Informe a data que deseja consultar.', { missingArgument: 'data' });
    if (dates.length > MAX_DATAS_DISPONIBILIDADE) {
        throw validationError(`Consulte no máximo ${MAX_DATAS_DISPONIBILIDADE} datas por vez.`);
    }
    const range = validateTimeRange(args.horaInicio, args.horaFim);

    const result = await salasService.listarSalasDisponiveis(
        req,
        dates.join(','),
        range.horaInicio,
        range.horaFim,
        unit.codigo
    );
    if (result.error) throw validationError(result.error);

    const salas = Array.isArray(result.data?.salasDisponiveis) ? result.data.salasDisponiveis : [];
    return {
        unidade: { nome: unit.nome, codigo: unit.codigo },
        datas: dates,
        horaInicio: range.horaInicio,
        horaFim: range.horaFim,
        salas: salas.slice(0, MAX_SALAS).map((room) => ({
            sala: room.nome_sala,
            datasDisponiveis: Array.isArray(room.datas_disponiveis) ? room.datas_disponiveis : []
        })),
        total: salas.length,
        limitado: salas.length > MAX_SALAS
    };
}

async function verificarOcupacaoSala(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const room = resolveRoom(rooms, args.sala, args.unidade);
    const date = parseIsoDate(args.data, 'A data').text;
    const range = validateTimeRange(args.horaInicio, args.horaFim, true);
    const pool = await getPool();
    const result = await pool.request()
        .input('idSala', sql.Int, room.id_sala)
        .input('data', sql.NVarChar, date)
        .input('horaInicio', sql.NVarChar, range.horaInicio)
        .input('horaFim', sql.NVarChar, range.horaFim)
        .query(`
            SELECT TOP 21
                CONVERT(varchar(10), a.data_reservas, 23) AS data,
                CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
                p.nome AS professor
            FROM agendamentos a
            INNER JOIN professores p ON p.id_professor = a.id_professor
            WHERE a.id_sala = @idSala
              AND a.data_reservas = @data
              AND CAST(a.hora_inicio AS time) < CAST(@horaFim AS time)
              AND CAST(a.hora_fim AS time) > CAST(@horaInicio AS time)
            ORDER BY a.hora_inicio
        `);

    const items = result.recordset.slice(0, MAX_AGENDAMENTOS).map((item) => ({
        sala: room.nome_sala,
        data: item.data,
        horaInicio: item.hora_inicio,
        horaFim: item.hora_fim,
        professor: item.professor
    }));

    return {
        sala: room.nome_sala,
        unidade: room.nome_unidade,
        data: date,
        horaInicioConsultada: range.horaInicio,
        horaFimConsultada: range.horaFim,
        ocupada: items.length > 0,
        ocupacoes: items,
        limitado: result.recordset.length > MAX_AGENDAMENTOS
    };
}

async function verificarOcupacaoSalas(req, args) {
    const selectors = Array.from(new Set((args.salas || []).map((item) => String(item || '').trim()).filter(Boolean)));
    if (!selectors.length) return verificarOcupacaoSala(req, args);
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const unit = resolveUnit(rooms, args.unidade);
    const date = parseIsoDate(args.data, 'A data').text;
    const range = validateTimeRange(args.horaInicio, args.horaFim, true);
    const consultas = [];
    for (const selector of selectors.slice(0, MAX_SALAS)) {
        try {
            const room = resolveRoom(rooms, selector, unit.codigo);
            const result = await verificarOcupacaoSala(req, { ...args, unidade: unit.codigo, sala: room.nome_sala, salas: undefined });
            consultas.push({ solicitada: selector, encontrada: true, sala: result.sala, unidade: result.unidade, ocupacoes: result.ocupacoes, limitado: result.limitado });
        } catch (error) {
            if (!error?.isChatQueryValidation) throw error;
            consultas.push({ solicitada: selector, encontrada: false, mensagem: `Não encontrei a sala ${selector} nessa unidade.` });
        }
    }
    return {
        unidade: unit.nome,
        codigoUnidade: unit.codigo,
        data: date,
        horaInicioConsultada: range.horaInicio,
        horaFimConsultada: range.horaFim,
        consultasSalas: consultas,
        limitado: selectors.length > MAX_SALAS
    };
}

async function listarMeusAgendamentos(req, args) {
    const { idProfessor } = requireUser(req);
    const period = validatePeriod(args.dataInicio, args.dataFim);
    const pool = await getPool();
    const result = await pool.request()
        .input('idProfessor', sql.Int, idProfessor)
        .input('dataInicio', sql.NVarChar, period.dataInicio)
        .input('dataFim', sql.NVarChar, period.dataFim)
        .query(`
            SELECT TOP 21
                CONVERT(varchar(10), a.data_reservas, 23) AS data,
                CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
                s.nome_sala,
                a.tipo_aula
            FROM agendamentos a
            INNER JOIN Salas s ON s.id_sala = a.id_sala
            WHERE a.id_professor = @idProfessor
              AND a.data_reservas BETWEEN @dataInicio AND @dataFim
            ORDER BY a.data_reservas, a.hora_inicio
        `);

    return {
        dataInicio: period.dataInicio,
        dataFim: period.dataFim,
        agendamentos: result.recordset.slice(0, MAX_AGENDAMENTOS).map((item) => ({
            data: item.data,
            horaInicio: item.hora_inicio,
            horaFim: item.hora_fim,
            sala: item.nome_sala,
            tipoAtividade: item.tipo_aula || null
        })),
        totalExibido: Math.min(result.recordset.length, MAX_AGENDAMENTOS),
        limitado: result.recordset.length > MAX_AGENDAMENTOS
    };
}

async function listarAgendamentosSalaData(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const room = resolveRoom(rooms, args.sala, args.unidade);
    const date = parseIsoDate(args.data, 'A data').text;
    const hasTime = Boolean(args.horaInicio || args.horaFim);
    const range = hasTime ? validateTimeRange(args.horaInicio, args.horaFim, true) : null;
    const pool = await getPool();
    const request = pool.request()
        .input('idSala', sql.Int, room.id_sala)
        .input('data', sql.NVarChar, date);
    let timeFilter = '';
    if (range) {
        request.input('horaInicio', sql.NVarChar, range.horaInicio);
        request.input('horaFim', sql.NVarChar, range.horaFim);
        timeFilter = `
              AND CAST(a.hora_inicio AS time) < CAST(@horaFim AS time)
              AND CAST(a.hora_fim AS time) > CAST(@horaInicio AS time)`;
    }

    const result = await request.query(`
        SELECT TOP 21
            CONVERT(varchar(10), a.data_reservas, 23) AS data,
            CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
            CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
            p.nome AS professor,
            a.tipo_aula
        FROM agendamentos a
        INNER JOIN professores p ON p.id_professor = a.id_professor
        WHERE a.id_sala = @idSala
          AND a.data_reservas = @data${timeFilter}
        ORDER BY a.hora_inicio
    `);

    return {
        sala: room.nome_sala,
        unidade: room.nome_unidade,
        data: date,
        agendamentos: result.recordset.slice(0, MAX_AGENDAMENTOS).map((item) => ({
            sala: room.nome_sala,
            data: item.data,
            horaInicio: item.hora_inicio,
            horaFim: item.hora_fim,
            professor: item.professor,
            tipoAtividade: item.tipo_aula || null
        })),
        totalExibido: Math.min(result.recordset.length, MAX_AGENDAMENTOS),
        limitado: result.recordset.length > MAX_AGENDAMENTOS
    };
}

async function consultarInformacoesSala(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const room = resolveRoom(rooms, args.sala, args.unidade);
    const result = await salasService.getSalaById(req, room.id_sala);
    if (result.error || !result.data) {
        throw validationError('Não encontrei informações públicas para essa sala.', { missingArgument: 'sala' });
    }
    const item = result.data;
    return {
        sala: item.nome_sala,
        unidade: room.nome_unidade,
        codigoUnidade: item.codigo_unidade,
        cadeiras: item.cadeiras ?? null,
        computadoresDeclarados: item.computadores ?? null,
        quadroBranco: item.quadro_branco ?? null,
        telaProjetor: item.tela_projetor ?? null,
        tv: item.tv ?? null,
        area: item.area ?? null,
        projetor: item.projetor ?? null,
        maquinario: item.maquinario ?? null,
        recurso: args.recurso || null
    };
}

async function consultarInformacoesSalas(req, args) {
    requireUser(req);
    const rooms = await getVisibleRooms(req);
    const unit = resolveUnit(rooms, args.unidade);
    const unitRooms = rooms.filter((room) => String(room.codigo_unidade) === unit.codigo);
    const requested = Array.isArray(args.salas) && args.salas.length ? args.salas : unitRooms.map((room) => room.nome_sala);
    const selectors = Array.from(new Set(requested.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, MAX_SALAS);
    const consultas = [];
    for (const selector of selectors) {
        try {
            const room = resolveRoom(rooms, selector, unit.codigo);
            const result = await salasService.getSalaById(req, room.id_sala);
            const item = result.data;
            if (result.error || !item) throw validationError(result.error || 'Não encontrei informações públicas para essa sala.');
            consultas.push({ solicitada: selector, encontrada: true, sala: item.nome_sala, unidade: room.nome_unidade, codigoUnidade: item.codigo_unidade, computadoresDeclarados: item.computadores ?? null, projetor: item.projetor ?? null, cadeiras: item.cadeiras ?? null, tv: item.tv ?? null, quadroBranco: item.quadro_branco ?? null, telaProjetor: item.tela_projetor ?? null, area: item.area ?? null, maquinario: item.maquinario ?? null });
        } catch (error) {
            if (!error?.isChatQueryValidation) throw error;
            consultas.push({ solicitada: selector, encontrada: false, mensagem: `Não encontrei a sala ${selector} nessa unidade.` });
        }
    }
    return { unidade: unit.nome, codigoUnidade: unit.codigo, recurso: args.recurso || null, consultasSalas: consultas };
}

function isAllowedTool(tool) {
    return ALLOWED_TOOLS.has(tool);
}

function isToolAllowedForRequest(req, tool) {
    return req.session?.user
        ? AUTHENTICATED_TOOLS.has(tool)
        : PUBLIC_TOOLS.has(tool);
}

async function executeTool(req, toolCall) {
    const tool = String(toolCall?.tool || '').trim();
    const args = toolCall?.arguments || {};
    validateArguments(tool, args);
    if (!isToolAllowedForRequest(req, tool)) {
        throw validationError('Você precisa estar autenticado para realizar essa consulta.');
    }
    if (AUTHENTICATED_TOOLS.has(tool)) requireUser(req);

    let data;
    switch (tool) {
        case 'listar_unidades_publicas': data = await listarUnidadesPublicas(); break;
        case 'listar_salas_publicas': data = await listarSalasPublicas(req, args); break;
        case 'listar_salas_disponiveis_publicas': data = await listarSalasDisponiveisPublicas(req, args); break;
        case 'verificar_ocupacao_sala_publica': data = Array.isArray(args.salas) ? await verificarOcupacaoSalasPublicas(req, args) : await verificarOcupacaoSalaPublica(req, args); break;
        case 'listar_agendamentos_sala_data_publicos': data = await listarAgendamentosSalaDataPublicos(req, args); break;
        case 'localizar_agendamentos_professor_publico': data = await localizarAgendamentosProfessorPublico(args); break;
        case 'consultar_informacoes_sala_publica': data = Array.isArray(args.salas) || !args.sala ? await consultarInformacoesSalasPublicas(req, args) : await consultarInformacoesSalaPublica(req, args); break;
        case 'listar_minhas_unidades': data = await listarMinhasUnidades(req); break;
        case 'listar_salas_visiveis': data = await listarSalasVisiveis(req, args); break;
        case 'listar_salas_disponiveis': data = await listarSalasDisponiveis(req, args); break;
        case 'verificar_ocupacao_sala': data = Array.isArray(args.salas) ? await verificarOcupacaoSalas(req, args) : await verificarOcupacaoSala(req, args); break;
        case 'listar_meus_agendamentos': data = await listarMeusAgendamentos(req, args); break;
        case 'listar_agendamentos_sala_data': data = await listarAgendamentosSalaData(req, args); break;
        case 'localizar_agendamentos_professor': data = await localizarAgendamentosProfessor(req, args); break;
        case 'consultar_informacoes_sala': data = Array.isArray(args.salas) || !args.sala ? await consultarInformacoesSalas(req, args) : await consultarInformacoesSala(req, args); break;
        default: throw validationError('Essa consulta não é permitida pelo JEYSON.');
    }

    return { ferramenta: tool, resultado: data };
}

module.exports = {
    executeTool,
    analyzeToolCall,
    isAllowedTool,
    isToolAllowedForRequest,
    TOOL_CATALOG,
    PUBLIC_TOOL_CATALOG,
    AUTHENTICATED_TOOL_CATALOG,
    ALLOWED_TOOLS: Array.from(ALLOWED_TOOLS),
    MAX_AGENDAMENTOS,
    MAX_SALAS,
    MAX_DIAS_PERIODO,
    MAX_DATAS_DISPONIBILIDADE
};
