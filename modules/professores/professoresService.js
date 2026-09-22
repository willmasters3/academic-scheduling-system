const sql = require('mssql');
const bcrypt = require('bcrypt');
const config = require('../../dbConfig');

let poolPromise = null;

/**
 * Valida a força da senha
 * Requisitos: min 8 caracteres, 1 maiúscula, 1 número, 1 caractere especial
 */
function validatePasswordStrength(senha) {
    if (!senha || typeof senha !== 'string') {
        return { valid: false, message: 'Senha é obrigatória.' };
    }
    if (senha.length < 8) {
        return { valid: false, message: 'Senha deve ter no mínimo 8 caracteres.' };
    }
    if (!/[A-Z]/.test(senha)) {
        return { valid: false, message: 'Senha deve conter pelo menos 1 letra maiúscula.' };
    }
    if (!/[0-9]/.test(senha)) {
        return { valid: false, message: 'Senha deve conter pelo menos 1 número.' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)) {
        return { valid: false, message: 'Senha deve conter pelo menos 1 caractere especial (!@#$%^&*).' };
    }
    return { valid: true, message: 'Senha válida.' };
}

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config).catch((error) => {
            poolPromise = null;
            throw error;
        });
    }

    return poolPromise;
}

function canAccessUnit(req, codigoUnidade) {
    const user = req.session?.user;
    if (!user) {
        return false;
    }

    if (user.permissao === 'admin') {
        return true;
    }

    const unidades = Array.isArray(user.unidades) ? user.unidades : [];
    return unidades.includes(codigoUnidade);
}

function normalizarListaValores(valor) {
    if (Array.isArray(valor)) {
        return valor.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof valor === 'string') {
        return valor
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    if (valor === null || valor === undefined) {
        return [];
    }

    return [String(valor).trim()].filter(Boolean);
}

function parseBooleanField(valor) {
    const texto = String(valor || '').trim().toLowerCase();
    return ['1', 'true', 'on', 'sim', 'yes'].includes(texto);
}

function parseCargaHoraria(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return null;
    }

    const numero = Number(valor);
    if (Number.isNaN(numero) || numero < 0 || numero > 80) {
        throw new Error('Carga horaria semanal invalida. Informe um valor entre 0 e 80 horas.');
    }

    return numero;
}

function normalizarTurnoPrincipal(valor) {
    const turno = String(valor || '').trim().toLowerCase();
    if (!turno) {
        return null;
    }

    const permitidos = new Set([
        'manha',
        'tarde',
        'noite',
        'manha, tarde',
        'tarde, noite',
        'manha, noite',
        'manha, tarde, noite'
    ]);

    if (!permitidos.has(turno)) {
        throw new Error('Turno principal invalido.');
    }

    return turno;
}

function normalizarQualificacao(valor) {
    const qualificacao = String(valor || '').trim();
    if (!qualificacao) {
        return null;
    }

    if (qualificacao.length > 200) {
        throw new Error('Qualificacao deve ter no maximo 200 caracteres.');
    }

    return qualificacao;
}

async function getProfessorOptionalColumns(pool) {
    const result = await pool.request().query(`
        SELECT
            CASE WHEN COL_LENGTH('dbo.professores', 'email') IS NULL THEN 0 ELSE 1 END AS possui_email,
            CASE WHEN COL_LENGTH('dbo.professores', 'turno_principal') IS NULL THEN 0 ELSE 1 END AS possui_turno_principal,
            CASE WHEN COL_LENGTH('dbo.professores', 'carga_horaria_semanal') IS NULL THEN 0 ELSE 1 END AS possui_carga_horaria_semanal,
            CASE WHEN COL_LENGTH('dbo.professores', 'qualificacao') IS NULL THEN 0 ELSE 1 END AS possui_qualificacao,
            CASE WHEN COL_LENGTH('dbo.professores', 'senhaTemporaria') IS NULL THEN 0 ELSE 1 END AS possui_senha_temporaria,
            CASE WHEN COL_LENGTH('dbo.professores', 'foto_url') IS NULL THEN 0 ELSE 1 END AS possui_foto_url,
            CASE WHEN COL_LENGTH('dbo.professores', 'foto_mime_type') IS NULL THEN 0 ELSE 1 END AS possui_foto_mime_type,
            CASE WHEN COL_LENGTH('dbo.professores', 'foto_atualizada_em') IS NULL THEN 0 ELSE 1 END AS possui_foto_atualizada_em
    `);

    const cols = result.recordset?.[0] || {};
    return {
        email: Number(cols.possui_email) === 1,
        turnoPrincipal: Number(cols.possui_turno_principal) === 1,
        cargaHorariaSemanal: Number(cols.possui_carga_horaria_semanal) === 1,
        qualificacao: Number(cols.possui_qualificacao) === 1,
        senhaTemporaria: Number(cols.possui_senha_temporaria) === 1,
        fotoUrl: Number(cols.possui_foto_url) === 1,
        fotoMimeType: Number(cols.possui_foto_mime_type) === 1,
        fotoAtualizadaEm: Number(cols.possui_foto_atualizada_em) === 1
    };
}

