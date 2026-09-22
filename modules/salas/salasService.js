const sql = require('mssql');
const config = require('../../dbConfig');

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

function getSchedulingUnitCodes(req) {
    const user = req.session?.user;
    if (!user) {
        return [];
    }

    return Array.isArray(user.unidades) ? user.unidades : [];
}

function getAllowedUnitCodes(req) {
    const user = req.session?.user;
    if (!user) {
        return [];
    }

    if (user.permissao === 'admin') {
        return null;
    }

    return Array.isArray(user.unidades) ? user.unidades : [];
}

function userCanAccessSchedulingUnit(req, codigoUnidade) {
    return getSchedulingUnitCodes(req).includes(codigoUnidade);
}

function userCanAccessUnit(req, codigoUnidade) {
    const allowed = getAllowedUnitCodes(req);
    if (allowed === null) {
        return true;
    }

    return allowed.includes(codigoUnidade);
}

function normalizeSalaType(tipoSala) {
    return String(tipoSala || 'academico').trim().toLowerCase() === 'administrativa'
        ? 'administrativa'
        : 'academico';
}

function getSalaTypeConfig(tipoSala) {
    const normalized = normalizeSalaType(tipoSala);
    return normalized === 'administrativa'
        ? { tipoSala: normalized, tabelaSalas: 'SalasAdministrativas' }
        : { tipoSala: normalized, tabelaSalas: 'Salas' };
}

async function userCanAccessManagedSala(req, idSala, tipoSala) {
    if (!Number.isInteger(Number(idSala))) {
        return false;
    }

    const pool = await getPool();
    const { tabelaSalas } = getSalaTypeConfig(tipoSala);
    const result = await pool.request()
        .input('idSala', sql.Int, Number(idSala))
        .query(`
            SELECT TOP 1 codigo_unidade
            FROM ${tabelaSalas}
            WHERE id_sala = @idSala
        `);

    if (!result.recordset.length) {
        return false;
    }

    return userCanAccessUnit(req, result.recordset[0].codigo_unidade);
}

async function userCanAccessSchedulingSala(req, idSala) {
    const allowedUnits = getSchedulingUnitCodes(req);
    if (!allowedUnits.length) {
        return false;
    }

    const pool = await getPool();
    const request = pool.request().input('idSala', sql.Int, idSala);
    const placeholders = allowedUnits.map((_, index) => `@unidadeAgenda${index}`).join(', ');

    allowedUnits.forEach((codigo, index) => {
        request.input(`unidadeAgenda${index}`, sql.NVarChar, codigo);
    });

    const result = await request.query(`
        SELECT TOP 1 1 AS permitido
        FROM Salas
        WHERE id_sala = @idSala
          AND codigo_unidade IN (${placeholders})
    `);

    return result.recordset.length > 0;
}

