const sql = require('mssql');
const config = require('../../dbConfig');
const { getProfessorOptionalColumns } = require('../professores/professoresService');

let poolPromise;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }
    return poolPromise;
}

function texto(value, max = 100) {
    return String(value ?? '').trim().slice(0, max);
}

function inteiroOpcional(value, nome) {
    if (value === undefined || value === null || value === '') return null;
    const numero = Number(value);
    if (!Number.isInteger(numero) || numero <= 0) {
        const error = new Error(`${nome} invalido.`);
        error.status = 400;
        throw error;
    }
    return numero;
}

function dataIso(value, nome) {
    const data = texto(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
        const error = new Error(`${nome} invalida.`);
        error.status = 400;
        throw error;
    }
    return data;
}

function unidadesPermitidas(user) {
    if (user?.permissao === 'admin') return null;
    return Array.isArray(user?.unidades) ? user.unidades.map(String) : [];
}

function aplicarFiltroUnidades(request, where, user, coluna, prefixo = 'unidadePermitida') {
    const unidades = unidadesPermitidas(user);
    if (unidades === null) return;
    if (!unidades.length) {
        where.push('1 = 0');
        return;
    }
    const parametros = unidades.map((codigo, indice) => {
        const nome = `${prefixo}${indice}`;
        request.input(nome, sql.VarChar(10), codigo);
        return `@${nome}`;
    });
    where.push(`${coluna} IN (${parametros.join(', ')})`);
}

function adicionarFiltrosPlanejamento(request, where, user, filtros) {
    aplicarFiltroUnidades(request, where, user, 'ca.codigo_unidade');

    const unidade = texto(filtros.unidade, 10);
    if (unidade) {
        const permitidas = unidadesPermitidas(user);
        if (permitidas !== null && !permitidas.includes(unidade)) {
            const error = new Error('Acesso negado para a unidade selecionada.');
            error.status = 403;
            throw error;
        }
        request.input('unidadeFiltro', sql.VarChar(10), unidade);
        where.push('ca.codigo_unidade = @unidadeFiltro');
    }

    for (const [chave, coluna, rotulo] of [
        ['curso', 'cuc.id_curso', 'Curso'],
        ['turma', 'ptu.id_turma', 'Turma'],
        ['uc', 'ptu.id_curso_uc', 'Unidade curricular']
    ]) {
        const valor = inteiroOpcional(filtros[chave], rotulo);
        if (valor !== null) {
            request.input(`${chave}Filtro`, sql.Int, valor);
            where.push(`${coluna} = @${chave}Filtro`);
        }
    }
}

function diferencaDias(inicio, fim) {
    const umDia = 86400000;
    return Math.ceil((fim.getTime() - inicio.getTime()) / umDia);
}

/*
 * Regra gerencial isolada para evoluir sem espalhar critérios no frontend.
 * Compara cobertura com o avanço temporal e endurece a classificação perto do fim.
 */
function classificarPlanejamento(item, hoje = new Date()) {
    const previsto = Number(item.carga_prevista_minutos) || 0;
    const agendado = Number(item.horas_agendadas_minutos) || 0;
    if (previsto <= 0) return 'ATENCAO';
    if (agendado > previsto) return 'COM_EXCESSO';
    if (agendado >= previsto) return 'ADEQUADO';

    const inicio = new Date(`${item.periodo_inicio}T00:00:00Z`);
    const fim = new Date(`${item.periodo_fim}T00:00:00Z`);
    const atual = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
    const cobertura = agendado / previsto;
    const duracao = Math.max(1, diferencaDias(inicio, fim));
    const decorrido = Math.min(1, Math.max(0, diferencaDias(inicio, atual) / duracao));
    const diasRestantes = diferencaDias(atual, fim);

    if (diasRestantes < 0 || (diasRestantes <= 14 && cobertura < 0.7)) return 'CRITICO';
    if (diasRestantes <= 30 && cobertura < 0.9) return 'ATENCAO';
    if (decorrido - cobertura > 0.15) return 'ATENCAO';
    return 'ADEQUADO';
}

function enriquecerPlanejamento(row) {
    const previsto = Number(row.carga_prevista_minutos) || 0;
    const agendado = Number(row.horas_agendadas_minutos) || 0;
    const faltante = Math.max(previsto - agendado, 0);
    const excesso = Math.max(agendado - previsto, 0);
    const cobertura = previsto > 0 ? (agendado / previsto) * 100 : 0;
    const item = {
        ...row,
        carga_prevista_minutos: previsto,
        horas_agendadas_minutos: agendado,
        horas_faltantes_minutos: faltante,
        horas_excesso_minutos: excesso,
        cobertura_percentual: Number(cobertura.toFixed(1)),
        carga_alterada: Number(row.total_versoes_carga) > 1
    };
    item.classificacao = classificarPlanejamento(item);
    return item;
}

