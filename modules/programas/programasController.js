const programasService = require('./programasService');

async function obterProgramasDaSala(req, res) {
    const { idSala } = req.params;
    try {
        const programas = await programasService.obterProgramasDaSala(idSala);
        return res.json(programas);
    } catch (err) {
        console.error('Erro ao obter programas da sala:', err);
        return res.status(500).send(err.message);
    }
}

async function adicionarPrograma(req, res) {
    const { nomePrograma, versao } = req.body;
    try {
        await programasService.adicionarPrograma(nomePrograma, versao);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao adicionar o programa:', error);
        return res.status(500).send('Erro ao adicionar o programa.');
    }
}

async function excluirProgramas(req, res) {
    const { programas } = req.body;
    if (!Array.isArray(programas) || programas.length === 0) {
        return res.status(400).send('Nenhum programa selecionado para exclusão');
    }

    try {
        await programasService.excluirProgramas(programas);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao excluir programas:', error);
        return res.status(500).send('Erro ao excluir programas.');
    }
}

async function listarProgramasAdicionados(req, res) {
    try {
        const programas = await programasService.listarProgramasAdicionados();
        return res.json(programas);
    } catch (error) {
        console.error('Erro ao obter programas adicionados:', error);
        return res.status(500).send('Erro ao obter programas adicionados.');
    }
}

async function listarProgramas(req, res) {
    try {
        const programas = await programasService.listarProgramas();
        return res.json(programas);
    } catch (error) {
        console.error('Erro ao buscar os programas:', error);
        return res.status(500).send('Erro ao buscar os programas');
    }
}

async function obterProgramasAssociados(req, res) {
    const { id_sala } = req.params;
    try {
        const programas = await programasService.obterProgramasAssociados(id_sala);
        return res.json(programas);
    } catch (error) {
        console.error('Erro ao buscar programas associados à sala:', error);
        return res.status(500).send('Erro ao buscar programas associados à sala');
    }
}

async function associarSalaPrograma(req, res) {
    const { sala, programas } = req.body;
    try {
        await programasService.associarSalaPrograma(sala, programas);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao associar sala e programa:', error);
        return res.status(500).send('Erro ao associar sala e programa');
    }
}

async function desassociarSalaPrograma(req, res) {
    const { sala, programas } = req.body;
    try {
        await programasService.desassociarSalaPrograma(sala, programas);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Erro ao desassociar sala e programa:', error);
        return res.status(500).send('Erro ao desassociar sala e programa');
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
