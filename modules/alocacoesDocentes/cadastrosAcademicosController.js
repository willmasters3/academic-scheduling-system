const service = require('./cadastrosAcademicosService');

function erro(res, error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('Erro nos cadastros academicos:', error);
    return res.status(status).json({ error: status >= 500 ? 'Erro interno nos cadastros academicos.' : error.message });
}
const executar = (fn, status = 200) => async (req, res) => {
    try { return res.status(status).json(await fn(req)); } catch (error) { return erro(res, error); }
};

module.exports = {
    listarCursos: executar(req => service.listarCursos(req.session.user, req.query.unidade)),
    criarCurso: executar(req => service.criarCurso(req.session.user, req.body), 201),
    editarCurso: executar(req => service.editarCurso(req.session.user, req.params.id, req.body)),
    alterarStatusCurso: executar(req => service.alterarStatusCurso(req.session.user, req.params.id, req.body.ativo)),
    listarCursoUcs: executar(req => service.listarCursoUcs(req.session.user, req.params.idCurso)),
    associarCursoUcsLote: executar(req => service.associarCursoUcsLote(req.session.user, req.params.idCurso, req.body), 201),
    associarCursoUc: executar(req => service.associarCursoUc(req.session.user, req.params.idCurso, req.body), 201),
    editarCursoUc: executar(req => service.editarCursoUc(req.session.user, req.params.id, req.body)),
    alterarStatusCursoUc: executar(req => service.alterarStatusCursoUc(req.session.user, req.params.id, req.body.ativo)),
    listarTurmas: executar(req => service.listarTurmas(req.session.user, req.query)),
    criarTurma: executar(req => service.criarTurma(req.session.user, req.body), 201),
    editarTurma: executar(req => service.editarTurma(req.session.user, req.params.id, req.body)),
    alterarStatusTurma: executar(req => service.alterarStatusTurma(req.session.user, req.params.id, req.body.ativo))
};