async function listarFiltros(user, somenteProfessores = false) {
    const pool = await getPool();
    const request = pool.request();
    const whereUnidades = [];
    aplicarFiltroUnidades(request, whereUnidades, user, 'u.codigo_unidade');

    const unidades = await request.query(`
        SELECT u.codigo_unidade, u.nome_unidade
        FROM dbo.Unidades u
        ${whereUnidades.length ? `WHERE ${whereUnidades.join(' AND ')}` : ''}
        ORDER BY u.nome_unidade
    `);

    const codigos = unidades.recordset.map((item) => String(item.codigo_unidade));
    if (!codigos.length) {
        return { unidades: [], cursos: [], turmas: [], ucs: [], professores: [] };
    }

    const montarParametros = (req, prefixo) => codigos.map((codigo, indice) => {
        const nome = `${prefixo}${indice}`;
        req.input(nome, sql.VarChar(10), codigo);
        return `@${nome}`;
    }).join(', ');

    const cursosReq = pool.request();
    const cursosParams = montarParametros(cursosReq, 'cursoUnidade');
    const cursos = await cursosReq.query(`
        SELECT id_curso, nome_curso, codigo_unidade
        FROM dbo.CursoAcademico
        WHERE codigo_unidade IN (${cursosParams}) AND ativo = 1
        ORDER BY nome_curso
    `);

    const turmasReq = pool.request();
    if (somenteProfessores) {
        const colunas = await getProfessorOptionalColumns(pool);
        return { unidades: unidades.recordset, cursos: cursos.recordset, suporta_turno: colunas.turnoPrincipal };
    }
    const turmasParams = montarParametros(turmasReq, 'turmaUnidade');
    const turmas = await turmasReq.query(`
        SELECT id_turma, codigo_reduzido, id_curso, codigo_unidade
        FROM dbo.TurmaAcademica
        WHERE codigo_unidade IN (${turmasParams}) AND ativo = 1
        ORDER BY codigo_reduzido
    `);

    const ucsReq = pool.request();
    const ucsParams = montarParametros(ucsReq, 'ucUnidade');
    const ucs = await ucsReq.query(`
        SELECT cuc.id_curso_uc, cuc.id_curso, ta.descricao, ca.codigo_unidade
        FROM dbo.CursoUnidadeCurricular cuc
        INNER JOIN dbo.CursoAcademico ca ON ca.id_curso = cuc.id_curso
        INNER JOIN dbo.tipos_aula ta ON ta.id_tipo_aula = cuc.id_tipo_aula
        WHERE ca.codigo_unidade IN (${ucsParams})
          AND ca.ativo = 1
          AND cuc.ativo = 1
        ORDER BY ta.descricao
    `);

    const professoresReq = pool.request();
    const professoresParams = montarParametros(professoresReq, 'profUnidade');
    const professores = await professoresReq.query(`
        SELECT DISTINCT p.id_professor, p.nome, pu.codigo_unidade
        FROM dbo.ProfessorUnidade pu
        INNER JOIN dbo.professores p ON p.id_professor = pu.id_professor
        WHERE pu.codigo_unidade IN (${professoresParams})
        ORDER BY p.nome
    `);

    return {
        unidades: unidades.recordset,
        cursos: cursos.recordset,
        turmas: turmas.recordset,
        ucs: ucs.recordset,
        professores: professores.recordset
    };
}

