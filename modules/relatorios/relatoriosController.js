const relatoriosService = require('./relatoriosService');

function getLoggedProfessorId(req) {
    return req.session?.user?.id_professor;
}

async function horasAgendadasMes(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Usuário não autenticado.');
    }

    try {
        const data = await relatoriosService.horasAgendadasMes(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao calcular dados da dashboard:', error);
        return res.status(500).send('Erro ao calcular dados da dashboard.');
    }
}

async function agendaSemanalProfessor(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const data = await relatoriosService.agendaSemanalProfessor(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar agenda semanal:', error);
        return res.status(500).send('Erro ao buscar agenda semanal.');
    }
}

async function agendaProfessorPorPeriodo(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).send('Parâmetros start e end são obrigatórios.');
    }

    try {
        const data = await relatoriosService.agendaProfessorPorPeriodo(idProfessor, start, end);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar agenda por período:', error);
        return res.status(500).send('Erro ao buscar agenda por período.');
    }
}

async function criarCompromissoAgendaProfessor(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const result = await relatoriosService.criarCompromissoAgendaProfessor(idProfessor, {
            titulo: req.body.titulo,
            data: req.body.data,
            horaInicio: req.body.hora_inicio,
            horaFim: req.body.hora_fim,
            descricao: req.body.descricao
        });

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao criar compromisso pessoal:', error);
        return res.status(500).json({ error: 'Erro ao criar compromisso pessoal.' });
    }
}

async function topSalasProfessor(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const data = await relatoriosService.topSalasProfessor(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao buscar top salas:', error);
        return res.status(500).send('Erro ao buscar top salas.');
    }
}

async function professorDisponibilidade(req, res) {
    const { id_professor } = req.params;
    const {
        dataInicio,
        dataFim,
        horaInicioJornada,
        horaFimJornada,
        modoJornada,
        filtroTurno,
        filtroDiaSemana,
        duracaoMinima
    } = req.query;

    if (!dataInicio || !dataFim) {
        return res.status(400).send('Parâmetros de data (início/fim) são obrigatórios.');
    }

    const id = parseInt(id_professor, 10);
    if (Number.isNaN(id)) {
        return res.status(400).send('ID do professor inválido.');
    }

    try {
        const data = await relatoriosService.professorDisponibilidade(
            id,
            dataInicio,
            dataFim,
            horaInicioJornada,
            horaFimJornada,
            modoJornada,
            filtroTurno,
            filtroDiaSemana,
            duracaoMinima
        );
        return res.json(data);
    } catch (error) {
        console.error('Erro ao verificar disponibilidade do professor:', error);
        return res.status(500).send('Erro ao verificar disponibilidade do professor.');
    }
}

async function relatorioHorasPorUc(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const data = await relatoriosService.relatorioHorasPorUc(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao gerar relatório de horas por UC:', error);
        return res.status(500).send('Erro ao gerar relatório.');
    }
}

async function relatorioUsoSalas(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const data = await relatoriosService.relatorioUsoSalas(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao gerar relatório de uso de salas:', error);
        return res.status(500).send('Erro ao gerar relatório.');
    }
}

async function relatorioAgendamentosPeriodo(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const data = await relatoriosService.relatorioAgendamentosPeriodo(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao gerar relatório por período:', error);
        return res.status(500).send('Erro ao gerar relatório.');
    }
}

async function relatorioSalasPorcentagem(req, res) {
    const idProfessor = getLoggedProfessorId(req);
    if (!idProfessor) {
        return res.status(401).send('Não autenticado.');
    }

    try {
        const data = await relatoriosService.relatorioSalasPorcentagem(idProfessor);
        return res.json(data);
    } catch (error) {
        console.error('Erro ao gerar dados para o gráfico de salas:', error);
        return res.status(500).send('Erro ao gerar dados do gráfico.');
    }
}

module.exports = {
    horasAgendadasMes,
    agendaSemanalProfessor,
    agendaProfessorPorPeriodo,
    criarCompromissoAgendaProfessor,
    topSalasProfessor,
    professorDisponibilidade,
    relatorioHorasPorUc,
    relatorioUsoSalas,
    relatorioAgendamentosPeriodo,
    relatorioSalasPorcentagem
};