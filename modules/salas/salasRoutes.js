const express = require('express');
const path = require('path');
const multer = require('multer');
const salasController = require('./salasController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');
const { requireAdminOrCoordinator } = require('../../middlewares/permissionMiddleware');

const router = express.Router();

function requireAdmin(req, res, next) {
    if (req.session?.user?.permissao === 'admin') {
        return next();
    }

    return res.status(403).send('Acesso negado.');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../imagens'));
    },
    filename: function (req, file, cb) {
        cb(null, `image-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

router.get('/top-salas', salasController.listarTopSalas);
router.get('/salas/:codigoUnidade', salasController.listarSalasPorCodigoUnidade);
router.get('/SalasAdministrativas/:codigoUnidade', salasController.listarSalasAdministrativasPorCodigoUnidade);
router.get('/sala/:idSala', salasController.obterSalaPorId);
router.post('/criar-unidade-salas', requireAuthenticatedSession, requireAdmin, salasController.criarUnidadeComSalas);
router.post('/form-adicionar-salas', requireAuthenticatedSession, requireAdminOrCoordinator, salasController.adicionarSalasEmUnidadeExistente);
router.delete('/deletar-sala/:idSala', requireAuthenticatedSession, requireAdminOrCoordinator, salasController.deletarSala);
router.post('/renomear-sala', requireAuthenticatedSession, requireAdminOrCoordinator, salasController.renomearSala);
router.post('/alterarSala', requireAuthenticatedSession, requireAdminOrCoordinator, upload.single('image'), salasController.alterarSala);
router.post('/adicionar-sala', requireAuthenticatedSession, requireAdminOrCoordinator, salasController.adicionarSala);
router.get('/listar-unidades-salas', requireAuthenticatedSession, requireAdminOrCoordinator, salasController.listarUnidadesSalas);
router.get('/salas', salasController.listarSalasDoUsuario);
router.get('/salas-disponiveis', requireAuthenticatedSession, salasController.listarSalasDisponiveis);
router.get('/listasSalas', salasController.listasSalas);
router.get('/listar-salas/:unidadeCodigo', requireAuthenticatedSession, salasController.listarSalasPorUnidade);
router.get('/todas-salas-academicas', salasController.listarTodasSalasAcademicas);
router.get('/todas-salas-administrativas', salasController.listarTodasSalasAdministrativas);
router.get('/salas/detalhes/:idSala', salasController.detalhesSala);

module.exports = router;