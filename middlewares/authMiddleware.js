function requireAuthenticatedSession(req, res, next) {
    if (req.session?.user) {
        return next();
    }

    return res.status(401).json({ error: 'Não autenticado.' });
}

function requireRoles(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.session?.user) {
            return res.status(401).json({ error: 'Não autenticado.' });
        }

        const permissao = req.session.user?.permissao;
        if (allowedRoles.includes(permissao)) {
            return next();
        }

        return res.status(403).json({ error: 'Acesso negado.' });
    };
}

module.exports = {
    requireAuthenticatedSession,
    requireRoles
};