function normalizarClassificacaoDocente(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if ([0, 1, '0', '1'].includes(valor)) return Number(valor);
    const error = new Error('Vínculo docente inválido.');
    error.status = 400;
    throw error;
}

async function inserirProfessor(pool, dados) {
    const colunasOpcionais = await getProfessorOptionalColumns(pool);
    const request = pool.request()
        .input('nome', sql.NVarChar, dados.nome)
        .input('matricula', sql.NVarChar, dados.matricula)
        .input('login', sql.NVarChar, dados.login)
        .input('senha', sql.NVarChar, dados.senhaHash)
        .input('permissao', sql.NVarChar, dados.permissao);

    const colunas = ['[nome]', '[matricula]', '[login]', '[senha]', '[permissao]'];
    const valores = ['@nome', '@matricula', '@login', '@senha', '@permissao'];
    request.input('classificacao_docente', sql.Bit, dados.classificacao_docente);
    colunas.push('[classificacao_docente]');
    valores.push('@classificacao_docente');

    if (colunasOpcionais.email) {
        request.input('email', sql.NVarChar, dados.email || null);
        colunas.push('[email]');
        valores.push('@email');
    }

    if (colunasOpcionais.turnoPrincipal) {
        request.input('turno_principal', sql.NVarChar, dados.turnoPrincipal || null);
        colunas.push('[turno_principal]');
        valores.push('@turno_principal');
    }

    if (colunasOpcionais.cargaHorariaSemanal) {
        request.input('carga_horaria_semanal', sql.Decimal(5, 2), dados.cargaHorariaSemanal);
        colunas.push('[carga_horaria_semanal]');
        valores.push('@carga_horaria_semanal');
    }

    if (colunasOpcionais.qualificacao) {
        request.input('qualificacao', sql.NVarChar(200), dados.qualificacao || null);
        colunas.push('[qualificacao]');
        valores.push('@qualificacao');
    }

    if (colunasOpcionais.senhaTemporaria) {
        request.input('senhaTemporaria', sql.Bit, dados.senhaTemporaria ? 1 : 0);
        colunas.push('[senhaTemporaria]');
        valores.push('@senhaTemporaria');
    }

    if (colunasOpcionais.fotoUrl) {
        request.input('foto_url', sql.NVarChar, dados.fotoUrl || null);
        colunas.push('[foto_url]');
        valores.push('@foto_url');
    }

    if (colunasOpcionais.fotoMimeType) {
        request.input('foto_mime_type', sql.NVarChar, dados.fotoMimeType || null);
        colunas.push('[foto_mime_type]');
        valores.push('@foto_mime_type');
    }

    if (colunasOpcionais.fotoAtualizadaEm && dados.fotoUrl) {
        colunas.push('[foto_atualizada_em]');
        valores.push('SYSDATETIME()');
    }

    const result = await request.query(`
        INSERT INTO professores (${colunas.join(', ')})
        OUTPUT INSERTED.id_professor
        VALUES (${valores.join(', ')})
    `);

    return result.recordset[0].id_professor;
}

