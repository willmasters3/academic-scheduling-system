const sql = require('mssql');
const crypto = require('crypto');
const { DateTime } = require('luxon');
const config = require('../../dbConfig');
const { agruparAvisosProfessorPorData, criarTokenAvisosProfessor } = require('./professorWarningHelper');
const auditoriaAgendamentos = require('../agendamentoAuditoria/agendamentoAuditoriaService');

let poolPromise = null;

// ──────────────────────────────────────────────────────────────
// Validações de Segurança
// ──────────────────────────────────────────────────────────────

/**
 * Valida horário de início e fim
 * Requisitos: hora_inicio < hora_fim, duração entre 1 e 480 minutos (8h)
 */
function validateScheduleTime(horaInicio, horaFim) {
    const inicioSegundos = timeToSeconds(horaInicio);
    const fimSegundos = timeToSeconds(horaFim);

    if (inicioSegundos >= fimSegundos) {
        throw { status: 400, message: 'Hora de início deve ser menor que hora de fim.' };
    }

    const duracaoMinutos = (fimSegundos - inicioSegundos) / 60;
    if (duracaoMinutos < 30) {
        throw { status: 400, message: 'Duração mínima do agendamento é 30 minutos.' };
    }
    if (duracaoMinutos > 480) {
        throw { status: 400, message: 'Duração máxima do agendamento é 8 horas.' };
    }

    return true;
}

/**
 * Valida se data não é no passado
 */
function validateFutureDate(data, horaInicio) {
    if (isPastCalendarDay(data)) {
        throw { status: 400, message: 'Não é permitido agendar em datas passadas.' };
    }
    const agoraSaoPaulo = DateTime.now().setZone('America/Sao_Paulo');
    const inicioAgendamento = DateTime.fromISO(`${data}T${normalizeStoredTime(horaInicio)}`, {
        zone: 'America/Sao_Paulo'
    });

    if (inicioAgendamento.isValid && inicioAgendamento <= agoraSaoPaulo) {
        throw { status: 400, message: 'Não é permitido agendar em horários que já passaram.' };
    }
    return true;
}

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

// ──────────────────────────────────────────────────────────────
// Helpers de tempo e turnos
// ──────────────────────────────────────────────────────────────

const SWAP_TURNOS = [
    { key: 'manha', label: 'Manhã', start: '06:00:00', end: '12:59:59' },
    { key: 'tarde', label: 'Tarde', start: '13:00:00', end: '17:15:59' },
    { key: 'noite', label: 'Noite', start: '17:16:00', end: '23:59:59' }
];

