const express = require('express');
const controller = require('./gestaoDocenteController');
const { requireAuthenticatedSession, requireRoles } = require('../../middlewares/authMiddleware');

const router = express.Router();
const requireManagement = requireRoles(['admin', 'coordenador']);

router.use('/api/gestao-docente', requireAuthenticatedSession, requireManagement);
router.get('/api/gestao-docente/filtros', controller.listarFiltros);
router.get('/api/gestao-docente/dashboard', controller.obterDashboard);
router.get('/api/gestao-docente/professores', controller.listarProfessores);
router.get('/api/gestao-docente/professores/:idProfessor', controller.obterPerfilProfessor);

router.patch('/api/gestao-docente/professores/:idProfessor/classificacao-docente', controller.atualizarClassificacaoDocente);

module.exports = router;
