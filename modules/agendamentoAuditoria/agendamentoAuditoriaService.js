const sql = require('mssql');
const config = require('../../dbConfig');

let poolPromise = null;

const ACOES = new Set(['CRIACAO', 'EDICAO', 'EXCLUSAO', 'CONFLITO', 'ERRO']);
const RESULTADOS = new Set(['SUCESSO', 'PARCIAL', 'BLOQUEADO', 'ERRO']);
const SENSITIVE_KEY_RE = /(senha|password|cookie|session|sessao|token|authorization|secret|avisoProfessorToken)/i;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

function sanitizeAuditValue(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 8) return '[limite de profundidade]';
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeAuditValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        const output = {};
        Object.entries(value).forEach(([key, item]) => {
            if (SENSITIVE_KEY_RE.test(key)) return;
            output[key] = sanitizeAuditValue(item, depth + 1);
        });
        return output;
    }
    return value;
}

function toJson(value) {
    if (value === null || value === undefined) return null;
    return JSON.stringify(sanitizeAuditValue(value));
}

function parseJson(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function normalizeText(value, maxLength) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    return maxLength ? text.slice(0, maxLength) : text;
}

function normalizeInt(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

function normalizeFilterId(value) {
    const text = String(value ?? '').trim();
    if (!/^-?\d+$/.test(text)) return null;

    const number = Number(text);
    return Number.isSafeInteger(number) && number >= -2147483648 && number <= 2147483647
        ? number
        : null;
}

function sanitizeCorrelationId(value) {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
        ? text
        : null;
}

function isAuditRole(user) {
    return user?.permissao === 'admin' || user?.permissao === 'coordenador';
}

function getAllowedUnits(user) {
    if (!isAuditRole(user)) {
        return [];
    }

    if (user.permissao === 'admin') {
        return null;
    }

    return Array.isArray(user.unidades) ? user.unidades.map(String).filter(Boolean) : [];
}

function buildResumoUsuario(user) {
    return {
        id: normalizeInt(user?.id_professor),
        nome: normalizeText(user?.nome, 255),
        login: normalizeText(user?.login, 255),
        permissao: normalizeText(user?.permissao, 50)
    };
}

async function registrarEvento(evento, options = {}) {
    const acao = String(evento?.acao || '').toUpperCase();
    const resultado = String(evento?.resultado || '').toUpperCase();

    if (!ACOES.has(acao)) {
        throw new Error('Acao de auditoria invalida.');
    }
    if (!RESULTADOS.has(resultado)) {
        throw new Error('Resultado de auditoria invalido.');
    }

    const usuario = buildResumoUsuario(evento.usuarioResponsavel || {});
    const request = options.transaction
        ? new sql.Request(options.transaction)
        : (await getPool()).request();

    try {
        await request
            .input('acao', sql.NVarChar(20), acao)
            .input('resultado', sql.NVarChar(20), resultado)
            .input('usuario_responsavel_id', sql.Int, usuario.id)
            .input('usuario_responsavel_nome', sql.NVarChar(255), usuario.nome)
            .input('usuario_responsavel_login', sql.NVarChar(255), usuario.login)
            .input('usuario_responsavel_permissao', sql.NVarChar(50), usuario.permissao)
            .input('id_agendamento', sql.Int, normalizeInt(evento.idAgendamento))
            .input('id_correlacao', sql.UniqueIdentifier, sanitizeCorrelationId(evento.idCorrelacao))
            .input('codigo_unidade', sql.NVarChar(50), normalizeText(evento.codigoUnidade, 50))
            .input('nome_unidade', sql.NVarChar(150), normalizeText(evento.nomeUnidade, 150))
            .input('id_sala', sql.Int, normalizeInt(evento.idSala))
            .input('nome_sala', sql.NVarChar(255), normalizeText(evento.nomeSala, 255))
            .input('id_professor', sql.Int, normalizeInt(evento.idProfessor))
            .input('nome_professor', sql.NVarChar(255), normalizeText(evento.nomeProfessor, 255))
            .input('data_reserva', sql.NVarChar(20), normalizeText(evento.dataReserva, 20))
            .input('hora_inicio', sql.NVarChar(20), normalizeText(evento.horaInicio, 20))
            .input('hora_fim', sql.NVarChar(20), normalizeText(evento.horaFim, 20))
            .input('motivo', sql.NVarChar(720), normalizeText(evento.motivo, 720))
            .input('tipo_aula', sql.NVarChar(720), normalizeText(evento.tipoAula, 720))
            .input('resumo', sql.NVarChar(500), normalizeText(evento.resumo, 500) || `${acao} ${resultado}`)
            .input('detalhes_json', sql.NVarChar(sql.MAX), toJson(evento.detalhes))
            .input('dados_anteriores_json', sql.NVarChar(sql.MAX), toJson(evento.dadosAnteriores))
            .input('dados_posteriores_json', sql.NVarChar(sql.MAX), toJson(evento.dadosPosteriores))
            .input('erro_mensagem', sql.NVarChar(sql.MAX), normalizeText(evento.erroMensagem))
            .query(`
                INSERT INTO dbo.AgendamentoAuditoria (
                    acao,
                    resultado,
                    usuario_responsavel_id,
                    usuario_responsavel_nome,
                    usuario_responsavel_login,
                    usuario_responsavel_permissao,
                    id_agendamento,
                    id_correlacao,
                    codigo_unidade,
                    nome_unidade,
                    id_sala,
                    nome_sala,
                    id_professor,
                    nome_professor,
                    data_reserva,
                    hora_inicio,
                    hora_fim,
                    motivo,
                    tipo_aula,
                    resumo,
                    detalhes_json,
                    dados_anteriores_json,
                    dados_posteriores_json,
                    erro_mensagem
                )
                VALUES (
                    @acao,
                    @resultado,
                    @usuario_responsavel_id,
                    @usuario_responsavel_nome,
                    @usuario_responsavel_login,
                    @usuario_responsavel_permissao,
                    @id_agendamento,
                    @id_correlacao,
                    @codigo_unidade,
                    @nome_unidade,
                    @id_sala,
                    @nome_sala,
                    @id_professor,
                    @nome_professor,
                    @data_reserva,
                    @hora_inicio,
                    @hora_fim,
                    @motivo,
                    @tipo_aula,
                    @resumo,
                    @detalhes_json,
                    @dados_anteriores_json,
                    @dados_posteriores_json,
                    @erro_mensagem
                )
            `);
    } catch (error) {
        if (options.suppressErrors) {
            console.warn('Falha ao registrar auditoria de agendamento:', error.message);
            return;
        }
        throw error;
    }
}

function addAllowedUnitFilter({ user, request, where }) {
    const allowedUnits = getAllowedUnits(user);

    if (allowedUnits === null) {
        return { blocked: false, allowedUnits };
    }

    if (!allowedUnits.length) {
        where.push('1 = 0');
        return { blocked: false, allowedUnits };
    }

    const placeholders = allowedUnits.map((codigo, index) => {
        request.input(`allowedUnit${index}`, sql.NVarChar(50), codigo);
        return `@allowedUnit${index}`;
    });
    where.push(`codigo_unidade IN (${placeholders.join(', ')})`);

    return { blocked: false, allowedUnits };
}

function applyDateFilter(filters, request, where) {
    if (filters.dataInicio) {
        const inicio = new Date(`${filters.dataInicio}T00:00:00`);
        if (!Number.isNaN(inicio.getTime())) {
            request.input('dataInicio', sql.DateTime2, inicio);
            where.push('data_evento >= @dataInicio');
        }
    }

    if (filters.dataFim) {
        const fim = new Date(`${filters.dataFim}T23:59:59.999`);
        if (!Number.isNaN(fim.getTime())) {
            request.input('dataFim', sql.DateTime2, fim);
            where.push('data_evento <= @dataFim');
        }
    }
}

function validateRequiredPeriod(filters) {
    const dataInicio = normalizeText(filters.dataInicio, 10);
    const dataFim = normalizeText(filters.dataFim, 10);

    if (!dataInicio || !dataFim) {
        const error = new Error('Informe data de inicio e data de fim para consultar a auditoria.');
        error.status = 400;
        throw error;
    }

    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        const error = new Error('Periodo de auditoria invalido.');
        error.status = 400;
        throw error;
    }

    if (inicio > fim) {
        const error = new Error('A data de inicio nao pode ser maior que a data de fim.');
        error.status = 400;
        throw error;
    }
}

