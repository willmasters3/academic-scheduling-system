const express = require('express');
const controller = require('./cadastrosAcademicosController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');
const { requireAdminOrCoordinator } = require('../../middlewares/permissionMiddleware');

const router = express.Router();
router.use('/cadastros-academicos', requireAuthenticatedSession, requireAdminOrCoordinator);

router.get('/cadastros-academicos/cursos', controller.listarCursos);
router.post('/cadastros-academicos/cursos', controller.criarCurso);
router.put('/cadastros-academicos/cursos/:id', controller.editarCurso);
router.patch('/cadastros-academicos/cursos/:id/status', controller.alterarStatusCurso);

router.get('/cadastros-academicos/cursos/:idCurso/ucs', controller.listarCursoUcs);
router.post('/cadastros-academicos/cursos/:idCurso/ucs/lote', controller.associarCursoUcsLote);
router.post('/cadastros-academicos/cursos/:idCurso/ucs', controller.associarCursoUc);
router.put('/cadastros-academicos/curso-ucs/:id', controller.editarCursoUc);
router.patch('/cadastros-academicos/curso-ucs/:id/status', controller.alterarStatusCursoUc);

router.get('/cadastros-academicos/turmas', controller.listarTurmas);
router.post('/cadastros-academicos/turmas', controller.criarTurma);
router.put('/cadastros-academicos/turmas/:id', controller.editarTurma);
router.patch('/cadastros-academicos/turmas/:id/status', controller.alterarStatusTurma);

module.exports = router;
