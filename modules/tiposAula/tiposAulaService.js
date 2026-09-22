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

function canAccessSchedulingUnit(req, codigoUnidade) {
    const unidades = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];
    return unidades.includes(codigoUnidade);
}

async function listarTiposAulaPorUnidade(req, codigoUnidade) {
    if (!canAccessSchedulingUnit(req, codigoUnidade)) {
        return { statusCode: 403, type: 'send', body: 'Acesso negado.' };
    }

    const pool = await getPool();
    const result = await pool.request()
        .input('codigoUnidade', sql.NVarChar, codigoUnidade)
        .query(`
            SELECT ta.id_tipo_aula, ta.descricao
            FROM unidade_tipo_aula uta
            JOIN tipos_aula ta ON uta.id_tipo_aula = ta.id_tipo_aula
            JOIN Unidades u ON uta.id_unidade = u.codigo_unidade
            WHERE u.codigo_unidade = @codigoUnidade;
        `);

    if (result.recordset.length === 0) {
        return { statusCode: 404, type: 'send', body: 'Nenhum tipo de aula encontrado para esta unidade.' };
    }

    return { statusCode: 200, type: 'json', body: result.recordset };
}

async function editarTipoAula(idTipoAula, descricao) {
    const pool = await getPool();
    const result = await pool.request()
        .input('descricao', sql.VarChar, descricao)
        .input('idTipoAula', sql.Int, idTipoAula)
        .query('UPDATE tipos_aula SET descricao = @descricao WHERE id_tipo_aula = @idTipoAula');

    return result.rowsAffected[0];
}

async function adicionarUnidadeTipoAula(descricao, id_unidade) {
    const pool = await getPool();

    const resultTipoAula = await pool.request()
        .input('descricao', sql.NVarChar(255), descricao)
        .query('INSERT INTO tipos_aula (descricao) VALUES (@descricao); SELECT SCOPE_IDENTITY() AS id_tipo_aula;');

    const id_tipo_aula = resultTipoAula.recordset[0].id_tipo_aula;

    await pool.request()
        .input('id_unidade', sql.NVarChar, id_unidade)
        .input('id_tipo_aula', sql.Int, id_tipo_aula)
        .query('INSERT INTO unidade_tipo_aula (id_unidade, id_tipo_aula) VALUES (@id_unidade, @id_tipo_aula);');
}

async function dessassociarTipoAula(idTipoAula) {
    const pool = await getPool();
    await pool.request()
        .input('idTipoAula', sql.Int, idTipoAula)
        .query('DELETE FROM unidade_tipo_aula WHERE id_tipo_aula = @idTipoAula');
}

async function excluirTipoAula(idTipoAula) {
    const pool = await getPool();

    const referenceCheck = await pool.request()
        .input('idTipoAula', sql.Int, idTipoAula)
        .query('SELECT COUNT(*) AS count FROM unidade_tipo_aula WHERE id_tipo_aula = @idTipoAula');

    if (referenceCheck.recordset[0].count > 0) {
        return { statusCode: 409, type: 'send', body: 'Não é possível excluir este tipo de aula; ele está associado a unidades.' };
    }

    await pool.request()
        .input('idTipoAula', sql.Int, idTipoAula)
        .query('DELETE FROM tipos_aula WHERE id_tipo_aula = @idTipoAula');

    return { statusCode: 200, type: 'sendStatus' };
}

async function listarTodosTiposAula() {
    const pool = await getPool();
    const result = await pool.request()
        .query('SELECT ta.id_tipo_aula, ta.descricao FROM tipos_aula ta');

    return result.recordset;
}

module.exports = {
    listarTiposAulaPorUnidade,
    editarTipoAula,
    adicionarUnidadeTipoAula,
    dessassociarTipoAula,
    excluirTipoAula,
    listarTodosTiposAula
};