async function obterDashboard(user, filtros, somentePlanejamentos = false) {
    const dataInicio = dataIso(filtros.data_inicio, 'Data inicial');
    const dataFim = dataIso(filtros.data_fim, 'Data final');
    if (dataFim < dataInicio) {
        const error = new Error('A data final nao pode ser anterior a data inicial.');
        error.status = 400;
        throw error;
    }

    const professor = inteiroOpcional(filtros.professor, 'Professor');
    const pool = await getPool();
    const request = pool.request()
        .input('dataInicio', sql.Date, dataInicio)
        .input('dataFim', sql.Date, dataFim);
    const where = [
        "ptu.situacao = 'ATIVO'",
        'ptu.periodo_inicio <= @dataFim',
        'ptu.periodo_fim >= @dataInicio'
    ];
    adicionarFiltrosPlanejamento(request, where, user, filtros);

    let filtroProfessorPlanejamento = '';
    let filtroProfessorFato = '';
    if (professor !== null) {
        request.input('professorFiltro', sql.Int, professor);
        filtroProfessorPlanejamento = `AND (EXISTS (
            SELECT 1 FROM dbo.FatoAgendamentoDocente fp
            WHERE fp.id_planejamento_turma_uc = ptu.id_planejamento_turma_uc
              AND fp.id_professor = @professorFiltro
              AND fp.situacao = 'ATIVO'
              AND fp.data_reserva BETWEEN @dataInicio AND @dataFim
        ) OR EXISTS (
            SELECT 1 FROM dbo.AlocacaoDocente ad
            WHERE ad.id_turma = ptu.id_turma
              AND ad.id_curso_uc = ptu.id_curso_uc
              AND ad.data_inicio = ptu.periodo_inicio
              AND ad.data_fim = ptu.periodo_fim
              AND ad.id_professor = @professorFiltro
              AND ad.ativo = 1
        ))`;
        filtroProfessorFato = 'AND f.id_professor = @professorFiltro';
    }

    const result = await request.query(`
        SELECT
            ptu.id_planejamento_turma_uc,
            ptu.id_turma,
            ptu.id_curso_uc,
            ptu.id_versao_carga_aplicavel,
            CONVERT(varchar(10), ptu.periodo_inicio, 23) AS periodo_inicio,
            CONVERT(varchar(10), ptu.periodo_fim, 23) AS periodo_fim,
            turma.codigo_reduzido,
            ca.id_curso,
            ca.nome_curso,
            ca.codigo_unidade,
            ta.descricao AS unidade_curricular,
            versao.carga_horaria_minutos AS carga_prevista_minutos,
            COALESCE(SUM(CASE WHEN f.situacao = 'ATIVO' THEN f.duracao_minutos ELSE 0 END), 0)
                AS horas_agendadas_minutos,
            COUNT(DISTINCT CASE WHEN f.situacao = 'ATIVO' THEN f.id_professor END)
                AS total_professores,
            (
                SELECT COUNT_BIG(*)
                FROM dbo.CursoUcCargaHorariaVersao cv
                WHERE cv.id_curso_uc = ptu.id_curso_uc
            ) AS total_versoes_carga
        FROM dbo.PlanejamentoTurmaUc ptu
        INNER JOIN dbo.TurmaAcademica turma
            ON turma.id_turma = ptu.id_turma
        INNER JOIN dbo.CursoUnidadeCurricular cuc
            ON cuc.id_curso_uc = ptu.id_curso_uc
        INNER JOIN dbo.CursoAcademico ca
            ON ca.id_curso = cuc.id_curso
        INNER JOIN dbo.tipos_aula ta
            ON ta.id_tipo_aula = cuc.id_tipo_aula
        INNER JOIN dbo.CursoUcCargaHorariaVersao versao
            ON versao.id_curso_uc = ptu.id_curso_uc
           AND versao.id_versao_carga = ptu.id_versao_carga_aplicavel
        LEFT JOIN dbo.FatoAgendamentoDocente f
            ON f.id_planejamento_turma_uc = ptu.id_planejamento_turma_uc
           AND f.situacao = 'ATIVO'
           AND f.data_reserva BETWEEN @dataInicio AND @dataFim
           ${filtroProfessorFato}
        WHERE ${where.join(' AND ')}
          ${filtroProfessorPlanejamento}
        GROUP BY
            ptu.id_planejamento_turma_uc,
            ptu.id_turma,
            ptu.id_curso_uc,
            ptu.id_versao_carga_aplicavel,
            ptu.periodo_inicio,
            ptu.periodo_fim,
            turma.codigo_reduzido,
            ca.id_curso,
            ca.nome_curso,
            ca.codigo_unidade,
            ta.descricao,
            versao.carga_horaria_minutos
        ORDER BY ptu.periodo_fim, ta.descricao
    `);

    let planejamentos = result.recordset.map(enriquecerPlanejamento);
    const situacao = texto(filtros.situacao, 30).toUpperCase();
    const situacoesPermitidas = new Set(['CRITICO', 'ATENCAO', 'ADEQUADO', 'COM_EXCESSO']);
    if (situacao === 'LEGADO_NAO_CLASSIFICADO') {
        planejamentos = [];
    } else if (situacao && situacoesPermitidas.has(situacao)) {
        planejamentos = planejamentos.filter((item) => item.classificacao === situacao);
    }

    const totais = planejamentos.reduce((acc, item) => {
        acc.previsto += item.carga_prevista_minutos;
        acc.agendado += item.horas_agendadas_minutos;
        acc.faltante += item.horas_faltantes_minutos;
        acc.excesso += item.horas_excesso_minutos;
        acc.distribuicao[item.classificacao] += 1;
        return acc;
    }, {
        previsto: 0,
        agendado: 0,
        faltante: 0,
        excesso: 0,
        distribuicao: { CRITICO: 0, ATENCAO: 0, ADEQUADO: 0, COM_EXCESSO: 0 }
    });

    const cobertura = totais.previsto > 0 ? (totais.agendado / totais.previsto) * 100 : 0;
    // The individual profile consumes exactly the same query, enrichment and totals.
    if (somentePlanejamentos) return {
        periodo: { inicio: dataInicio, fim: dataFim }, planejamentos,
        resumo: {
            horas_previstas_minutos: totais.previsto, horas_agendadas_minutos: totais.agendado,
            horas_faltantes_minutos: totais.faltante, horas_excesso_minutos: totais.excesso,
            cobertura_percentual: totais.previsto > 0 ? Number(cobertura.toFixed(1)) : null,
            planejamentos_ativos: planejamentos.length
        },
        distribuicao: totais.distribuicao
    };
    const atencao = totais.distribuicao.CRITICO + totais.distribuicao.ATENCAO + totais.distribuicao.COM_EXCESSO;
    const ordem = { CRITICO: 0, ATENCAO: 1, COM_EXCESSO: 2, ADEQUADO: 3 };
    const ordenados = [...planejamentos].sort((a, b) => {
        const porSituacao = ordem[a.classificacao] - ordem[b.classificacao];
        if (porSituacao !== 0) return porSituacao;
        return b.horas_faltantes_minutos - a.horas_faltantes_minutos;
    });

    const ocorrencias = await listarOcorrenciasRecentes(pool, user, filtros);
    const legado = await contarLegado(pool, user, filtros, dataInicio, dataFim);
    const coberturaPorUnidadeMap = new Map();
    for (const item of planejamentos) {
        const chave = String(item.codigo_unidade || 'SEM_UNIDADE');
        const atual = coberturaPorUnidadeMap.get(chave) || {
            codigo_unidade: item.codigo_unidade || null,
            nome_unidade: item.codigo_unidade || 'Sem unidade',
            carga_prevista_minutos: 0,
            horas_agendadas_minutos: 0,
            planejamentos: 0
        };
        atual.carga_prevista_minutos += item.carga_prevista_minutos;
        atual.horas_agendadas_minutos += item.horas_agendadas_minutos;
        atual.planejamentos += 1;
        coberturaPorUnidadeMap.set(chave, atual);
    }
    const nomesUnidades = new Map((await listarNomesUnidades(pool, [...coberturaPorUnidadeMap.keys()])).map((item) => [String(item.codigo_unidade), item.nome_unidade]));
    const coberturaPorUnidade = [...coberturaPorUnidadeMap.values()].map((item) => ({
        ...item,
        nome_unidade: nomesUnidades.get(String(item.codigo_unidade)) || item.nome_unidade,
        cobertura_percentual: item.carga_prevista_minutos > 0
            ? Number(((item.horas_agendadas_minutos / item.carga_prevista_minutos) * 100).toFixed(1))
            : 0
    })).sort((a, b) => b.cobertura_percentual - a.cobertura_percentual);

    const ucsComMaiorPendencia = [...planejamentos]
        .filter((item) => item.horas_faltantes_minutos > 0)
        .sort((a, b) => b.horas_faltantes_minutos - a.horas_faltantes_minutos)
        .slice(0, 10);

    return {
        atualizado_em: new Date().toISOString(),
        periodo: { inicio: dataInicio, fim: dataFim },
        resumo: {
            horas_previstas_minutos: totais.previsto,
            horas_agendadas_minutos: totais.agendado,
            horas_faltantes_minutos: totais.faltante,
            horas_excesso_minutos: totais.excesso,
            cobertura_percentual: Number(cobertura.toFixed(1)),
            planejamentos_atencao: atencao,
            planejamentos_ativos: planejamentos.length,
            fatos_legados: legado.total,
            horas_legadas_minutos: legado.minutos
        },
        distribuicao: totais.distribuicao,
        situacoes_planejamentos: {
            ...totais.distribuicao,
            SEM_CLASSIFICACAO: legado.total
        },
        cobertura_por_unidade: coberturaPorUnidade,
        alertas: {
            planejamentos_criticos: totais.distribuicao.CRITICO,
            planejamentos_atencao: totais.distribuicao.ATENCAO,
            planejamentos_excesso: totais.distribuicao.COM_EXCESSO,
            registros_sem_classificacao: legado.total
        },
        ucs_maior_pendencia: ucsComMaiorPendencia,
        grafico_planejamentos: ordenados.slice(0, 8),
        planejamentos_atencao: ordenados.filter((item) => item.classificacao !== 'ADEQUADO').slice(0, 10),
        ocorrencias
    };
}

