const sql = require('mssql');
const config = require('../../dbConfig');

const TIPOS = new Set(['PRESENCIAL', 'EAD', 'PREPARACAO']);
const TURNOS = new Set(['MANHA', 'TARDE', 'NOITE']);
const DIAS = new Set([1, 2, 3, 4, 5, 6]);
let poolPromise;

function getPool() {
    if (!poolPromise) poolPromise = sql.connect(config).catch((error) => { poolPromise = null; throw error; });
    return poolPromise;
}

function falha(status, message) { const error = new Error(message); error.status = status; throw error; }
function inteiro(value, nome) { const n = Number(value); if (!Number.isInteger(n) || n <= 0) falha(400, `${nome} invalido.`); return n; }
function texto(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function dataIso(value, nome) { const v = texto(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) falha(400, `${nome} invalida.`); return v; }
function ehGestor(user) { return user?.permissao === 'admin' || user?.permissao === 'coordenador'; }
function unidadesPermitidas(user) { return user?.permissao === 'admin' ? null : (Array.isArray(user?.unidades) ? user.unidades.map(String) : []); }
function validarUnidade(user, unidade) { const codigo = texto(unidade, 10); const permitidas = unidadesPermitidas(user); if (!codigo || (permitidas !== null && !permitidas.includes(codigo))) falha(403, 'Acesso negado para esta unidade.'); return codigo; }
function normalizarDias(value) { if (!Array.isArray(value)) falha(400, 'Selecione ao menos um dia da semana.'); const dias = [...new Set(value.map(Number))]; if (!dias.length || dias.some((dia) => !DIAS.has(dia))) falha(400, 'Dias da semana invalidos.'); return dias.sort(); }

function normalizarPayload(user, body, professorForcado) {
    const tipo = texto(body.tipo, 20).toUpperCase();
    const turno = texto(body.turno, 10).toUpperCase();
    if (!TIPOS.has(tipo)) falha(400, 'Tipo de alocacao invalido.');
    if (!TURNOS.has(turno)) falha(400, 'Turno invalido.');
    const dataInicio = dataIso(body.data_inicio, 'Data de inicio');
    const dataFim = dataIso(body.data_fim, 'Data de termino');
    if (dataFim < dataInicio) falha(400, 'A data de termino nao pode ser anterior a data de inicio.');
    if (!ehGestor(user)) falha(403, 'Acesso exclusivo da Coordenacao e Administracao.');
    const idProfessor = professorForcado || inteiro(body.id_professor, 'Professor');
    const preparacao = tipo === 'PREPARACAO';
    const idCursoUc = preparacao ? null : inteiro(body.id_curso_uc, 'Unidade curricular');
    const idTurma = preparacao ? null : inteiro(body.id_turma, 'Turma');
    return { idProfessor, codigoUnidade: validarUnidade(user, body.codigo_unidade), tipo, turno, idCursoUc, idTurma, dataInicio, dataFim, dias: normalizarDias(body.dias), observacao: texto(body.observacao, 1000) || null };
}

function normalizarPayloadColetivo(user, body) {
    if (!ehGestor(user)) falha(403, 'Acesso exclusivo da Coordenacao e Administracao.');
    const codigoUnidade = validarUnidade(user, body.codigo_unidade);
    const tipo = texto(body.tipo, 20).toUpperCase();
    if (tipo !== 'PREPARACAO') falha(400, 'Atividades coletivas sem Curso, UC e Turma devem utilizar o tipo PREPARACAO.');
    if (!Array.isArray(body.turnos)) falha(400, 'Selecione ao menos um turno.');
    const turnos = [...new Set(body.turnos.map((turno) => texto(turno, 10).toUpperCase()))];
    if (!turnos.length) falha(400, 'Selecione ao menos um turno.');
    if (turnos.some((turno) => !TURNOS.has(turno))) falha(400, 'Turno invalido.');
    const dataInicio = dataIso(body.data_inicio, 'Data de inicio');
    const dataFim = dataIso(body.data_fim, 'Data de termino');
    if (dataFim < dataInicio) falha(400, 'A data de termino nao pode ser anterior a data de inicio.');
    const nomeAtividade = texto(body.nome_atividade, 200);
    if (!nomeAtividade) falha(400, 'Nome / Atividade e obrigatorio.');
    if (!Array.isArray(body.ids_professores)) falha(400, 'Selecione ao menos um professor.');
    const idsProfessores = [...new Set(body.ids_professores.map((id) => inteiro(id, 'Professor')))];
    if (!idsProfessores.length) falha(400, 'Selecione ao menos um professor.');
    const observacaoAdicional = texto(body.observacao, 750);
    // Provisorio: o schema atual nao possui coluna de atividade. Mantemos texto legivel,
    // sem JSON, para permitir migracao simples quando houver um campo dedicado.
    const observacao = `Atividade: ${nomeAtividade}${observacaoAdicional ? `\nObservacao: ${observacaoAdicional}` : ''}`;
    return { idsProfessores, codigoUnidade, tipo, turnos, dataInicio, dataFim, dias: normalizarDias(body.dias), nomeAtividade, observacao };
}

function adicionarFiltroUnidades(request, where, user, alias = 'a') {
    const unidades = unidadesPermitidas(user);
    if (unidades === null) return;
    if (!unidades.length) { where.push('1 = 0'); return; }
    const params = unidades.map((codigo, i) => { request.input(`unidadePermitida${i}`, sql.VarChar(10), codigo); return `@unidadePermitida${i}`; });
    where.push(`${alias}.codigo_unidade IN (${params.join(', ')})`);
}

const SELECT_COMPLETO = `
    SELECT a.id_alocacao, a.id_professor, p.nome AS nome_professor, a.codigo_unidade,
           u.nome_unidade, a.tipo, a.turno, a.id_curso_uc, a.id_turma,
           CONVERT(varchar(10), a.data_inicio, 23) AS data_inicio,
           CONVERT(varchar(10), a.data_fim, 23) AS data_fim,
           a.observacao, a.ativo, a.criado_em, a.atualizado_em,
           ca.id_curso, ca.nome_curso, ca.modalidade, ta.descricao AS unidade_curricular,
           cuc.carga_horaria_total, cuc.modulo, turma.codigo_reduzido,
           STRING_AGG(CONVERT(varchar(1), ad.dia_semana), ',') WITHIN GROUP (ORDER BY ad.dia_semana) AS dias_csv
    FROM dbo.AlocacaoDocente a
    JOIN dbo.professores p ON p.id_professor = a.id_professor
    JOIN dbo.Unidades u ON u.codigo_unidade = a.codigo_unidade
    LEFT JOIN dbo.CursoUnidadeCurricular cuc ON cuc.id_curso_uc = a.id_curso_uc
    LEFT JOIN dbo.CursoAcademico ca ON ca.id_curso = cuc.id_curso
    LEFT JOIN dbo.tipos_aula ta ON ta.id_tipo_aula = cuc.id_tipo_aula
    LEFT JOIN dbo.TurmaAcademica turma ON turma.id_turma = a.id_turma
    LEFT JOIN dbo.AlocacaoDocenteDias ad ON ad.id_alocacao = a.id_alocacao`;

const GROUP_COMPLETO = `GROUP BY a.id_alocacao, a.id_professor, p.nome, a.codigo_unidade, u.nome_unidade,
    a.tipo, a.turno, a.id_curso_uc, a.id_turma, a.data_inicio, a.data_fim, a.observacao,
    a.ativo, a.criado_em, a.atualizado_em, ca.id_curso, ca.nome_curso, ca.modalidade,
    ta.descricao, cuc.carga_horaria_total, cuc.modulo, turma.codigo_reduzido`;

function mapear(row) { return { ...row, ativo: Boolean(row.ativo), dias: texto(row.dias_csv).split(',').filter(Boolean).map(Number) }; }

async function obterContexto(user) {
    const pool = await getPool();
    const request = pool.request().input('idProfessor', sql.Int, inteiro(user.id_professor, 'Usuario'));
    const where = [];
    adicionarFiltroUnidades(request, where, user, 'u');
    const unidades = await request.query(`SELECT u.codigo_unidade, u.nome_unidade FROM dbo.Unidades u ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.nome_unidade`);
    return { usuario: { id_professor: user.id_professor, nome: user.nome, permissao: user.permissao }, unidades: unidades.recordset, pode_gerenciar: ehGestor(user) };
}

async function listarCursos(user, unidade) {
    const codigo = validarUnidade(user, unidade);
    const pool = await getPool();
    const result = await pool.request().input('unidade', sql.VarChar(10), codigo).query(`SELECT id_curso, codigo_curso, nome_curso, modalidade FROM dbo.CursoAcademico WHERE codigo_unidade = @unidade AND ativo = 1 ORDER BY nome_curso`);
    return result.recordset;
}

async function listarUcsCurso(user, idCurso) {
    const pool = await getPool();
    const request = pool.request().input('idCurso', sql.Int, inteiro(idCurso, 'Curso'));
    const where = ['cuc.id_curso = @idCurso', 'cuc.ativo = 1', 'ca.ativo = 1'];
    adicionarFiltroUnidades(request, where, user, 'ca');
    const result = await request.query(`SELECT cuc.id_curso_uc, cuc.id_tipo_aula, ta.descricao, cuc.codigo_uc, cuc.carga_horaria_total, cuc.modulo FROM dbo.CursoUnidadeCurricular cuc JOIN dbo.CursoAcademico ca ON ca.id_curso = cuc.id_curso JOIN dbo.tipos_aula ta ON ta.id_tipo_aula = cuc.id_tipo_aula WHERE ${where.join(' AND ')} ORDER BY ta.descricao`);
    return result.recordset;
}

async function listarTurmas(user, filters) {
    const codigo = validarUnidade(user, filters.unidade);
    const idCurso = inteiro(filters.id_curso, 'Curso');
    const pool = await getPool();
    const result = await pool.request().input('unidade', sql.VarChar(10), codigo).input('idCurso', sql.Int, idCurso).query(`SELECT id_turma, codigo_reduzido, ano, semestre, turno FROM dbo.TurmaAcademica WHERE codigo_unidade = @unidade AND id_curso = @idCurso AND ativo = 1 ORDER BY codigo_reduzido`);
    return result.recordset;
}

async function validarReferencias(poolOrTransaction, dados) {
    if (dados.tipo === 'PREPARACAO') return;
    const request = poolOrTransaction instanceof sql.Transaction ? new sql.Request(poolOrTransaction) : poolOrTransaction.request();
    const result = await request.input('idCursoUc', sql.Int, dados.idCursoUc).input('idTurma', sql.Int, dados.idTurma).input('unidade', sql.VarChar(10), dados.codigoUnidade).query(`
        SELECT TOP 1 1 AS ok FROM dbo.CursoUnidadeCurricular cuc
        JOIN dbo.CursoAcademico ca ON ca.id_curso = cuc.id_curso
        JOIN dbo.TurmaAcademica t ON t.id_turma = @idTurma AND t.id_curso = ca.id_curso
        WHERE cuc.id_curso_uc = @idCursoUc AND cuc.ativo = 1 AND ca.ativo = 1
          AND ca.codigo_unidade = @unidade AND t.codigo_unidade = @unidade AND t.ativo = 1`);
    if (!result.recordset.length) falha(400, 'Curso, UC e turma nao formam uma combinacao academica valida para a unidade.');
}

async function validarProfessorUnidade(poolOrTransaction, idProfessor, codigoUnidade) {
    const request = poolOrTransaction instanceof sql.Transaction ? new sql.Request(poolOrTransaction) : poolOrTransaction.request();
    const result = await request.input('idProfessor', sql.Int, idProfessor).input('unidade', sql.VarChar(10), codigoUnidade).query('SELECT TOP 1 p.id_professor, p.nome FROM dbo.ProfessorUnidade pu JOIN dbo.professores p ON p.id_professor = pu.id_professor WHERE pu.id_professor = @idProfessor AND pu.codigo_unidade = @unidade');
    if (!result.recordset.length) falha(403, 'O professor nao pertence a unidade selecionada.');
    return result.recordset[0];
}

async function buscarPorIdInterno(executor, id) {
    const request = executor instanceof sql.Transaction ? new sql.Request(executor) : executor.request();
    const result = await request.input('id', sql.Int, id).query(`${SELECT_COMPLETO} WHERE a.id_alocacao = @id ${GROUP_COMPLETO}`);
    return result.recordset[0] ? mapear(result.recordset[0]) : null;
}

function autorizarRegistro(user, registro) {
    if (!registro) falha(404, 'Alocacao nao encontrada.');
    if (!ehGestor(user)) falha(403, 'Acesso exclusivo da Coordenacao e Administracao.');
    if (user.permissao === 'admin') return;
    if (user.permissao === 'coordenador') { validarUnidade(user, registro.codigo_unidade); return; }
    falha(403, 'Acesso negado a esta alocacao.');
}

async function obterPorId(user, id) { const pool = await getPool(); const registro = await buscarPorIdInterno(pool, inteiro(id, 'Alocacao')); autorizarRegistro(user, registro); return registro; }

async function listarMinhas(user) {
    const pool = await getPool();
    const result = await pool.request().input('idProfessor', sql.Int, inteiro(user.id_professor, 'Usuario')).query(`${SELECT_COMPLETO} WHERE a.id_professor = @idProfessor ${GROUP_COMPLETO} ORDER BY a.ativo DESC, a.data_inicio DESC, a.id_alocacao DESC`);
    return result.recordset.map(mapear);
}

async function listarCoordenacao(user, filters) {
    if (!ehGestor(user)) falha(403, 'Painel exclusivo da Coordenacao e Administracao.');
    const pool = await getPool(); const request = pool.request(); const where = [];
    adicionarFiltroUnidades(request, where, user);
    const addInt = (key, column) => { if (filters[key]) { const n = inteiro(filters[key], key); request.input(key, sql.Int, n); where.push(`${column} = @${key}`); } };
    const addText = (key, column, max) => { const v = texto(filters[key], max); if (v) { request.input(key, sql.NVarChar(max), `%${v}%`); where.push(`${column} LIKE @${key}`); } };
    if (filters.unidade) { const u = validarUnidade(user, filters.unidade); request.input('filtroUnidade', sql.VarChar(10), u); where.push('a.codigo_unidade = @filtroUnidade'); }
    addInt('professor', 'a.id_professor'); addInt('curso', 'ca.id_curso'); addInt('uc', 'a.id_curso_uc');
    if (filters.dia) {
        const dia = inteiro(filters.dia, 'dia');
        if (!DIAS.has(dia)) falha(400, 'Filtro de dia invalido.');
        request.input('dia', sql.TinyInt, dia);
        where.push('EXISTS (SELECT 1 FROM dbo.AlocacaoDocenteDias filtroDia WHERE filtroDia.id_alocacao = a.id_alocacao AND filtroDia.dia_semana = @dia)');
    }
    addText('turma', 'turma.codigo_reduzido', 50);
    for (const [key, column, allowed] of [['turno','a.turno',TURNOS],['tipo','a.tipo',TIPOS]]) { const v = texto(filters[key], 20).toUpperCase(); if (v) { if (!allowed.has(v)) falha(400, `Filtro ${key} invalido.`); request.input(key, sql.VarChar(20), v); where.push(`${column} = @${key}`); } }
    if (filters.data) { const d = dataIso(filters.data, 'Data'); request.input('data', sql.Date, d); where.push('@data BETWEEN a.data_inicio AND a.data_fim'); }
    const result = await request.query(`${SELECT_COMPLETO} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${GROUP_COMPLETO} ORDER BY p.nome, a.data_inicio, a.turno`);
    return result.recordset.map(mapear);
}

async function consultarSobreposicoes(executor, dados, ignorarId) {
    const request = executor instanceof sql.Transaction ? new sql.Request(executor) : executor.request();
    request.input('professor', sql.Int, dados.idProfessor).input('turno', sql.VarChar(10), dados.turno).input('inicio', sql.Date, dados.dataInicio).input('fim', sql.Date, dados.dataFim);
    const diaParams = dados.dias.map((dia, i) => { request.input(`dia${i}`, sql.TinyInt, dia); return `@dia${i}`; });
    const ignore = ignorarId ? 'AND a.id_alocacao <> @ignorarId' : '';
    if (ignorarId) request.input('ignorarId', sql.Int, ignorarId);
    const result = await request.query(`${SELECT_COMPLETO} WHERE a.ativo = 1 AND a.id_professor = @professor AND a.turno = @turno AND a.data_inicio <= @fim AND a.data_fim >= @inicio AND EXISTS (SELECT 1 FROM dbo.AlocacaoDocenteDias x WHERE x.id_alocacao = a.id_alocacao AND x.dia_semana IN (${diaParams.join(',')})) ${ignore} ${GROUP_COMPLETO} ORDER BY a.data_inicio`);
    return result.recordset.map(mapear);
}

async function verificarSobreposicao(user, body) { const dados = normalizarPayload(user, body); const pool = await getPool(); await validarProfessorUnidade(pool, dados.idProfessor, dados.codigoUnidade); const registros = await consultarSobreposicoes(pool, dados, body.id_alocacao ? inteiro(body.id_alocacao, 'Alocacao') : null); return { tem_sobreposicao: registros.length > 0, total: registros.length, registros }; }

async function auditar(transaction, acao, registro, user, anteriores, novos, origem = 'modulo_alocacao_docente') {
    await new sql.Request(transaction).input('idAlocacao', sql.Int, registro.id_alocacao).input('acao', sql.VarChar(20), acao).input('responsavel', sql.Int, Number(user.id_professor) || null).input('nome', sql.NVarChar(255), texto(user.nome,255) || null).input('login', sql.NVarChar(255), texto(user.login,255) || null).input('permissao', sql.NVarChar(50), texto(user.permissao,50) || null).input('unidade', sql.VarChar(10), registro.codigo_unidade).input('anteriores', sql.NVarChar(sql.MAX), anteriores ? JSON.stringify(anteriores) : null).input('novos', sql.NVarChar(sql.MAX), novos ? JSON.stringify(novos) : null).input('detalhes', sql.NVarChar(sql.MAX), JSON.stringify({ origem })).query(`INSERT INTO dbo.AlocacaoDocenteAuditoria (id_alocacao, acao, usuario_responsavel_id, usuario_responsavel_nome, usuario_responsavel_login, usuario_responsavel_permissao, codigo_unidade, dados_anteriores_json, dados_novos_json, detalhes_json) VALUES (@idAlocacao,@acao,@responsavel,@nome,@login,@permissao,@unidade,@anteriores,@novos,@detalhes)`);
}

// Uses the caller's transaction: allocation, version and planning commit together.
// A planning is a class obligation, never a separate workload per professor.
async function garantirPlanejamentoDaAlocacao(transaction, registro, user) {
    if (registro.tipo === 'PREPARACAO') return null;
    if (!registro.id_turma || !registro.id_curso_uc) falha(400, 'Alocacao academica sem turma ou UC.');
    const idCursoUc = inteiro(registro.id_curso_uc, 'UC');
    const carga = await new sql.Request(transaction).input('uc', sql.Int, idCursoUc).query(`
        SELECT carga_horaria_total FROM dbo.CursoUnidadeCurricular WITH (UPDLOCK, HOLDLOCK)
        WHERE id_curso_uc = @uc`);
    if (!carga.recordset.length) falha(409, 'UC nao encontrada para garantir o planejamento.');
    const existentes = await new sql.Request(transaction)
        .input('turma', sql.Int, registro.id_turma).input('uc', sql.Int, idCursoUc)
        .input('inicio', sql.Date, registro.data_inicio).input('fim', sql.Date, registro.data_fim)
        .query(`SELECT id_planejamento_turma_uc, id_versao_carga_aplicavel, situacao
            FROM dbo.PlanejamentoTurmaUc WITH (UPDLOCK, HOLDLOCK)
            WHERE id_turma=@turma AND id_curso_uc=@uc AND periodo_inicio=@inicio AND periodo_fim=@fim`);
    if (existentes.recordset.length > 1) falha(409, 'Existe mais de um planejamento para turma, UC e periodo. Revise os registros existentes antes de salvar.');
    const existente = existentes.recordset[0];
    if (existente) {
        // Preserve manual/versioned obligations; never silently reactivate or replace them.
        if (existente.situacao !== 'ATIVO') falha(409, 'O planejamento deste periodo nao esta ativo. Revise o planejamento existente antes de salvar a alocacao.');
        const versao = await new sql.Request(transaction)
            .input('uc', sql.Int, idCursoUc).input('versao', sql.Int, existente.id_versao_carga_aplicavel)
            .query(`SELECT carga_horaria_minutos FROM dbo.CursoUcCargaHorariaVersao WITH (HOLDLOCK)
                WHERE id_curso_uc=@uc AND id_versao_carga=@versao`);
        if (!versao.recordset.length || !Number.isSafeInteger(Number(versao.recordset[0].carga_horaria_minutos)) || Number(versao.recordset[0].carga_horaria_minutos) <= 0) falha(409, 'Planejamento existente sem versao de carga valida. Revise antes de salvar.');
        return existente.id_planejamento_turma_uc;
    }
    const versoes = await new sql.Request(transaction).input('uc', sql.Int, idCursoUc).query(`
        SELECT TOP 1 id_versao_carga, carga_horaria_minutos
        FROM dbo.CursoUcCargaHorariaVersao WITH (UPDLOCK, HOLDLOCK)
        WHERE id_curso_uc=@uc ORDER BY numero_versao DESC, id_versao_carga DESC`);
    let versao = versoes.recordset[0];
    if (versao && (!Number.isSafeInteger(Number(versao.carga_horaria_minutos)) || Number(versao.carga_horaria_minutos) <= 0)) falha(409, 'A ultima versao da UC possui carga invalida. Revise antes de salvar.');
    if (!versao) {
        const minutos = Math.round(Number(carga.recordset[0].carga_horaria_total) * 60);
        if (!Number.isSafeInteger(minutos) || minutos <= 0 || minutos > 2147483647) falha(400, 'Carga horaria da UC invalida para planejamento.');
        const nova = await new sql.Request(transaction)
            .input('uc', sql.Int, idCursoUc).input('minutos', sql.Int, minutos)
            .input('nome', sql.NVarChar(255), texto(user.nome, 255) || null)
            .input('perfil', sql.NVarChar(50), texto(user.permissao, 50) || null)
            .query(`INSERT INTO dbo.CursoUcCargaHorariaVersao
                (id_curso_uc, numero_versao, versao_anterior_id, natureza_alteracao, carga_horaria_minutos,
                 registrado_em, registrado_por_nome_snapshot, registrado_por_perfil_snapshot, motivo_alteracao)
                OUTPUT INSERTED.id_versao_carga
                VALUES (@uc, 1, NULL, 'INICIAL', @minutos, SYSUTCDATETIME(), @nome, @perfil,
                    'Carga inicial do catalogo ao garantir planejamento da alocacao docente.')`);
        versao = nova.recordset[0];
    }
    const planejamento = await new sql.Request(transaction)
        .input('turma', sql.Int, registro.id_turma).input('uc', sql.Int, idCursoUc)
        .input('versao', sql.Int, versao.id_versao_carga)
        .input('inicio', sql.Date, registro.data_inicio).input('fim', sql.Date, registro.data_fim)
        .query(`INSERT INTO dbo.PlanejamentoTurmaUc
            (id_turma, id_curso_uc, id_versao_carga_aplicavel, periodo_inicio, periodo_fim, situacao)
            OUTPUT INSERTED.id_planejamento_turma_uc
            VALUES (@turma, @uc, @versao, @inicio, @fim, 'ATIVO')`);
    return planejamento.recordset[0].id_planejamento_turma_uc;
}

async function protegerPlanejamentoNaEdicao(transaction, anterior, dados) {
    if (!anterior.id_turma || !anterior.id_curso_uc) return;
    const mudou = Number(anterior.id_turma) !== dados.idTurma || Number(anterior.id_curso_uc) !== dados.idCursoUc
        || anterior.data_inicio !== dados.dataInicio || anterior.data_fim !== dados.dataFim;
    if (!mudou) return;
    // Serialize decisions concerning a shared obligation. No deletion or status inference.
    await new sql.Request(transaction).input('uc', sql.Int, anterior.id_curso_uc)
        .query('SELECT id_curso_uc FROM dbo.CursoUnidadeCurricular WITH (UPDLOCK, HOLDLOCK) WHERE id_curso_uc=@uc');
    const dependencias = await new sql.Request(transaction)
        .input('turma', sql.Int, anterior.id_turma).input('uc', sql.Int, anterior.id_curso_uc)
        .input('inicio', sql.Date, anterior.data_inicio).input('fim', sql.Date, anterior.data_fim)
        .input('id', sql.Int, anterior.id_alocacao)
        .query(`SELECT p.id_planejamento_turma_uc FROM dbo.PlanejamentoTurmaUc p WITH (UPDLOCK, HOLDLOCK)
            WHERE p.id_turma=@turma AND p.id_curso_uc=@uc AND p.periodo_inicio=@inicio AND p.periodo_fim=@fim
              AND p.situacao='ATIVO' AND NOT EXISTS (
                SELECT 1 FROM dbo.AlocacaoDocente a WITH (UPDLOCK, HOLDLOCK)
                WHERE a.id_turma=@turma AND a.id_curso_uc=@uc AND a.data_inicio=@inicio AND a.data_fim=@fim
                  AND a.ativo=1 AND a.id_alocacao<>@id)`);
    if (dependencias.recordset.length) falha(409, 'Esta alteracao deixaria o planejamento anterior sem alocacao ativa. Revise a obrigacao da turma antes de trocar turma, UC ou periodo. O planejamento nao foi alterado.');
}

async function validarProfessoresColetivos(executor, dados) {
    const professores = [];
    for (const idProfessor of dados.idsProfessores) professores.push(await validarProfessorUnidade(executor, idProfessor, dados.codigoUnidade));
    return professores;
}

async function verificarSobreposicaoColetiva(user, body) {
    const dados = normalizarPayloadColetivo(user, body);
    const pool = await getPool();
    const professores = await validarProfessoresColetivos(pool, dados);
    const conflitos = [];
    for (const professor of professores) {
        for (const turno of dados.turnos) {
            const registros = await consultarSobreposicoes(pool, { ...dados, idProfessor: professor.id_professor, turno });
            if (registros.length) conflitos.push({ id_professor: professor.id_professor, nome_professor: professor.nome, turno, total: registros.length, registros });
        }
    }
    return { tem_sobreposicao: conflitos.length > 0, total_combinacoes: conflitos.length, conflitos };
}

async function criarColetiva(user, body) {
    const dados = normalizarPayloadColetivo(user, body);
    const pool = await getPool();
    const professores = await validarProfessoresColetivos(pool, dados);
    if (body.confirmar_sobreposicoes !== true) {
        for (const professor of professores) {
            for (const turno of dados.turnos) {
                const registros = await consultarSobreposicoes(pool, { ...dados, idProfessor: professor.id_professor, turno });
                if (registros.length) falha(409, 'Existem possiveis sobreposicoes. Verifique o lote e confirme para salvar mesmo assim.');
            }
        }
    }
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const alocacoes = [];
        for (const idProfessor of dados.idsProfessores) {
            await validarProfessorUnidade(transaction, idProfessor, dados.codigoUnidade);
            for (const turno of dados.turnos) {
                const insert = await new sql.Request(transaction).input('professor',sql.Int,idProfessor).input('unidade',sql.VarChar(10),dados.codigoUnidade).input('tipo',sql.VarChar(20),dados.tipo).input('turno',sql.VarChar(10),turno).input('inicio',sql.Date,dados.dataInicio).input('fim',sql.Date,dados.dataFim).input('observacao',sql.NVarChar(1000),dados.observacao).input('responsavel',sql.Int,Number(user.id_professor)).query(`INSERT INTO dbo.AlocacaoDocente (id_professor,codigo_unidade,tipo,turno,id_curso_uc,id_turma,data_inicio,data_fim,observacao,criado_por,atualizado_por) OUTPUT INSERTED.id_alocacao VALUES (@professor,@unidade,@tipo,@turno,NULL,NULL,@inicio,@fim,@observacao,@responsavel,@responsavel)`);
                const id = insert.recordset[0].id_alocacao;
                for (const dia of dados.dias) await new sql.Request(transaction).input('id',sql.Int,id).input('dia',sql.TinyInt,dia).query('INSERT INTO dbo.AlocacaoDocenteDias (id_alocacao,dia_semana) VALUES (@id,@dia)');
                const registro = await buscarPorIdInterno(transaction, id);
                await garantirPlanejamentoDaAlocacao(transaction, registro, user);
                await auditar(transaction, 'CRIACAO', registro, user, null, registro, 'ALOCACAO_COLETIVA');
                alocacoes.push(registro);
            }
        }
        await transaction.commit();
        return { message: `${alocacoes.length} alocacao(oes) criada(s) com sucesso.`, total: alocacoes.length, alocacoes };
    } catch (error) { await transaction.rollback().catch(() => {}); throw error; }
}

