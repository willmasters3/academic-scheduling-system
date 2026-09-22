const express = require('express');
const tiposAulaController = require('./tiposAulaController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.get('/listar-tipos-aula-por-unidade/:codigoUnidade', requireAuthenticatedSession, tiposAulaController.listarTiposAulaPorUnidade);
router.put('/editar-tipo-aula/:idTipoAula', tiposAulaController.editarTipoAula);
router.post('/adicionar-unidade-tipo-aula', tiposAulaController.adicionarUnidadeTipoAula);
router.delete('/dessassociar-tipo-aula/:idTipoAula', tiposAulaController.dessassociarTipoAula);
router.delete('/excluir-tipo-aula/:idTipoAula', tiposAulaController.excluirTipoAula);
router.get('/listar-todos-tipos-aula', tiposAulaController.listarTodosTiposAula);

module.exports = router;