async function registerProfessor({ nome, matricula, login, senha, permissao, unidades, email, turno_principal, carga_horaria_semanal, qualificacao, classificacao_docente, senhaTemporaria, foto }) {
    const classificacaoDocente = normalizarClassificacaoDocente(classificacao_docente);
    const pool = await getPool();
    const unidadesNormalizadas = normalizarListaValores(unidades);
    const nomeLimpo = String(nome || '').trim();
    const matriculaLimpa = String(matricula || '').trim();
    const loginLimpo = String(login || '').trim();
    const emailLimpo = String(email || '').trim();
    const turnoPrincipalLimpo = normalizarTurnoPrincipal(turno_principal);
    const cargaHorariaSemanal = parseCargaHoraria(carga_horaria_semanal);
    const qualificacaoLimpa = normalizarQualificacao(qualificacao);
    const senhaTemporariaBool = parseBooleanField(senhaTemporaria);
    const fotoUrl = foto?.filename ? `/imagens/${foto.filename}` : null;
    const fotoMimeType = foto?.mimetype || null;

    if (!nomeLimpo || !matriculaLimpa || !loginLimpo || !senha) {
        throw new Error('Nome, matricula, login e senha sao obrigatorios.');
    }

    if (!unidadesNormalizadas.length) {
        throw new Error('Selecione pelo menos uma unidade.');
    }

    if (emailLimpo && !/^\S+@\S+\.\S+$/.test(emailLimpo)) {
        throw new Error('Email invalido.');
    }

    // Validar força da senha
    const passwordValidation = validatePasswordStrength(senha);
    if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
    }

    // Verificar matrícula duplicada
    const existingProfessor = await pool.request()
        .input('matricula', sql.NVarChar, matriculaLimpa)
        .query('SELECT * FROM professores WHERE matricula = @matricula');

    if (existingProfessor.recordset.length > 0) {
        const professor = existingProfessor.recordset[0];
        const existingAssociations = await pool.request()
            .input('id_professor', sql.Int, professor.id_professor)
            .query('SELECT * FROM ProfessorUnidade WHERE id_professor = @id_professor');

        const newAssociations = [];
        for (const codigoUnidade of unidadesNormalizadas) {
            if (!existingAssociations.recordset.some((association) => association.codigo_unidade === codigoUnidade)) {
                newAssociations.push(codigoUnidade);
            }
        }

        for (const codigoUnidade of newAssociations) {
            await pool.request()
                .input('id_professor', sql.Int, professor.id_professor)
                .input('codigo_unidade', sql.NVarChar, codigoUnidade)
                .query('INSERT INTO ProfessorUnidade (id_professor, codigo_unidade) VALUES (@id_professor, @codigo_unidade)');
        }

        return {
            statusCode: 200,
            message: 'Professor já existe e foi associado a novas unidades, se necessário.'
        };
    }

    // Verificar login duplicado
    const existingLogin = await pool.request()
        .input('login', sql.NVarChar, loginLimpo)
        .query('SELECT * FROM professores WHERE login = @login');

    if (existingLogin.recordset.length > 0) {
        throw new Error('Login já existe no sistema.');
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    const idProfessor = await inserirProfessor(pool, {
        nome: nomeLimpo,
        matricula: matriculaLimpa,
        login: loginLimpo,
        senhaHash: hashedPassword,
        permissao,
        email: emailLimpo,
        turnoPrincipal: turnoPrincipalLimpo || null,
        cargaHorariaSemanal,
        qualificacao: qualificacaoLimpa,
        classificacao_docente: classificacaoDocente,
        senhaTemporaria: senhaTemporariaBool,
        fotoUrl,
        fotoMimeType
    });

    for (const codigoUnidade of unidadesNormalizadas) {
        await pool.request()
            .input('id_professor', sql.Int, idProfessor)
            .input('codigo_unidade', sql.NVarChar, codigoUnidade)
            .query('INSERT INTO ProfessorUnidade (id_professor, codigo_unidade) VALUES (@id_professor, @codigo_unidade)');
    }

    return {
        statusCode: 201,
        message: 'Professor cadastrado com sucesso.'
    };
}

