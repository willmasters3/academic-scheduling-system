const express = require('express');
const inventarioController = require('./inventarioController');
const { requireAuthenticatedSession } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.post('/cadastrar-monitor', requireAuthenticatedSession, inventarioController.cadastrarMonitor);
router.post('/cadastrar-computador-manual', requireAuthenticatedSession, inventarioController.cadastrarComputadorManual);
router.get('/monitor-por-patrimonio/:patrimonio', requireAuthenticatedSession, inventarioController.monitorPorPatrimonio);
router.put('/editar-monitor/:id', requireAuthenticatedSession, inventarioController.editarMonitor);
router.delete('/excluir-monitor/:id', requireAuthenticatedSession, inventarioController.excluirMonitor);
router.post('/associar-computador', requireAuthenticatedSession, inventarioController.associarComputador);
router.get('/computadores-associados/:id_sala/:tipoSala', requireAuthenticatedSession, inventarioController.computadoresAssociados);
router.get('/infocomputadores', inventarioController.infoComputadores);
router.post('/infocomputadores/deduplicar', requireAuthenticatedSession, inventarioController.deduplicarComputadores);
router.delete('/desassociar-computador/:id_computador/:id_sala/:tipoSala', requireAuthenticatedSession, inventarioController.desassociarComputador);
router.get('/monitores', requireAuthenticatedSession, inventarioController.listarMonitores);
router.get('/monitores-associados-all', requireAuthenticatedSession, inventarioController.monitoresAssociadosAll);
router.get('/monitores-associados/:id_sala', requireAuthenticatedSession, inventarioController.monitoresAssociados);
router.delete('/desassociar-monitor/:monitorId/:salaId', requireAuthenticatedSession, inventarioController.desassociarMonitor);
router.post('/associar-monitor', requireAuthenticatedSession, inventarioController.associarMonitor);

router.get('/computadores/inventario', requireAuthenticatedSession, inventarioController.inventarioComputadores);
router.get('/historico-equipamentos', requireAuthenticatedSession, inventarioController.historicoEquipamentos);
router.patch('/computadores/:serial/patrimonio', requireAuthenticatedSession, inventarioController.patchPatrimonioPorSerial);
router.patch('/computadores/id/:id/patrimonio', requireAuthenticatedSession, inventarioController.patchPatrimonioPorId);
router.patch('/computadores/id/:id/dados-manual', requireAuthenticatedSession, inventarioController.patchDadosManual);

module.exports = router;