function isPastCalendarDay(dateValue) {
    const data = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(data.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return data < hoje;
}

function normalizeStoredTime(value) {
    const text = String(value || '').trim();
    if (!text) return '00:00:00';
    if (/^\d{2}:\d{2}$/.test(text)) return `${text}:00`;
    if (/^\d{2}:\d{2}:\d{2}$/.test(text)) return text;
    return text.slice(0, 8);
}

function timeToSeconds(value) {
    const [hours, minutes, seconds] = normalizeStoredTime(value).split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + (seconds || 0);
}

function getTurnosDoAgendamento(horaInicio, horaFim) {
    const inicioSegundos = timeToSeconds(horaInicio);
    const fimSegundos = timeToSeconds(horaFim);
    return SWAP_TURNOS.filter((turno) => {
        const turnoInicio = timeToSeconds(turno.start);
        const turnoFim = timeToSeconds(turno.end);
        return inicioSegundos <= turnoFim && fimSegundos >= turnoInicio;
    });
}

function getTurnosCompativeis(agendamentoOrigem, agendamentoDestino) {
    if (agendamentoOrigem.data_reservas !== agendamentoDestino.data_reservas) return [];
    const turnosOrigem = getTurnosDoAgendamento(agendamentoOrigem.hora_inicio, agendamentoOrigem.hora_fim);
    const turnosDestino = getTurnosDoAgendamento(agendamentoDestino.hora_inicio, agendamentoDestino.hora_fim);
    const turnosDestinoMap = new Map(turnosDestino.map((t) => [t.key, t]));
    return turnosOrigem.filter((t) => turnosDestinoMap.has(t.key));
}

async function removerSolicitacoesTrocaPorAgendamento(request, idAgendamento) {
    await request
        .input('idAgendamentoTroca', sql.Int, idAgendamento)
        .query(`
            IF OBJECT_ID('dbo.solicitacoes_troca_sala', 'U') IS NOT NULL
            BEGIN
                DELETE FROM dbo.solicitacoes_troca_sala
                WHERE id_agendamento_origem = @idAgendamentoTroca
                   OR id_agendamento_destino = @idAgendamentoTroca
            END
        `);
}

function criarIdCorrelacaoAuditoria() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizarDataAuditoria(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    return text || null;
}

function mapAgendamentoAuditoria(row) {
    if (!row) return null;
    return {
        id_agendamento: row.id_agendamento,
        id_sala: row.id_sala,
        nome_sala: row.nome_sala || null,
        codigo_unidade: row.codigo_unidade || null,
        nome_unidade: row.nome_unidade || null,
        id_professor: row.id_professor,
        nome_professor: row.nome_professor || null,
        data_reservas: normalizarDataAuditoria(row.data_reservas),
        hora_inicio: row.hora_inicio ? normalizeStoredTime(row.hora_inicio) : null,
        hora_fim: row.hora_fim ? normalizeStoredTime(row.hora_fim) : null,
        motivo: row.motivo || null,
        tipo_aula: row.tipo_aula || null
    };
}

async function buscarContextoSalaProfessor(request, { idSala, idProfessor }) {
    const result = await request
        .input('auditoriaIdSala', sql.Int, idSala)
        .input('auditoriaIdProfessor', sql.Int, idProfessor)
        .query(`
            SELECT TOP 1
                s.id_sala,
                s.nome_sala,
                s.codigo_unidade,
                u.nome_unidade,
                p.id_professor,
                p.nome AS nome_professor
            FROM Salas s
            LEFT JOIN Unidades u ON u.codigo_unidade = s.codigo_unidade
            LEFT JOIN professores p ON p.id_professor = @auditoriaIdProfessor
            WHERE s.id_sala = @auditoriaIdSala
        `);

    return mapAgendamentoAuditoria(result.recordset[0] || {
        id_sala: idSala,
        id_professor: idProfessor
    });
}

async function buscarContextoAgendamento(request, idAgendamento, lockHint = '') {
    const result = await request
        .input('auditoriaIdAgendamento', sql.Int, idAgendamento)
        .query(`
            SELECT
                a.id_agendamento,
                a.id_sala,
                s.nome_sala,
                s.codigo_unidade,
                u.nome_unidade,
                a.id_professor,
                p.nome AS nome_professor,
                CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
                a.motivo,
                a.tipo_aula
            FROM agendamentos a ${lockHint}
            LEFT JOIN Salas s ON s.id_sala = a.id_sala
            LEFT JOIN Unidades u ON u.codigo_unidade = s.codigo_unidade
            LEFT JOIN professores p ON p.id_professor = a.id_professor
            WHERE a.id_agendamento = @auditoriaIdAgendamento
        `);

    return mapAgendamentoAuditoria(result.recordset[0]);
}

function eventoBaseAgendamento(contexto, overrides = {}) {
    const agendamento = mapAgendamentoAuditoria(contexto) || {};
    return {
        idAgendamento: agendamento.id_agendamento,
        codigoUnidade: agendamento.codigo_unidade,
        nomeUnidade: agendamento.nome_unidade,
        idSala: agendamento.id_sala,
        nomeSala: agendamento.nome_sala,
        idProfessor: agendamento.id_professor,
        nomeProfessor: agendamento.nome_professor,
        dataReserva: agendamento.data_reservas,
        horaInicio: agendamento.hora_inicio,
        horaFim: agendamento.hora_fim,
        motivo: agendamento.motivo,
        tipoAula: agendamento.tipo_aula,
        ...overrides
    };
}

function resumirAlteracoesAgendamento(antes, depois) {
    const campos = ['id_sala', 'id_professor', 'data_reservas', 'hora_inicio', 'hora_fim', 'motivo', 'tipo_aula'];
    return campos
        .filter((campo) => String(antes?.[campo] ?? '') !== String(depois?.[campo] ?? ''))
        .map((campo) => ({
            campo,
            anterior: antes?.[campo] ?? null,
            posterior: depois?.[campo] ?? null
        }));
}

async function registrarAuditoriaBloqueio(evento) {
    await auditoriaAgendamentos.registrarEvento(evento, { suppressErrors: true });
}

// ──────────────────────────────────────────────────────────────
// Helpers de permissão de sala (requerem pool)
// ──────────────────────────────────────────────────────────────

async function userCanAccessSchedulingSala(unidadesSessao, idSala) {
    if (!unidadesSessao.length) return false;
    const pool = await getPool();
    const request = pool.request().input('idSala', sql.Int, idSala);
    const placeholders = unidadesSessao.map((_, i) => `@u${i}`).join(', ');
    unidadesSessao.forEach((codigo, i) => request.input(`u${i}`, sql.NVarChar, codigo));
    const result = await request.query(`
        SELECT TOP 1 1 AS permitido FROM Salas
        WHERE id_sala = @idSala AND codigo_unidade IN (${placeholders})
    `);
    return result.recordset.length > 0;
}

async function professorCanScheduleInSala(unidadesSessao, idProfessor, idSala) {
    if (!unidadesSessao.length) return false;
    const pool = await getPool();
    const request = pool.request()
        .input('idProfessor', sql.Int, idProfessor)
        .input('idSala', sql.Int, idSala);
    const placeholders = unidadesSessao.map((_, i) => `@up${i}`).join(', ');
    unidadesSessao.forEach((codigo, i) => request.input(`up${i}`, sql.NVarChar, codigo));
    const result = await request.query(`
        SELECT TOP 1 1 AS permitido
        FROM Salas s
        INNER JOIN ProfessorUnidade pu ON pu.codigo_unidade = s.codigo_unidade
        WHERE s.id_sala = @idSala AND pu.id_professor = @idProfessor
          AND s.codigo_unidade IN (${placeholders})
    `);
    return result.recordset.length > 0;
}

// ──────────────────────────────────────────────────────────────
// Agendamentos — CRUD
// ──────────────────────────────────────────────────────────────

async function validarPermissoesAgendamento({ idSala, idProfessor, horaInicio, horaFim, idProfessorSessao, podeAgendarEmNomeDeTerceiros, unidadesSessao }) {
    const idProfessorAgendamento = podeAgendarEmNomeDeTerceiros ? Number(idProfessor) : idProfessorSessao;
    if (!Number.isInteger(idProfessorAgendamento)) throw { status: 400, message: 'Professor inválido para agendamento.' };

    validateScheduleTime(horaInicio, horaFim);

    const podeAcessarSala = await userCanAccessSchedulingSala(unidadesSessao, idSala);
    if (!podeAcessarSala) throw { status: 403, message: 'Acesso negado para esta sala.' };

    const professorPodeNaSala = await professorCanScheduleInSala(unidadesSessao, idProfessorAgendamento, idSala);
    if (!professorPodeNaSala) throw { status: 403, message: 'Professor selecionado não pertence à unidade da sala.' };

    return { idProfessorAgendamento };
}

async function verificarConflitoParaData(request, { idSala, data, horaInicio, horaFim }) {
    const horaInicioNormalizada = normalizeStoredTime(horaInicio);
    const horaFimNormalizada = normalizeStoredTime(horaFim);

    const conflitoResult = await request
        .input('id_sala', sql.Int, idSala)
        .input('data', sql.NVarChar, data)
        .input('hora_inicio', sql.NVarChar, horaInicioNormalizada)
        .input('hora_fim', sql.NVarChar, horaFimNormalizada)
        .query(`
            SELECT TOP 1 a.id_agendamento, a.data_reservas, a.hora_inicio, a.hora_fim, p.nome AS nome_professor
            FROM agendamentos a
            INNER JOIN professores p ON p.id_professor = a.id_professor
            WHERE a.id_sala = @id_sala AND a.data_reservas = @data
              AND (CAST(a.hora_inicio AS time) < CAST(@hora_fim AS time)
                   AND CAST(a.hora_fim AS time) > CAST(@hora_inicio AS time))
            ORDER BY a.hora_inicio
        `);

    if (conflitoResult.recordset.length > 0) {
        return {
            temConflito: true,
            conflito: conflitoResult.recordset[0]
        };
    }

    return { temConflito: false, conflito: null };
}

async function buscarReservasProfessorParaAviso(request, { idProfessor, data, horaInicio, horaFim, idSala }) {
    const horaInicioNormalizada = normalizeStoredTime(horaInicio);
    const horaFimNormalizada = normalizeStoredTime(horaFim);

    const resultado = await request
        .input('id_professor', sql.Int, idProfessor)
        .input('data', sql.NVarChar, data)
        .input('hora_inicio', sql.NVarChar, horaInicioNormalizada)
        .input('hora_fim', sql.NVarChar, horaFimNormalizada)
        .input('id_sala', sql.Int, idSala)
        .query(`
            SELECT a.id_agendamento, a.id_sala, a.data_reservas, a.hora_inicio, a.hora_fim, s.nome_sala
            FROM agendamentos a
            INNER JOIN Salas s ON s.id_sala = a.id_sala
            WHERE a.id_professor = @id_professor
              AND a.data_reservas = @data
              AND a.id_sala <> @id_sala
              AND (CAST(a.hora_inicio AS time) < CAST(@hora_fim AS time)
                   AND CAST(a.hora_fim AS time) > CAST(@hora_inicio AS time))
            ORDER BY a.hora_inicio
        `);

    return resultado.recordset || [];
}

async function buscarNomeSala(request, idSala) {
    const resultado = await request
        .input('id_sala', sql.Int, idSala)
        .query('SELECT TOP 1 nome_sala FROM Salas WHERE id_sala = @id_sala');

    return resultado.recordset?.[0]?.nome_sala || '';
}

async function verificarDisponibilidadeAgendamentos({ idSala, idProfessor, dataReservas, horaInicio, horaFim, motivo, tipoAula, idProfessorSessao, podeAgendarEmNomeDeTerceiros, unidadesSessao }) {
    const { idProfessorAgendamento } = await validarPermissoesAgendamento({
        idSala,
        idProfessor,
        horaInicio,
        horaFim,
        idProfessorSessao,
        podeAgendarEmNomeDeTerceiros,
        unidadesSessao
    });

    const pool = await getPool();
    const datasDisponiveis = [];
    const conflitos = [];
    const reservasProfessorPorData = {};
    const horaInicioNormalizada = normalizeStoredTime(horaInicio);
    const horaFimNormalizada = normalizeStoredTime(horaFim);
    const nomeSalaSolicitada = await buscarNomeSala(pool.request(), idSala);

    for (const data of dataReservas) {
        const dataLuxon = DateTime.fromISO(data, { zone: 'UTC' });
        if (!dataLuxon.isValid) throw { status: 400, message: 'Data inválida.' };

        validateFutureDate(data, horaInicio);

        const { temConflito, conflito } = await verificarConflitoParaData(pool.request(), {
            idSala,
            data,
            horaInicio,
            horaFim
        });

        if (temConflito) {
            conflitos.push({
                data,
                motivo: 'Sala ocupada no horário solicitado',
                detalhes: {
                    horaInicio: conflito.hora_inicio,
                    horaFim: conflito.hora_fim,
                    nomeProfessor: conflito.nome_professor
                }
            });
        } else {
            datasDisponiveis.push(data);

            const reservasProfessor = await buscarReservasProfessorParaAviso(pool.request(), {
                idProfessor: idProfessorAgendamento,
                data,
                horaInicio: horaInicioNormalizada,
                horaFim: horaFimNormalizada,
                idSala
            });

            if (reservasProfessor.length > 0) {
                reservasProfessorPorData[data] = reservasProfessor;
            }
        }
    }

    const avisosProfessor = agruparAvisosProfessorPorData({
        dataReservas: datasDisponiveis,
        reservasProfessorPorData,
        idSalaSolicitada: idSala,
        nomeSalaSolicitada,
        horaInicio: horaInicioNormalizada,
        horaFim: horaFimNormalizada
    });
    const avisoProfessorToken = criarTokenAvisosProfessor(avisosProfessor);

    return {
        totalSolicitadas: dataReservas.length,
        datasDisponiveis,
        conflitosSala: conflitos,
        conflitos,
        avisosProfessor,
        avisoProfessorToken,
        professorAgendamento: idProfessorAgendamento
    };
}

async function agendarSala({ idSala, idProfessor, dataReservas, horaInicio, horaFim, motivo, tipoAula, idProfessorSessao, podeAgendarEmNomeDeTerceiros, unidadesSessao, confirmarAgendamento, usarSomenteDisponiveis, aceitarAvisosProfessor, avisoProfessorToken, avisoProfessorTokenSessao, usuarioResponsavel, resumoPreVerificacao }) {
    const { idProfessorAgendamento } = await validarPermissoesAgendamento({
        idSala,
        idProfessor,
        horaInicio,
        horaFim,
        idProfessorSessao,
        podeAgendarEmNomeDeTerceiros,
        unidadesSessao
    });

    const pool = await getPool();
    const idCorrelacao = criarIdCorrelacaoAuditoria();
    const datasParaProcessar = Array.isArray(dataReservas) ? dataReservas.filter(Boolean) : [];
    const contextoSolicitacao = await buscarContextoSalaProfessor(pool.request(), {
        idSala,
        idProfessor: idProfessorAgendamento
    });
    const disponibilidade = await verificarDisponibilidadeAgendamentos({
        idSala,
        idProfessor,
        dataReservas: datasParaProcessar,
        horaInicio,
        horaFim,
        motivo,
        tipoAula,
        idProfessorSessao,
        podeAgendarEmNomeDeTerceiros,
        unidadesSessao
    });

    if (confirmarAgendamento !== true) {
        await registrarAuditoriaBloqueio({
            acao: 'CRIACAO',
            resultado: 'BLOQUEADO',
            usuarioResponsavel,
            idCorrelacao,
            ...eventoBaseAgendamento(contextoSolicitacao, {
                dataReserva: datasParaProcessar[0] || null,
                horaInicio: normalizeStoredTime(horaInicio),
                horaFim: normalizeStoredTime(horaFim),
                motivo,
                tipoAula,
                resumo: 'Criacao de agendamento aguardando confirmacao final'
            }),
            detalhes: {
                motivoBloqueio: 'CONFIRMACAO_FINAL_PENDENTE',
                datasSolicitadas: datasParaProcessar,
                disponibilidade
            }
        });
        throw {
            status: 409,
            message: 'Confirme o resumo antes de gravar os agendamentos.',
            details: disponibilidade,
            alreadyRolledBack: true
        };
    }

    if (disponibilidade.conflitos.length > 0) {
        await registrarAuditoriaBloqueio({
            acao: 'CONFLITO',
            resultado: 'BLOQUEADO',
            usuarioResponsavel,
            idCorrelacao,
            ...eventoBaseAgendamento(contextoSolicitacao, {
                dataReserva: disponibilidade.conflitos[0]?.data || datasParaProcessar[0] || null,
                horaInicio: normalizeStoredTime(horaInicio),
                horaFim: normalizeStoredTime(horaFim),
                motivo,
                tipoAula,
                resumo: 'Criacao bloqueada por conflito de sala'
            }),
            detalhes: {
                motivoBloqueio: 'SALA_OCUPADA',
                datasSolicitadas: datasParaProcessar,
                disponibilidade
            }
        });
        throw {
            status: 409,
            message: 'Algumas datas foram recusadas por conflito. Revise o resumo atualizado antes de continuar.',
            details: disponibilidade,
            alreadyRolledBack: true
        };
    }

    const avisosProfessor = Array.isArray(disponibilidade.avisosProfessor) ? disponibilidade.avisosProfessor : [];
    if (avisosProfessor.length > 0) {
        const tokenAtual = String(disponibilidade.avisoProfessorToken || '');
        const tokenConfirmado = String(avisoProfessorToken || '');
        const tokenSessao = String(avisoProfessorTokenSessao || '');

        if (aceitarAvisosProfessor !== true || !tokenAtual || tokenConfirmado !== tokenAtual || tokenSessao !== tokenAtual) {
            await registrarAuditoriaBloqueio({
                acao: 'CRIACAO',
                resultado: 'BLOQUEADO',
                usuarioResponsavel,
                idCorrelacao,
                ...eventoBaseAgendamento(contextoSolicitacao, {
                    dataReserva: avisosProfessor[0]?.data || datasParaProcessar[0] || null,
                    horaInicio: normalizeStoredTime(horaInicio),
                    horaFim: normalizeStoredTime(horaFim),
                    motivo,
                    tipoAula,
                    resumo: 'Criacao aguardando ciencia de reserva do professor'
                }),
                detalhes: {
                    motivoBloqueio: 'CONFIRMACAO_AVISO_PROFESSOR_PENDENTE',
                    datasSolicitadas: datasParaProcessar,
                    disponibilidade
                }
            });
            throw {
                status: 409,
                message: 'Atencao: este professor ja possui uma ou mais salas reservadas em algumas das datas selecionadas. Confira antes de continuar.',
                details: disponibilidade,
                alreadyRolledBack: true
            };
        }
    }

    const datasParaCriar = usarSomenteDisponiveis ? disponibilidade.datasDisponiveis : datasParaProcessar;

    if (!datasParaCriar.length) {
        await registrarAuditoriaBloqueio({
            acao: 'CRIACAO',
            resultado: 'BLOQUEADO',
            usuarioResponsavel,
            idCorrelacao,
            ...eventoBaseAgendamento(contextoSolicitacao, {
                dataReserva: datasParaProcessar[0] || null,
                horaInicio: normalizeStoredTime(horaInicio),
                horaFim: normalizeStoredTime(horaFim),
                motivo,
                tipoAula,
                resumo: 'Criacao bloqueada sem datas disponiveis'
            }),
            detalhes: {
                motivoBloqueio: 'SEM_DATAS_DISPONIVEIS',
                datasSolicitadas: datasParaProcessar,
                disponibilidade
            }
        });
        throw {
            status: 409,
            message: 'Nenhuma data disponível para agendamento.',
            details: disponibilidade,
            alreadyRolledBack: true
        };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const horaInicioNormalizada = normalizeStoredTime(horaInicio);
        const horaFimNormalizada = normalizeStoredTime(horaFim);
        const agendamentosCriados = [];

        for (const data of datasParaCriar) {
            const dataLuxon = DateTime.fromISO(data, { zone: 'UTC' });
            if (!dataLuxon.isValid) throw { status: 400, message: 'Data inválida.' };

            validateFutureDate(data, horaInicio);

            const { temConflito } = await verificarConflitoParaData(transaction.request(), {
                idSala,
                data,
                horaInicio,
                horaFim
            });

            if (temConflito) {
                await transaction.rollback();
                await registrarAuditoriaBloqueio({
                    acao: 'CONFLITO',
                    resultado: 'BLOQUEADO',
                    usuarioResponsavel,
                    idCorrelacao,
                    ...eventoBaseAgendamento(contextoSolicitacao, {
                        dataReserva: data,
                        horaInicio: horaInicioNormalizada,
                        horaFim: horaFimNormalizada,
                        motivo,
                        tipoAula,
                        resumo: 'Criacao bloqueada por conflito durante a gravacao'
                    }),
                    detalhes: {
                        motivoBloqueio: 'SALA_OCUPADA_NA_GRAVACAO',
                        datasSolicitadas: datasParaCriar,
                        dataConflitante: data
                    }
                });
                const partesData = data.split('-');
                const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
                const dataFormatada = `${partesData[2]} de ${meses[parseInt(partesData[1], 10) - 1]} de ${partesData[0]}`;
                throw {
                    status: 409,
                    message: `Data (${dataFormatada}) e horário já ocupados. Escolha outro, por gentileza.`,
                    alreadyRolledBack: true,
                    details: {
                        totalSolicitadas: datasParaCriar.length,
                        datasDisponiveis: [],
                        conflitosSala: [{ data, motivo: 'Sala ocupada no horário solicitado' }],
                        conflitos: [{ data, motivo: 'Sala ocupada no horário solicitado' }],
                        avisosProfessor: [],
                        avisoProfessorToken: ''
                    }
                };
            }

            const insertResult = await transaction.request()
                .input('id_sala', sql.Int, idSala)
                .input('id_professor', sql.Int, idProfessorAgendamento)
                .input('data_reservas', sql.NVarChar, data)
                .input('hora_inicio', sql.NVarChar, horaInicioNormalizada)
                .input('hora_fim', sql.NVarChar, horaFimNormalizada)
                .input('tipo_aula', sql.NVarChar, tipoAula)
                .input('motivo', sql.NVarChar, motivo)
                .query(`
                    INSERT INTO agendamentos (id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula)
                    OUTPUT INSERTED.id_agendamento
                    VALUES (@id_sala, @id_professor, @data_reservas, @hora_inicio, @hora_fim, @motivo, @tipo_aula)
                `);

            agendamentosCriados.push({
                ...contextoSolicitacao,
                id_agendamento: insertResult.recordset[0]?.id_agendamento || null,
                data_reservas: data,
                hora_inicio: horaInicioNormalizada,
                hora_fim: horaFimNormalizada,
                motivo,
                tipo_aula: tipoAula
            });
        }
        const totalPreVerificacao = Number(resumoPreVerificacao?.totalSolicitadas || 0);
        const conflitosPreVerificacao = Array.isArray(resumoPreVerificacao?.conflitos)
            ? resumoPreVerificacao.conflitos
            : [];
        const houveParcialidade = totalPreVerificacao > agendamentosCriados.length || conflitosPreVerificacao.length > 0;

        await auditoriaAgendamentos.registrarEvento({
            acao: 'CRIACAO',
            resultado: houveParcialidade ? 'PARCIAL' : 'SUCESSO',
            usuarioResponsavel,
            idCorrelacao,
            ...eventoBaseAgendamento(agendamentosCriados[0] || contextoSolicitacao, {
                idAgendamento: agendamentosCriados.length === 1 ? agendamentosCriados[0]?.id_agendamento : null,
                resumo: houveParcialidade
                    ? `Criados ${agendamentosCriados.length} agendamento(s) de ${totalPreVerificacao || datasParaProcessar.length} solicitados`
                    : `Criados ${agendamentosCriados.length} agendamento(s)`
            }),
            detalhes: {
                totalSolicitadas: totalPreVerificacao || datasParaProcessar.length,
                totalCriadas: agendamentosCriados.length,
                idsCriados: agendamentosCriados.map((item) => item.id_agendamento).filter(Boolean),
                datasSolicitadas: resumoPreVerificacao?.datasSolicitadas || datasParaProcessar,
                datasCriadas: agendamentosCriados.map((item) => item.data_reservas),
                datasDisponiveis: disponibilidade.datasDisponiveis,
                conflitosSala: resumoPreVerificacao?.conflitosSala || disponibilidade.conflitosSala,
                avisosProfessor: disponibilidade.avisosProfessor,
                aceitouAvisosProfessor: avisosProfessor.length > 0 && aceitarAvisosProfessor === true,
                usarSomenteDisponiveis: usarSomenteDisponiveis === true
            },
            dadosPosteriores: agendamentosCriados
        }, { transaction });

        await transaction.commit();
        return {
            totalSolicitadas: datasParaCriar.length,
            datasDisponiveis: datasParaCriar,
            conflitosSala: [],
            conflitos: [],
            avisosProfessor: [],
            avisoProfessorToken: ''
        };
    } catch (error) {
        if (!error.alreadyRolledBack) {
            try { await transaction.rollback(); } catch (_) {}
        }
        if (!error.status) {
            await registrarAuditoriaBloqueio({
                acao: 'ERRO',
                resultado: 'ERRO',
                usuarioResponsavel,
                idCorrelacao,
                ...eventoBaseAgendamento(contextoSolicitacao, {
                    dataReserva: datasParaProcessar[0] || null,
                    horaInicio: normalizeStoredTime(horaInicio),
                    horaFim: normalizeStoredTime(horaFim),
                    motivo,
                    tipoAula,
                    resumo: 'Erro ao criar agendamento'
                }),
                detalhes: {
                    datasSolicitadas: datasParaProcessar,
                    usarSomenteDisponiveis: usarSomenteDisponiveis === true
                },
                erroMensagem: error.message
            });
        }
        throw error;
    }
}

async function editarAgendamento({ id, professor, tipoAtividade, motivo, idProfessorSessao, permissaoSessao, usuarioResponsavel }) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
    // Buscar agendamento original para verificar proprietário
    const agendamentoOriginal = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('SELECT id_agendamento, id_professor, data_reservas FROM agendamentos WHERE id_agendamento = @id');

    if (!agendamentoOriginal.recordset.length) {
        throw { status: 404, message: 'Agendamento não encontrado.' };
    }

    const agendamento = agendamentoOriginal.recordset[0];
    const antes = await buscarContextoAgendamento(new sql.Request(transaction), id);

    // Proteção de acesso: apenas proprietário ou admin/coordenador podem editar
    const ehProprietario = agendamento.id_professor === idProfessorSessao;
    const ehAdmin = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
    if (!ehProprietario && !ehAdmin) {
        throw { status: 403, message: 'Você só pode editar seus próprios agendamentos.' };
    }

    // Não permitir editar agendamentos passados
    if (isPastCalendarDay(agendamento.data_reservas)) {
        throw { status: 400, message: 'Não é permitido editar agendamentos de datas passadas.' };
    }

    await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('professor', sql.Int, professor)
        .input('tipoAtividade', sql.NVarChar, tipoAtividade)
        .input('motivo', sql.NVarChar, motivo)
        .query(`UPDATE agendamentos SET id_professor = @professor, tipo_aula = @tipoAtividade, motivo = @motivo WHERE id_agendamento = @id`);

    const depois = await buscarContextoAgendamento(new sql.Request(transaction), id);
    await auditoriaAgendamentos.registrarEvento({
        acao: 'EDICAO',
        resultado: 'SUCESSO',
        usuarioResponsavel,
        idCorrelacao: criarIdCorrelacaoAuditoria(),
        ...eventoBaseAgendamento(depois, {
            resumo: `Agendamento ${id} editado`
        }),
        detalhes: {
            camposAlterados: resumirAlteracoesAgendamento(antes, depois)
        },
        dadosAnteriores: antes,
        dadosPosteriores: depois
    }, { transaction });

    await transaction.commit();
    } catch (error) {
        try { await transaction.rollback(); } catch (_) {}
        throw error;
    }
}