async function registerCoordenador({ nome, matricula, login, senha, unidades, email, turno_principal, carga_horaria_semanal, qualificacao, classificacao_docente, senhaTemporaria, foto }) {
    const classificacaoDocente = normalizarClassificacaoDocente(classificacao_docente);
    const pool = await getPool();
    const unidadesNormalizadas = normalizarListaValores(unidades);
    const nomeLimpo = String(nome || '').trim();
    const matriculaLimpa = String(matricula || '').trim();
    const loginLimpo = String(login || '').trim();
    const emailLimpo = String(email || '').trim();
    const turnoPrincipalLimpo = normalizarTurnoPrincipal(turno_principal);
    const cargaHorariaSemanal = parseCargaHoraria(carga_horaria_semanal);
    const qualificacaoLimpa = normalizarQualificacao(qualificacao);
    const senhaTemporariaBool = parseBooleanField(senhaTemporaria);
    const fotoUrl = foto?.filename ? `/imagens/${foto.filename}` : null;
    const fotoMimeType = foto?.mimetype || null;

    if (!nomeLimpo || !matriculaLimpa || !loginLimpo || !senha) {
        throw new Error('Nome, matricula, login e senha sao obrigatorios.');
    }

    if (!unidadesNormalizadas.length) {
        throw new Error('Selecione pelo menos uma unidade.');
    }

    if (emailLimpo && !/^\S+@\S+\.\S+$/.test(emailLimpo)) {
        throw new Error('Email invalido.');
    }

    // Validar força da senha
    const passwordValidation = validatePasswordStrength(senha);
    if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
    }

    const existingCoordenador = await pool.request()
        .input('matricula', sql.NVarChar, matriculaLimpa)
        .query('SELECT * FROM professores WHERE matricula = @matricula');

    if (existingCoordenador.recordset.length > 0) {
        return {
            statusCode: 409,
            message: 'Coordenador já existe.'
        };
    }

    // Verificar login duplicado
    const existingLogin = await pool.request()
        .input('login', sql.NVarChar, loginLimpo)
        .query('SELECT * FROM professores WHERE login = @login');

    if (existingLogin.recordset.length > 0) {
        return {
            statusCode: 409,
            message: 'Login já existe no sistema.'
        };
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    const idCoordenador = await inserirProfessor(pool, {
        nome: nomeLimpo,
        matricula: matriculaLimpa,
        login: loginLimpo,
        senhaHash: hashedPassword,
        permissao: 'coordenador',
        email: emailLimpo,
        turnoPrincipal: turnoPrincipalLimpo || null,
        cargaHorariaSemanal,
        qualificacao: qualificacaoLimpa,
        classificacao_docente: classificacaoDocente,
        senhaTemporaria: senhaTemporariaBool,
        fotoUrl,
        fotoMimeType
    });

    for (const codigoUnidade of unidadesNormalizadas) {
        await pool.request()
            .input('id_professor', sql.Int, idCoordenador)
            .input('codigo_unidade', sql.NVarChar, codigoUnidade)
            .query('INSERT INTO ProfessorUnidade (id_professor, codigo_unidade) VALUES (@id_professor, @codigo_unidade)');
    }

    return {
        statusCode: 201,
        message: 'Coordenador cadastrado com sucesso.'
    };
}

async function verificarMatricula(matricula) {
    const pool = await getPool();
    const result = await pool.request()
        .input('matricula', sql.NVarChar, matricula)
        .query(`
            SELECT TOP 1 id_professor, nome, matricula, login, email, turno_principal, carga_horaria_semanal
            FROM professores
            WHERE matricula = @matricula
        `);

    return result.recordset.length > 0 ? result.recordset[0] : null;
}

async function alterarSenha(id, senhaAtual, novaSenha, skipSenhaAtual = false) {
    const pool = await getPool();

    // Validar força da nova senha
    const passwordValidation = validatePasswordStrength(novaSenha);
    if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
    }

    const professor = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT senha FROM professores WHERE id_professor = @id');

    if (professor.recordset.length === 0) {
        throw new Error('Usuário não encontrado.');
    }

    // Verificar senha atual apenas quando o próprio usuário altera sua senha
    if (!skipSenhaAtual) {
        const senhaCorreta = await bcrypt.compare(senhaAtual, professor.recordset[0].senha);
        if (!senhaCorreta) {
            throw new Error('Senha atual incorreta.');
        }
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 10);
    await pool.request()
        .input('id', sql.Int, id)
        .input('senha', sql.NVarChar, hashedPassword)
        .query('UPDATE professores SET senha = @senha WHERE id_professor = @id');
}