async function listarNomesUnidades(pool, codigos) {
    const validos = codigos.filter((codigo) => codigo && codigo !== 'SEM_UNIDADE');
    if (!validos.length) return [];
    const request = pool.request();
    const parametros = validos.map((codigo, indice) => {
        const nome = `nomeUnidade${indice}`;
        request.input(nome, sql.VarChar(10), codigo);
        return `@${nome}`;
    });
    const result = await request.query(`
        SELECT codigo_unidade, nome_unidade
        FROM dbo.Unidades
        WHERE codigo_unidade IN (${parametros.join(', ')})
    `);
    return result.recordset;
}

async function contarLegado(pool, user, filtros, dataInicio, dataFim) {
    const request = pool.request()
        .input('legadoInicio', sql.Date, dataInicio)
        .input('legadoFim', sql.Date, dataFim);
    const where = [
        "f.classificacao_academica = 'LEGADO_NAO_CLASSIFICADO'",
        "f.situacao = 'ATIVO'",
        'f.data_reserva BETWEEN @legadoInicio AND @legadoFim'
    ];
    aplicarFiltroUnidades(request, where, user, 'f.codigo_unidade');
    const unidade = texto(filtros.unidade, 10);
    if (unidade) {
        request.input('legadoUnidadeFiltro', sql.VarChar(10), unidade);
        where.push('f.codigo_unidade = @legadoUnidadeFiltro');
    }
    const professor = inteiroOpcional(filtros.professor, 'Professor');
    if (professor !== null) {
        request.input('legadoProfessorFiltro', sql.Int, professor);
        where.push('f.id_professor = @legadoProfessorFiltro');
    }
    const result = await request.query(`
        SELECT COUNT_BIG(*) AS total,
               COALESCE(SUM(f.duracao_minutos), 0) AS minutos
        FROM dbo.FatoAgendamentoDocente f
        WHERE ${where.join(' AND ')}
    `);
    return {
        total: Number(result.recordset[0]?.total) || 0,
        minutos: Number(result.recordset[0]?.minutos) || 0
    };
}