async function editarProfessorAgendamento({ id, professor, idProfessorSessao, permissaoSessao, usuarioResponsavel }) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
    // Buscar agendamento original para verificar proprietário
    const agendamentoOriginal = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('SELECT id_agendamento, id_professor, data_reservas FROM agendamentos WHERE id_agendamento = @id');

    if (!agendamentoOriginal.recordset.length) {
        throw { status: 404, message: 'Agendamento não encontrado.' };
    }

    // Proteção de acesso: apenas admin/coordenador podem alterar professor de agendamento
    const ehAdmin = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
    if (!ehAdmin) {
        throw { status: 403, message: 'Apenas administradores e coordenadores podem alterar o professor do agendamento.' };
    }

    // Não permitir editar agendamentos passados
    const agendamento = agendamentoOriginal.recordset[0];
    const antes = await buscarContextoAgendamento(new sql.Request(transaction), id);
    if (isPastCalendarDay(agendamento.data_reservas)) {
        throw { status: 400, message: 'Não é permitido editar agendamentos de datas passadas.' };
    }

    await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('professor', sql.Int, professor)
        .query(`UPDATE agendamentos SET id_professor = @professor WHERE id_agendamento = @id`);

    const depois = await buscarContextoAgendamento(new sql.Request(transaction), id);
    await auditoriaAgendamentos.registrarEvento({
        acao: 'EDICAO',
        resultado: 'SUCESSO',
        usuarioResponsavel,
        idCorrelacao: criarIdCorrelacaoAuditoria(),
        ...eventoBaseAgendamento(depois, {
            resumo: `Professor do agendamento ${id} alterado`
        }),
        detalhes: {
            camposAlterados: resumirAlteracoesAgendamento(antes, depois)
        },
        dadosAnteriores: antes,
        dadosPosteriores: depois
    }, { transaction });

    await transaction.commit();
    } catch (error) {
        try { await transaction.rollback(); } catch (_) {}
        throw error;
    }
}

