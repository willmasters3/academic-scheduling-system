const express = require('express');
const relatoriosEquipamentosController = require('./relatoriosEquipamentosController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');
const { requireAdminOrCoordinator } = require('../../middlewares/permissionMiddleware');

const router = express.Router();

router.get('/api/relatorios/equipamentos/salas-disponiveis', requireAuthenticatedSession, requireAdminOrCoordinator, relatoriosEquipamentosController.listarSalasDisponiveis);

router.get('/api/relatorios/equipamentos/salas', requireAuthenticatedSession, requireAdminOrCoordinator, relatoriosEquipamentosController.listarSalasEquipamentos);
router.get('/api/relatorios/equipamentos/excel', requireAuthenticatedSession, requireAdminOrCoordinator, relatoriosEquipamentosController.exportarExcel);

module.exports = router;
