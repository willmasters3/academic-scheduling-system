const unidadesService = require('./unidadesService');

async function listarUnidades(req, res) {
    try {
        const unidades = await unidadesService.listarUnidades(req);
        return res.json(unidades);
    } catch (err) {
        return res.status(500).send(err.message);
    }
}

async function listarUnidadesRestritas(req, res) {
    try {
        const unidades = await unidadesService.listarUnidadesRestritas(req);
        return res.json(unidades);
    } catch (err) {
        console.error('Erro ao listar unidades:', err);
        return res.status(500).send('Erro ao listar unidades');
    }
}

async function listarUnidadesPublicas(req, res) {
    try {
        const unidades = await unidadesService.listarUnidadesPublicas();
        return res.json(unidades);
    } catch (err) {
        console.error('Erro ao listar unidades públicas:', err);
        return res.status(500).send('Erro ao listar unidades');
    }
}

async function renomearUnidade(req, res) {
    const { codigoUnidade, novoNomeUnidade } = req.body;

    try {
        await unidadesService.renomearUnidade(codigoUnidade, novoNomeUnidade);
        return res.sendStatus(200);
    } catch (err) {
        console.error('Erro ao renomear unidade:', err);
        return res.status(500).send('Erro ao renomear unidade');
    }
}

async function removerUnidade(req, res) {
    const { codigoUnidade } = req.body;

    try {
        await unidadesService.removerUnidade(codigoUnidade);
        return res.sendStatus(200);
    } catch (err) {
        console.error('Erro ao remover unidade:', err);
        return res.status(500).send('Erro ao remover unidade');
    }
}

module.exports = {
    listarUnidades,
    listarUnidadesRestritas,
    listarUnidadesPublicas,
    renomearUnidade,
    removerUnidade
};