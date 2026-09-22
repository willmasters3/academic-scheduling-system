const sql = require('mssql');
const bcrypt = require('bcrypt');
const config = require('../../dbConfig');

const TEMP_PASSWORD_MAX_ATTEMPTS = 5;

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

function validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Informe a nova senha.' };
    }
    if (password.length < 8) {
        return { valid: false, message: 'A nova senha deve ter no mínimo 8 caracteres.' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'A nova senha deve conter pelo menos 1 letra maiúscula.' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'A nova senha deve conter pelo menos 1 número.' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) {
        return { valid: false, message: 'A nova senha deve conter pelo menos 1 caractere especial.' };
    }
    return { valid: true, message: 'Senha válida.' };
}

async function possuiColunaSenhaTemporaria(pool) {
    const result = await pool.request().query(`
        SELECT CASE WHEN COL_LENGTH('dbo.professores', 'senhaTemporaria') IS NULL THEN 0 ELSE 1 END AS possui
    `);
    return Number(result.recordset?.[0]?.possui) === 1;
}

async function hasTempPasswordControlTable(pool) {
    const result = await pool.request().query(`
        SELECT CASE WHEN OBJECT_ID('dbo.ProfessorSenhaTemporariaControle', 'U') IS NULL THEN 0 ELSE 1 END AS possui
    `);
    return Number(result.recordset?.[0]?.possui) === 1;
}

async function getTempPasswordControl(pool, idProfessor) {
    const hasTable = await hasTempPasswordControlTable(pool);
    if (!hasTable) {
        return null;
    }

    const result = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(`
            SELECT TOP 1 id_professor, falhas, bloqueado
            FROM dbo.ProfessorSenhaTemporariaControle
            WHERE id_professor = @id_professor
        `);

    return result.recordset?.[0] || null;
}

async function resetTempPasswordControl(pool, idProfessor) {
    const hasTable = await hasTempPasswordControlTable(pool);
    if (!hasTable) {
        return;
    }

    await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query(`
            DELETE FROM dbo.ProfessorSenhaTemporariaControle
            WHERE id_professor = @id_professor
        `);
}

async function addTempPasswordFailure(pool, idProfessor) {
    const hasTable = await hasTempPasswordControlTable(pool);
    if (!hasTable) {
        return {
            falhas: 0,
            bloqueado: false,
            semPersistencia: true
        };
    }

    const mergeResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('max_falhas', sql.Int, TEMP_PASSWORD_MAX_ATTEMPTS)
        .query(`
            MERGE dbo.ProfessorSenhaTemporariaControle AS destino
            USING (SELECT @id_professor AS id_professor) AS origem
            ON destino.id_professor = origem.id_professor
            WHEN MATCHED THEN
                UPDATE SET
                    falhas = destino.falhas + 1,
                    bloqueado = CASE WHEN destino.falhas + 1 >= @max_falhas THEN 1 ELSE destino.bloqueado END,
                    atualizado_em = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (id_professor, falhas, bloqueado, atualizado_em)
                VALUES (@id_professor, 1, 0, SYSDATETIME());

            SELECT TOP 1 falhas, bloqueado
            FROM dbo.ProfessorSenhaTemporariaControle
            WHERE id_professor = @id_professor;
        `);

    const row = mergeResult.recordset?.[0] || { falhas: 1, bloqueado: 0 };
    return {
        falhas: Number(row.falhas || 0),
        bloqueado: Number(row.bloqueado || 0) === 1
    };
}

async function getUserAndUnitsById(pool, idProfessor) {
    const userResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query('SELECT * FROM professores WHERE id_professor = @id_professor');

    if (!userResult.recordset.length) {
        return null;
    }

    const user = userResult.recordset[0];
    const unidadesResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query('SELECT codigo_unidade FROM ProfessorUnidade WHERE id_professor = @id_professor');

    const unidades = unidadesResult.recordset.map((row) => row.codigo_unidade);
    return {
        user: {
            id_professor: user.id_professor,
            nome: user.nome,
            login: user.login,
            email: user.email,
            qualificacao: user.qualificacao || null,
            classificacao_docente: user.classificacao_docente ?? null,
            sobrenome: null,
            nome_exibicao: null,
            turno_principal: user.turno_principal || null,
            carga_horaria_semanal: user.carga_horaria_semanal ?? null,
            foto_url: user.foto_url || null,
            permissao: user.permissao,
            unidades
        },
        redirectPath: user.permissao === 'admin'
            ? '/dashboard'
            : user.permissao === 'coordenador'
                ? '/dashboard-coordenador'
                : '/dashboard-professor'
    };
}