async function criar(user, body) {
    const dados = normalizarPayload(user, body); const pool = await getPool(); const transaction = new sql.Transaction(pool); await transaction.begin();
    try {
        await validarProfessorUnidade(transaction, dados.idProfessor, dados.codigoUnidade); await validarReferencias(transaction, dados);
        const insert = await new sql.Request(transaction).input('professor',sql.Int,dados.idProfessor).input('unidade',sql.VarChar(10),dados.codigoUnidade).input('tipo',sql.VarChar(20),dados.tipo).input('turno',sql.VarChar(10),dados.turno).input('cursoUc',sql.Int,dados.idCursoUc).input('turma',sql.Int,dados.idTurma).input('inicio',sql.Date,dados.dataInicio).input('fim',sql.Date,dados.dataFim).input('observacao',sql.NVarChar(1000),dados.observacao).input('responsavel',sql.Int,Number(user.id_professor)).query(`INSERT INTO dbo.AlocacaoDocente (id_professor,codigo_unidade,tipo,turno,id_curso_uc,id_turma,data_inicio,data_fim,observacao,criado_por,atualizado_por) OUTPUT INSERTED.id_alocacao VALUES (@professor,@unidade,@tipo,@turno,@cursoUc,@turma,@inicio,@fim,@observacao,@responsavel,@responsavel)`);
        const id = insert.recordset[0].id_alocacao;
        for (const dia of dados.dias) await new sql.Request(transaction).input('id',sql.Int,id).input('dia',sql.TinyInt,dia).query('INSERT INTO dbo.AlocacaoDocenteDias (id_alocacao,dia_semana) VALUES (@id,@dia)');
        const registro = await buscarPorIdInterno(transaction, id); await garantirPlanejamentoDaAlocacao(transaction, registro, user); await auditar(transaction,'CRIACAO',registro,user,null,registro); await transaction.commit();
        return { message: 'Alocacao criada com sucesso.', alocacao: registro };
    } catch (error) { await transaction.rollback().catch(() => {}); throw error; }
}