async function atualizarMeuPerfil(req, { nome, email, qualificacao, turnosTrabalho, cargaHorariaSemanal, foto }) {
    const idProfessor = Number(req.session?.user?.id_professor);
    if (!Number.isInteger(idProfessor) || idProfessor <= 0) {
        return { statusCode: 401, body: { error: 'Usuário não autenticado.' } };
    }

    const nomeLimpo = String(nome || '').trim();
    const emailLimpo = String(email || '').trim();
    const qualificacaoLimpa = normalizarQualificacao(qualificacao);
    const turnosLimpos = Array.isArray(turnosTrabalho)
        ? turnosTrabalho
        : String(turnosTrabalho || '')
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
    const turnosValidos = [...new Set(turnosLimpos)];
    const cargaHoraria = cargaHorariaSemanal === '' || cargaHorariaSemanal === null || cargaHorariaSemanal === undefined
        ? null
        : Number(cargaHorariaSemanal);

    if (!nomeLimpo) {
        return { statusCode: 400, body: { error: 'Nome é obrigatório.' } };
    }

    if (turnosValidos.some((turno) => !['manha', 'tarde', 'noite'].includes(turno))) {
        return { statusCode: 400, body: { error: 'Um ou mais turnos informados são inválidos.' } };
    }

    if (cargaHoraria !== null && (Number.isNaN(cargaHoraria) || cargaHoraria < 0 || cargaHoraria > 80)) {
        return { statusCode: 400, body: { error: 'Carga horária semanal inválida.' } };
    }

    const pool = await getPool();
    const possuiColunasPerfil = await pool.request()
        .query(`
            SELECT
                CASE WHEN COL_LENGTH('dbo.professores', 'turno_principal') IS NULL THEN 0 ELSE 1 END AS possui_turno_principal,
                CASE WHEN COL_LENGTH('dbo.professores', 'carga_horaria_semanal') IS NULL THEN 0 ELSE 1 END AS possui_carga_horaria_semanal,
                CASE WHEN COL_LENGTH('dbo.professores', 'qualificacao') IS NULL THEN 0 ELSE 1 END AS possui_qualificacao,
                CASE WHEN COL_LENGTH('dbo.professores', 'perfil_atualizado_em') IS NULL THEN 0 ELSE 1 END AS possui_perfil_atualizado_em,
                CASE WHEN COL_LENGTH('dbo.professores', 'foto_url') IS NULL THEN 0 ELSE 1 END AS possui_foto_url,
                CASE WHEN COL_LENGTH('dbo.professores', 'foto_mime_type') IS NULL THEN 0 ELSE 1 END AS possui_foto_mime_type,
                CASE WHEN COL_LENGTH('dbo.professores', 'foto_atualizada_em') IS NULL THEN 0 ELSE 1 END AS possui_foto_atualizada_em
        `);

    const perfilCols = possuiColunasPerfil.recordset?.[0] || {};
    const suportaTurnoPrincipal = Number(perfilCols.possui_turno_principal) === 1;
    const suportaCargaHoraria = Number(perfilCols.possui_carga_horaria_semanal) === 1;
    const suportaQualificacao = Number(perfilCols.possui_qualificacao) === 1;
    const suportaPerfilAtualizado = Number(perfilCols.possui_perfil_atualizado_em) === 1;
    const suportaFotoUrl = Number(perfilCols.possui_foto_url) === 1;
    const suportaFotoMimeType = Number(perfilCols.possui_foto_mime_type) === 1;
    const suportaFotoAtualizadaEm = Number(perfilCols.possui_foto_atualizada_em) === 1;

    const turnoPersistido = turnosValidos.join(', ') || null;
    const fotoUrl = foto?.filename ? `/imagens/${foto.filename}` : null;
    const fotoMimeType = foto?.mimetype || null;
    const temFotoNova = Boolean(fotoUrl);

    const updateResult = await pool.request()
        .input('id_professor', sql.Int, idProfessor)
        .input('nome', sql.NVarChar, nomeLimpo)
        .input('email', sql.NVarChar, emailLimpo || null)
        .input('qualificacao', sql.NVarChar(200), qualificacaoLimpa)
        .input('turno_principal', sql.NVarChar, turnoPersistido)
        .input('carga_horaria_semanal', sql.Decimal(5, 2), cargaHoraria)
        .input('foto_url', sql.NVarChar, fotoUrl)
        .input('foto_mime_type', sql.NVarChar, fotoMimeType)
        .query(`
            UPDATE professores
            SET nome = @nome,
                email = @email${suportaQualificacao ? ',\n                qualificacao = @qualificacao' : ''}${suportaTurnoPrincipal ? ',\n                turno_principal = @turno_principal' : ''}${suportaCargaHoraria ? ',\n                carga_horaria_semanal = @carga_horaria_semanal' : ''}${suportaPerfilAtualizado ? ',\n                perfil_atualizado_em = SYSDATETIME()' : ''}${suportaFotoUrl && temFotoNova ? ',\n                foto_url = @foto_url' : ''}${suportaFotoMimeType && temFotoNova ? ',\n                foto_mime_type = @foto_mime_type' : ''}${suportaFotoAtualizadaEm && temFotoNova ? ',\n                foto_atualizada_em = SYSDATETIME()' : ''}
            WHERE id_professor = @id_professor
        `);

    if (!updateResult.rowsAffected[0]) {
        return { statusCode: 404, body: { error: 'Usuário não encontrado para atualização.' } };
    }

    if (req.session?.user) {
        req.session.user.nome = nomeLimpo;
        req.session.user.email = emailLimpo || null;
        if (suportaQualificacao) {
            req.session.user.qualificacao = qualificacaoLimpa;
        }
        req.session.user.turno_principal = suportaTurnoPrincipal ? turnoPersistido : null;
        req.session.user.carga_horaria_semanal = suportaCargaHoraria ? cargaHoraria : null;
        if (temFotoNova && suportaFotoUrl) {
            req.session.user.foto_url = fotoUrl;
        }
    }

    return { statusCode: 200, body: { ok: true, message: 'Perfil atualizado com sucesso.' } };
}

