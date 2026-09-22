const express = require('express');
const agendamentosController = require('./agendamentosController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');

const router = express.Router();

// Agendamentos — CRUD
router.post('/agendar-sala', requireAuthenticatedSession, agendamentosController.agendarSala);
router.post('/agendar-sala/verificar-disponibilidade', requireAuthenticatedSession, agendamentosController.verificarDisponibilidadeAgendamentos);
router.put('/editar-agendamento/:id', requireAuthenticatedSession, agendamentosController.editarAgendamento);
router.put('/editar-professor-agendamento/:id', requireAuthenticatedSession, agendamentosController.editarProfessorAgendamento);
router.get('/verificar-agendamento/:id_sala/:data/:hora_inicio/:hora_fim', agendamentosController.verificarAgendamento);
router.get('/listar-agendamentos/:id_Sala', agendamentosController.listarAgendamentosSala);
router.get('/listar-agendamentos-professor-logado', requireAuthenticatedSession, agendamentosController.listarAgendamentosProfessorLogado);
router.get('/troca-sala/stream', requireAuthenticatedSession, agendamentosController.streamTrocasSala);
router.delete('/excluir-agendamento/:id', requireAuthenticatedSession, agendamentosController.excluirAgendamento);
router.delete('/excluir-agendamentos-intervalo', requireAuthenticatedSession, agendamentosController.excluirAgendamentosIntervalo);
router.get('/listar-agendamento/:unidadeCodigo', agendamentosController.listarAgendamentosUnidade);
router.get('/listar-agendamentos-filtrados', agendamentosController.listarAgendamentosFiltrados);
router.get('/dashboard-agendamentos-filtrados', requireAuthenticatedSession, agendamentosController.listarAgendamentosDashboardFiltrados);

// Troca de sala — simples
router.get('/troca-sala/possiveis/:idAgendamentoOrigem', requireAuthenticatedSession, agendamentosController.listarPossiveisTrocas);
router.post('/troca-sala/solicitar', requireAuthenticatedSession, agendamentosController.solicitarTroca);
router.get('/troca-sala/coordenador/agendamentos/:unidadeCodigo', requireAuthenticatedSession, agendamentosController.listarAgendamentosTrocaCoordenador);
router.post('/troca-sala/coordenador/trocar', requireAuthenticatedSession, agendamentosController.executarTrocaDiretaCoordenador);
router.get('/troca-sala/recebidas', requireAuthenticatedSession, agendamentosController.listarTrocasRecebidas);
router.get('/troca-sala/enviadas', requireAuthenticatedSession, agendamentosController.listarTrocasEnviadas);
router.post('/troca-sala/:idSolicitacao/decidir', requireAuthenticatedSession, agendamentosController.decidirTroca);

// Troca de sala — lote
router.post('/troca-sala/lote/solicitar', requireAuthenticatedSession, agendamentosController.solicitarTrocaLote);
router.get('/troca-sala/lotes/recebidos', requireAuthenticatedSession, agendamentosController.listarLotesRecebidos);
router.get('/troca-sala/lotes/enviados', requireAuthenticatedSession, agendamentosController.listarLotesEnviados);
router.get('/troca-sala/lote/:idLote', requireAuthenticatedSession, agendamentosController.buscarDetalhesLote);
router.post('/troca-sala/lote/:idLote/decidir', requireAuthenticatedSession, agendamentosController.decidirTrocaLote);

// Verificar expirados (interno/legado)
router.post('/agendamentos/verificar-expirados', requireAuthenticatedSession, agendamentosController.verificarEExcluirAgendamentosExpirados);

module.exports = router;