async function verificarAgendamento({ idSala, data, horaInicio, horaFim }) {
    const horaInicioNormalizada = normalizeStoredTime(horaInicio);
    const horaFimNormalizada = normalizeStoredTime(horaFim);

    const pool = await getPool();
    const result = await pool.request()
        .input('id_sala', sql.Int, idSala)
        .input('data', sql.NVarChar, data)
        .input('hora_inicio', sql.NVarChar, horaInicioNormalizada)
        .input('hora_fim', sql.NVarChar, horaFimNormalizada)
        .query(`
            SELECT COUNT(*) AS numConflictos FROM agendamentos
            WHERE id_sala = @id_sala AND data_reservas = @data
            AND (CAST(hora_inicio AS time) < CAST(@hora_fim AS time)
                 AND CAST(hora_fim AS time) > CAST(@hora_inicio AS time))
        `);
    const existe = result.recordset[0].numConflictos > 0;
    let agendamentos = [];
    if (existe) {
        const conflitos = await pool.request()
            .input('id_sala', sql.Int, idSala)
            .input('data', sql.NVarChar, data)
            .input('hora_inicio', sql.NVarChar, horaInicioNormalizada)
            .input('hora_fim', sql.NVarChar, horaFimNormalizada)
            .query(`
                SELECT a.*, p.nome AS nome_professor FROM agendamentos a
                JOIN professores p ON a.id_professor = p.id_professor
                WHERE a.id_sala = @id_sala AND a.data_reservas = @data
                AND (CAST(a.hora_inicio AS time) < CAST(@hora_fim AS time)
                     AND CAST(a.hora_fim AS time) > CAST(@hora_inicio AS time))
            `);
        agendamentos = conflitos.recordset;
    }
    return { existe, agendamentos };
}

async function listarAgendamentosSala(idSala) {
    const pool = await getPool();
    const dataAtual = new Date().toISOString().split('T')[0];
    const result = await pool.request()
        .input('id_Sala', sql.Int, idSala)
        .input('dataAtual', sql.Date, dataAtual)
        .query(`
            SELECT a.id_agendamento, a.data_reservas, a.hora_inicio, a.hora_fim, p.nome, a.motivo, a.tipo_aula
            FROM agendamentos a JOIN professores p ON a.id_professor = p.id_professor
            WHERE a.id_sala = @id_Sala AND CAST(a.data_reservas AS DATE) = @dataAtual
            ORDER BY a.hora_inicio
        `);
    return result.recordset;
}

async function listarAgendamentosProfessor(idProfessor, idProfessorSessao, permissaoSessao) {
    // Proteção de acesso: professor só lista seus próprios agendamentos, admin lista todos
    const ehAdmin = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
    if (Number(idProfessor) !== idProfessorSessao && !ehAdmin) {
        throw { status: 403, message: 'Você só pode acessar seus próprios agendamentos.' };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query('SELECT * FROM agendamentos WHERE id_professor = @id_professor');
    return result.recordset;
}

async function listarAgendamentosProfessorLogado(idProfessor) {
    const pool = await getPool();
    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(`
            SELECT a.*, s.nome_sala FROM agendamentos a
            JOIN Salas s ON a.id_sala = s.id_sala
            WHERE a.id_professor = @id_professor
        `);
    return result.recordset;
}

async function excluirAgendamentoById(id, idProfessorSessao, permissaoSessao, usuarioResponsavel) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
        // Buscar agendamento para verificar proprietário
        const agendamentoResult = await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .query('SELECT id_agendamento, id_professor, data_reservas FROM agendamentos WHERE id_agendamento = @id');

        if (!agendamentoResult.recordset.length) {
            throw { status: 404, message: 'Agendamento não encontrado.' };
        }

        const agendamento = agendamentoResult.recordset[0];
        const antes = await buscarContextoAgendamento(new sql.Request(transaction), id);

        // Proteção de acesso: apenas proprietário ou admin/coordenador podem deletar
        const ehProprietario = agendamento.id_professor === idProfessorSessao;
        const ehAdmin = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
        if (!ehProprietario && !ehAdmin) {
            throw { status: 403, message: 'Você só pode deletar seus próprios agendamentos.' };
        }

        // Não permitir deletar agendamentos passados
        if (isPastCalendarDay(agendamento.data_reservas)) {
            throw { status: 400, message: 'Não é permitido deletar agendamentos de datas passadas.' };
        }

        // Remove vínculos de troca que bloqueiam o DELETE por FK.
        await removerSolicitacoesTrocaPorAgendamento(new sql.Request(transaction), id);

        const deleteResult = await new sql.Request(transaction)
            .input('id', sql.Int, id)
            .query('DELETE FROM agendamentos WHERE id_agendamento = @id');

        if (deleteResult.rowsAffected && deleteResult.rowsAffected[0] === 1) {
            await auditoriaAgendamentos.registrarEvento({
                acao: 'EXCLUSAO',
                resultado: 'SUCESSO',
                usuarioResponsavel,
                idCorrelacao: criarIdCorrelacaoAuditoria(),
                ...eventoBaseAgendamento(antes, {
                    resumo: `Agendamento ${id} excluido`
                }),
                detalhes: {
                    idsExcluidos: [Number(id)],
                    quantidade: 1
                },
                dadosAnteriores: antes
            }, { transaction });
        }

        if (!deleteResult.rowsAffected || deleteResult.rowsAffected[0] !== 1) {
            throw { status: 409, message: 'O agendamento não pôde ser removido do banco de dados.' };
        }

        await transaction.commit();
    } catch (error) {
        try { await transaction.rollback(); } catch (_) {}
        if (error && error.status) {
            throw error;
        }
        throw error;
    }
}

async function excluirAgendamentosIntervalo({ codigoUnidade, dataInicio, dataFim, permissaoSessao, usuarioResponsavel }) {
    // Proteção de acesso: apenas admin/coordenador podem deletar em intervalo
    const ehAdmin = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
    if (!ehAdmin) {
        throw { status: 403, message: 'Apenas administradores e coordenadores podem deletar agendamentos em intervalo.' };
    }

    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        throw { status: 400, message: 'Intervalo de datas inválido.' };
    }

    if (inicio > fim) {
        throw { status: 400, message: 'A data de início não pode ser maior que a data de fim.' };
    }

    const anoAtual = new Date().getFullYear();
    const intervaloContemAnoAtual = inicio.getFullYear() <= anoAtual && fim.getFullYear() >= anoAtual;
    if (intervaloContemAnoAtual) {
        throw {
            status: 400,
            message: 'Exclusão por intervalo bloqueada: não é permitido excluir agendamentos do ano vigente.'
        };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    const idCorrelacao = criarIdCorrelacaoAuditoria();
    await transaction.begin();

    try {
        const agendamentosResult = await new sql.Request(transaction)
            .input('codigoUnidadeAuditoria', sql.NVarChar, codigoUnidade)
            .input('dataInicioAuditoria', sql.Date, dataInicio)
            .input('dataFimAuditoria', sql.Date, dataFim)
            .query(`
                SELECT
                    a.id_agendamento,
                    a.id_sala,
                    s.nome_sala,
                    s.codigo_unidade,
                    u.nome_unidade,
                    a.id_professor,
                    p.nome AS nome_professor,
                    CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
                    CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                    CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
                    a.motivo,
                    a.tipo_aula
                FROM agendamentos a
                INNER JOIN Salas s ON s.id_sala = a.id_sala
                LEFT JOIN Unidades u ON u.codigo_unidade = s.codigo_unidade
                LEFT JOIN professores p ON p.id_professor = a.id_professor
                WHERE s.codigo_unidade = @codigoUnidadeAuditoria
                  AND a.data_reservas BETWEEN @dataInicioAuditoria AND @dataFimAuditoria
                ORDER BY a.data_reservas, a.hora_inicio, a.id_agendamento
            `);
        const agendamentosExcluidos = (agendamentosResult.recordset || []).map(mapAgendamentoAuditoria);

        await new sql.Request(transaction)
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .input('dataInicio', sql.Date, dataInicio)
            .input('dataFim', sql.Date, dataFim)
            .query(`
                IF OBJECT_ID('dbo.solicitacoes_troca_sala', 'U') IS NOT NULL
                BEGIN
                    DELETE t
                    FROM dbo.solicitacoes_troca_sala t
                    WHERE EXISTS (
                        SELECT 1
                        FROM agendamentos a
                        INNER JOIN Salas s ON s.id_sala = a.id_sala
                        WHERE s.codigo_unidade = @codigoUnidade
                          AND a.data_reservas BETWEEN @dataInicio AND @dataFim
                          AND a.id_agendamento = t.id_agendamento_origem
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM agendamentos a
                        INNER JOIN Salas s ON s.id_sala = a.id_sala
                        WHERE s.codigo_unidade = @codigoUnidade
                          AND a.data_reservas BETWEEN @dataInicio AND @dataFim
                          AND a.id_agendamento = t.id_agendamento_destino
                    )
                END
            `);

        const deleteResult = await new sql.Request(transaction)
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .input('dataInicio', sql.Date, dataInicio)
            .input('dataFim', sql.Date, dataFim)
            .query(`
                DELETE FROM agendamentos
                WHERE data_reservas BETWEEN @dataInicio AND @dataFim
                AND id_sala IN (SELECT id_sala FROM Salas WHERE codigo_unidade = @codigoUnidade)
            `);

        const quantidadeExcluida = deleteResult.rowsAffected?.[0] || 0;
        const contextoIntervalo = agendamentosExcluidos[0] || {
            codigo_unidade: codigoUnidade,
            data_reservas: `${dataInicio} a ${dataFim}`
        };

        await auditoriaAgendamentos.registrarEvento({
            acao: 'EXCLUSAO',
            resultado: 'SUCESSO',
            usuarioResponsavel,
            idCorrelacao,
            ...eventoBaseAgendamento(contextoIntervalo, {
                idAgendamento: null,
                dataReserva: null,
                resumo: `Excluidos ${quantidadeExcluida} agendamento(s) no intervalo`
            }),
            detalhes: {
                codigoUnidade,
                dataInicio,
                dataFim,
                quantidade: quantidadeExcluida,
                idsExcluidos: agendamentosExcluidos.map((item) => item.id_agendamento).filter(Boolean)
            },
            dadosAnteriores: agendamentosExcluidos
        }, { transaction });

        await transaction.commit();
    } catch (error) {
        try { await transaction.rollback(); } catch (_) {}
        throw error;
    }
}

