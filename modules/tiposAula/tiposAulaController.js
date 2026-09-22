const tiposAulaService = require('./tiposAulaService');

async function listarTiposAulaPorUnidade(req, res) {
    const { codigoUnidade } = req.params;

    try {
        const result = await tiposAulaService.listarTiposAulaPorUnidade(req, codigoUnidade);
        if (result.type === 'send') {
            return res.status(result.statusCode).send(result.body);
        }

        return res.status(result.statusCode).json(result.body);
    } catch (err) {
        console.error('Erro ao listar tipos de aula:', err);
        return res.status(500).send('Erro ao listar tipos de aula.');
    }
}

async function editarTipoAula(req, res) {
    const { descricao } = req.body;
    const { idTipoAula } = req.params;

    try {
        const rowsAffected = await tiposAulaService.editarTipoAula(idTipoAula, descricao);
        if (rowsAffected === 0) {
            return res.status(404).send('Tipo de aula não encontrado.');
        }

        return res.send('Tipo de aula editado com sucesso!');
    } catch (error) {
        console.error('Erro ao editar tipo de aula:', error);
        return res.status(500).send('Erro ao editar tipo de aula.');
    }
}

async function adicionarUnidadeTipoAula(req, res) {
    const { descricao, id_unidade } = req.body;

    if (!descricao || !id_unidade || typeof id_unidade !== 'string') {
        return res.status(400).send('Descrição e ID da unidade são obrigatórios e ID deve ser uma string.');
    }

    try {
        await tiposAulaService.adicionarUnidadeTipoAula(descricao, id_unidade);
        return res.status(201).send('Tipo de aula adicionado e associado à unidade com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar e associar tipo de aula:', error);
        return res.status(500).send('Erro ao adicionar e associar tipo de aula.');
    }
}

async function dessassociarTipoAula(req, res) {
    const { idTipoAula } = req.params;

    try {
        await tiposAulaService.dessassociarTipoAula(idTipoAula);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao dessassociar tipo de aula:', error);
        return res.status(500).send('Erro ao dessassociar tipo de aula.');
    }
}

async function excluirTipoAula(req, res) {
    const { idTipoAula } = req.params;

    try {
        const result = await tiposAulaService.excluirTipoAula(idTipoAula);
        if (result.type === 'send') {
            return res.status(result.statusCode).send(result.body);
        }

        return res.sendStatus(result.statusCode);
    } catch (error) {
        console.error('Erro ao excluir tipo de aula:', error);
        return res.status(500).send('Erro ao excluir tipo de aula.');
    }
}

async function listarTodosTiposAula(req, res) {
    try {
        const data = await tiposAulaService.listarTodosTiposAula();
        return res.json(data);
    } catch (error) {
        console.error('Erro ao listar todos os tipos de aula:', error);
        return res.status(500).send('Erro ao listar tipos de aula.');
    }
}

module.exports = {
    listarTiposAulaPorUnidade,
    editarTipoAula,
    adicionarUnidadeTipoAula,
    dessassociarTipoAula,
    excluirTipoAula,
    listarTodosTiposAula
};