async function listarOcorrenciasRecentes(pool, user, filtros) {
    const request = pool.request();
    const whereAuditoria = [];
    const whereVersao = [];
    aplicarFiltroUnidades(request, whereAuditoria, user, 'aa.codigo_unidade', 'auditoriaUnidade');
    aplicarFiltroUnidades(request, whereVersao, user, 'ca.codigo_unidade', 'versaoUnidade');

    const unidade = texto(filtros.unidade, 10);
    if (unidade) {
        request.input('ocorrenciaUnidade', sql.VarChar(10), unidade);
        whereAuditoria.push('aa.codigo_unidade = @ocorrenciaUnidade');
        whereVersao.push('ca.codigo_unidade = @ocorrenciaUnidade');
    }

    const result = await request.query(`
        SELECT TOP (5)
            eventos.data_evento,
            eventos.tipo_ocorrencia,
            eventos.responsavel_nome,
            eventos.responsavel_perfil,
            eventos.professor,
            eventos.alvo,
            eventos.resumo
        FROM
        (
            SELECT
                aa.data_evento,
                aa.acao AS tipo_ocorrencia,
                aa.usuario_responsavel_nome AS responsavel_nome,
                aa.usuario_responsavel_permissao AS responsavel_perfil,
                aa.nome_professor AS professor,
                COALESCE(aa.nome_sala, CONCAT('Agendamento #', aa.id_agendamento)) AS alvo,
                aa.resumo
            FROM dbo.AgendamentoAuditoria aa
            ${whereAuditoria.length ? `WHERE ${whereAuditoria.join(' AND ')}` : ''}

            UNION ALL

            SELECT
                cv.registrado_em AS data_evento,
                cv.natureza_alteracao AS tipo_ocorrencia,
                cv.registrado_por_nome_snapshot AS responsavel_nome,
                cv.registrado_por_perfil_snapshot AS responsavel_perfil,
                CAST(NULL AS NVARCHAR(255)) AS professor,
                ta.descricao AS alvo,
                CONCAT(
                    'Carga registrada: ',
                    CAST(cv.carga_horaria_minutos AS varchar(20)),
                    ' min — ',
                    cv.motivo_alteracao
                ) AS resumo
            FROM dbo.CursoUcCargaHorariaVersao cv
            INNER JOIN dbo.CursoUnidadeCurricular cuc
                ON cuc.id_curso_uc = cv.id_curso_uc
            INNER JOIN dbo.CursoAcademico ca
                ON ca.id_curso = cuc.id_curso
            INNER JOIN dbo.tipos_aula ta
                ON ta.id_tipo_aula = cuc.id_tipo_aula
            ${whereVersao.length ? `WHERE ${whereVersao.join(' AND ')}` : ''}
        ) eventos
        ORDER BY eventos.data_evento DESC
    `);
    return result.recordset;
}