async function editar(user, idValue, body) {
    const id = inteiro(idValue, 'Alocacao'); const pool = await getPool();
    const transaction = new sql.Transaction(pool); await transaction.begin();
    try {
        await new sql.Request(transaction).input('id', sql.Int, id)
            .query('SELECT id_alocacao FROM dbo.AlocacaoDocente WITH (UPDLOCK, HOLDLOCK) WHERE id_alocacao=@id');
        const anterior = await buscarPorIdInterno(transaction, id);
        autorizarRegistro(user, anterior);
        if (!anterior.ativo) falha(409, 'Reative a alocacao antes de edita-la.');
        const dados = normalizarPayload(user, body);
        await protegerPlanejamentoNaEdicao(transaction, anterior, dados);
        await validarProfessorUnidade(transaction,dados.idProfessor,dados.codigoUnidade); await validarReferencias(transaction,dados);
        await new sql.Request(transaction).input('id',sql.Int,id).input('professor',sql.Int,dados.idProfessor).input('unidade',sql.VarChar(10),dados.codigoUnidade).input('tipo',sql.VarChar(20),dados.tipo).input('turno',sql.VarChar(10),dados.turno).input('cursoUc',sql.Int,dados.idCursoUc).input('turma',sql.Int,dados.idTurma).input('inicio',sql.Date,dados.dataInicio).input('fim',sql.Date,dados.dataFim).input('observacao',sql.NVarChar(1000),dados.observacao).input('responsavel',sql.Int,Number(user.id_professor)).query(`UPDATE dbo.AlocacaoDocente SET id_professor=@professor,codigo_unidade=@unidade,tipo=@tipo,turno=@turno,id_curso_uc=@cursoUc,id_turma=@turma,data_inicio=@inicio,data_fim=@fim,observacao=@observacao,atualizado_em=SYSUTCDATETIME(),atualizado_por=@responsavel WHERE id_alocacao=@id`);
        await new sql.Request(transaction).input('id',sql.Int,id).query('DELETE FROM dbo.AlocacaoDocenteDias WHERE id_alocacao=@id');
        for (const dia of dados.dias) await new sql.Request(transaction).input('id',sql.Int,id).input('dia',sql.TinyInt,dia).query('INSERT INTO dbo.AlocacaoDocenteDias (id_alocacao,dia_semana) VALUES (@id,@dia)');
        const novo = await buscarPorIdInterno(transaction,id); await garantirPlanejamentoDaAlocacao(transaction, novo, user); await auditar(transaction,'ALTERACAO',novo,user,anterior,novo); await transaction.commit(); return { message:'Alocacao atualizada com sucesso.',alocacao:novo };
    } catch(error) { await transaction.rollback().catch(()=>{}); throw error; }
}