async function getTopSalas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT TOP 10 nome_sala, COUNT(*) AS quantidade
        FROM agendamentos
        JOIN Salas ON agendamentos.id_sala = Salas.id_sala
        GROUP BY nome_sala
        ORDER BY quantidade DESC
    `);

    return result.recordset;
}

async function getSalasByCodigoUnidade(req, codigoUnidade) {
    if (req.session?.user && !userCanAccessSchedulingUnit(req, codigoUnidade)) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('codigoUnidade', sql.VarChar, codigoUnidade)
        .query(`
            SELECT s.id_sala, s.nome_sala, u.codigo_unidade, u.nome_unidade
            FROM Salas s
            JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade
            WHERE s.codigo_unidade = @codigoUnidade
        `);

    return { status: 200, data: result.recordset };
}

async function getSalasAdministrativasByCodigoUnidade(req, codigoUnidade) {
    if (req.session?.user && !userCanAccessSchedulingUnit(req, codigoUnidade)) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('codigoUnidade', sql.VarChar, codigoUnidade)
        .query(`
            SELECT s.id_sala, s.nome_sala, u.codigo_unidade
            FROM SalasAdministrativas s
            JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade
            WHERE s.codigo_unidade = @codigoUnidade
        `);

    return { status: 200, data: result.recordset };
}

async function getSalaById(req, idSala) {
    if (req.session?.user) {
        const podeAcessar = await userCanAccessSchedulingSala(req, Number(idSala));
        if (!podeAcessar) {
            return { status: 403, error: 'Acesso negado.' };
        }
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('idSala', sql.Int, idSala)
        .query('SELECT * FROM Salas WHERE id_sala = @idSala');

    return { status: 200, data: result.recordset[0] };
}

async function criarUnidadeSalas(nomeUnidade, codigoUnidade, salas) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        await transaction.request()
            .input('nomeUnidade', sql.NVarChar, nomeUnidade)
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query(`
                INSERT INTO Unidades (nome_unidade, codigo_unidade)
                VALUES (@nomeUnidade, @codigoUnidade);
            `);

        for (const nomeSala of salas) {
            await transaction.request()
                .input('nomeSala', sql.NVarChar, nomeSala)
                .input('codigoUnidade', sql.NVarChar, codigoUnidade)
                .query(`
                    INSERT INTO Salas (nome_sala, codigo_unidade)
                    VALUES (@nomeSala, @codigoUnidade);
                `);
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function adicionarSalasEmUnidadeExistente(unidadeAdicionarSala, novasSalas) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        for (const nomeSala of novasSalas) {
            const nomeSalaNormalizado = String(nomeSala || '').trim();
            if (!nomeSalaNormalizado) {
                continue;
            }

            await transaction.request()
                .input('nomeSala', sql.NVarChar, nomeSalaNormalizado)
                .input('codigoUnidade', sql.NVarChar, unidadeAdicionarSala)
                .query(`
                    INSERT INTO Salas (nome_sala, codigo_unidade)
                    VALUES (@nomeSala, @codigoUnidade)
                `);
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function deletarSala(req, idSala, tipoSala) {
    const { tabelaSalas } = getSalaTypeConfig(tipoSala);
    const podeAcessar = await userCanAccessManagedSala(req, Number(idSala), tipoSala);
    if (!podeAcessar) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const pool = await getPool();
    await pool.request()
        .input('idSala', sql.Int, idSala)
        .query(`DELETE FROM ${tabelaSalas} WHERE id_sala = @idSala`);

    return { status: 200 };
}

async function renomearSala(req, idSala, novoNomeSala, tipoSala) {
    const { tabelaSalas } = getSalaTypeConfig(tipoSala);
    const podeAcessar = await userCanAccessManagedSala(req, Number(idSala), tipoSala);
    if (!podeAcessar) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('idSala', sql.Int, idSala);
    request.input('novoNomeSala', sql.NVarChar, novoNomeSala);

    await request.query(`
        UPDATE ${tabelaSalas}
        SET nome_sala = @novoNomeSala
        WHERE id_sala = @idSala
    `);

    return { status: 200 };
}

async function alterarSala(body, file) {
    const idSala = body.idSala;
    const cadeiras = body.cadeiras;
    const computadores = body.computadores;
    const quadroBranco = body.quadroBranco;
    const telaProjetor = body.telaProjetor;
    const tv = body.tv;
    const area = body.area;
    const projetor = body.projetor;
    const maquinario = body.maquinario;

    const imageFilePath = file ? `/imagens/${file.filename}` : null;

    let query = `
        UPDATE Salas
        SET cadeiras = @cadeiras,
            computadores = @computadores,
            quadro_branco = @quadroBranco,
            tela_projetor = @telaProjetor,
            tv = @tv,
            area = @area,
            projetor = @projetor,
            maquinario = @maquinario
    `;

    if (imageFilePath) {
        query += ', imagem = @imageFilePath ';
    }

    query += ' WHERE id_sala = @idSala';

    const pool = await getPool();
    const request = pool.request();
    request.input('idSala', sql.Int, idSala);
    request.input('cadeiras', sql.Int, cadeiras);
    request.input('computadores', sql.Int, computadores);
    request.input('quadroBranco', sql.NVarChar(100), quadroBranco);
    request.input('telaProjetor', sql.NVarChar(100), telaProjetor);
    request.input('tv', sql.NVarChar(100), tv);
    request.input('area', sql.NVarChar(100), area);
    request.input('projetor', sql.NVarChar(100), projetor);
    request.input('maquinario', sql.NVarChar(100), maquinario);

    if (imageFilePath) {
        request.input('imageFilePath', sql.NVarChar(255), imageFilePath);
    }

    await request.query(query);
}

async function adicionarSala(req, codigoUnidade, nomeSala, tipoSala) {
    const { tabelaSalas } = getSalaTypeConfig(tipoSala);
    if (!userCanAccessUnit(req, codigoUnidade)) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const pool = await getPool();
    await pool.request()
        .input('codigoUnidade', sql.NVarChar, codigoUnidade)
        .input('nomeSala', sql.NVarChar, nomeSala)
        .query(`INSERT INTO ${tabelaSalas} (nome_sala, codigo_unidade) VALUES (@nomeSala, @codigoUnidade)`);

    return { status: 200 };
}

async function listarUnidadesSalas(req) {
    const allowedUnits = getAllowedUnitCodes(req);
    const pool = await getPool();
    const request = pool.request();

    let query = `
        SELECT *
        FROM (
            SELECT u.nome_unidade AS nome, u.codigo_unidade AS codigo,
                   s.nome_sala AS sala,
                   'academico' AS tipo
            FROM Unidades u
            LEFT JOIN Salas s ON u.codigo_unidade = s.codigo_unidade

            UNION ALL

            SELECT u.nome_unidade AS nome, u.codigo_unidade AS codigo,
                   sa.nome_sala AS sala,
                   'administrativa' AS tipo
            FROM Unidades u
            LEFT JOIN SalasAdministrativas sa ON u.codigo_unidade = sa.codigo_unidade
        ) AS base
    `;

    if (allowedUnits !== null) {
        if (!allowedUnits.length) {
            return [];
        }

        const placeholders = allowedUnits.map((_, index) => `@unidade${index}`).join(', ');
        allowedUnits.forEach((codigo, index) => {
            request.input(`unidade${index}`, sql.NVarChar, codigo);
        });
        query += ` WHERE base.codigo IN (${placeholders})`;
    }

    query += ' ORDER BY nome, tipo, sala;';
    const result = await request.query(query);

    const unidadesSalas = [];
    let unidadeAtual = null;

    for (const row of result.recordset) {
        if (row.nome !== unidadeAtual) {
            unidadeAtual = row.nome;
            unidadesSalas.push({
                nome: row.nome,
                codigo: row.codigo,
                salasAcademicas: [],
                salasAdministrativas: []
            });
        }

        if (!row.sala) {
            continue;
        }

        if (row.tipo === 'administrativa') {
            unidadesSalas[unidadesSalas.length - 1].salasAdministrativas.push(row.sala);
        } else {
            unidadesSalas[unidadesSalas.length - 1].salasAcademicas.push(row.sala);
        }
    }

    return unidadesSalas;
}

async function listarSalasDoUsuario(req) {
    if (!req.session?.user) {
        return { status: 401, error: 'Usuário não autenticado.' };
    }

    const unidades = getSchedulingUnitCodes(req);
    if (!unidades || unidades.length === 0) {
        return { status: 200, data: [] };
    }

    const pool = await getPool();
    const placeholders = unidades.map((_, i) => `@unidade${i}`).join(', ');
    const request = pool.request();

    unidades.forEach((unidade, i) => {
        request.input(`unidade${i}`, sql.NVarChar, unidade);
    });

    const result = await request.query(`
        SELECT s.id_sala, s.nome_sala, u.nome_unidade, u.codigo_unidade
        FROM Salas s
        JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade
        WHERE u.codigo_unidade IN (${placeholders})
        ORDER BY u.codigo_unidade, s.nome_sala
    `);

    return { status: 200, data: result.recordset };
}

async function listarSalasDisponiveis(req, data, horaInicio, horaFim, codigoUnidade) {
    if (!data || !horaInicio || !horaFim || !codigoUnidade) {
        return { status: 400, error: 'Todos os parâmetros de data, hora e unidade são obrigatórios.' };
    }

    if (!userCanAccessSchedulingUnit(req, codigoUnidade)) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const pool = await getPool();
    const datas = data.split(',').map((d) => d.trim());
    const resultados = [];

    for (const dataSelecionada of datas) {
        const request = pool.request();
        request.input('hora_inicio', sql.NVarChar, horaInicio);
        request.input('hora_fim', sql.NVarChar, horaFim);
        request.input('codigo_unidade', sql.NVarChar, codigoUnidade);
        request.input('dataSelecionada', sql.NVarChar, dataSelecionada);

        const result = await request.query(`
            SELECT s.id_sala, s.nome_sala,
                   CASE
                       WHEN a.data_reservas IS NULL THEN @dataSelecionada
                       ELSE NULL
                   END as data_disponivel
            FROM Salas s
            LEFT JOIN Agendamentos a ON s.id_sala = a.id_sala
            AND a.data_reservas = @dataSelecionada
            AND (
                (a.hora_inicio < @hora_fim AND a.hora_fim > @hora_inicio)
            )
            WHERE s.codigo_unidade = @codigo_unidade
        `);

        result.recordset.forEach((sala) => {
            const salaIndex = resultados.findIndex((r) => r.id_sala === sala.id_sala);
            if (salaIndex === -1) {
                sala.datas_disponiveis = sala.data_disponivel ? [sala.data_disponivel] : [];
                resultados.push(sala);
            } else if (sala.data_disponivel) {
                resultados[salaIndex].datas_disponiveis.push(sala.data_disponivel);
            }
        });
    }

    resultados.forEach((r) => {
        r.datas_disponiveis = [...new Set(r.datas_disponiveis)];
    });

    return {
        status: 200,
        data: { salasDisponiveis: resultados.filter((sala) => sala.datas_disponiveis.length > 0) }
    };
}

async function listasSalas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT s.id_sala, s.nome_sala, u.nome_unidade, u.codigo_unidade
        FROM Salas s
        JOIN Unidades u ON s.codigo_unidade = u.codigo_unidade
    `);

    return result.recordset;
}

