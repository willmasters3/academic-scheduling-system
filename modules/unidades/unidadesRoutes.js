const express = require('express');
const unidadesController = require('./unidadesController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');
const { requireAdminOrCoordinator } = require('../../middlewares/permissionMiddleware');

const router = express.Router();

function requireAdmin(req, res, next) {
    if (req.session?.user?.permissao === 'admin') {
        return next();
    }

    return res.status(403).send('Acesso negado.');
}

router.get('/unidades', unidadesController.listarUnidades);
router.get('/listar-unidades', requireAuthenticatedSession, requireAdminOrCoordinator, unidadesController.listarUnidadesRestritas);
router.get('/listar-unidades-publicas', unidadesController.listarUnidadesPublicas);
router.post('/renomear-unidade', requireAuthenticatedSession, requireAdmin, unidadesController.renomearUnidade);
router.post('/remover-unidade', requireAuthenticatedSession, requireAdmin, unidadesController.removerUnidade);

module.exports = router;