async function atualizarProfessor(req, {
    id,
    nome,
    matricula,
    login,
    codigoUnidade,
    permissao,
    email,
    turnoPrincipal,
    cargaHorariaSemanal,
    qualificacao,
    classificacao_docente,
    senhaTemporaria,
    novaSenha,
    confirmarNovaSenha,
    foto
}) {
    let classificacaoDocente;
    try { classificacaoDocente = normalizarClassificacaoDocente(classificacao_docente); }
    catch (error) { return { statusCode: 400, body: { error: error.message } }; }
    const professorId = Number(id);

    if (!Number.isInteger(professorId) || professorId <= 0) {
        return { statusCode: 400, body: { error: 'Professor inválido.' } };
    }

    const nomeLimpo = String(nome || '').trim();
    const matriculaLimpa = String(matricula || '').trim();
    const loginLimpo = String(login || '').trim();
    const codigoUnidadeLimpo = String(codigoUnidade || '').trim();
    const permissaoLimpa = String(permissao || '').trim().toLowerCase();
    const emailLimpo = String(email || '').trim();
    const turnoPrincipalLimpo = String(turnoPrincipal || '').trim().toLowerCase();
    const qualificacaoLimpa = normalizarQualificacao(qualificacao);
    const novaSenhaLimpa = String(novaSenha || '');
    const confirmarNovaSenhaLimpa = String(confirmarNovaSenha || '');
    const atualizarSenha = Boolean(novaSenhaLimpa || confirmarNovaSenhaLimpa);
    const senhaTemporariaBool = parseBooleanField(senhaTemporaria);
    const fotoUrl = foto?.filename ? `/imagens/${foto.filename}` : null;
    const fotoMimeType = foto?.mimetype || null;

    const cargaHorariaNormalizada = cargaHorariaSemanal === '' || cargaHorariaSemanal === null || cargaHorariaSemanal === undefined
        ? null
        : parseCargaHoraria(cargaHorariaSemanal);

    if (!nomeLimpo || !matriculaLimpa || !loginLimpo || !codigoUnidadeLimpo) {
        return { statusCode: 400, body: { error: 'Nome, matrícula, login e unidade são obrigatórios.' } };
    }

    if (!['user', 'coordenador', 'admin'].includes(permissaoLimpa)) {
        return { statusCode: 400, body: { error: 'Perfil inválido.' } };
    }

    if (permissaoLimpa === 'admin' && req.session?.user?.permissao !== 'admin') {
        return { statusCode: 403, body: { error: 'Apenas administradores podem atribuir perfil de administrador.' } };
    }

    if (emailLimpo && !/^\S+@\S+\.\S+$/.test(emailLimpo)) {
        return { statusCode: 400, body: { error: 'Email inválido.' } };
    }

    if (turnoPrincipalLimpo) {
        normalizarTurnoPrincipal(turnoPrincipalLimpo);
    }

    if (atualizarSenha) {
        if (novaSenhaLimpa !== confirmarNovaSenhaLimpa) {
            return { statusCode: 400, body: { error: 'A confirmação da nova senha não confere.' } };
        }

        const senhaValida = validatePasswordStrength(novaSenhaLimpa);
        if (!senhaValida.valid) {
            return { statusCode: 400, body: { error: senhaValida.message } };
        }
    }

    if (!canAccessUnit(req, codigoUnidadeLimpo)) {
        return { statusCode: 403, body: { error: 'Acesso negado para a unidade informada.' } };
    }

    const pool = await getPool();

    const professorNaUnidade = await pool.request()
        .input('id_professor', sql.Int, professorId)
        .input('codigo_unidade', sql.NVarChar, codigoUnidadeLimpo)
        .query(`
            SELECT TOP 1 p.id_professor
            FROM professores p
            INNER JOIN ProfessorUnidade pu ON pu.id_professor = p.id_professor
            WHERE p.id_professor = @id_professor
              AND pu.codigo_unidade = @codigo_unidade
        `);

    if (!professorNaUnidade.recordset.length) {
        return { statusCode: 404, body: { error: 'Usuário não encontrado na unidade selecionada.' } };
    }

    const matriculaDuplicada = await pool.request()
        .input('id_professor', sql.Int, professorId)
        .input('matricula', sql.NVarChar, matriculaLimpa)
        .query(`
            SELECT TOP 1 id_professor
            FROM professores
            WHERE matricula = @matricula
              AND id_professor <> @id_professor
        `);

    if (matriculaDuplicada.recordset.length) {
        return { statusCode: 409, body: { error: 'Já existe outro usuário com esta matrícula.' } };
    }

    const loginDuplicado = await pool.request()
        .input('id_professor', sql.Int, professorId)
        .input('login', sql.NVarChar, loginLimpo)
        .query(`
            SELECT TOP 1 id_professor
            FROM professores
            WHERE login = @login
              AND id_professor <> @id_professor
        `);

    if (loginDuplicado.recordset.length) {
        return { statusCode: 409, body: { error: 'Já existe outro usuário com este login.' } };
    }

    const colunas = await getProfessorOptionalColumns(pool);
    const request = pool.request()
        .input('id_professor', sql.Int, professorId)
        .input('nome', sql.NVarChar, nomeLimpo)
        .input('matricula', sql.NVarChar, matriculaLimpa)
        .input('login', sql.NVarChar, loginLimpo)
        .input('permissao', sql.NVarChar, permissaoLimpa);

    const sets = [
        'nome = @nome',
        'matricula = @matricula',
        'login = @login',
        'permissao = @permissao'
    ];

    if (classificacao_docente !== undefined) {
        request.input('classificacao_docente', sql.Bit, classificacaoDocente);
        sets.push('classificacao_docente = @classificacao_docente');
    }

    if (colunas.email) {
        request.input('email', sql.NVarChar, emailLimpo || null);
        sets.push('email = @email');
    }

    if (colunas.turnoPrincipal) {
        request.input('turno_principal', sql.NVarChar, turnoPrincipalLimpo || null);
        sets.push('turno_principal = @turno_principal');
    }

    if (colunas.cargaHorariaSemanal) {
        request.input('carga_horaria_semanal', sql.Decimal(5, 2), cargaHorariaNormalizada);
        sets.push('carga_horaria_semanal = @carga_horaria_semanal');
    }

    if (colunas.qualificacao) {
        request.input('qualificacao', sql.NVarChar(200), qualificacaoLimpa);
        sets.push('qualificacao = @qualificacao');
    }

    if (colunas.senhaTemporaria) {
        request.input('senhaTemporaria', sql.Bit, senhaTemporariaBool ? 1 : 0);
        sets.push('[senhaTemporaria] = @senhaTemporaria');
    }

    if (colunas.fotoUrl && fotoUrl) {
        request.input('foto_url', sql.NVarChar, fotoUrl);
        sets.push('foto_url = @foto_url');
    }

    if (colunas.fotoMimeType && fotoMimeType) {
        request.input('foto_mime_type', sql.NVarChar, fotoMimeType);
        sets.push('foto_mime_type = @foto_mime_type');
    }

    if (colunas.fotoAtualizadaEm && fotoUrl) {
        sets.push('foto_atualizada_em = SYSDATETIME()');
    }

    if (atualizarSenha) {
        const senhaHash = await bcrypt.hash(novaSenhaLimpa, 10);
        request.input('senha', sql.NVarChar, senhaHash);
        sets.push('senha = @senha');
    }

    const updateResult = await request.query(`
        UPDATE professores
        SET ${sets.join(',\n                ')}
        WHERE id_professor = @id_professor
    `);

    if (!updateResult.rowsAffected[0]) {
        return { statusCode: 404, body: { error: 'Usuário não encontrado para atualização.' } };
    }

    if (Number(req.session?.user?.id_professor) === professorId) {
        req.session.user.nome = nomeLimpo;
        req.session.user.login = loginLimpo;
        req.session.user.matricula = matriculaLimpa;
        req.session.user.permissao = permissaoLimpa;
        if (colunas.email) req.session.user.email = emailLimpo || null;
        if (colunas.turnoPrincipal) req.session.user.turno_principal = turnoPrincipalLimpo || null;
        if (colunas.cargaHorariaSemanal) req.session.user.carga_horaria_semanal = cargaHorariaNormalizada;
        if (colunas.qualificacao) req.session.user.qualificacao = qualificacaoLimpa;
        if (colunas.fotoUrl && fotoUrl) req.session.user.foto_url = fotoUrl;
    }

    return { statusCode: 200, body: { ok: true, message: 'Usuário atualizado com sucesso.' } };
}