function applyFilters(filters, request, where, user) {
    addAllowedUnitFilter({ user, request, where });
    applyDateFilter(filters, request, where);

    const unidade = normalizeText(filters.unidade, 50);
    if (unidade) {
        const allowedUnits = getAllowedUnits(user);
        if (allowedUnits !== null && !allowedUnits.includes(unidade)) {
            const error = new Error('Acesso negado para esta unidade.');
            error.status = 403;
            throw error;
        }
        request.input('unidade', sql.NVarChar(50), unidade);
        where.push('codigo_unidade = @unidade');
    }

    const acao = normalizeText(filters.acao, 20)?.toUpperCase();
    if (acao) {
        if (!ACOES.has(acao)) {
            const error = new Error('Acao invalida.');
            error.status = 400;
            throw error;
        }
        request.input('acaoFiltro', sql.NVarChar(20), acao);
        where.push('acao = @acaoFiltro');
    }

    const resultado = normalizeText(filters.resultado, 20)?.toUpperCase();
    if (resultado) {
        if (!RESULTADOS.has(resultado)) {
            const error = new Error('Resultado invalido.');
            error.status = 400;
            throw error;
        }
        request.input('resultadoFiltro', sql.NVarChar(20), resultado);
        where.push('resultado = @resultadoFiltro');
    }

    const usuario = normalizeText(filters.usuario, 255);
    if (usuario) {
        request.input('usuario', sql.NVarChar(255), `%${usuario}%`);
        where.push('(usuario_responsavel_nome LIKE @usuario OR usuario_responsavel_login LIKE @usuario)');
    }

    const sala = normalizeText(filters.sala, 255);
    if (sala) {
        const salaConditions = ['nome_sala LIKE @sala'];
        const salaId = normalizeFilterId(sala);
        request.input('sala', sql.NVarChar(255), `%${sala}%`);
        if (salaId !== null) {
            request.input('salaExato', sql.Int, salaId);
            salaConditions.push('id_sala = @salaExato');
        }
        where.push(`(${salaConditions.join(' OR ')})`);
    }

    const professor = normalizeText(filters.professor, 255);
    if (professor) {
        const professorConditions = ['nome_professor LIKE @professor'];
        const professorId = normalizeFilterId(professor);
        request.input('professor', sql.NVarChar(255), `%${professor}%`);
        if (professorId !== null) {
            request.input('professorExato', sql.Int, professorId);
            professorConditions.push('id_professor = @professorExato');
        }
        where.push(`(${professorConditions.join(' OR ')})`);
    }

    const idAgendamento = normalizeInt(filters.idAgendamento);
    if (idAgendamento !== null) {
        request.input('idAgendamento', sql.Int, idAgendamento);
        where.push('id_agendamento = @idAgendamento');
    }

    const idCorrelacao = sanitizeCorrelationId(filters.idCorrelacao);
    if (idCorrelacao) {
        request.input('idCorrelacao', sql.UniqueIdentifier, idCorrelacao);
        where.push('id_correlacao = @idCorrelacao');
    }
}

