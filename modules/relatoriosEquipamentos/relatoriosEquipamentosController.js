const relatoriosEquipamentosService = require('./relatoriosEquipamentosService');

async function listarSalasDisponiveis(req, res) {
    try {
        const result = await relatoriosEquipamentosService.listarSalasDisponiveis(
            req, req.query.unidadeId, req.query.tipoSala
        );
        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao listar salas para relatório:', error);
        return res.status(500).json({ error: 'Erro ao carregar salas.' });
    }
}

async function listarSalasEquipamentos(req, res) {
    try {
        const result = await relatoriosEquipamentosService.listarSalasEquipamentos(
            req,
            req.query.unidadeId,
            req.query.tipoSala,
            req.query.salaId
        );

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao gerar relatório de equipamentos:', error);
        return res.status(500).json({ error: 'Erro ao gerar relatório de equipamentos.' });
    }
}

async function exportarExcel(req, res) {
    try {
        const result = await relatoriosEquipamentosService.gerarExcel(
            req,
            req.query.unidadeId,
            req.query.tipoSala,
            req.query.salaId
        );

        if (result.statusCode !== 200) {
            return res.status(result.statusCode).json(result.body);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.body);
    } catch (error) {
        console.error('Erro ao exportar Excel de equipamentos:', error);
        return res.status(500).json({ error: 'Erro ao exportar Excel de equipamentos.' });
    }
}

module.exports = {
    listarSalasDisponiveis,
    listarSalasEquipamentos,
    exportarExcel
};
