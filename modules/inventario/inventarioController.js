const inventarioService = require('./inventarioService');

async function cadastrarMonitor(req, res) {
    try {
        const result = await inventarioService.cadastrarMonitor(req.body);
        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao cadastrar monitor:', error);
        return res.status(500).send('Erro ao cadastrar monitor.');
    }
}

async function cadastrarComputadorManual(req, res) {
    try {
        const result = await inventarioService.cadastrarComputadorManual(req.body);
        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao cadastrar computador manual:', error);
        return res.status(500).json({ error: 'Erro ao cadastrar computador manualmente.' });
    }
}

async function monitorPorPatrimonio(req, res) {
    try {
        const result = await inventarioService.monitorPorPatrimonio(req.params.patrimonio);
        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao buscar monitor por patrimonio:', error);
        return res.status(500).json({ error: 'Erro ao buscar monitor por patrimonio.' });
    }
}

async function editarMonitor(req, res) {
    try {
        const result = await inventarioService.editarMonitor(req.params.id, req.body);
        if (result.statusCode === 200) {
            return res.status(200).send(result.body);
        }

        return res.status(result.statusCode).send(result.body);
    } catch (error) {
        console.error('Erro ao editar monitor:', error);
        return res.status(500).send('Erro ao editar monitor.');
    }
}

async function excluirMonitor(req, res) {
    try {
        const result = await inventarioService.excluirMonitor(req.params.id);
        if (result.statusCode === 200) {
            return res.sendStatus(200);
        }

        return res.status(result.statusCode).send(result.body);
    } catch (error) {
        console.error('Erro ao excluir monitor:', error);
        return res.status(500).send('Erro interno ao excluir monitor.');
    }
}

async function associarComputador(req, res) {
    try {
        const result = await inventarioService.associarComputador(req, req.body);
        if (result.statusCode === 200 && typeof result.body === 'object') {
            return res.status(200).json(result.body);
        }

        if (typeof result.body === 'string') {
            return res.status(result.statusCode).send(result.body);
        }

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao associar computador à sala:', error);
        return res.status(500).send('Erro ao associar computador à sala.');
    }
}

async function computadoresAssociados(req, res) {
    try {
        const result = await inventarioService.computadoresAssociados(req.params.id_sala, req.params.tipoSala);
        if (result.statusCode !== 200) {
            return res.status(result.statusCode).send(result.body);
        }

        return res.json(result.body);
    } catch (error) {
        console.error('Erro ao obter computadores associados à sala:', error);
        return res.status(500).send('Erro ao obter computadores associados à sala.');
    }
}

async function infoComputadores(req, res) {
    try {
        const data = await inventarioService.infoComputadores(req);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados dos computadores:', error);
        return res.status(500).send('Erro ao buscar dados dos computadores.');
    }
}

async function historicoEquipamentos(req, res) {
    try {
        const data = await inventarioService.historicoEquipamentos(req);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar histórico de equipamentos:', error);
        return res.status(500).send('Erro ao buscar histórico de equipamentos.');
    }
}

async function deduplicarComputadores(req, res) {
    try {
        const resultado = await inventarioService.deduplicarComputadores();
        return res.json(resultado);
    } catch (error) {
        console.error('Erro ao deduplicar computadores:', error);
        return res.status(500).json({ error: 'Erro ao deduplicar computadores.' });
    }
}

async function desassociarComputador(req, res) {
    try {
        const result = await inventarioService.desassociarComputador(
            req.params.id_computador,
            req.params.id_sala,
            req.params.tipoSala
        );

        if (result.statusCode !== 200) {
            return res.status(result.statusCode).send(result.body);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao desassociar computador:', error);
        return res.status(500).send('Erro ao desassociar computador.');
    }
}

async function listarMonitores(req, res) {
    try {
        const data = await inventarioService.listarMonitores();
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar dados dos monitores:', error);
        return res.status(500).send('Erro ao buscar dados dos monitores.');
    }
}

async function monitoresAssociadosAll(req, res) {
    try {
        const data = await inventarioService.monitoresAssociadosAll();
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar todos os monitores associados (All):', error);
        return res.status(500).send('Erro ao buscar todos os monitores associados (All).');
    }
}

async function monitoresAssociados(req, res) {
    try {
        const data = await inventarioService.monitoresAssociados(req.params.id_sala);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar monitores associados:', error);
        return res.status(500).send('Erro ao buscar monitores associados.');
    }
}

async function desassociarMonitor(req, res) {
    try {
        await inventarioService.desassociarMonitor(req.params.monitorId, req.params.salaId);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao desassociar monitor da sala:', error);
        return res.status(500).send('Erro ao desassociar monitor da sala.');
    }
}

async function associarMonitor(req, res) {
    try {
        const result = await inventarioService.associarMonitor(req.body);
        if (result.statusCode === 200) {
            return res.sendStatus(200);
        }

        return res.status(result.statusCode).send(result.body);
    } catch (error) {
        console.error('Erro ao associar monitor à sala:', error);
        return res.status(500).send('Erro ao associar monitor à sala.');
    }
}

async function inventarioComputadores(req, res) {
    try {
        const data = await inventarioService.inventarioComputadores(req);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar inventário com status:', error);
        return res.status(500).send('Erro ao buscar dados do inventário.');
    }
}

async function patchPatrimonioPorSerial(req, res) {
    try {
        const result = await inventarioService.patchPatrimonioPorSerial(req, req.params.serial, req.body.patrimonio);
        return res.status(result.statusCode).json(result.body);
    } catch (err) {
        console.error('[PATCH patrimonio]', err);
        return res.status(500).json({ error: 'Erro ao atualizar patrimônio.' });
    }
}

async function patchPatrimonioPorId(req, res) {
    try {
        const result = await inventarioService.patchPatrimonioPorId(req, req.params.id, req.body.patrimonio);
        return res.status(result.statusCode).json(result.body);
    } catch (err) {
        console.error('[PATCH patrimonio por id]', err);
        return res.status(500).json({ error: 'Erro ao atualizar patrimonio.' });
    }
}

async function patchDadosManual(req, res) {
    try {
        const result = await inventarioService.patchDadosManual(req, req.params.id, req.body);
        return res.status(result.statusCode).json(result.body);
    } catch (err) {
        console.error('[PATCH dados manual computador]', err);
        return res.status(500).json({ error: 'Erro ao atualizar os dados do computador manual.' });
    }
}

module.exports = {
    cadastrarMonitor,
    cadastrarComputadorManual,
    monitorPorPatrimonio,
    editarMonitor,
    excluirMonitor,
    associarComputador,
    computadoresAssociados,
    infoComputadores,
    deduplicarComputadores,
    desassociarComputador,
    listarMonitores,
    monitoresAssociadosAll,
    monitoresAssociados,
    desassociarMonitor,
    associarMonitor,
    inventarioComputadores,
    patchPatrimonioPorSerial,
    patchPatrimonioPorId,
    patchDadosManual,
    historicoEquipamentos
};