async function authenticateUser(username, password) {
    const pool = await getPool();
    const suportaSenhaTemporaria = await possuiColunaSenhaTemporaria(pool);
    const result = await pool.request()
        .input('username', sql.NVarChar, username)
        .query(`
            SELECT p.*
            FROM professores p
            WHERE p.login = @username
        `);

    if (result.recordset.length === 0) {
        return { ok: false, statusCode: 401, message: 'Usuário ou senha inválidos.' };
    }

    const user = result.recordset[0];
    const match = await bcrypt.compare(password, user.senha);

    if (!match) {
        return { ok: false, statusCode: 401, message: 'Usuário ou senha inválidos.' };
    }

    if (suportaSenhaTemporaria && Number(user.senhaTemporaria || 0) === 1) {
        const controle = await getTempPasswordControl(pool, user.id_professor);
        if (controle?.bloqueado) {
            return {
                ok: false,
                statusCode: 423,
                message: 'Por segurança, o acesso foi temporariamente bloqueado após múltiplas tentativas de redefinição. Solicite ao administrador a reativação da senha temporária.'
            };
        }

        return {
            ok: true,
            statusCode: 200,
            requiresPasswordReset: true,
            user: {
                id_professor: user.id_professor,
                login: user.login,
                nome: user.nome
            },
            message: 'Por segurança, você precisa definir uma nova senha antes de continuar.'
        };
    }

    const perfil = await getUserAndUnitsById(pool, user.id_professor);
    return {
        ok: true,
        statusCode: 200,
        user: perfil.user,
        redirectPath: perfil.redirectPath
    };
}

async function completeTemporaryPasswordReset({ idProfessor, newPassword, confirmPassword }) {
    const pool = await getPool();
    const suportaSenhaTemporaria = await possuiColunaSenhaTemporaria(pool);
    if (!suportaSenhaTemporaria) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Este ambiente não possui controle de senha temporária habilitado.'
        };
    }

    const userResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .query('SELECT TOP 1 id_professor, senhaTemporaria FROM professores WHERE id_professor = @id_professor');

    if (!userResult.recordset.length) {
        return { ok: false, statusCode: 404, message: 'Usuário não encontrado.' };
    }

    const usuario = userResult.recordset[0];
    if (Number(usuario.senhaTemporaria || 0) !== 1) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Sua senha temporária não está ativa. Solicite suporte ao administrador.'
        };
    }

    const controle = await getTempPasswordControl(pool, idProfessor);
    if (controle?.bloqueado) {
        return {
            ok: false,
            statusCode: 423,
            message: 'Conta temporariamente bloqueada. Peça ao administrador para reativar sua senha temporária.'
        };
    }

    if (String(newPassword || '') !== String(confirmPassword || '')) {
        const falha = await addTempPasswordFailure(pool, idProfessor);
        if (falha.bloqueado) {
            return {
                ok: false,
                statusCode: 423,
                message: 'Por segurança, o acesso foi bloqueado após 5 tentativas sem sucesso. Solicite ao administrador a reativação da senha temporária.'
            };
        }

        if (falha.semPersistencia) {
            return {
                ok: false,
                statusCode: 400,
                message: 'As senhas informadas não conferem.'
            };
        }

        return {
            ok: false,
            statusCode: 400,
            message: `As senhas informadas não conferem. Tentativas restantes: ${Math.max(0, TEMP_PASSWORD_MAX_ATTEMPTS - falha.falhas)}.`
        };
    }

    const validacao = validatePasswordStrength(String(newPassword || ''));
    if (!validacao.valid) {
        const falha = await addTempPasswordFailure(pool, idProfessor);
        if (falha.bloqueado) {
            return {
                ok: false,
                statusCode: 423,
                message: 'Por segurança, o acesso foi bloqueado após 5 tentativas sem sucesso. Solicite ao administrador a reativação da senha temporária.'
            };
        }

        if (falha.semPersistencia) {
            return {
                ok: false,
                statusCode: 400,
                message: validacao.message
            };
        }

        return {
            ok: false,
            statusCode: 400,
            message: `${validacao.message} Tentativas restantes: ${Math.max(0, TEMP_PASSWORD_MAX_ATTEMPTS - falha.falhas)}.`
        };
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('senha', sql.NVarChar, hashedPassword)
        .query(`
            UPDATE professores
            SET senha = @senha,
                senhaTemporaria = 0
            WHERE id_professor = @id_professor
        `);

    await resetTempPasswordControl(pool, idProfessor);
    const perfil = await getUserAndUnitsById(pool, idProfessor);

    return {
        ok: true,
        statusCode: 200,
        message: 'Senha atualizada com sucesso. Seu acesso foi liberado.',
        user: perfil.user,
        redirectPath: perfil.redirectPath
    };
}

module.exports = {
    authenticateUser,
    completeTemporaryPasswordReset
};
