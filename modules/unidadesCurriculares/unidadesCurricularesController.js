const unidadesCurricularesService = require('./unidadesCurricularesService');

async function getUnidadeCurricular(req, res) {
    const { idUc } = req.params;

    try {
        const data = await unidadesCurricularesService.getUnidadeCurricular(idUc);
        if (data.length === 0) {
            return res.status(404).send('Unidade Curricular não encontrada.');
        }

        return res.json(data[0]);
    } catch (error) {
        console.error('Erro ao buscar detalhes da UC:', error);
        return res.status(500).send('Erro ao buscar detalhes da UC.');
    }
}

async function updateUnidadeCurricular(req, res) {
    const { idUc } = req.params;

    try {
        await unidadesCurricularesService.updateUnidadeCurricular(idUc, req.body);
        return res.status(200).send('Unidade Curricular atualizada com sucesso!');
    } catch (error) {
        console.error('Erro ao editar UC:', error);
        return res.status(500).send('Erro ao editar Unidade Curricular.');
    }
}

async function adicionarUnidadeCurricular(req, res) {
    const { codigoUnidade } = req.body;

    if (!codigoUnidade) {
        return res.status(400).send('O código da unidade é obrigatório.');
    }

    try {
        await unidadesCurricularesService.adicionarUnidadeCurricular(req.body);
        return res.status(201).send('Unidade curricular adicionada com sucesso!');
    } catch (error) {
        console.error('Erro ao adicionar unidade curricular:', error);
        return res.status(500).send('Erro ao adicionar unidade curricular.');
    }
}

async function listarUcsPorUnidade(req, res) {
    const { codigoUnidade } = req.params;

    try {
        const data = await unidadesCurricularesService.listarUcsPorUnidade(codigoUnidade);
        if (data.length === 0) {
            return res.json([]);
        }

        return res.json(data);
    } catch (err) {
        console.error('Erro ao listar UCs por unidade:', err);
        return res.status(500).send('Erro ao listar Unidades Curriculares.');
    }
}

async function associarUnidadeTipoAula(req, res) {
    const { id_unidade_curricular, id_tipo_aula } = req.body;

    if (!id_unidade_curricular || !id_tipo_aula) {
        return res.status(400).send('IDs de Unidade Curricular e Tipo de Aula são obrigatórios.');
    }

    try {
        const result = await unidadesCurricularesService.associarUnidadeTipoAula(req.body);
        if (result.type === 'json') {
            return res.status(result.statusCode).json(result.body);
        }

        return res.status(result.statusCode).send(result.body);
    } catch (error) {
        console.error('Erro crítico na associação:', error);
        return res.status(500).send('Erro interno ao tentar associar.');
    }
}

async function listarAssociacoes(req, res) {
    const { unidadeId } = req.params;

    try {
        const data = await unidadesCurricularesService.listarAssociacoes(unidadeId);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao listar associações:', error);
        return res.status(500).send('Erro ao listar associações.');
    }
}

async function listarUnidadesCurriculares(req, res) {
    try {
        const data = await unidadesCurricularesService.listarUnidadesCurriculares();
        return res.json(data);
    } catch (err) {
        console.error('Erro ao listar unidades curriculares:', err);
        return res.status(500).send('Erro ao listar unidades curriculares.');
    }
}

async function dessassociarUnidadeTipoAula(req, res) {
    const { id_unidade_curricular, id_tipos_aula } = req.body;

    try {
        await unidadesCurricularesService.dessassociarUnidadeTipoAula({
            id_unidade_curricular,
            id_tipos_aula
        });

        return res.status(200).send('Dessassociação realizada com sucesso!');
    } catch (error) {
        // ...
    }
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