// Batch read: no per-professor queries or historical schedules sent to the browser.
async function listarProfessores(user, filtros) {
    if (!['admin', 'coordenador'].includes(user?.permissao)) {
        const error = new Error('Acesso negado.'); error.status = 403; throw error;
    }
    const inicio = dataIso(filtros.data_inicio, 'Data inicial'), fim = dataIso(filtros.data_fim, 'Data final');
    const erroFiltro = message => { const error = new Error(message); error.status = 400; throw error; };
    if (fim < inicio) erroFiltro('Periodo invalido.');
    const somenteProfessores = filtros.somente_professores ?? '1';
    if (!['0', '1'].includes(somenteProfessores)) erroFiltro('Filtro Somente professores invalido.');
    const pagina = inteiroOpcional(filtros.pagina, 'Pagina') || 1;
    const tamanho = inteiroOpcional(filtros.por_pagina, 'Tamanho da pagina') || 25;
    if (![10, 25, 50, 100].includes(tamanho)) erroFiltro('Tamanho de pagina invalido.');
    const ordenacao = filtros.ordenacao || 'nome';
    if (!['nome', 'previsto', 'agendado', 'faltante', 'cobertura'].includes(ordenacao)) erroFiltro('Ordenacao invalida.');
    const direcao = filtros.direcao || 'asc';
    if (!['asc', 'desc'].includes(direcao)) erroFiltro('Direcao invalida.');
    const situacao = texto(filtros.situacao, 30).toUpperCase();
    if (situacao && !['CRITICO','ATENCAO','ADEQUADO','COM_EXCESSO','SEM_PLANEJAMENTO'].includes(situacao)) erroFiltro('Situacao invalida.');
    const turno = texto(filtros.turno, 10).toLowerCase();
    if (turno && !['manha','tarde','noite'].includes(turno)) erroFiltro('Turno invalido.');
    const pool = await getPool(), colunas = await getProfessorOptionalColumns(pool);
    if (turno && !colunas.turnoPrincipal) erroFiltro('Turno cadastral indisponivel.');
    const request = pool.request().input('inicio', sql.Date, inicio).input('fim', sql.Date, fim);
    const wherePlanos = ["ptu.situacao='ATIVO'", 'ptu.periodo_inicio<=@fim', 'ptu.periodo_fim>=@inicio'];
    adicionarFiltrosPlanejamento(request, wherePlanos, user, {unidade: filtros.unidade, curso: filtros.curso});
    const whereUnidades = [];
    aplicarFiltroUnidades(request, whereUnidades, user, 'pu.codigo_unidade', 'cadastroUnidade');
    if (texto(filtros.unidade,10)) whereUnidades.push('pu.codigo_unidade=@unidadeFiltro');
    const whereCadastro = [];
    // Explicit cadastro classification; independent from access roles and academic calculations.
    if (somenteProfessores === '1') whereCadastro.push('p.classificacao_docente = 1');
    if (whereUnidades.length) whereCadastro.push(`EXISTS (SELECT 1 FROM dbo.ProfessorUnidade pu WHERE pu.id_professor=p.id_professor AND ${whereUnidades.join(' AND ')})`);
    const nome = texto(filtros.busca, 150);
    if (nome) {
        request.input('busca', sql.NVarChar(150), nome);
        whereCadastro.push('CHARINDEX(@busca, p.nome)>0');
    }
    if (turno) {
        request.input('turnoCadastro', sql.NVarChar(10), turno);
        whereCadastro.push("CHARINDEX(','+@turnoCadastro+',', ','+REPLACE(LOWER(p.turno_principal),' ','')+',')>0");
    }
    const perfilSelect = `p.id_professor,p.nome,p.login,p.matricula,
        ${colunas.turnoPrincipal ? 'p.turno_principal' : 'CAST(NULL AS nvarchar(100)) AS turno_principal'},
        ${colunas.cargaHorariaSemanal ? 'p.carga_horaria_semanal' : 'CAST(NULL AS decimal(5,2)) AS carga_horaria_semanal'},
        ${colunas.fotoUrl ? 'p.foto_url' : 'CAST(NULL AS nvarchar(1000)) AS foto_url'}`;
    const cadastro = `SELECT p.id_professor,p.nome FROM dbo.professores p ${whereCadastro.length ? 'WHERE '+whereCadastro.join(' AND ') : ''}`;
    const ctes = `WITH Docentes AS (${cadastro}), Planos AS (
        SELECT ptu.id_planejamento_turma_uc,ptu.id_turma,ptu.id_curso_uc,
            ptu.periodo_inicio,ptu.periodo_fim,versao.carga_horaria_minutos AS carga_prevista_minutos
        FROM dbo.PlanejamentoTurmaUc ptu
        JOIN dbo.CursoUnidadeCurricular cuc ON cuc.id_curso_uc=ptu.id_curso_uc
        JOIN dbo.CursoAcademico ca ON ca.id_curso=cuc.id_curso
        JOIN dbo.CursoUcCargaHorariaVersao versao ON versao.id_curso_uc=ptu.id_curso_uc
            AND versao.id_versao_carga=ptu.id_versao_carga_aplicavel
        WHERE ${wherePlanos.join(' AND ')}
    ), Fatos AS (
        SELECT f.id_planejamento_turma_uc,f.id_professor,SUM(f.duracao_minutos) AS minutos
        FROM dbo.FatoAgendamentoDocente f JOIN Planos p ON p.id_planejamento_turma_uc=f.id_planejamento_turma_uc
        WHERE f.situacao='ATIVO' AND f.data_reserva BETWEEN @inicio AND @fim
        GROUP BY f.id_planejamento_turma_uc,f.id_professor
    ), Vinculos AS (
        SELECT p.id_planejamento_turma_uc,a.id_professor FROM Planos p
        JOIN dbo.AlocacaoDocente a ON a.id_turma=p.id_turma AND a.id_curso_uc=p.id_curso_uc
            AND a.data_inicio=p.periodo_inicio AND a.data_fim=p.periodo_fim AND a.ativo=1
        UNION SELECT id_planejamento_turma_uc,id_professor FROM Fatos
    )`;
    const result = await request.query(`
        WITH Docentes AS (${cadastro})
        SELECT d.id_professor,d.nome FROM Docentes d;
        ${ctes}
        SELECT v.id_professor,p.id_planejamento_turma_uc,p.carga_prevista_minutos,
            CONVERT(varchar(10),p.periodo_inicio,23) AS periodo_inicio,
            CONVERT(varchar(10),p.periodo_fim,23) AS periodo_fim,
            COALESCE(f.minutos,0) AS minutos_professor,
            COALESCE(total.minutos,0) AS horas_agendadas_minutos,
            compartilhados.total_vinculos
        FROM Vinculos v JOIN Docentes d ON d.id_professor=v.id_professor
        JOIN Planos p ON p.id_planejamento_turma_uc=v.id_planejamento_turma_uc
        JOIN (SELECT id_planejamento_turma_uc,COUNT(*) AS total_vinculos FROM Vinculos GROUP BY id_planejamento_turma_uc) compartilhados
            ON compartilhados.id_planejamento_turma_uc=p.id_planejamento_turma_uc
        LEFT JOIN Fatos f ON f.id_planejamento_turma_uc=p.id_planejamento_turma_uc AND f.id_professor=v.id_professor
        LEFT JOIN (SELECT id_planejamento_turma_uc,SUM(minutos) AS minutos FROM Fatos GROUP BY id_planejamento_turma_uc) total
            ON total.id_planejamento_turma_uc=p.id_planejamento_turma_uc;
    `);
    const docentes = new Map();
    for (const row of result.recordsets[0]) {
        if (!docentes.has(row.id_professor)) docentes.set(row.id_professor, {...row, planos: new Map()});
    }
    const docentesComPlanejamento = new Set();
    for (const row of result.recordsets[1]) {
        docentesComPlanejamento.add(row.id_professor);
        const plano = enriquecerPlanejamento(row); // Classification stays global to the obligation.
        if (situacao && situacao !== plano.classificacao) continue;
        docentes.get(row.id_professor)?.planos.set(row.id_planejamento_turma_uc, plano);
    }
    const geral = new Map(), linhas = [];
    for (const docente of docentes.values()) {
        if ((filtros.curso || (situacao && situacao !== 'SEM_PLANEJAMENTO')) && !docente.planos.size) continue;
        if (situacao === 'SEM_PLANEJAMENTO' && docentesComPlanejamento.has(docente.id_professor)) continue;
        let previsto=0,agendado=0,faltante=0,excesso=0,compartilhados=0;
        const situacoes = {};
        for (const [id, plano] of docente.planos) {
            const horas = Number(plano.minutos_professor)||0;
            previsto += plano.carga_prevista_minutos; agendado += horas;
            faltante += Math.max(plano.carga_prevista_minutos-horas,0);
            excesso += Math.max(horas-plano.carga_prevista_minutos,0);
            if (Number(plano.total_vinculos)>1) compartilhados++;
            situacoes[plano.classificacao]=(situacoes[plano.classificacao]||0)+1;
            if (!geral.has(id)) geral.set(id,{previsto:plano.carga_prevista_minutos,agendado:0});
            geral.get(id).agendado += horas;
        }
        linhas.push({id_professor:docente.id_professor,nome:docente.nome,previsto,agendado,faltante,excesso,
            cobertura:previsto>0?agendado/previsto*100:null,situacoes,compartilhados});
    }
    const resumo = {total_professores:linhas.length,previsto:0,agendado:0,faltante:0,excesso:0,cobertura:null};
    for (const p of geral.values()) {
        resumo.previsto+=p.previsto; resumo.agendado+=p.agendado;
        resumo.faltante+=Math.max(p.previsto-p.agendado,0); resumo.excesso+=Math.max(p.agendado-p.previsto,0);
    }
    if (resumo.previsto>0) resumo.cobertura=resumo.agendado/resumo.previsto*100;
    linhas.sort((a,b) => {
        const av=a[ordenacao],bv=b[ordenacao];
        const comparacao=ordenacao==='nome'?String(av||'').localeCompare(String(bv||''),'pt-BR'):
            av===null?(bv===null?0:1):bv===null?-1:(av-bv)*(direcao==='desc'?-1:1);
        return (ordenacao==='nome' && direcao==='desc'?-comparacao:comparacao)||a.id_professor-b.id_professor;
    });
    const paginas=Math.max(1,Math.ceil(linhas.length/tamanho)), atual=Math.min(pagina,paginas);
    const professores = linhas.slice((atual-1)*tamanho,atual*tamanho);
    // Full cadastro and photos are read only for the bounded page; summaries need all matching IDs.
    if (professores.length) {
        const ids = professores.map((p,i) => { request.input(`paginaId${i}`,sql.Int,p.id_professor); return `@paginaId${i}`; });
        const perfis = await request.query(`SELECT ${perfilSelect}, pu.codigo_unidade
            FROM dbo.professores p LEFT JOIN dbo.ProfessorUnidade pu ON pu.id_professor=p.id_professor
                ${whereUnidades.length ? 'AND '+whereUnidades.join(' AND ') : ''}
            WHERE p.id_professor IN (${ids.join(',')})`);
        const porId = new Map(professores.map(p=>[p.id_professor,p]));
        for (const linha of professores) linha.unidades=[];
        for (const perfil of perfis.recordset) {
            const linha=porId.get(perfil.id_professor);
            const {codigo_unidade,...campos}=perfil;
            Object.assign(linha,campos);
            if (codigo_unidade && !linha.unidades.includes(codigo_unidade)) linha.unidades.push(codigo_unidade);
        }
    }
    return {professores,resumo,pagina:atual,por_pagina:tamanho,
        total:linhas.length,paginas,atualizado_em:new Date().toISOString()};
}

