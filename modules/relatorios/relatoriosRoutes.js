const express = require('express');
const relatoriosController = require('./relatoriosController');

const router = express.Router();

router.get('/horas-agendadas-mes', relatoriosController.horasAgendadasMes);
router.get('/agenda-semanal-professor', relatoriosController.agendaSemanalProfessor);
router.get('/agenda-professor-periodo', relatoriosController.agendaProfessorPorPeriodo);
router.post('/agenda-professor-compromisso', relatoriosController.criarCompromissoAgendaProfessor);
router.get('/top-salas-professor', relatoriosController.topSalasProfessor);
router.get('/professor-disponibilidade/:id_professor', relatoriosController.professorDisponibilidade);

router.get('/relatorio/horas-por-uc', relatoriosController.relatorioHorasPorUc);
router.get('/relatorio/uso-salas', relatoriosController.relatorioUsoSalas);
router.get('/relatorio/agendamentos-periodo', relatoriosController.relatorioAgendamentosPeriodo);
router.get('/relatorio/salas-porcentagem', relatoriosController.relatorioSalasPorcentagem);

module.exports = router;