async function listarProfessoresPorUnidade(req, codigoUnidade) {
    const pool = await getPool();
    const permissao = req.session?.user?.permissao;
    const idProfessorLogado = Number(req.session?.user?.id_professor);

    if (!canAccessUnit(req, codigoUnidade)) {
        return { statusCode: 403, body: 'Acesso negado.' };
    }

    const request = pool.request()
        .input('codigo_unidade', sql.NVarChar, codigoUnidade)
        .input('id_professor_logado', sql.Int, idProfessorLogado);
    const colunas = await getProfessorOptionalColumns(pool);
    const qualificacaoOuterSelect = colunas.qualificacao
        ? 'base.qualificacao'
        : 'CAST(NULL AS NVARCHAR(200)) AS qualificacao';
    const qualificacaoBaseSelect = colunas.qualificacao
        ? 'p.qualificacao'
        : 'CAST(NULL AS NVARCHAR(200)) AS qualificacao';

    let query = `
        SELECT base.id_professor, base.nome, base.login, base.matricula, base.permissao,
               base.email, base.turno_principal, base.carga_horaria_semanal, ${qualificacaoOuterSelect},
               base.senhaTemporaria, base.foto_url, base.classificacao_docente
        FROM (
            SELECT DISTINCT p.id_professor, p.nome, p.login, p.matricula, p.permissao,
                            p.email, p.turno_principal, p.carga_horaria_semanal, ${qualificacaoBaseSelect},
                            p.senhaTemporaria, p.foto_url, p.classificacao_docente
            FROM professores p
            JOIN ProfessorUnidade pu ON p.id_professor = pu.id_professor
            WHERE pu.codigo_unidade = @codigo_unidade
    `;

    if (permissao !== 'admin' && permissao !== 'coordenador') {
        query += ' AND p.id_professor = @id_professor_logado';
    }

    query += `
        ) AS base
        ORDER BY CASE WHEN base.id_professor = @id_professor_logado THEN 0 ELSE 1 END, base.nome
    `;

    const result = await request.query(query);
    return { statusCode: 200, body: result.recordset };
}