async function obterPerfilProfessor(user, idValue, filtros) {
    const falhar = (status, message) => { const error=new Error(message);error.status=status;throw error; };
    if (!['admin','coordenador'].includes(user?.permissao)) falhar(403,'Acesso negado.');
    const idProfessor=inteiroOpcional(idValue,'Professor');
    if (idProfessor===null || idProfessor>2147483647) falhar(404,'Professor nao encontrado.');
    const inicio=dataIso(filtros.data_inicio,'Data inicial'),fim=dataIso(filtros.data_fim,'Data final');
    if (fim<inicio) falhar(400,'Periodo invalido.');
    const pagina=inteiroOpcional(filtros.pagina_agendamentos,'Pagina')||1, tamanho=10;
    const unidade=texto(filtros.unidade,10), permitidas=unidadesPermitidas(user);
    if (unidade && permitidas!==null && !permitidas.includes(unidade)) falhar(403,'Acesso negado para a unidade selecionada.');
    const pool=await getPool(), colunas=await getProfessorOptionalColumns(pool);
    const request=pool.request().input('perfilId',sql.Int,idProfessor);
    const whereUnidades=[];
    aplicarFiltroUnidades(request,whereUnidades,user,'pu.codigo_unidade','perfilUnidade');
    const whereProfessor=['p.id_professor=@perfilId'];
    if (whereUnidades.length) whereProfessor.push(`EXISTS (SELECT 1 FROM dbo.ProfessorUnidade pu WHERE pu.id_professor=p.id_professor AND ${whereUnidades.join(' AND ')})`);
    const cadastro=await request.query(`SELECT p.id_professor,p.nome,p.login,p.matricula,p.classificacao_docente,
        ${colunas.turnoPrincipal?'p.turno_principal':'CAST(NULL AS nvarchar(100)) AS turno_principal'},
        ${colunas.cargaHorariaSemanal?'p.carga_horaria_semanal':'CAST(NULL AS decimal(5,2)) AS carga_horaria_semanal'},
        ${colunas.fotoUrl?'p.foto_url':'CAST(NULL AS nvarchar(1000)) AS foto_url'},
        pu.codigo_unidade,u.nome_unidade
        FROM dbo.professores p LEFT JOIN dbo.ProfessorUnidade pu ON pu.id_professor=p.id_professor
            ${whereUnidades.length?'AND '+whereUnidades.join(' AND '):''}
        LEFT JOIN dbo.Unidades u ON u.codigo_unidade=pu.codigo_unidade
        WHERE ${whereProfessor.join(' AND ')}`);
    if (!cadastro.recordset.length) falhar(404,'Professor nao encontrado.');
    const {codigo_unidade,nome_unidade,...professor}=cadastro.recordset[0];
    professor.unidades=[...new Map(cadastro.recordset.filter(r=>r.codigo_unidade).map(r=>[r.codigo_unidade,{codigo_unidade:r.codigo_unidade,nome_unidade:r.nome_unidade}])).values()];
    if (unidade && !professor.unidades.some(u=>String(u.codigo_unidade)===unidade)) falhar(404,'Professor nao encontrado.');
    const filtrosPerfil={unidade,data_inicio:inicio,data_fim:fim,professor:idProfessor};
    const academico=await obterDashboard(user,filtrosPerfil,true);
    const legado=await contarLegado(pool,user,filtrosPerfil,inicio,fim);
    // Existing scheduling source. No guessed relation between raw bookings and facts.
    const historicoReq=pool.request().input('professorHistorico',sql.Int,idProfessor)
        .input('historicoInicio',sql.Date,inicio).input('historicoFim',sql.Date,fim);
    const whereHistorico=['a.id_professor=@professorHistorico','a.data_reservas BETWEEN @historicoInicio AND @historicoFim'];
    aplicarFiltroUnidades(historicoReq,whereHistorico,user,'s.codigo_unidade','historicoUnidade');
    if (unidade) {historicoReq.input('unidadeHistorico',sql.VarChar(10),unidade);whereHistorico.push('s.codigo_unidade=@unidadeHistorico');}
    const origem=`FROM dbo.agendamentos a LEFT JOIN dbo.Salas s ON s.id_sala=a.id_sala WHERE ${whereHistorico.join(' AND ')}`;
    const contagem=await historicoReq.query(`SELECT COUNT_BIG(*) AS total ${origem}`);
    const total=Number(contagem.recordset[0].total),paginas=Math.max(1,Math.ceil(total/tamanho)),atual=Math.min(pagina,paginas);
    historicoReq.input('offsetHistorico',sql.Int,(atual-1)*tamanho).input('limiteHistorico',sql.Int,tamanho);
    const historico=await historicoReq.query(`SELECT a.id_agendamento,
        CONVERT(varchar(10),a.data_reservas,23) AS data,
        CONVERT(varchar(8),TRY_CONVERT(time,a.hora_inicio),108) AS hora_inicio,
        CONVERT(varchar(8),TRY_CONVERT(time,a.hora_fim),108) AS hora_fim,
        s.nome_sala,a.motivo,
        CASE WHEN TRY_CONVERT(time,a.hora_fim)>TRY_CONVERT(time,a.hora_inicio)
            THEN DATEDIFF(SECOND,TRY_CONVERT(time,a.hora_inicio),TRY_CONVERT(time,a.hora_fim))/60.0 ELSE NULL END AS duracao_minutos
        ${origem} ORDER BY a.data_reservas DESC,a.hora_inicio DESC,a.id_agendamento DESC
        OFFSET @offsetHistorico ROWS FETCH NEXT @limiteHistorico ROWS ONLY`);
    const resumo=academico.resumo;
    const componentes=resumo.horas_agendadas_minutos+resumo.horas_faltantes_minutos;
    return {professor,...academico,atualizado_em:new Date().toISOString(),
        legado:{total:Number(legado.total),minutos:Number(legado.minutos)},
        distribuicao_horas:{agendadas:resumo.horas_agendadas_minutos,faltantes:resumo.horas_faltantes_minutos,
            excesso:resumo.horas_excesso_minutos,percentual_agendadas:componentes>0?resumo.horas_agendadas_minutos/componentes*100:null},
        agendamentos:{registros:historico.recordset,total,pagina:atual,paginas,por_pagina:tamanho}
    };
}

