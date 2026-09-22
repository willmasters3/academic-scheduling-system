const service = require('./gestaoDocenteService');

function responderErro(res, error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('Erro na Gestao Docente:', error);
    return res.status(status).json({
        error: status >= 500
            ? 'Nao foi possivel carregar a Gestao Docente.'
            : error.message
    });
}

async function listarFiltros(req, res) {
    try {
        return res.json(await service.listarFiltros(req.session.user, req.query.tela === 'professores'));
    } catch (error) {
        return responderErro(res, error);
    }
}

async function obterDashboard(req, res) {
    try {
        return res.json(await service.obterDashboard(req.session.user, req.query));
    } catch (error) {
        return responderErro(res, error);
    }
}

async function listarProfessores(req, res) {
    try { return res.json(await service.listarProfessores(req.session.user, req.query)); }
    catch (error) { return responderErro(res, error); }
}

async function obterPerfilProfessor(req, res) {
    try { return res.json(await service.obterPerfilProfessor(req.session.user, req.params.idProfessor, req.query)); }
    catch (error) { return responderErro(res, error); }
}

async function atualizarClassificacaoDocente(req, res) {
    try { return res.json(await service.atualizarClassificacaoDocente(req.session.user, req.params.idProfessor, req.body)); }
    catch (error) { return responderErro(res, error); }
}

module.exports = { atualizarClassificacaoDocente, listarFiltros, obterDashboard, listarProfessores, obterPerfilProfessor };
