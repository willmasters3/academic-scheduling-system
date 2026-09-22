const express = require('express');
const auditoriaController = require('./agendamentoAuditoriaController');
const { requireAuthenticatedSession, requireRoles } = require('../../middlewares/authMiddleware');

const router = express.Router();

router.get(
    '/agendamento-auditoria',
    requireAuthenticatedSession,
    requireRoles(['admin', 'coordenador']),
    auditoriaController.listarAuditoria
);

router.get(
    '/agendamento-auditoria/:id',
    requireAuthenticatedSession,
    requireRoles(['admin', 'coordenador']),
    auditoriaController.obterAuditoriaPorId
);

module.exports = router;