async function atualizarClassificacaoDocente(user, idValue, dados) {
    const falhar = (status, message) => { const error = new Error(message); error.status = status; throw error; };
    if (!['admin', 'coordenador'].includes(user?.permissao)) falhar(403, 'Acesso negado.');
    const idProfessor = inteiroOpcional(idValue, 'Professor');
    if (idProfessor === null || idProfessor > 2147483647) falhar(400, 'Professor invalido.');
    if (!dados || Array.isArray(dados) || Object.keys(dados).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(dados, 'classificacao_docente') ||
        ![null, 0, 1].includes(dados.classificacao_docente)) {
        falhar(400, 'Informe somente o vinculo docente: null, 0 ou 1.');
    }
    const pool = await getPool();
    const request = pool.request().input('professorId', sql.Int, idProfessor)
        .input('classificacao', sql.Bit, dados.classificacao_docente);
    const unidades = [];
    aplicarFiltroUnidades(request, unidades, user, 'pu.codigo_unidade', 'classificacaoUnidade');
    const escopo = unidades.length
        ? `AND EXISTS (SELECT 1 FROM dbo.ProfessorUnidade pu WHERE pu.id_professor=p.id_professor AND ${unidades.join(' AND ')})` : '';
    const result = await request.query(`UPDATE p SET classificacao_docente=@classificacao
        FROM dbo.professores p WHERE p.id_professor=@professorId ${escopo}`);
    if (!result.rowsAffected[0]) falhar(404, 'Professor nao encontrado nas unidades autorizadas.');
    return { classificacao_docente: dados.classificacao_docente };
}

module.exports = {
    atualizarClassificacaoDocente,
    obterPerfilProfessor,
    listarProfessores,
    listarFiltros,
    obterDashboard,
    classificarPlanejamento
};
