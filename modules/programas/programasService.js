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

async function obterProgramasDaSala(idSala) {
    const pool = await getPool();
    const result = await pool.request()
        .input('idSala', sql.Int, idSala)
        .query(`
            SELECT p.id_programa, p.nome_programa, p.versao
            FROM Programas p
            JOIN SalaPrograma sp ON p.id_programa = sp.id_programa
            WHERE sp.id_sala = @idSala
        `);

    return result.recordset;
}

async function adicionarPrograma(nomePrograma, versao) {
    const pool = await getPool();
    const query = `
        INSERT INTO programas (nome_programa, versao)
        VALUES (@nomePrograma, @versao)
    `;

    await pool.request()
        .input('nomePrograma', sql.NVarChar(50), nomePrograma)
        .input('versao', sql.NVarChar(50), versao)
        .query(query);
}

async function excluirProgramas(programas) {
    const pool = await getPool();
    const query = `DELETE FROM programas WHERE id_programa IN (${programas.map((programa) => parseInt(programa, 10)).join(',')})`;
    await pool.request().query(query);
}

async function listarProgramasAdicionados() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id_programa, nome_programa, versao FROM programas');
    return result.recordset;
}

async function listarProgramas() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id_programa, nome_programa, versao FROM Programas');
    return result.recordset;
}

async function obterProgramasAssociados(idSala) {
    const pool = await getPool();
    const query = 'SELECT p.id_programa, p.nome_programa, p.versao FROM Programas p JOIN SalaPrograma sp ON p.id_programa = sp.id_programa WHERE sp.id_sala = @id_sala';
    const result = await pool.request().input('id_sala', sql.Int, idSala).query(query);
    return result.recordset;
}

async function associarSalaPrograma(sala, programas) {
    const pool = await getPool();
    for (const programa of programas) {
        const query = 'INSERT INTO SalaPrograma (id_sala, id_programa) VALUES (@sala, @programa)';
        await pool.request().input('sala', sql.Int, sala).input('programa', sql.Int, programa).query(query);
    }
}

async function desassociarSalaPrograma(sala, programas) {
    const pool = await getPool();
    for (const programa of programas) {
        const query = 'DELETE FROM SalaPrograma WHERE id_sala = @sala AND id_programa = @programa';
        await pool.request().input('sala', sql.Int, sala).input('programa', sql.Int, programa).query(query);
    }
}

module.exports = {
    obterProgramasDaSala,
    adicionarPrograma,
    excluirProgramas,
    listarProgramasAdicionados,
    listarProgramas,
    obterProgramasAssociados,
    associarSalaPrograma,
    desassociarSalaPrograma
};