async function listarAgendamentosUnidade(unidadeCodigo, permissaoSessao, unidadesSessao) {
    // Proteção de acesso: apenas admin/coordenador podem listar todos os agendamentos de uma unidade
    // Outros podem listar apenas se têm acesso à unidade
    const requisicaoPublica = !permissaoSessao && (!Array.isArray(unidadesSessao) || !unidadesSessao.length);
    const ehAdmin = permissaoSessao === 'admin';
    const temAcessoUnidade = Array.isArray(unidadesSessao) && unidadesSessao.includes(unidadeCodigo);

    if (!requisicaoPublica && !ehAdmin && !temAcessoUnidade) {
        throw { status: 403, message: 'Acesso negado para esta unidade.' };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('unidadeCodigo', sql.NVarChar, unidadeCodigo)
        .query(`
            SELECT a.id_agendamento, a.id_professor, a.id_sala, s.codigo_unidade, a.data_reservas, a.hora_inicio, a.hora_fim, s.nome_sala, p.nome, a.motivo, a.tipo_aula
            FROM agendamentos a JOIN salas s ON a.id_sala = s.id_sala JOIN professores p ON a.id_professor = p.id_professor
            WHERE s.codigo_unidade = @unidadeCodigo
            ORDER BY a.data_reservas, a.hora_inicio
        `);
    return result.recordset;
}

async function listarAgendamentosFiltrados({ unidadeCodigo, professor, dataInicio, dataFim, sala }) {
    const pool = await getPool();
    let query = `
        SELECT a.id_agendamento, s.nome_sala, p.nome, a.data_reservas, a.hora_inicio, a.hora_fim, a.motivo, a.tipo_aula
        FROM agendamentos a JOIN salas s ON a.id_sala = s.id_sala JOIN professores p ON a.id_professor = p.id_professor
        WHERE s.codigo_unidade = @unidadeCodigo
    `;
    if (professor) query += ` AND p.nome LIKE '%' + @professor + '%'`;
    if (dataInicio) query += ` AND a.data_reservas >= @dataInicio`;
    if (dataFim) query += ` AND a.data_reservas <= @dataFim`;
    if (sala) query += ` AND s.nome_sala LIKE '%' + @sala + '%'`;

    const result = await pool.request()
        .input('unidadeCodigo', sql.NVarChar, unidadeCodigo)
        .input('professor', sql.NVarChar, professor || '')
        .input('dataInicio', sql.NVarChar, dataInicio || '')
        .input('dataFim', sql.NVarChar, dataFim || '')
        .input('sala', sql.NVarChar, sala || '')
        .query(query);
    return result.recordset;
}

function getDiaSemanaIso(dateValue) {
    const data = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(data.getTime())) return null;
    return data.getDay();
}

async function listarAgendamentosDashboardFiltrados({ unidadeCodigo, professor, dataInicio, dataFim, sala, turno, diaSemana, permissaoSessao, unidadesSessao }) {
    const unidadeSelecionada = String(unidadeCodigo || '').trim();
    const ehAdmin = permissaoSessao === 'admin';
    const unidadesPermitidas = Array.isArray(unidadesSessao)
        ? unidadesSessao.map((codigo) => String(codigo).trim())
        : [];

    if (!unidadeSelecionada) {
        throw { status: 400, message: 'Selecione uma unidade para consultar os agendamentos.' };
    }

    if (!ehAdmin && !unidadesPermitidas.includes(unidadeSelecionada)) {
        throw { status: 403, message: 'Acesso negado para a unidade selecionada.' };
    }

    const pool = await getPool();
    let query = `
        SELECT a.id_agendamento,
            s.nome_sala,
            p.nome,
            CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
            CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
            CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim,
            a.motivo,
            a.tipo_aula
        FROM agendamentos a
        INNER JOIN salas s ON a.id_sala = s.id_sala
        INNER JOIN professores p ON a.id_professor = p.id_professor
        WHERE s.codigo_unidade = @unidadeCodigo
    `;

    if (professor) query += ` AND p.nome LIKE '%' + @professor + '%'`;
    if (dataInicio) query += ` AND a.data_reservas >= @dataInicio`;
    if (dataFim) query += ` AND a.data_reservas <= @dataFim`;
    if (sala) query += ` AND s.nome_sala LIKE '%' + @sala + '%'`;

    query += ' ORDER BY a.data_reservas ASC, a.hora_inicio ASC, s.nome_sala ASC';

    const result = await pool.request()
        .input('unidadeCodigo', sql.NVarChar, unidadeSelecionada)
        .input('professor', sql.NVarChar, professor || '')
        .input('dataInicio', sql.NVarChar, dataInicio || '')
        .input('dataFim', sql.NVarChar, dataFim || '')
        .input('sala', sql.NVarChar, sala || '')
        .query(query);

    return result.recordset.filter((item) => {
        const turnoValido = !turno || getTurnosDoAgendamento(item.hora_inicio, item.hora_fim).some((faixa) => faixa.key === turno);
        const diaValido = diaSemana === undefined || diaSemana === null || diaSemana === ''
            ? true
            : String(getDiaSemanaIso(item.data_reservas)) === String(diaSemana);
        return turnoValido && diaValido;
    });
}

// ──────────────────────────────────────────────────────────────
// Troca de sala — simples
// ──────────────────────────────────────────────────────────────

async function listarPossiveisTrocas(idProfessorLogado, idAgendamentoOrigem) {
    const pool = await getPool();
    const origemResult = await pool.request()
        .input('idAgendamentoOrigem', sql.Int, idAgendamentoOrigem)
        .query(`
            SELECT a.id_agendamento, a.id_professor, a.id_sala, s.nome_sala,
                CONVERT(varchar(10), data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), hora_fim, 108) AS hora_fim
            FROM agendamentos a
            INNER JOIN Salas s ON s.id_sala = a.id_sala
            WHERE a.id_agendamento = @idAgendamentoOrigem
        `);
    if (!origemResult.recordset.length) throw { status: 404, message: 'Agendamento de origem não encontrado.' };

    const agendamentoOrigem = origemResult.recordset[0];
    if (agendamentoOrigem.id_professor !== idProfessorLogado) throw { status: 403, message: 'Você só pode solicitar troca para seus próprios agendamentos.' };
    if (isPastCalendarDay(agendamentoOrigem.data_reservas)) throw { status: 400, message: 'Não é permitido trocar agendamentos de dias anteriores.' };

    const possiveisResult = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .input('idAgendamentoOrigem', sql.Int, idAgendamentoOrigem)
        .input('dataReservas', sql.NVarChar, agendamentoOrigem.data_reservas)
        .query(`
            SELECT a.id_agendamento, a.id_professor, p.nome AS nome_professor, s.nome_sala,
                CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim
            FROM agendamentos a
            INNER JOIN professores p ON p.id_professor = a.id_professor
            INNER JOIN Salas s ON s.id_sala = a.id_sala
            WHERE a.id_professor <> @idProfessorLogado AND a.id_agendamento <> @idAgendamentoOrigem
              AND CONVERT(varchar(10), a.data_reservas, 23) = @dataReservas
            ORDER BY p.nome ASC, s.nome_sala ASC
        `);

    const possiveis = possiveisResult.recordset.flatMap((agendamentoDestino) => {
        const turnosCompativeis = getTurnosCompativeis(agendamentoOrigem, agendamentoDestino);
        return turnosCompativeis.map((turno) => ({ ...agendamentoDestino, turno_chave: turno.key, turno_label: turno.label }));
    });

    return {
        origem: {
            id_agendamento: agendamentoOrigem.id_agendamento,
            data_reservas: agendamentoOrigem.data_reservas,
            hora_inicio: agendamentoOrigem.hora_inicio,
            hora_fim: agendamentoOrigem.hora_fim,
            nome_sala: agendamentoOrigem.nome_sala,
            turnos: getTurnosDoAgendamento(agendamentoOrigem.hora_inicio, agendamentoOrigem.hora_fim)
        },
        possiveis
    };
}

async function listarAgendamentosParaTrocaCoordenador({ unidadeCodigo, professorId, permissaoSessao, unidadesSessao }) {
    const ehCoordenador = permissaoSessao === 'coordenador' || permissaoSessao === 'admin';
    if (!ehCoordenador) {
        throw { status: 403, message: 'Apenas coordenadores e administradores podem acessar a troca direta.' };
    }

    const ehAdmin = permissaoSessao === 'admin';
    const temAcessoUnidade = Array.isArray(unidadesSessao) && unidadesSessao.includes(unidadeCodigo);
    if (!ehAdmin && !temAcessoUnidade) {
        throw { status: 403, message: 'Acesso negado para esta unidade.' };
    }

    const pool = await getPool();
    const request = pool.request().input('unidadeCodigo', sql.NVarChar, unidadeCodigo);
    let filtroProfessor = '';

    if (Number.isInteger(professorId) && professorId > 0) {
        filtroProfessor = ' AND a.id_professor = @professorId';
        request.input('professorId', sql.Int, professorId);
    }

    const result = await request.query(`
        SELECT a.id_agendamento, a.id_professor, p.nome AS nome_professor,
            s.id_sala, s.nome_sala, s.codigo_unidade,
            CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
            CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
            CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim
        FROM agendamentos a
        INNER JOIN Salas s ON s.id_sala = a.id_sala
        INNER JOIN professores p ON p.id_professor = a.id_professor
        WHERE s.codigo_unidade = @unidadeCodigo
          AND a.data_reservas >= CONVERT(date, GETDATE())
          ${filtroProfessor}
        ORDER BY a.data_reservas ASC, a.hora_inicio ASC, p.nome ASC
    `);

    return result.recordset;
}

async function coordenadorTrocaDiretaSala({
    idAgendamentoOrigem,
    idAgendamentoDestino,
    idCoordenadorSessao,
    permissaoSessao,
    unidadesSessao
}) {
    const ehCoordenador = permissaoSessao === 'coordenador' || permissaoSessao === 'admin';
    if (!ehCoordenador) {
        throw { status: 403, message: 'Apenas coordenadores e administradores podem executar troca direta.' };
    }

    if (!Number.isInteger(idCoordenadorSessao) || idCoordenadorSessao <= 0) {
        throw { status: 401, message: 'Usuário não autenticado.' };
    }

    if (!Number.isInteger(idAgendamentoOrigem) || !Number.isInteger(idAgendamentoDestino)) {
        throw { status: 400, message: 'Agendamentos de origem e destino são obrigatórios.' };
    }

    if (idAgendamentoOrigem === idAgendamentoDestino) {
        throw { status: 400, message: 'Os agendamentos de origem e destino não podem ser iguais.' };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
        const dadosResult = await new sql.Request(transaction)
            .input('idAgendamentoOrigem', sql.Int, idAgendamentoOrigem)
            .input('idAgendamentoDestino', sql.Int, idAgendamentoDestino)
            .query(`
                SELECT a.id_agendamento, a.id_professor, p.nome AS nome_professor,
                    a.id_sala, s.nome_sala, s.codigo_unidade,
                    CONVERT(varchar(10), a.data_reservas, 23) AS data_reservas,
                    CONVERT(varchar(8), a.hora_inicio, 108) AS hora_inicio,
                    CONVERT(varchar(8), a.hora_fim, 108) AS hora_fim
                FROM agendamentos a WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN Salas s ON s.id_sala = a.id_sala
                INNER JOIN professores p ON p.id_professor = a.id_professor
                WHERE a.id_agendamento IN (@idAgendamentoOrigem, @idAgendamentoDestino)
            `);

        if (dadosResult.recordset.length !== 2) {
            throw { status: 404, message: 'Agendamento de origem ou destino não encontrado.' };
        }

        const origem = dadosResult.recordset.find((item) => item.id_agendamento === idAgendamentoOrigem);
        const destino = dadosResult.recordset.find((item) => item.id_agendamento === idAgendamentoDestino);

        if (!origem || !destino) {
            throw { status: 404, message: 'Agendamento de origem ou destino não encontrado.' };
        }

        const ehAdmin = permissaoSessao === 'admin';
        const unidadesPermitidas = Array.isArray(unidadesSessao) ? unidadesSessao : [];
        const acessoOrigem = ehAdmin || unidadesPermitidas.includes(origem.codigo_unidade);
        const acessoDestino = ehAdmin || unidadesPermitidas.includes(destino.codigo_unidade);

        if (!acessoOrigem || !acessoDestino) {
            throw { status: 403, message: 'Acesso negado para um dos agendamentos selecionados.' };
        }

        if (origem.codigo_unidade !== destino.codigo_unidade) {
            throw { status: 400, message: 'A troca direta deve ocorrer dentro da mesma unidade.' };
        }

        if (origem.id_professor === destino.id_professor) {
            throw { status: 400, message: 'Selecione agendamentos de professores diferentes.' };
        }

        if (origem.data_reservas !== destino.data_reservas) {
            throw { status: 400, message: 'A troca direta só é permitida no mesmo dia.' };
        }

        if (origem.hora_inicio !== destino.hora_inicio || origem.hora_fim !== destino.hora_fim) {
            throw { status: 400, message: 'A troca direta só é permitida no mesmo horário.' };
        }

        if (origem.id_sala === destino.id_sala) {
            throw { status: 400, message: 'Os agendamentos já estão na mesma sala.' };
        }

        if (isPastCalendarDay(origem.data_reservas) || isPastCalendarDay(destino.data_reservas)) {
            throw { status: 400, message: 'Não é permitido trocar agendamentos de datas passadas.' };
        }

        await new sql.Request(transaction)
            .input('novaSala', sql.Int, destino.id_sala)
            .input('id', sql.Int, origem.id_agendamento)
            .query('UPDATE agendamentos SET id_sala = @novaSala WHERE id_agendamento = @id');

        await new sql.Request(transaction)
            .input('novaSala', sql.Int, origem.id_sala)
            .input('id', sql.Int, destino.id_agendamento)
            .query('UPDATE agendamentos SET id_sala = @novaSala WHERE id_agendamento = @id');

        await transaction.commit();

        return {
            id_professor_origem: origem.id_professor,
            id_professor_destino: destino.id_professor,
            professor_origem_nome: origem.nome_professor,
            professor_destino_nome: destino.nome_professor,
            sala_origem_anterior: origem.nome_sala,
            sala_destino_anterior: destino.nome_sala,
            data_reservas: origem.data_reservas,
            hora_inicio: origem.hora_inicio,
            hora_fim: origem.hora_fim,
            codigo_unidade: origem.codigo_unidade
        };
    } catch (error) {
        try { await transaction.rollback(); } catch (_) {}
        if (error && error.status) {
            throw error;
        }
        throw { status: 400, message: error.message || 'Não foi possível concluir a troca direta.' };
    }
}

