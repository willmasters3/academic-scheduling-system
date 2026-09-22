const express = require('express');
const programasController = require('./programasController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');
const { requireAdminOrCoordinator } = require('../../middlewares/permissionMiddleware');

const router = express.Router();

router.get('/programas/:idSala', programasController.obterProgramasDaSala);
router.post('/adicionarPrograma', requireAuthenticatedSession, requireAdminOrCoordinator, programasController.adicionarPrograma);
router.post('/excluirProgramas', requireAuthenticatedSession, requireAdminOrCoordinator, programasController.excluirProgramas);
router.get('/programasAdicionados', programasController.listarProgramasAdicionados);
router.get('/listaProgramas', programasController.listarProgramas);
router.get('/programas-sala/:id_sala', programasController.obterProgramasAssociados);
router.post('/associar-sala-programa', requireAuthenticatedSession, requireAdminOrCoordinator, programasController.associarSalaPrograma);
router.post('/desassociar-sala-programa', requireAuthenticatedSession, requireAdminOrCoordinator, programasController.desassociarSalaPrograma);

module.exports = router;