async function listarSalasPorUnidade(req, unidadeCodigo, tipoSala) {
    if (!userCanAccessSchedulingUnit(req, unidadeCodigo)) {
        return { status: 403, error: 'Acesso negado.' };
    }

    const { tabelaSalas } = getSalaTypeConfig(tipoSala);
    const pool = await getPool();
    const result = await pool.request()
        .input('unidadeCodigo', unidadeCodigo)
        .query(`
            SELECT id_sala, nome_sala
            FROM ${tabelaSalas}
            WHERE codigo_unidade = @unidadeCodigo
            ORDER BY nome_sala
        `);

    return { status: 200, data: result.recordset };
}

async function listarTodasSalasAcademicas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT id_sala, nome_sala
        FROM Salas
    `);

    return result.recordset;
}

async function listarTodasSalasAdministrativas() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT id_sala, nome_sala
        FROM SalasAdministrativas
    `);

    return result.recordset;
}

async function getSalaDetalhes(idSala) {
    const pool = await getPool();
    const detalhesResult = await pool.request()
        .input('idSala', sql.Int, idSala)
        .query('SELECT * FROM Salas WHERE id_sala = @idSala');

    if (detalhesResult.recordset.length === 0) {
        return { status: 404, error: 'Sala não encontrada.' };
    }

    const computadoresResult = await pool.request()
        .input('idSala', sql.Int, idSala)
        .query(`
            SELECT DISTINCT
                c.id,
                c.nome_computador,
                c.SerialNumber,
                c.patrimonio,
                c.memoria_ram,
                c.disco_info
            FROM computadores c
            LEFT JOIN SalaComputadorAcademica sca ON sca.id_computador = c.id
            LEFT JOIN SalaComputadorAdministrativa scad ON scad.id_computador = c.id
            WHERE sca.id_sala = @idSala OR scad.id_sala = @idSala
            ORDER BY c.nome_computador ASC, c.id ASC
        `);

    const monitoresResult = await pool.request()
        .input('idSala', sql.Int, idSala)
        .query(`
            SELECT
                m.id,
                m.modelo,
                m.polegadas,
                m.patrimonio,
                m.numero_serie
            FROM MonitorSala ms
            JOIN monitores m ON ms.id_monitor = m.id
            WHERE ms.id_sala = @idSala
            ORDER BY m.modelo ASC, m.id ASC
        `);

    const agendamentosResult = await pool.request()
        .input('idSala', sql.Int, idSala)
        .query(`
            SELECT a.motivo, a.data_reservas, a.hora_inicio, a.hora_fim, p.nome as nome_professor
            FROM agendamentos a
            JOIN professores p ON a.id_professor = p.id_professor
            WHERE a.id_sala = @idSala
            ORDER BY a.data_reservas, a.hora_inicio;
        `);

    const detalhesDaSala = detalhesResult.recordset[0];
    detalhesDaSala.computadores_associados = computadoresResult.recordset.length;
    detalhesDaSala.monitores_associados = monitoresResult.recordset.length;

    return {
        status: 200,
        data: {
            detalhes: detalhesDaSala,
            computadores: computadoresResult.recordset,
            monitores: monitoresResult.recordset,
            agendamentos: agendamentosResult.recordset
        }
    };
}

module.exports = {
    getTopSalas,
    getSalasByCodigoUnidade,
    getSalasAdministrativasByCodigoUnidade,
    getSalaById,
    criarUnidadeSalas,
    adicionarSalasEmUnidadeExistente,
    deletarSala,
    renomearSala,
    alterarSala,
    adicionarSala,
    listarUnidadesSalas,
    listarSalasDoUsuario,
    listarSalasDisponiveis,
    listasSalas,
    listarSalasPorUnidade,
    listarTodasSalasAcademicas,
    listarTodasSalasAdministrativas,
    getSalaDetalhes
};