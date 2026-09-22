const express = require('express');
const controller = require('./alocacoesDocentesController');
const { requireAuthenticatedSession, requireRoles } = require('../../middlewares/authMiddleware');

const router = express.Router();
const requireCoordinator = requireRoles(['admin', 'coordenador']);

router.use('/alocacoes-docentes', requireAuthenticatedSession, requireCoordinator);

router.get('/alocacoes-docentes/contexto', controller.obterContexto);
router.get('/alocacoes-docentes/cursos', controller.listarCursos);
router.get('/alocacoes-docentes/cursos/:idCurso/ucs', controller.listarUcsCurso);
router.get('/alocacoes-docentes/turmas', controller.listarTurmas);
router.get('/alocacoes-docentes/minhas', controller.minhasDescontinuada);
router.get('/alocacoes-docentes/coordenacao', controller.listarCoordenacao);
router.post('/alocacoes-docentes/coletiva/verificar-sobreposicao', controller.verificarSobreposicaoColetiva);
router.post('/alocacoes-docentes/coletiva', controller.criarColetiva);
router.post('/alocacoes-docentes/verificar-sobreposicao', controller.verificarSobreposicao);
router.get('/alocacoes-docentes/:id', controller.obterPorId);
router.post('/alocacoes-docentes', controller.criar);
router.put('/alocacoes-docentes/:id', controller.editar);
router.patch('/alocacoes-docentes/:id/inativar', controller.inativar);
router.patch('/alocacoes-docentes/:id/reativar', controller.reativar);

module.exports = router;
