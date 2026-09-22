const professoresService = require('./professoresService');

async function register(req, res) {
    try {
        const result = await professoresService.registerProfessor({
            ...req.body,
            foto: req.file
        });
        return res.status(result.statusCode).send(result.message);
    } catch (error) {
        console.error('Erro ao registrar professor:', error);
        // Retornar mensagem de erro específica para validação
        return res.status(400).send(error.message);
    }
}

async function verificarMatricula(req, res) {
    const { matricula } = req.params;

    try {
        const professor = await professoresService.verificarMatricula(matricula);
        return res.json(professor);
    } catch (error) {
        console.error('Erro ao verificar matrícula:', error);
        return res.status(500).send('Erro ao verificar matrícula.');
    }
}

async function registerCoordenador(req, res) {
    try {
        const result = await professoresService.registerCoordenador({
            ...req.body,
            foto: req.file
        });
        return res.status(result.statusCode).send(result.message);
    } catch (error) {
        console.error('Erro ao registrar coordenador:', error);
        // Retornar mensagem de erro específica para validação
        return res.status(400).send(error.message);
    }
}

async function alterarSenha(req, res) {
    const { id } = req.params;
    const { senhaAtual, novaSenha } = req.body;
    const usuarioLogadoId = Number(req.session?.user?.id_professor);
    const permissao = req.session?.user?.permissao;
    const isSelf = usuarioLogadoId === Number(id);

    try {
        // Proteção de acesso por proprietário: usuários comuns só podem alterar sua própria senha
        if (!isSelf && permissao !== 'admin' && permissao !== 'coordenador') {
            return res.status(403).send('Você só pode alterar sua própria senha.');
        }

        // Admin/coordenador alterando senha de outro usuário não precisa da senha atual
        const skipSenhaAtual = !isSelf && (permissao === 'admin' || permissao === 'coordenador');
        await professoresService.alterarSenha(id, senhaAtual, novaSenha, skipSenhaAtual);
        return res.status(200).send('Senha alterada com sucesso.');
    } catch (error) {
        console.error('Erro ao alterar a senha:', error);
        return res.status(400).send(error.message);
    }
}

async function atualizarMeuPerfil(req, res) {
    try {
        const result = await professoresService.atualizarMeuPerfil(req, {
            nome: req.body.nome,
            email: req.body.email,
            qualificacao: req.body.qualificacao,
            turnosTrabalho: req.body.turnosTrabalho,
            cargaHorariaSemanal: req.body.cargaHorariaSemanal,
            foto: req.file
        });

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao atualizar o proprio perfil:', error);
        return res.status(500).json({ error: 'Erro ao atualizar o perfil.' });
    }
}

async function atualizarProfessor(req, res) {
    try {
        const result = await professoresService.atualizarProfessor(req, {
            id: req.params.id,
            nome: req.body.nome,
            matricula: req.body.matricula,
            login: req.body.login,
            codigoUnidade: req.body.codigoUnidade,
            permissao: req.body.permissao,
            email: req.body.email,
            classificacao_docente: req.body.classificacao_docente,
            turnoPrincipal: req.body.turno_principal,
            cargaHorariaSemanal: req.body.carga_horaria_semanal,
            qualificacao: req.body.qualificacao,
            senhaTemporaria: req.body.senhaTemporaria,
            novaSenha: req.body.novaSenha,
            confirmarNovaSenha: req.body.confirmarNovaSenha,
            foto: req.file
        });

        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('Erro ao atualizar professor:', error);
        return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
}

async function listarProfessoresPorUnidade(req, res) {
    const { codigoUnidade } = req.params;

    try {
        const result = await professoresService.listarProfessoresPorUnidade(req, codigoUnidade);
        if (result.statusCode !== 200) {
            return res.status(result.statusCode).send(result.body);
        }

        return res.json(result.body);
    } catch (error) {
        console.error('Erro ao listar professores por unidade:', error);
        return res.status(500).send('Erro ao listar professores.');
    }
}

async function listarTodosProfessores(req, res) {
    try {
        const professores = await professoresService.listarTodosProfessores();
        return res.json(professores);
    } catch (error) {
        console.error('Erro ao listar todos os professores:', error);
        return res.status(500).send('Erro ao listar professores.');
    }
}

async function excluirProfessor(req, res) {
    const { id } = req.params;

    try {
        await professoresService.excluirProfessor(id);
        return res.status(200).send('Professor excluído com sucesso.');
    } catch (error) {
        console.error('Erro ao excluir professor:', error.message);
        // Retornar 409 para conflito (agendamentos ativos) ou 400 para outros erros
        const statusCode = error.message.includes('agendamentos ativos') ? 409 : 400;
        return res.status(statusCode).send(error.message);
    }
}

async function desassociarProfessorUnidade(req, res) {
    const { id, codigo_unidade } = req.params;
    const usuarioLogadoPermissao = req.session?.user?.permissao;

    try {
        // Apenas admin ou coordenador podem desassociar professores
        if (usuarioLogadoPermissao !== 'admin' && usuarioLogadoPermissao !== 'coordenador') {
            return res.status(403).send('Você não tem permissão para desassociar professores.');
        }

        await professoresService.desassociarProfessorUnidade(id, codigo_unidade);
        return res.status(200).send('Professor desassociado com sucesso.');
    } catch (error) {
        console.error('Erro ao desassociar professor:', error);
        return res.status(400).send(error.message);
    }
}

module.exports = {
    register,
    verificarMatricula,
    registerCoordenador,
    alterarSenha,
    atualizarMeuPerfil,
    atualizarProfessor,
    listarProfessoresPorUnidade,
    listarTodosProfessores,
    excluirProfessor,
    desassociarProfessorUnidade
};
