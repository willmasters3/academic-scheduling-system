const auditoriaService = require('./agendamentoAuditoriaService');

async function listarAuditoria(req, res) {
    try {
        const resultado = await auditoriaService.listarAuditoria({
            user: req.session?.user,
            filters: req.query || {}
        });

        return res.json(resultado);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error('Erro ao listar auditoria de agendamentos:', error);
        return res.status(500).json({ error: 'Erro ao listar auditoria de agendamentos.' });
    }
}

async function obterAuditoriaPorId(req, res) {
    try {
        const registro = await auditoriaService.obterAuditoriaPorId({
            user: req.session?.user,
            id: req.params.id
        });

        return res.json(registro);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error('Erro ao obter auditoria de agendamento:', error);
        return res.status(500).json({ error: 'Erro ao obter auditoria de agendamento.' });
    }
}

module.exports = {
    listarAuditoria,
    obterAuditoriaPorId
};
