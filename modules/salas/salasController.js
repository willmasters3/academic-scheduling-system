const salasService = require('./salasService');

async function listarTopSalas(req, res) {
    try {
        const result = await salasService.getTopSalas();
        return res.json(result);
    } catch (error) {
        console.error('Erro ao listar as salas:', error);
        return res.status(500).send('Erro ao listar as salas.');
    }
}

async function listarSalasPorCodigoUnidade(req, res) {
    const { codigoUnidade } = req.params;
    try {
        const result = await salasService.getSalasByCodigoUnidade(req, codigoUnidade);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Erro ao obter salas:', error);
        return res.status(500).send(error.message);
    }
}

async function listarSalasAdministrativasPorCodigoUnidade(req, res) {
    const { codigoUnidade } = req.params;
    try {
        const result = await salasService.getSalasAdministrativasByCodigoUnidade(req, codigoUnidade);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Erro ao obter salas:', error);
        return res.status(500).send(error.message);
    }
}

async function obterSalaPorId(req, res) {
    const { idSala } = req.params;
    try {
        const result = await salasService.getSalaById(req, idSala);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

async function criarUnidadeComSalas(req, res) {
    const { nomeUnidade, codigoUnidade, salas } = req.body;
    try {
        await salasService.criarUnidadeSalas(nomeUnidade, codigoUnidade, salas);
        return res.status(200).send('Unidade e salas criadas com sucesso!');
    } catch (error) {
        console.error('Erro ao criar unidade e salas:', error);
        return res.status(500).send('Erro ao criar unidade e salas.');
    }
}

async function adicionarSalasEmUnidadeExistente(req, res) {
    const { unidadeAdicionarSala, novaSala } = req.body;

    try {
        const salas = Array.isArray(novaSala) ? novaSala : [novaSala];
        await salasService.adicionarSalasEmUnidadeExistente(unidadeAdicionarSala, salas);
        return res.status(200).send('Salas criadas com sucesso!');
    } catch (error) {
        console.error('Erro ao criar salas:', error);
        return res.status(500).send('Erro ao criar salas.');
    }
}

async function deletarSala(req, res) {
    const { idSala } = req.params;
    try {
        const result = await salasService.deletarSala(req, idSala, req.query.tipoSala);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir sala:', error);
        return res.status(500).send('Erro ao excluir sala.');
    }
}

async function renomearSala(req, res) {
    const { idSala, novoNomeSala, tipoSala } = req.body;

    if (!idSala || !novoNomeSala) {
        return res.status(400).send('ID da sala e novo nome da sala são obrigatórios.');
    }

    try {
        const result = await salasService.renomearSala(req, idSala, novoNomeSala, tipoSala);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao renomear sala:', error);
        return res.status(500).send('Erro ao renomear sala.');
    }
}

async function alterarSala(req, res) {
    try {
        await salasService.alterarSala(req.body, req.file);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao atualizar os dados da sala:', error);
        return res.status(500).send('Erro ao alterar os dados da sala: ' + error.message);
    }
}

async function adicionarSala(req, res) {
    const { codigoUnidade, nomeSala, tipoSala } = req.body;

    try {
        const result = await salasService.adicionarSala(req, codigoUnidade, nomeSala, tipoSala);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao adicionar sala:', error);
        return res.status(500).send('Erro ao adicionar sala.');
    }
}

async function listarUnidadesSalas(req, res) {
    try {
        const result = await salasService.listarUnidadesSalas(req);
        return res.json(result);
    } catch (error) {
        console.error('Erro ao obter a lista de unidades e salas:', error);
        return res.status(500).send('Erro ao obter a lista de unidades e salas.');
    }
}

async function listarSalasDoUsuario(req, res) {
    try {
        const result = await salasService.listarSalasDoUsuario(req);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Erro ao buscar as salas:', error);
        return res.status(500).send('Erro ao buscar as salas');
    }
}

async function listarSalasDisponiveis(req, res) {
    const { data, hora_inicio, hora_fim, codigo_unidade } = req.query;

    try {
        const result = await salasService.listarSalasDisponiveis(req, data, hora_inicio, hora_fim, codigo_unidade);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Erro ao verificar salas disponíveis:', error);
        return res.status(500).send('Erro ao verificar salas disponíveis.');
    }
}

async function listasSalas(req, res) {
    try {
        const result = await salasService.listasSalas();
        return res.json(result);
    } catch (error) {
        console.error('Erro ao buscar as salas:', error);
        return res.status(500).send('Erro ao buscar as salas');
    }
}

async function listarSalasPorUnidade(req, res) {
    const { unidadeCodigo } = req.params;

    try {
        const result = await salasService.listarSalasPorUnidade(req, unidadeCodigo, req.query.tipoSala);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Erro ao listar salas:', error);
        return res.status(500).send('Erro ao listar salas.');
    }
}

async function listarTodasSalasAcademicas(req, res) {
    try {
        const result = await salasService.listarTodasSalasAcademicas();
        return res.json(result);
    } catch (error) {
        console.error('Erro ao buscar todas as salas acadêmicas:', error);
        return res.status(500).send('Erro ao buscar todas as salas acadêmicas.');
    }
}

async function listarTodasSalasAdministrativas(req, res) {
    try {
        const result = await salasService.listarTodasSalasAdministrativas();
        return res.json(result);
    } catch (error) {
        console.error('Erro ao buscar todas as salas administrativas:', error);
        return res.status(500).send('Erro ao buscar todas as salas administrativas.');
    }
}

async function detalhesSala(req, res) {
    const { idSala } = req.params;

    try {
        const result = await salasService.getSalaDetalhes(idSala);
        if (result.error) {
            return res.status(result.status).send(result.error);
        }

        return res.json(result.data);
    } catch (error) {
        console.error('Erro ao buscar detalhes da sala:', error);
        return res.status(500).send('Erro ao buscar detalhes da sala.');
    }
}

module.exports = {
    listarTopSalas,
    listarSalasPorCodigoUnidade,
    listarSalasAdministrativasPorCodigoUnidade,
    obterSalaPorId,
    criarUnidadeComSalas,
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
    detalhesSala
};