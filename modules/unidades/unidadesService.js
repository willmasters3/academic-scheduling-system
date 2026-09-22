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

function normalizeEquipmentUnitCode(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) {
        return null;
    }

    const match = text.match(/(?:^UC)?\s*([0-9]{1,3})/);
    if (!match) {
        return null;
    }

    return match[1].padStart(3, '0');
}

function getEquipmentUnitCodes(req) {
    const units = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];
    const normalized = units
        .map((unit) => normalizeEquipmentUnitCode(unit))
        .filter(Boolean);

    return Array.from(new Set(normalized));
}

function isAuthenticatedRequest(req) {
    return Boolean(req.session?.user);
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

async function listarUnidades(req) {
    const pool = await getPool();
    const result = await pool.request().query('SELECT codigo_unidade, nome_unidade FROM Unidades');

    if (!isAuthenticatedRequest(req)) {
        return result.recordset;
    }

    const allowedUnitCodes = getEquipmentUnitCodes(req);
    if (!allowedUnitCodes.length) {
        return [];
    }

    return result.recordset.filter((unidade) => {
        const codigoNormalizado = normalizeEquipmentUnitCode(unidade.codigo_unidade);
        return codigoNormalizado && allowedUnitCodes.includes(codigoNormalizado);
    });
}

async function listarUnidadesRestritas(req) {
    const allowedUnits = getAllowedUnitCodes(req);
    const pool = await getPool();
    const request = pool.request();
    let query = 'SELECT codigo_unidade AS codigo, nome_unidade AS nome FROM Unidades';

    if (allowedUnits !== null) {
        if (!allowedUnits.length) {
            return [];
        }

        const placeholders = allowedUnits.map((_, index) => `@unidade${index}`).join(', ');
        allowedUnits.forEach((codigo, index) => {
            request.input(`unidade${index}`, sql.NVarChar, codigo);
        });
        query += ` WHERE codigo_unidade IN (${placeholders})`;
    }

    const result = await request.query(query);
    return result.recordset;
}

async function listarUnidadesPublicas() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT codigo_unidade AS codigo, nome_unidade AS nome FROM Unidades ORDER BY nome_unidade');
    return result.recordset;
}

async function renomearUnidade(codigoUnidade, novoNomeUnidade) {
    const pool = await getPool();
    await pool.request()
        .input('codigoUnidade', sql.NVarChar, codigoUnidade)
        .input('novoNomeUnidade', sql.NVarChar, novoNomeUnidade)
        .query(`
            UPDATE Unidades
            SET nome_unidade = @novoNomeUnidade
            WHERE codigo_unidade = @codigoUnidade
        `);
}

async function removerUnidade(codigoUnidade) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        await transaction.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query('DELETE FROM Salas WHERE codigo_unidade = @codigoUnidade');

        await transaction.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query('DELETE FROM SalasAdministrativas WHERE codigo_unidade = @codigoUnidade');

        await transaction.request()
            .input('codigoUnidade', sql.NVarChar, codigoUnidade)
            .query('DELETE FROM Unidades WHERE codigo_unidade = @codigoUnidade');

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

module.exports = {
    listarUnidades,
    listarUnidadesRestritas,
    listarUnidadesPublicas,
    renomearUnidade,
    removerUnidade
};