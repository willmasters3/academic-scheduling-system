const { requireRoles } = require('./authMiddleware');

function requireAdminOrCoordinator(req, res, next) {
    return requireRoles(['admin', 'coordenador'])(req, res, next);
}

module.exports = {
    requireAdminOrCoordinator
};