// Inactivation releases the professor, not the independent class obligation.
// Keep manual/shared planning active until an explicit planning lifecycle exists.
async function alterarAtivo(user,idValue,ativo) {
    const id=inteiro(idValue,'Alocacao'); const pool=await getPool();
    const transaction=new sql.Transaction(pool); await transaction.begin();
    try {
        await new sql.Request(transaction).input('id', sql.Int, id)
            .query('SELECT id_alocacao FROM dbo.AlocacaoDocente WITH (UPDLOCK, HOLDLOCK) WHERE id_alocacao=@id');
        const anterior=await buscarPorIdInterno(transaction,id); autorizarRegistro(user,anterior);
        if (anterior.ativo===ativo) {
            if (ativo) {
                await validarReferencias(transaction, normalizarPayload(user, anterior));
                await garantirPlanejamentoDaAlocacao(transaction, anterior, user);
            }
            await transaction.commit();
            return {message:ativo?'Alocacao ja esta ativa.':'Alocacao ja esta inativa.',alocacao:anterior};
        }
        await new sql.Request(transaction).input('id',sql.Int,id).input('responsavel',sql.Int,Number(user.id_professor)).input('ativo',sql.Bit,ativo?1:0).query(`UPDATE dbo.AlocacaoDocente SET ativo=@ativo, atualizado_em=SYSUTCDATETIME(), atualizado_por=@responsavel, inativado_em=CASE WHEN @ativo=0 THEN SYSUTCDATETIME() ELSE NULL END, inativado_por=CASE WHEN @ativo=0 THEN @responsavel ELSE NULL END WHERE id_alocacao=@id`); const novo=await buscarPorIdInterno(transaction,id); if (ativo) { await validarReferencias(transaction, normalizarPayload(user, novo)); await garantirPlanejamentoDaAlocacao(transaction, novo, user); } await auditar(transaction,ativo?'REATIVACAO':'INATIVACAO',novo,user,anterior,novo); await transaction.commit(); return {message:ativo?'Alocacao reativada com sucesso.':'Alocacao inativada com sucesso.',alocacao:novo}; } catch(error){await transaction.rollback().catch(()=>{});throw error;}
}

module.exports={obterContexto,listarCursos,listarUcsCurso,listarTurmas,listarMinhas,listarCoordenacao,obterPorId,verificarSobreposicao,verificarSobreposicaoColetiva,criar,criarColetiva,editar,alterarAtivo};