async function listarTodosProfessores() {
    const pool = await getPool();
    const result = await pool.request()
        .query('SELECT p.id_professor, p.nome, p.login, p.matricula FROM professores p');

    return result.recordset;
}

async function excluirProfessor(id) {
    const pool = await getPool();

    // Verificar se o professor tem agendamentos ativos
    const agendamentosAtivos = await pool.request()
        .input('id_professor', sql.Int, id)
        .query(`
            SELECT COUNT(*) as total
            FROM agendamentos
            WHERE id_professor = @id_professor
              AND data_agendamento >= CAST(GETDATE() AS DATE)
        `);

    if (agendamentosAtivos.recordset[0].total > 0) {
        throw new Error('Não é possível excluir professor com agendamentos ativos. Remova os agendamentos antes de excluir o professor.');
    }

    await pool.request()
        .input('id_professor', sql.Int, id)
        .query('DELETE FROM ProfessorUnidade WHERE id_professor = @id_professor');

    await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM professores WHERE id_professor = @id');
}

async function desassociarProfessorUnidade(id, codigoUnidade) {
    const pool = await getPool();

    await pool.request()
        .input('id_professor', sql.Int, id)
        .input('codigo_unidade', sql.NVarChar, codigoUnidade)
        .query('DELETE FROM ProfessorUnidade WHERE id_professor = @id_professor AND codigo_unidade = @codigo_unidade');
}

module.exports = {
    getProfessorOptionalColumns,
    registerProfessor,
    registerCoordenador,
    verificarMatricula,
    alterarSenha,
    atualizarMeuPerfil,
    atualizarProfessor,
    listarProfessoresPorUnidade,
    listarTodosProfessores,
    excluirProfessor,
    desassociarProfessorUnidade,
    validatePasswordStrength
};