function mapRegistro(row) {
    return {
        id_auditoria: row.id_auditoria,
        data_evento: row.data_evento,
        acao: row.acao,
        resultado: row.resultado,
        usuario_responsavel_id: row.usuario_responsavel_id,
        usuario_responsavel_nome: row.usuario_responsavel_nome,
        usuario_responsavel_login: row.usuario_responsavel_login,
        usuario_responsavel_permissao: row.usuario_responsavel_permissao,
        id_agendamento: row.id_agendamento,
        id_correlacao: row.id_correlacao,
        codigo_unidade: row.codigo_unidade,
        nome_unidade: row.nome_unidade,
        id_sala: row.id_sala,
        nome_sala: row.nome_sala,
        id_professor: row.id_professor,
        nome_professor: row.nome_professor,
        data_reserva: row.data_reserva,
        hora_inicio: row.hora_inicio,
        hora_fim: row.hora_fim,
        motivo: row.motivo,
        tipo_aula: row.tipo_aula,
        resumo: row.resumo,
        detalhes: parseJson(row.detalhes_json),
        dados_anteriores: parseJson(row.dados_anteriores_json),
        dados_posteriores: parseJson(row.dados_posteriores_json),
        erro_mensagem: row.erro_mensagem
    };
}

async function listarAuditoria({ user, filters = {} }) {
    if (!isAuditRole(user)) {
        const error = new Error('Acesso negado.');
        error.status = 403;
        throw error;
    }
    validateRequiredPeriod(filters);

    const pool = await getPool();
    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(filters.pageSize, 10) || 25));
    const offset = (page - 1) * pageSize;

    const request = pool.request();
    const where = [];
    applyFilters(filters, request, where, user);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);

    const result = await request.query(`
        SELECT
            COUNT(1) AS total,
            SUM(CASE WHEN acao = 'CRIACAO' THEN 1 ELSE 0 END) AS criacoes,
            SUM(CASE WHEN acao = 'EDICAO' THEN 1 ELSE 0 END) AS edicoes,
            SUM(CASE WHEN acao = 'EXCLUSAO' THEN 1 ELSE 0 END) AS exclusoes,
            SUM(CASE WHEN resultado = 'BLOQUEADO' THEN 1 ELSE 0 END) AS bloqueios,
            SUM(CASE WHEN resultado = 'ERRO' OR acao = 'ERRO' THEN 1 ELSE 0 END) AS erros
        FROM dbo.AgendamentoAuditoria
        ${whereSql};

        SELECT *
        FROM dbo.AgendamentoAuditoria
        ${whereSql}
        ORDER BY data_evento DESC, id_auditoria DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
    `);

    const resumo = result.recordsets[0]?.[0] || {};
    const registros = (result.recordsets[1] || []).map(mapRegistro);

    return {
        resumo: {
            total: resumo.total || 0,
            criacoes: resumo.criacoes || 0,
            edicoes: resumo.edicoes || 0,
            exclusoes: resumo.exclusoes || 0,
            bloqueios: resumo.bloqueios || 0,
            erros: resumo.erros || 0
        },
        pagination: {
            page,
            pageSize,
            total: resumo.total || 0,
            totalPages: Math.max(1, Math.ceil((resumo.total || 0) / pageSize))
        },
        registros
    };
}

async function obterAuditoriaPorId({ user, id }) {
    if (!isAuditRole(user)) {
        const error = new Error('Acesso negado.');
        error.status = 403;
        throw error;
    }

    const idAuditoria = normalizeInt(id);
    if (idAuditoria === null) {
        const error = new Error('ID de auditoria invalido.');
        error.status = 400;
        throw error;
    }

    const pool = await getPool();
    const request = pool.request().input('idAuditoria', sql.Int, idAuditoria);
    const where = ['id_auditoria = @idAuditoria'];
    addAllowedUnitFilter({ user, request, where });

    const result = await request.query(`
        SELECT TOP 1 *
        FROM dbo.AgendamentoAuditoria
        WHERE ${where.join(' AND ')}
    `);

    if (!result.recordset.length) {
        const error = new Error('Registro de auditoria nao encontrado.');
        error.status = 404;
        throw error;
    }

    return mapRegistro(result.recordset[0]);
}

module.exports = {
    ACOES,
    RESULTADOS,
    getAllowedUnits,
    listarAuditoria,
    obterAuditoriaPorId,
    registrarEvento,
    sanitizeAuditValue
};
