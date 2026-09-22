const express = require('express');
const path = require('path');

const router = express.Router();

const pageMap = {
    '/login': 'login.html',
    '/agendamentos': 'agendamentos.html',
    '/info-computadores': 'infocomputadores.html',
    '/agendas-api': 'agendas-api.html',
    '/agenda-sala': 'agendasala.html',
    '/dashboard-professor': 'dashboardagenda.html',
    '/dashboard': 'dashboard.html',
    '/dashboard-coordenador': 'dashboard-coordenador.html',
    '/adiciona-programas': 'adicionaprogramas.html',
    '/adiciona-unidade': 'adicionaunidade.html',
    '/altera-agenda': 'alteraagenda.html',
    '/altera-dados': 'alteradados.html',
    '/cadastro': 'cadastro.html',
    '/gerenciar-equipamentos': 'gerenciarequipamentos.html',
    '/relatorios-equipamentos': 'relatorios-equipamentos.html',
    '/unidades-curriculares': 'unidadescurriculares.html',
    '/disponibilidade-professores': 'disponibilidade-professores.html',
    '/alocacao-docente': 'alocacao-docente.html',
    '/alocacao-docente/nova': 'alocacao-docente-nova.html',
    '/alocacao-docente/coletiva': 'alocacao-docente-coletiva.html',
    '/alocacao-docente/minhas': 'alocacao-docente-minhas.html',
    '/alocacao-docente/coordenacao': 'alocacao-docente-coordenacao.html',
    '/auditoria-agendamentos': 'auditoria-agendamentos.html',
    '/gestao-docente': 'gestao-docente-dashboard.html',
    '/gestao-docente/professores': 'gestao-docente-professores.html'
};

const legacyToClean = {
    '/html/login.html': '/login',
    '/html/agendamentos.html': '/agendamentos',
    '/html/infocomputadores.html': '/info-computadores',
    '/html/agendas-api.html': '/agendas-api',
    '/html/agendasala.html': '/agenda-sala',
    '/html/dashboardagenda.html': '/dashboard-professor',
    '/html/dashboard.html': '/dashboard',
    '/html/dashboard-coordenador.html': '/dashboard-coordenador',
    '/html/adicionaprogramas.html': '/adiciona-programas',
    '/html/adicionaunidade.html': '/adiciona-unidade',
    '/html/alteraagenda.html': '/altera-agenda',
    '/html/alteradados.html': '/altera-dados',
    '/html/cadastro.html': '/cadastro',
    '/html/gerenciarequipamentos.html': '/gerenciar-equipamentos',
    '/html/relatorios-equipamentos.html': '/relatorios-equipamentos',
    '/html/unidadescurriculares.html': '/unidades-curriculares',
    '/html/disponibilidade-professores.html': '/disponibilidade-professores',
    '/html/auditoria-agendamentos.html': '/auditoria-agendamentos'
};

const legacyRootToClean = {
    '/login.html': '/login',
    '/agendamentos.html': '/agendamentos',
    '/infocomputadores.html': '/info-computadores',
    '/agendas-api.html': '/agendas-api',
    '/agendasala.html': '/agenda-sala',
    '/dashboardagenda.html': '/dashboard-professor',
    '/dashboard.html': '/dashboard',
    '/dashboard-coordenador.html': '/dashboard-coordenador',
    '/adicionaprogramas.html': '/adiciona-programas',
    '/adicionaunidade.html': '/adiciona-unidade',
    '/alteraagenda.html': '/altera-agenda',
    '/alteradados.html': '/altera-dados',
    '/cadastro.html': '/cadastro',
    '/gerenciarequipamentos.html': '/gerenciar-equipamentos',
    '/relatorios-equipamentos.html': '/relatorios-equipamentos',
    '/unidadescurriculares.html': '/unidades-curriculares',
    '/disponibilidade-professores.html': '/disponibilidade-professores',
    '/auditoria-agendamentos.html': '/auditoria-agendamentos'
};

function checkAuth(req, res, next) {
    if (req.session?.user) {
        return next();
    }

    return res.redirect('/login');
}

function checkPermissions(req, res, next) {
    const { permissao } = req.session?.user || {};
    if (permissao === 'admin' || permissao === 'coordenador') {
        return next();
    }

    return res.status(403).send('Acesso negado.');
}