async function solicitarTroca({ idProfessorOrigem, idAgendamentoOrigem, idAgendamentoDestino, mensagem }) {
    const pool = await getPool();
    const agendamentosResult = await pool.request()
        .input('idAgendamentoOrigem', sql.Int, idAgendamentoOrigem)
        .input('idAgendamentoDestino', sql.Int, idAgendamentoDestino)
        .query(`
            SELECT id_agendamento, id_professor, id_sala,
                CONVERT(varchar(10), data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), hora_fim, 108) AS hora_fim
            FROM agendamentos WHERE id_agendamento IN (@idAgendamentoOrigem, @idAgendamentoDestino)
        `);

    if (agendamentosResult.recordset.length !== 2) throw { status: 404, message: 'Agendamento de origem ou destino não encontrado.' };

    const agendamentoOrigem = agendamentosResult.recordset.find((a) => a.id_agendamento === idAgendamentoOrigem);
    const agendamentoDestino = agendamentosResult.recordset.find((a) => a.id_agendamento === idAgendamentoDestino);

    if (agendamentoOrigem.id_professor !== idProfessorOrigem) throw { status: 403, message: 'Você só pode iniciar troca com agendamento próprio.' };
    if (agendamentoDestino.id_professor === idProfessorOrigem) throw { status: 400, message: 'A troca deve envolver outro professor.' };
    if (isPastCalendarDay(agendamentoOrigem.data_reservas) || isPastCalendarDay(agendamentoDestino.data_reservas)) throw { status: 400, message: 'Não é permitido trocar agendamentos de dias anteriores.' };
    if (!getTurnosCompativeis(agendamentoOrigem, agendamentoDestino).length) throw { status: 400, message: 'No modo simples, a troca só é permitida no mesmo dia com pelo menos um turno compatível.' };
    if (agendamentoOrigem.id_sala === agendamentoDestino.id_sala) throw { status: 400, message: 'Os agendamentos já estão na mesma sala.' };

    const solicitacaoExistente = await pool.request()
        .input('origem', sql.Int, idAgendamentoOrigem)
        .input('destino', sql.Int, idAgendamentoDestino)
        .query(`
            SELECT TOP 1 id_solicitacao FROM dbo.solicitacoes_troca_sala
            WHERE status = 'PENDENTE'
              AND ((id_agendamento_origem = @origem AND id_agendamento_destino = @destino)
                OR (id_agendamento_origem = @destino AND id_agendamento_destino = @origem))
            ORDER BY created_at DESC
        `);
    if (solicitacaoExistente.recordset.length) throw { status: 409, message: 'Já existe uma solicitação pendente para esse par de agendamentos.' };

    const insertResult = await pool.request()
        .input('idProfessorOrigem', sql.Int, idProfessorOrigem)
        .input('idProfessorDestino', sql.Int, agendamentoDestino.id_professor)
        .input('idAgendamentoOrigem', sql.Int, idAgendamentoOrigem)
        .input('idAgendamentoDestino', sql.Int, idAgendamentoDestino)
        .input('mensagem', sql.NVarChar, mensagem || null)
        .query(`
            INSERT INTO dbo.solicitacoes_troca_sala (id_professor_origem, id_professor_destino, id_agendamento_origem, id_agendamento_destino, mensagem, status)
            OUTPUT INSERTED.id_solicitacao
            VALUES (@idProfessorOrigem, @idProfessorDestino, @idAgendamentoOrigem, @idAgendamentoDestino, @mensagem, 'PENDENTE')
        `);
    return insertResult.recordset[0].id_solicitacao;
}

async function obterResumoTrocaPorSolicitacao(idSolicitacao) {
    const pool = await getPool();
    const result = await pool.request()
        .input('idSolicitacao', sql.Int, idSolicitacao)
        .query(`
            SELECT TOP 1 id_professor_origem, id_professor_destino
            FROM dbo.solicitacoes_troca_sala
            WHERE id_solicitacao = @idSolicitacao
        `);

    if (!result.recordset.length) {
        throw { status: 404, message: 'Solicitação de troca não encontrada.' };
    }

    return result.recordset[0];
}

