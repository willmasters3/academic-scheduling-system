const service = require('./alocacoesDocentesService');

function responderErro(res, error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('Erro no modulo Alocacao Docente:', error);
    return res.status(status).json({ error: status >= 500 ? 'Erro interno no modulo Alocacao Docente.' : error.message });
}

async function obterContexto(req, res) {
    try { return res.json(await service.obterContexto(req.session.user)); }
    catch (error) { return responderErro(res, error); }
}

async function listarCursos(req, res) {
    try { return res.json(await service.listarCursos(req.session.user, req.query.unidade)); }
    catch (error) { return responderErro(res, error); }
}

async function listarUcsCurso(req, res) {
    try { return res.json(await service.listarUcsCurso(req.session.user, req.params.idCurso)); }
    catch (error) { return responderErro(res, error); }
}

async function listarTurmas(req, res) {
    try { return res.json(await service.listarTurmas(req.session.user, req.query)); }
    catch (error) { return responderErro(res, error); }
}

async function listarMinhas(req, res) {
    try { return res.json(await service.listarMinhas(req.session.user)); }
    catch (error) { return responderErro(res, error); }
}

function minhasDescontinuada(req, res) {
    return res.status(410).json({ error: 'A funcionalidade Minhas Alocacoes foi descontinuada. Utilize o Painel da Coordenacao.' });
}

async function listarCoordenacao(req, res) {
    try { return res.json(await service.listarCoordenacao(req.session.user, req.query)); }
    catch (error) { return responderErro(res, error); }
}

async function obterPorId(req, res) {
    try { return res.json(await service.obterPorId(req.session.user, req.params.id)); }
    catch (error) { return responderErro(res, error); }
}

async function verificarSobreposicao(req, res) {
    try { return res.json(await service.verificarSobreposicao(req.session.user, req.body)); }
    catch (error) { return responderErro(res, error); }
}

async function verificarSobreposicaoColetiva(req, res) {
    try { return res.json(await service.verificarSobreposicaoColetiva(req.session.user, req.body)); }
    catch (error) { return responderErro(res, error); }
}

async function criar(req, res) {
    try { return res.status(201).json(await service.criar(req.session.user, req.body)); }
    catch (error) { return responderErro(res, error); }
}

async function criarColetiva(req, res) {
    try { return res.status(201).json(await service.criarColetiva(req.session.user, req.body)); }
    catch (error) { return responderErro(res, error); }
}

async function editar(req, res) {
    try { return res.json(await service.editar(req.session.user, req.params.id, req.body)); }
    catch (error) { return responderErro(res, error); }
}

async function inativar(req, res) {
    try { return res.json(await service.alterarAtivo(req.session.user, req.params.id, false)); }
    catch (error) { return responderErro(res, error); }
}

async function reativar(req, res) {
    try { return res.json(await service.alterarAtivo(req.session.user, req.params.id, true)); }
    catch (error) { return responderErro(res, error); }
}

module.exports = { obterContexto, listarCursos, listarUcsCurso, listarTurmas, listarMinhas, minhasDescontinuada, listarCoordenacao, obterPorId, verificarSobreposicao, verificarSobreposicaoColetiva, criar, criarColetiva, editar, inativar, reativar };