function getDashboardPathByPermission(permissao) {
    if (permissao === 'admin') {
        return '/dashboard';
    }

    if (permissao === 'coordenador') {
        return '/dashboard-coordenador';
    }

    return '/dashboard-professor';
}

function sendPublicPage(pageName) {
    return (req, res) => {
        return res.sendFile(path.join(__dirname, `../../public/html/${pageName}`));
    };
}

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

router.get('/login', (req, res) => {
    if (req.session?.user) {
        return res.redirect(getDashboardPathByPermission(req.session.user.permissao));
    }

    return res.sendFile(path.join(__dirname, '../../public/html/login.html'));
});

router.get('/agendamentos', sendPublicPage(pageMap['/agendamentos']));
router.get('/agendas-api', sendPublicPage(pageMap['/agendas-api']));

router.get('/agendar-salas', checkAuth, (req, res) => {
    return res.redirect(getDashboardPathByPermission(req.session.user?.permissao));
});

router.get('/agenda-sala', checkAuth, sendPublicPage(pageMap['/agenda-sala']));
router.get('/dashboard-professor', checkAuth, sendPublicPage(pageMap['/dashboard-professor']));
router.get('/alocacao-docente', checkAuth, checkPermissions, sendPublicPage(pageMap['/alocacao-docente']));
router.get('/alocacao-docente/nova', checkAuth, checkPermissions, sendPublicPage(pageMap['/alocacao-docente/nova']));
router.get('/alocacao-docente/coletiva', checkAuth, checkPermissions, sendPublicPage(pageMap['/alocacao-docente/coletiva']));
router.get('/alocacao-docente/minhas', checkAuth, checkPermissions, (req, res) => res.redirect('/alocacao-docente'));
router.get('/alocacao-docente/coordenacao', checkAuth, checkPermissions, sendPublicPage(pageMap['/alocacao-docente/coordenacao']));

router.get('/gestao-docente/professores/:idProfessor', checkAuth, checkPermissions, sendPublicPage('gestao-docente-perfil.html'));

const protectedRouteMap = [
    ['/adiciona-programas', 'adicionaprogramas.html'],
    ['/adiciona-unidade', 'adicionaunidade.html'],
    ['/altera-agenda', 'alteraagenda.html'],
    ['/altera-dados', 'alteradados.html'],
    ['/cadastro', 'cadastro.html'],
    ['/dashboard', 'dashboard.html'],
    ['/dashboard-coordenador', 'dashboard-coordenador.html'],
    ['/info-computadores', 'infocomputadores.html'],
    ['/gerenciar-equipamentos', 'gerenciarequipamentos.html'],
    ['/relatorios-equipamentos', 'relatorios-equipamentos.html'],
    ['/unidades-curriculares', 'unidadescurriculares.html'],
    ['/disponibilidade-professores', 'disponibilidade-professores.html'],
    ['/auditoria-agendamentos', 'auditoria-agendamentos.html'],
    ['/gestao-docente', 'gestao-docente-dashboard.html'],
    ['/gestao-docente/professores', 'gestao-docente-professores.html']
];

protectedRouteMap.forEach(([routePath, fileName]) => {
    router.get(routePath, checkAuth, checkPermissions, (req, res) => {
        res.sendFile(path.join(__dirname, `../../public/html/${fileName}`));
    });
});

Object.entries(legacyToClean).forEach(([legacyPath, cleanPath]) => {
    router.get(legacyPath, (req, res) => {
        const qsIndex = req.originalUrl.indexOf('?');
        const suffix = qsIndex >= 0 ? req.originalUrl.slice(qsIndex) : '';
        return res.redirect(302, `${cleanPath}${suffix}`);
    });
});

Object.entries(legacyRootToClean).forEach(([legacyPath, cleanPath]) => {
    router.get(legacyPath, (req, res) => {
        const qsIndex = req.originalUrl.indexOf('?');
        const suffix = qsIndex >= 0 ? req.originalUrl.slice(qsIndex) : '';
        return res.redirect(302, `${cleanPath}${suffix}`);
    });
});

router.get('/html/agendar-salas', checkAuth, (req, res) => {
    return res.redirect('/agendar-salas');
});

module.exports = {
    webPagesRoutes: router,
    checkAuth
};
