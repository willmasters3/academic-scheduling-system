const express = require('express');
const path = require('path');
const multer = require('multer');
const professoresController = require('./professoresController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');
const { requireAdminOrCoordinator } = require('../../middlewares/permissionMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, path.join(__dirname, '../../imagens'));
	},
	filename: function (req, file, cb) {
		const extensao = path.extname(file.originalname || '').toLowerCase() || '.jpg';
		cb(null, `professor-${Date.now()}${extensao}`);
	}
});

const upload = multer({ storage });

router.post('/register', requireAuthenticatedSession, requireAdminOrCoordinator, upload.single('foto'), professoresController.register);
router.get('/verificar-matricula/:matricula', requireAuthenticatedSession, requireAdminOrCoordinator, professoresController.verificarMatricula);
router.post('/register-coordenador', requireAuthenticatedSession, requireAdminOrCoordinator, upload.single('foto'), professoresController.registerCoordenador);
router.put('/alterar-senha/:id', requireAuthenticatedSession, professoresController.alterarSenha);
router.put('/meu-perfil', requireAuthenticatedSession, upload.single('foto'), professoresController.atualizarMeuPerfil);
router.put('/atualizar-professor/:id', requireAuthenticatedSession, requireAdminOrCoordinator, upload.single('foto'), professoresController.atualizarProfessor);
router.get('/listar-professores-por-unidade/:codigoUnidade', requireAuthenticatedSession, professoresController.listarProfessoresPorUnidade);
router.get('/listar-todos-professores', professoresController.listarTodosProfessores);
router.delete('/desassociar-professor/:id/:codigo_unidade', requireAuthenticatedSession, requireAdminOrCoordinator, professoresController.desassociarProfessorUnidade);
router.delete('/excluir-professor/:id', requireAuthenticatedSession, requireAdminOrCoordinator, professoresController.excluirProfessor);

module.exports = router;
