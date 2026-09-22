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

async function getUnidadeCurricular(idUc) {
    const pool = await getPool();
    const result = await pool.request()
        .input('idUc', sql.Int, idUc)
        .query(`
            SELECT id_unidade_curricular, ano, semestre, turma, turno, modulo, tipo_curso, codigo_unidade
            FROM UnidadesCurriculares
            WHERE id_unidade_curricular = @idUc
        `);

    return result.recordset;
}

async function updateUnidadeCurricular(idUc, data) {
    const pool = await getPool();
    await pool.request()
        .input('idUc', sql.Int, idUc)
        .input('ano', sql.Int, data.ano)
        .input('semestre', sql.Int, data.semestre)
        .input('turma', sql.NVarChar(1), data.turma)
        .input('turno', sql.Int, data.turno)
        .input('modulo', sql.Int, data.modulo)
        .input('tipoCurso', sql.Int, data.tipoCurso)
        .input('codigoUnidade', sql.NVarChar, data.codigoUnidade)
        .query(`
            UPDATE UnidadesCurriculares
            SET
                ano = @ano,
                semestre = @semestre,
                turma = @turma,
                turno = @turno,
                modulo = @modulo,
                tipo_curso = @tipoCurso,
                codigo_unidade = @codigoUnidade
            WHERE id_unidade_curricular = @idUc
        `);
}

async function adicionarUnidadeCurricular(data) {
    const pool = await getPool();
    await pool.request()
        .input('ano', sql.Int, data.ano)
        .input('semestre', sql.Int, data.semestre)
        .input('turma', sql.NVarChar(1), data.turma)
        .input('turno', sql.Int, data.turno)
        .input('modulo', sql.Int, data.modulo)
        .input('tipoCurso', sql.Int, data.tipoCurso)
        .input('codigoUnidade', sql.NVarChar, data.codigoUnidade)
        .query(`
            INSERT INTO UnidadesCurriculares (ano, semestre, turma, turno, modulo, tipo_curso, codigo_unidade)
            VALUES (@ano, @semestre, @turma, @turno, @modulo, @tipoCurso, @codigoUnidade);
        `);
}

async function listarUcsPorUnidade(codigoUnidade) {
    const pool = await getPool();
    const result = await pool.request()
        .input('codigoUnidade', sql.NVarChar, codigoUnidade)
        .query(`
            SELECT id_unidade_curricular, ano, semestre, turma, turno, modulo, tipo_curso
            FROM UnidadesCurriculares
            WHERE codigo_unidade = @codigoUnidade
        `);

    return result.recordset;
}

async function associarUnidadeTipoAula(data) {
    const pool = await getPool();

    const checkResult = await pool.request()
        .input('id_uc', sql.Int, data.id_unidade_curricular)
        .input('id_ta', sql.Int, data.id_tipo_aula)
        .query(`
            SELECT 1
            FROM unidade_tipo_aula_associacao
            WHERE id_unidade_curricular = @id_uc AND id_tipo_aula = @id_ta
        `);

    const monitorEncontradoPorPatrimonio = checkResult.recordset.find((item) => String(item.patrimonio || '').trim() === patrimonioLimpo);
    const monitorEncontradoPorSerie = checkResult.recordset.find((item) => String(item.numero_serie || '').trim() === numeroSerieLimpo);

    if (
        monitorEncontradoPorPatrimonio
        && monitorEncontradoPorSerie
        && Number(monitorEncontradoPorPatrimonio.id) !== Number(monitorEncontradoPorSerie.id)
    ) {
        return { statusCode: 409, type: 'json', body: { error: 'Ja existe conflito entre patrimonio e numero de serie em registros diferentes.' } };
    }

    const monitorExistente = monitorIdNumerico
        ? { id: monitorIdNumerico }
        : monitorEncontradoPorPatrimonio || monitorEncontradoPorSerie || null;

    if (checkResult.recordset.length > 0 && !monitorExistente) {
        return { statusCode: 409, type: 'send', body: 'Esta associação já existe na matriz curricular.' };
    }

    await pool.request()
        .input('id_uc', sql.Int, data.id_unidade_curricular)
        .input('id_ta', sql.Int, data.id_tipo_aula)
        .query(`
            INSERT INTO unidade_tipo_aula_associacao (id_unidade_curricular, id_tipo_aula)
            VALUES (@id_uc, @id_ta);
        `);

    return { statusCode: 201, type: 'send', body: 'Associação criada com sucesso!' };
}

async function listarAssociacoes(unidadeId) {
    const pool = await getPool();
    const result = await pool.request()
        .input('unidadeId', sql.Int, unidadeId)
        .query(`
            SELECT uta.id_tipo_aula, ta.descricao
            FROM unidade_tipo_aula_associacao uta
            JOIN tipos_aula ta ON uta.id_tipo_aula = ta.id_tipo_aula
            WHERE uta.id_unidade_curricular = @unidadeId
        `);

    return result.recordset;
}

async function listarUnidadesCurriculares() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT TOP (1000) [id_unidade_curricular], [ano], [semestre], [turma], [turno], [modulo], [tipo_curso] FROM [dbo].[UnidadesCurriculares]');
    return result.recordset;
}

async function dessassociarUnidadeTipoAula(data) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    for (let id_tipo_aula of data.id_tipos_aula) {
        await transaction.request()
            .input('id_unidade_curricular', sql.Int, data.id_unidade_curricular)
            .input('id_tipo_aula', sql.Int, id_tipo_aula)
            .query(`
                DELETE FROM unidade_tipo_aula_associacao
                WHERE id_unidade_curricular = @id_unidade_curricular AND id_tipo_aula = @id_tipo_aula
            `);
    }

    await transaction.commit();
}

module.exports = {
    getUnidadeCurricular,
    updateUnidadeCurricular,
    adicionarUnidadeCurricular,
    listarUcsPorUnidade,
    associarUnidadeTipoAula,
    listarAssociacoes,
    listarUnidadesCurriculares,
    dessassociarUnidadeTipoAula
};
