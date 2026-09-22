const authService = require('./authService');

async function login(req, res) {
    const { username, password } = req.body;

    try {
        const result = await authService.authenticateUser(username, password);
        if (!result.ok) {
            return res.status(result.statusCode).send(result.message);
        }

        if (result.requiresPasswordReset) {
            req.session.tempPasswordReset = {
                id_professor: result.user.id_professor,
                login: result.user.login,
                nome: result.user.nome
            };

            return res.status(200).json({
                requiresPasswordReset: true,
                message: result.message
            });
        }

        req.session.user = result.user;
        req.session.tempPasswordReset = null;
        return res.send(result.redirectPath);
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        return res.status(500).send('Erro ao fazer login.');
    }
}

async function completeTemporaryPassword(req, res) {
    const pending = req.session?.tempPasswordReset;
    if (!pending?.id_professor) {
        return res.status(401).send('Sessão de redefinição de senha não encontrada. Faça login novamente.');
    }

    const { newPassword, confirmPassword } = req.body || {};

    try {
        const result = await authService.completeTemporaryPasswordReset({
            idProfessor: Number(pending.id_professor),
            newPassword,
            confirmPassword
        });

        if (!result.ok) {
            return res.status(result.statusCode).send(result.message);
        }

        req.session.user = result.user;
        req.session.tempPasswordReset = null;
        return res.status(200).json({ redirectPath: result.redirectPath, message: result.message });
    } catch (error) {
        console.error('Erro ao concluir redefinição de senha temporária:', error);
        return res.status(500).send('Não foi possível concluir a redefinição de senha.');
    }
}

function userInfo(req, res) {
    if (req.session.user) {
        return res.json(req.session.user);
    }

    return res.status(401).send('Usuário não autenticado.');
}

function sessionInfo(req, res) {
    if (!req.session?.user) {
        return res.redirect('/login');
    }

    if (req.session.cookie && req.session.cookie.expires) {
        const tempoRestante = Math.round((new Date(req.session.cookie.expires).getTime() - Date.now()) / 1000);
        return res.json({ tempoRestante: tempoRestante > 0 ? tempoRestante : 0 });
    }

    return res.status(404).json({ error: 'Sessão não encontrada ou já expirada.' });
}

function logout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Nao foi possivel encerrar a sessao.' });
        }

        res.clearCookie('connect.sid');
        return res.status(200).json({ message: 'Sessao encerrada com sucesso.' });
    });
}

module.exports = {
    login,
    completeTemporaryPassword,
    userInfo,
    sessionInfo,
    logout
};