async function listarTrocasRecebidas(idProfessorLogado, options = {}) {
    const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
    const pageSizeRaw = Number.isInteger(options.pageSize) && options.pageSize > 0 ? options.pageSize : 8;
    const pageSize = Math.min(8, pageSizeRaw);
    const offset = (page - 1) * pageSize;

    const pool = await getPool();
    const totalResult = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .query(`
            SELECT COUNT(1) AS total
            FROM dbo.solicitacoes_troca_sala t
            WHERE t.id_professor_destino = @idProfessorLogado AND t.status = 'PENDENTE'
        `);

    const totalItems = Number(totalResult.recordset[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(page, totalPages);
    const safeOffset = (currentPage - 1) * pageSize;

    const result = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .input('offset', sql.Int, safeOffset)
        .input('pageSize', sql.Int, pageSize)
        .query(`
            SELECT t.id_solicitacao, t.status, t.mensagem, t.created_at, p_origem.nome AS professor_origem_nome,
                s_origem.nome_sala AS sala_origem, s_destino.nome_sala AS sala_destino,
                CONVERT(varchar(10), a_origem.data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), a_origem.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a_origem.hora_fim, 108) AS hora_fim
            FROM dbo.solicitacoes_troca_sala t
            INNER JOIN professores p_origem ON p_origem.id_professor = t.id_professor_origem
            INNER JOIN agendamentos a_origem ON a_origem.id_agendamento = t.id_agendamento_origem
            INNER JOIN agendamentos a_destino ON a_destino.id_agendamento = t.id_agendamento_destino
            INNER JOIN Salas s_origem ON s_origem.id_sala = a_origem.id_sala
            INNER JOIN Salas s_destino ON s_destino.id_sala = a_destino.id_sala
            WHERE t.id_professor_destino = @idProfessorLogado AND t.status = 'PENDENTE'
            ORDER BY t.created_at DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

    return {
        items: result.recordset,
        pagination: {
            page: currentPage,
            pageSize,
            totalItems,
            totalPages
        }
    };
}

async function listarTrocasEnviadas(idProfessorLogado, options = {}) {
    const page = Number.isInteger(options.page) && options.page > 0 ? options.page : 1;
    const pageSizeRaw = Number.isInteger(options.pageSize) && options.pageSize > 0 ? options.pageSize : 8;
    const pageSize = Math.min(8, pageSizeRaw);

    const pool = await getPool();
    const totalResult = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .query(`
            SELECT COUNT(1) AS total
            FROM dbo.solicitacoes_troca_sala t
            WHERE t.id_professor_origem = @idProfessorLogado
              AND t.created_at >= DATEADD(MONTH, -1, SYSDATETIME())
        `);

    const totalItems = Number(totalResult.recordset[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(page, totalPages);
    const safeOffset = (currentPage - 1) * pageSize;

    const result = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .input('offset', sql.Int, safeOffset)
        .input('pageSize', sql.Int, pageSize)
        .query(`
            SELECT t.id_solicitacao, t.status, t.mensagem, t.created_at, t.responded_at,
                p_destino.nome AS professor_destino_nome, s_origem.nome_sala AS sala_origem, s_destino.nome_sala AS sala_destino,
                CONVERT(varchar(10), a_origem.data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), a_origem.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a_origem.hora_fim, 108) AS hora_fim
            FROM dbo.solicitacoes_troca_sala t
            INNER JOIN professores p_destino ON p_destino.id_professor = t.id_professor_destino
            INNER JOIN agendamentos a_origem ON a_origem.id_agendamento = t.id_agendamento_origem
            INNER JOIN agendamentos a_destino ON a_destino.id_agendamento = t.id_agendamento_destino
            INNER JOIN Salas s_origem ON s_origem.id_sala = a_origem.id_sala
            INNER JOIN Salas s_destino ON s_destino.id_sala = a_destino.id_sala
            WHERE t.id_professor_origem = @idProfessorLogado
                            AND t.created_at >= DATEADD(MONTH, -1, SYSDATETIME())
            ORDER BY CASE WHEN t.status = 'PENDENTE' THEN 0 ELSE 1 END, t.created_at DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
        `);

    return {
        items: result.recordset,
        pagination: {
            page: currentPage,
            pageSize,
            totalItems,
            totalPages
        }
    };
}

async function decidirTroca({ idSolicitacao, idProfessorDestino, acao }) {
    const pool = await getPool();
    if (acao === 'recusar') {
        const recusado = await pool.request()
            .input('idSolicitacao', sql.Int, idSolicitacao)
            .input('idProfessorDestino', sql.Int, idProfessorDestino)
            .query(`
                UPDATE dbo.solicitacoes_troca_sala SET status = 'RECUSADA', responded_at = SYSDATETIME()
                WHERE id_solicitacao = @idSolicitacao AND id_professor_destino = @idProfessorDestino AND status = 'PENDENTE'
            `);
        if (!recusado.rowsAffected[0]) throw { status: 404, message: 'Solicitação pendente não encontrada para este professor.' };
        return { message: 'Solicitação recusada.' };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const solicitacaoResult = await new sql.Request(transaction)
            .input('idSolicitacao', sql.Int, idSolicitacao)
            .input('idProfessorDestino', sql.Int, idProfessorDestino)
            .query(`
                SELECT id_solicitacao, id_professor_origem, id_professor_destino, id_agendamento_origem, id_agendamento_destino, status
                FROM dbo.solicitacoes_troca_sala WITH (UPDLOCK, HOLDLOCK)
                WHERE id_solicitacao = @idSolicitacao AND id_professor_destino = @idProfessorDestino
            `);
        if (!solicitacaoResult.recordset.length) throw new Error('Solicitação não encontrada para este professor.');
        const solicitacao = solicitacaoResult.recordset[0];
        if (solicitacao.status !== 'PENDENTE') throw new Error('Esta solicitação não está mais pendente.');

        const agendamentosResult = await new sql.Request(transaction)
            .input('idAgendamentoOrigem', sql.Int, solicitacao.id_agendamento_origem)
            .input('idAgendamentoDestino', sql.Int, solicitacao.id_agendamento_destino)
            .query(`
                SELECT id_agendamento, id_professor, id_sala,
                    CONVERT(varchar(10), data_reservas, 23) AS data_reservas,
                    CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
                    CONVERT(varchar(8), hora_fim, 108) AS hora_fim
                FROM agendamentos WITH (UPDLOCK, HOLDLOCK)
                WHERE id_agendamento IN (@idAgendamentoOrigem, @idAgendamentoDestino)
            `);
        if (agendamentosResult.recordset.length !== 2) throw new Error('Um dos agendamentos não existe mais.');

        const agendamentoOrigem = agendamentosResult.recordset.find((a) => a.id_agendamento === solicitacao.id_agendamento_origem);
        const agendamentoDestino = agendamentosResult.recordset.find((a) => a.id_agendamento === solicitacao.id_agendamento_destino);

        if (agendamentoOrigem.id_professor !== solicitacao.id_professor_origem || agendamentoDestino.id_professor !== solicitacao.id_professor_destino) throw new Error('Os agendamentos já não pertencem aos mesmos professores.');
        if (!getTurnosCompativeis(agendamentoOrigem, agendamentoDestino).length) throw new Error('Os agendamentos mudaram e não são mais compatíveis para troca simples.');
        if (isPastCalendarDay(agendamentoOrigem.data_reservas) || isPastCalendarDay(agendamentoDestino.data_reservas)) throw new Error('Não é permitido concluir troca de agendamentos de dias anteriores.');
        if (agendamentoOrigem.id_sala === agendamentoDestino.id_sala) throw new Error('Os agendamentos já estão na mesma sala.');

        await new sql.Request(transaction).input('novaSala', sql.Int, agendamentoDestino.id_sala).input('id', sql.Int, agendamentoOrigem.id_agendamento).query('UPDATE agendamentos SET id_sala = @novaSala WHERE id_agendamento = @id');
        await new sql.Request(transaction).input('novaSala', sql.Int, agendamentoOrigem.id_sala).input('id', sql.Int, agendamentoDestino.id_agendamento).query('UPDATE agendamentos SET id_sala = @novaSala WHERE id_agendamento = @id');
        await new sql.Request(transaction).input('idSolicitacao', sql.Int, idSolicitacao).query(`UPDATE dbo.solicitacoes_troca_sala SET status = 'ACEITA', responded_at = SYSDATETIME() WHERE id_solicitacao = @idSolicitacao`);

        await transaction.commit();
        return { message: 'Troca realizada com sucesso.' };
    } catch (txError) {
        try { await transaction.rollback(); } catch (_) {}
        throw { status: 400, message: txError.message || 'Não foi possível concluir a troca.' };
    }
}

async function obterResumoTrocaLote(idLote) {
    const pool = await getPool();
    const result = await pool.request()
        .input('idLote', sql.Int, idLote)
        .query(`
            SELECT TOP 1 id_professor_origem, id_professor_destino
            FROM dbo.solicitacoes_troca_sala_lote
            WHERE id_lote = @idLote
        `);

    if (!result.recordset.length) {
        throw { status: 404, message: 'Lote de troca não encontrado.' };
    }

    return result.recordset[0];
}

// ──────────────────────────────────────────────────────────────
// Troca de sala — lote (múltipla)
// ──────────────────────────────────────────────────────────────

async function solicitarTrocaLote({ idProfessorOrigem, mensagem, items }) {
    const pool = await getPool();
    const paresNormalizados = items.map((item) => ({
        id_agendamento_origem: Number(item.id_agendamento_origem),
        id_agendamento_destino: Number(item.id_agendamento_destino)
    }));

    const possuiParInvalido = paresNormalizados.some((item) => !Number.isInteger(item.id_agendamento_origem) || !Number.isInteger(item.id_agendamento_destino) || item.id_agendamento_origem === item.id_agendamento_destino);
    if (possuiParInvalido) throw { status: 400, message: 'Todos os pares do pacote precisam ter agendamentos válidos.' };

    const origens = paresNormalizados.map((i) => i.id_agendamento_origem);
    const destinos = paresNormalizados.map((i) => i.id_agendamento_destino);
    if (new Set(origens).size !== origens.length || new Set(destinos).size !== destinos.length) throw { status: 400, message: 'Não repita o mesmo agendamento dentro do pacote.' };

    const idsEnvolvidos = [...new Set([...origens, ...destinos])];
    const agendamentosResult = await pool.request().query(`
        SELECT id_agendamento, id_professor, id_sala,
            CONVERT(varchar(10), data_reservas, 23) AS data_reservas,
            CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
            CONVERT(varchar(8), hora_fim, 108) AS hora_fim
        FROM agendamentos WHERE id_agendamento IN (${idsEnvolvidos.join(',')})
    `);
    if (agendamentosResult.recordset.length !== idsEnvolvidos.length) throw { status: 404, message: 'Um ou mais agendamentos do pacote não foram encontrados.' };

    const mapaAgendamentos = new Map(agendamentosResult.recordset.map((a) => [a.id_agendamento, a]));
    let idProfessorDestino = null;

    for (const par of paresNormalizados) {
        const agendamentoOrigem = mapaAgendamentos.get(par.id_agendamento_origem);
        const agendamentoDestino = mapaAgendamentos.get(par.id_agendamento_destino);
        if (!agendamentoOrigem || !agendamentoDestino) throw { status: 404, message: 'Par inválido no pacote de troca.' };
        if (agendamentoOrigem.id_professor !== idProfessorOrigem) throw { status: 403, message: 'Todos os agendamentos de origem precisam ser do professor logado.' };
        if (agendamentoDestino.id_professor === idProfessorOrigem) throw { status: 400, message: 'Todos os destinos precisam pertencer a outro professor.' };
        if (idProfessorDestino === null) idProfessorDestino = agendamentoDestino.id_professor;
        if (agendamentoDestino.id_professor !== idProfessorDestino) throw { status: 400, message: 'O pacote múltiplo deve envolver apenas um professor destinatário.' };
        if (isPastCalendarDay(agendamentoOrigem.data_reservas) || isPastCalendarDay(agendamentoDestino.data_reservas)) throw { status: 400, message: 'Não é permitido incluir agendamentos de dias anteriores no pacote de troca.' };
        if (!getTurnosCompativeis(agendamentoOrigem, agendamentoDestino).length) throw { status: 400, message: 'Cada item do pacote precisa ser no mesmo dia com pelo menos um turno compatível.' };
        if (agendamentoOrigem.id_sala === agendamentoDestino.id_sala) throw { status: 400, message: 'Um dos pares selecionados já está na mesma sala.' };
    }

    const simplesPendentes = await pool.request().query(`
        SELECT id_solicitacao FROM dbo.solicitacoes_troca_sala
        WHERE status = 'PENDENTE' AND (id_agendamento_origem IN (${idsEnvolvidos.join(',')}) OR id_agendamento_destino IN (${idsEnvolvidos.join(',')}))
    `);
    if (simplesPendentes.recordset.length) throw { status: 409, message: 'Já existe uma solicitação simples pendente envolvendo um dos agendamentos selecionados.' };

    const lotesPendentes = await pool.request().query(`
        SELECT TOP 1 i.id_item FROM dbo.solicitacoes_troca_sala_lote_item i
        INNER JOIN dbo.solicitacoes_troca_sala_lote l ON l.id_lote = i.id_lote
        WHERE l.status = 'PENDENTE' AND (i.id_agendamento_origem IN (${idsEnvolvidos.join(',')}) OR i.id_agendamento_destino IN (${idsEnvolvidos.join(',')}))
    `);
    if (lotesPendentes.recordset.length) throw { status: 409, message: 'Já existe um pacote pendente envolvendo um dos agendamentos selecionados.' };

    const loteInserido = await pool.request()
        .input('idProfessorOrigem', sql.Int, idProfessorOrigem)
        .input('idProfessorDestino', sql.Int, idProfessorDestino)
        .input('mensagem', sql.NVarChar, mensagem || null)
        .query(`
            INSERT INTO dbo.solicitacoes_troca_sala_lote (id_professor_origem, id_professor_destino, mensagem, status)
            OUTPUT INSERTED.id_lote VALUES (@idProfessorOrigem, @idProfessorDestino, @mensagem, 'PENDENTE')
        `);
    const idLote = loteInserido.recordset[0].id_lote;

    for (const par of paresNormalizados) {
        await pool.request()
            .input('idLote', sql.Int, idLote)
            .input('idAgendamentoOrigem', sql.Int, par.id_agendamento_origem)
            .input('idAgendamentoDestino', sql.Int, par.id_agendamento_destino)
            .query(`
                INSERT INTO dbo.solicitacoes_troca_sala_lote_item (id_lote, id_agendamento_origem, id_agendamento_destino, status)
                VALUES (@idLote, @idAgendamentoOrigem, @idAgendamentoDestino, 'PENDENTE')
            `);
    }
    return idLote;
}

async function listarLotesRecebidos(idProfessorLogado) {
    const pool = await getPool();
    const result = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .query(`
            SELECT l.id_lote, l.status, l.mensagem, l.created_at, p.nome AS professor_origem_nome,
                COUNT(i.id_item) AS quantidade_itens,
                MIN(CONVERT(varchar(10), a.data_reservas, 23)) AS primeira_data,
                MAX(CONVERT(varchar(10), a.data_reservas, 23)) AS ultima_data
            FROM dbo.solicitacoes_troca_sala_lote l
            INNER JOIN professores p ON p.id_professor = l.id_professor_origem
            INNER JOIN dbo.solicitacoes_troca_sala_lote_item i ON i.id_lote = l.id_lote
            INNER JOIN agendamentos a ON a.id_agendamento = i.id_agendamento_origem
            WHERE l.id_professor_destino = @idProfessorLogado
            GROUP BY l.id_lote, l.status, l.mensagem, l.created_at, p.nome
            ORDER BY l.created_at DESC
        `);
    return result.recordset;
}

async function listarLotesEnviados(idProfessorLogado) {
    const pool = await getPool();
    const result = await pool.request()
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .query(`
            SELECT l.id_lote, l.status, l.mensagem, l.created_at, l.responded_at, p.nome AS professor_destino_nome,
                COUNT(i.id_item) AS quantidade_itens,
                MIN(CONVERT(varchar(10), a.data_reservas, 23)) AS primeira_data,
                MAX(CONVERT(varchar(10), a.data_reservas, 23)) AS ultima_data
            FROM dbo.solicitacoes_troca_sala_lote l
            INNER JOIN professores p ON p.id_professor = l.id_professor_destino
            INNER JOIN dbo.solicitacoes_troca_sala_lote_item i ON i.id_lote = l.id_lote
            INNER JOIN agendamentos a ON a.id_agendamento = i.id_agendamento_origem
            WHERE l.id_professor_origem = @idProfessorLogado
            GROUP BY l.id_lote, l.status, l.mensagem, l.created_at, l.responded_at, p.nome
            ORDER BY l.created_at DESC
        `);
    return result.recordset;
}

async function buscarDetalhesLote(idLote, idProfessorLogado) {
    const pool = await getPool();
    const loteResult = await pool.request()
        .input('idLote', sql.Int, idLote)
        .input('idProfessorLogado', sql.Int, idProfessorLogado)
        .query(`
            SELECT l.id_lote, l.status, l.mensagem, l.created_at, l.responded_at, l.id_professor_origem, l.id_professor_destino,
                p1.nome AS professor_origem_nome, p2.nome AS professor_destino_nome
            FROM dbo.solicitacoes_troca_sala_lote l
            INNER JOIN professores p1 ON p1.id_professor = l.id_professor_origem
            INNER JOIN professores p2 ON p2.id_professor = l.id_professor_destino
            WHERE l.id_lote = @idLote AND (l.id_professor_origem = @idProfessorLogado OR l.id_professor_destino = @idProfessorLogado)
        `);
    if (!loteResult.recordset.length) throw { status: 404, message: 'Lote não encontrado para este usuário.' };

    const itensResult = await pool.request()
        .input('idLote', sql.Int, idLote)
        .query(`
            SELECT i.id_item, i.status, i.id_agendamento_origem, i.id_agendamento_destino,
                s1.nome_sala AS sala_origem, s2.nome_sala AS sala_destino,
                CONVERT(varchar(10), a1.data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), a1.hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), a1.hora_fim, 108) AS hora_fim
            FROM dbo.solicitacoes_troca_sala_lote_item i
            INNER JOIN agendamentos a1 ON a1.id_agendamento = i.id_agendamento_origem
            INNER JOIN agendamentos a2 ON a2.id_agendamento = i.id_agendamento_destino
            INNER JOIN Salas s1 ON s1.id_sala = a1.id_sala
            INNER JOIN Salas s2 ON s2.id_sala = a2.id_sala
            WHERE i.id_lote = @idLote ORDER BY a1.data_reservas, a1.hora_inicio
        `);
    return { lote: loteResult.recordset[0], itens: itensResult.recordset };
}

async function decidirTrocaLote({ idLote, idProfessorDestino, acao }) {
    const pool = await getPool();
    if (acao === 'recusar') {
        const recusado = await pool.request()
            .input('idLote', sql.Int, idLote)
            .input('idProfessorDestino', sql.Int, idProfessorDestino)
            .query(`UPDATE dbo.solicitacoes_troca_sala_lote SET status = 'RECUSADO', responded_at = SYSDATETIME() WHERE id_lote = @idLote AND id_professor_destino = @idProfessorDestino AND status = 'PENDENTE'`);
        if (!recusado.rowsAffected[0]) throw { status: 404, message: 'Lote pendente não encontrado para este professor.' };
        await pool.request().input('idLote', sql.Int, idLote).query(`UPDATE dbo.solicitacoes_troca_sala_lote_item SET status = 'RECUSADO' WHERE id_lote = @idLote`);
        return { message: 'Pacote recusado.' };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const loteResult = await new sql.Request(transaction)
            .input('idLote', sql.Int, idLote)
            .input('idProfessorDestino', sql.Int, idProfessorDestino)
            .query(`
                SELECT id_lote, id_professor_origem, id_professor_destino, status
                FROM dbo.solicitacoes_troca_sala_lote WITH (UPDLOCK, HOLDLOCK)
                WHERE id_lote = @idLote AND id_professor_destino = @idProfessorDestino
            `);
        if (!loteResult.recordset.length) throw new Error('Lote não encontrado para este professor.');
        const lote = loteResult.recordset[0];
        if (lote.status !== 'PENDENTE') throw new Error('Este lote não está mais pendente.');

        const itensResult = await new sql.Request(transaction)
            .input('idLote', sql.Int, idLote)
            .query(`SELECT id_item, id_agendamento_origem, id_agendamento_destino, status FROM dbo.solicitacoes_troca_sala_lote_item WITH (UPDLOCK, HOLDLOCK) WHERE id_lote = @idLote`);
        if (!itensResult.recordset.length) throw new Error('O lote não possui itens para troca.');

        const idsEnvolvidos = [...new Set(itensResult.recordset.flatMap((item) => [item.id_agendamento_origem, item.id_agendamento_destino]))];
        const agendamentosResult = await new sql.Request(transaction).query(`
            SELECT id_agendamento, id_professor, id_sala,
                CONVERT(varchar(10), data_reservas, 23) AS data_reservas,
                CONVERT(varchar(8), hora_inicio, 108) AS hora_inicio,
                CONVERT(varchar(8), hora_fim, 108) AS hora_fim
            FROM agendamentos WITH (UPDLOCK, HOLDLOCK) WHERE id_agendamento IN (${idsEnvolvidos.join(',')})
        `);
        if (agendamentosResult.recordset.length !== idsEnvolvidos.length) throw new Error('Um dos agendamentos do lote não existe mais.');

        const mapaAgendamentos = new Map(agendamentosResult.recordset.map((a) => [a.id_agendamento, a]));

        for (const item of itensResult.recordset) {
            const agendamentoOrigem = mapaAgendamentos.get(item.id_agendamento_origem);
            const agendamentoDestino = mapaAgendamentos.get(item.id_agendamento_destino);
            if (!agendamentoOrigem || !agendamentoDestino) throw new Error('Há um item inválido dentro do lote.');
            if (agendamentoOrigem.id_professor !== lote.id_professor_origem || agendamentoDestino.id_professor !== lote.id_professor_destino) throw new Error('Os agendamentos do lote já não pertencem aos mesmos professores.');
            if (!getTurnosCompativeis(agendamentoOrigem, agendamentoDestino).length) throw new Error('Um item do lote deixou de ser compatível para troca múltipla.');
            if (isPastCalendarDay(agendamentoOrigem.data_reservas) || isPastCalendarDay(agendamentoDestino.data_reservas)) throw new Error('Não é permitido concluir pacote com agendamentos de dias anteriores.');
            if (agendamentoOrigem.id_sala === agendamentoDestino.id_sala) throw new Error('Um item do lote já está na mesma sala.');
        }

        for (const item of itensResult.recordset) {
            const agendamentoOrigem = mapaAgendamentos.get(item.id_agendamento_origem);
            const agendamentoDestino = mapaAgendamentos.get(item.id_agendamento_destino);
            await new sql.Request(transaction).input('novaSala', sql.Int, agendamentoDestino.id_sala).input('id', sql.Int, agendamentoOrigem.id_agendamento).query('UPDATE agendamentos SET id_sala = @novaSala WHERE id_agendamento = @id');
            await new sql.Request(transaction).input('novaSala', sql.Int, agendamentoOrigem.id_sala).input('id', sql.Int, agendamentoDestino.id_agendamento).query('UPDATE agendamentos SET id_sala = @novaSala WHERE id_agendamento = @id');
        }

        await new sql.Request(transaction).input('idLote', sql.Int, idLote).query(`UPDATE dbo.solicitacoes_troca_sala_lote SET status = 'ACEITO', responded_at = SYSDATETIME() WHERE id_lote = @idLote`);
        await new sql.Request(transaction).input('idLote', sql.Int, idLote).query(`UPDATE dbo.solicitacoes_troca_sala_lote_item SET status = 'ACEITO' WHERE id_lote = @idLote`);

        await transaction.commit();
        return { message: 'Pacote de trocas realizado com sucesso.' };
    } catch (txError) {
        try { await transaction.rollback(); } catch (_) {}
        throw { status: 400, message: txError.message || 'Não foi possível concluir o pacote de trocas.' };
    }
}

// ──────────────────────────────────────────────────────────────
// Legado — verificar agendamentos expirados
// ──────────────────────────────────────────────────────────────

async function _excluirAgendamentosExpiradosById(agendamentoId, pool) {
    await pool.request()
        .input('id', sql.Int, agendamentoId)
        .query('DELETE FROM agendamentos WHERE id_agendamento = @id');
}

async function verificarEExcluirAgendamentosExpirados() {
    const now = new Date();
    const pool = await getPool();

    const result = await pool.request().query(`
        SELECT id_agendamento, data_fim, hora_fim
        FROM agendamentos
    `);

    for (const agendamento of result.recordset) {
        const dataFimParts = String(agendamento.data_fim || '').split('/');
        const horaFimParts = String(agendamento.hora_fim || '').split(':');

        const dataFimDate = new Date(Date.UTC(
            Number(dataFimParts[2]),
            Number(dataFimParts[1]) - 1,
            Number(dataFimParts[0]),
            Number(horaFimParts[0]),
            Number(horaFimParts[1]),
            Number(horaFimParts[2] || 0)
        ));

        if (!Number.isNaN(dataFimDate.getTime()) && now >= dataFimDate) {
            await _excluirAgendamentosExpiradosById(agendamento.id_agendamento, pool);
        }
    }
}

module.exports = {
    agendarSala,
    verificarDisponibilidadeAgendamentos,
    editarAgendamento,
    editarProfessorAgendamento,
    verificarAgendamento,
    listarAgendamentosSala,
    listarAgendamentosProfessor,
    listarAgendamentosProfessorLogado,
    excluirAgendamentoById,
    excluirAgendamentosIntervalo,
    listarAgendamentosUnidade,
    listarAgendamentosFiltrados,
    listarAgendamentosDashboardFiltrados,
    listarAgendamentosParaTrocaCoordenador,
    listarPossiveisTrocas,
    coordenadorTrocaDiretaSala,
    solicitarTroca,
    obterResumoTrocaPorSolicitacao,
    listarTrocasRecebidas,
    listarTrocasEnviadas,
    decidirTroca,
    solicitarTrocaLote,
    obterResumoTrocaLote,
    listarLotesRecebidos,
    listarLotesEnviados,
    buscarDetalhesLote,
    decidirTrocaLote,
    verificarEExcluirAgendamentosExpirados,
};
