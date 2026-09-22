const sql = require('mssql');
const config = require('../../dbConfig');

const TURNOS = new Set(['MANHA', 'TARDE', 'NOITE']);
let poolPromise;
function getPool() { if (!poolPromise) poolPromise = sql.connect(config).catch(error => { poolPromise = null; throw error; }); return poolPromise; }
function falha(status, message) { const error = new Error(message); error.status = status; throw error; }
function texto(value, max) { return String(value ?? '').trim().slice(0, max); }
function id(value, nome) { const n = Number(value); if (!Number.isInteger(n) || n <= 0) falha(400, `${nome} invalido.`); return n; }
function booleano(value) { if (value === true || value === 1 || value === '1') return true; if (value === false || value === 0 || value === '0') return false; falha(400, 'Status invalido.'); }
function permitidas(user) { return user?.permissao === 'admin' ? null : (Array.isArray(user?.unidades) ? user.unidades.map(String) : []); }
function unidade(user, value) { const codigo = texto(value, 10); const lista = permitidas(user); if (!codigo || (lista !== null && !lista.includes(codigo))) falha(403, 'Acesso negado para esta unidade.'); return codigo; }

async function cursoAutorizado(executor, user, idCurso) {
    const request = executor.request().input('idCurso', sql.Int, id(idCurso, 'Curso'));
    const lista = permitidas(user); let filtro = '';
    if (lista !== null) { if (!lista.length) falha(403, 'Usuario sem unidades autorizadas.'); const p = lista.map((v,i)=>{request.input(`u${i}`,sql.VarChar(10),v);return `@u${i}`;}); filtro=`AND codigo_unidade IN (${p.join(',')})`; }
    const result=await request.query(`SELECT TOP 1 * FROM dbo.CursoAcademico WHERE id_curso=@idCurso ${filtro}`);
    if(!result.recordset.length) falha(404,'Curso nao encontrado ou sem acesso.'); return result.recordset[0];
}

async function listarCursos(user, codigo) {
    const u=unidade(user,codigo), pool=await getPool();
    const result=await pool.request().input('unidade',sql.VarChar(10),u).query('SELECT id_curso,codigo_curso,nome_curso,modalidade,codigo_unidade,ativo,criado_em,atualizado_em FROM dbo.CursoAcademico WHERE codigo_unidade=@unidade ORDER BY ativo DESC,nome_curso');
    return result.recordset;
}
async function criarCurso(user, body) {
    const u=unidade(user,body.codigo_unidade), nome=texto(body.nome_curso,255), modalidade=texto(body.modalidade,100), codigo=texto(body.codigo_curso,50)||null;
    if(!nome||!modalidade) falha(400,'Nome e modalidade sao obrigatorios.'); const pool=await getPool();
    const result=await pool.request().input('unidade',sql.VarChar(10),u).input('nome',sql.NVarChar(255),nome).input('modalidade',sql.NVarChar(100),modalidade).input('codigo',sql.NVarChar(50),codigo).query('INSERT INTO dbo.CursoAcademico (codigo_curso,nome_curso,modalidade,codigo_unidade) OUTPUT INSERTED.* VALUES (@codigo,@nome,@modalidade,@unidade)');
    return {message:'Curso cadastrado com sucesso.',curso:result.recordset[0]};
}
async function editarCurso(user,idCurso,body){const pool=await getPool();await cursoAutorizado(pool,user,idCurso);const nome=texto(body.nome_curso,255),modalidade=texto(body.modalidade,100),codigo=texto(body.codigo_curso,50)||null;if(!nome||!modalidade)falha(400,'Nome e modalidade sao obrigatorios.');await pool.request().input('id',sql.Int,id(idCurso,'Curso')).input('nome',sql.NVarChar(255),nome).input('modalidade',sql.NVarChar(100),modalidade).input('codigo',sql.NVarChar(50),codigo).query('UPDATE dbo.CursoAcademico SET codigo_curso=@codigo,nome_curso=@nome,modalidade=@modalidade,atualizado_em=SYSUTCDATETIME() WHERE id_curso=@id');return{message:'Curso atualizado com sucesso.'};}
async function alterarStatusCurso(user,idCurso,ativoValue){const pool=await getPool();await cursoAutorizado(pool,user,idCurso);const ativo=booleano(ativoValue);await pool.request().input('id',sql.Int,id(idCurso,'Curso')).input('ativo',sql.Bit,ativo?1:0).query('UPDATE dbo.CursoAcademico SET ativo=@ativo,atualizado_em=SYSUTCDATETIME() WHERE id_curso=@id');return{message:ativo?'Curso reativado com sucesso.':'Curso inativado com sucesso.'};}

async function listarCursoUcs(user,idCurso){const pool=await getPool();await cursoAutorizado(pool,user,idCurso);const result=await pool.request().input('idCurso',sql.Int,id(idCurso,'Curso')).query(`SELECT cuc.id_curso_uc,cuc.id_curso,cuc.id_tipo_aula,ta.descricao,cuc.codigo_uc,cuc.carga_horaria_total,cuc.modulo,cuc.ativo FROM dbo.CursoUnidadeCurricular cuc JOIN dbo.tipos_aula ta ON ta.id_tipo_aula=cuc.id_tipo_aula WHERE cuc.id_curso=@idCurso ORDER BY cuc.ativo DESC,ta.descricao`);return result.recordset;}
function dadosCursoUc(body){const idTipo=id(body.id_tipo_aula,'Unidade curricular'),carga=Number(body.carga_horaria_total),modulo=body.modulo===''||body.modulo==null?null:Number(body.modulo),codigo=texto(body.codigo_uc,50)||null;if(!Number.isFinite(carga)||carga<=0)falha(400,'Carga horaria invalida.');if(modulo!==null&&(!Number.isInteger(modulo)||modulo<=0))falha(400,'Modulo invalido.');return{idTipo,carga,modulo,codigo};}
async function inserirCursoUc(executor, idCurso, d) {
    const result=await executor.request().input('curso',sql.Int,id(idCurso,'Curso')).input('tipo',sql.Int,d.idTipo).input('carga',sql.Decimal(7,2),d.carga).input('modulo',sql.Int,d.modulo).input('codigo',sql.NVarChar(50),d.codigo).query('INSERT INTO dbo.CursoUnidadeCurricular (id_curso,id_tipo_aula,codigo_uc,carga_horaria_total,modulo) OUTPUT INSERTED.* VALUES (@curso,@tipo,@codigo,@carga,@modulo)');
    return result.recordset[0];
}
async function associarCursoUc(user,idCurso,body) {
    const pool=await getPool();
    const curso=await cursoAutorizado(pool,user,idCurso);
    if(!curso.ativo) falha(409,'Reative o curso antes de associar uma UC.');
    const d=dadosCursoUc(body);
    try {
        return {message:'UC associada ao curso com sucesso.',associacao:await inserirCursoUc(pool,idCurso,d)};
    } catch(error) {
        if([2627,2601].includes(Number(error.number))) falha(409,'Esta UC ja esta associada ao curso. Reative ou edite a associacao existente.');
        throw error;
    }
}
async function associarCursoUcsLote(user, idCurso, body) {
    id(idCurso, 'Curso');
    if (!Array.isArray(body?.relacoes) || !body.relacoes.length) falha(400, 'Selecione pelo menos uma UC.');
    const vistos = new Set();
    const dados = body.relacoes.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) falha(400, `Relacao ${index + 1} invalida.`);
        let d;
        try { d = dadosCursoUc(item); } catch (error) { falha(400, `Relacao ${index + 1} (UC ${item.id_tipo_aula ?? 'nao informada'}): ${error.message}`); }
        if (d.idTipo > 2147483647 || d.carga > 99999.99 || (d.modulo !== null && d.modulo > 2147483647)) falha(400, `UC ${d.idTipo}: valores acima do limite permitido.`);
        if (vistos.has(d.idTipo)) falha(400, `UC ${d.idTipo} repetida no lote.`);
        vistos.add(d.idTipo);
        return d;
    }).sort((a, b) => a.idTipo - b.idTipo);
    const pool = await getPool(), transaction = new sql.Transaction(pool);
    await transaction.begin();
    let ucAtual;
    try {
        const curso = await cursoAutorizado(transaction, user, idCurso);
        if (!curso.ativo) falha(409, 'Reative o curso antes de associar UCs.');
        for (const d of dados) {
            const uc = await transaction.request().input('tipo', sql.Int, d.idTipo).input('unidade', sql.VarChar(10), curso.codigo_unidade).query(`SELECT ta.descricao FROM dbo.tipos_aula ta WHERE ta.id_tipo_aula=@tipo AND EXISTS (SELECT 1 FROM dbo.unidade_tipo_aula uta WHERE uta.id_tipo_aula=ta.id_tipo_aula AND uta.id_unidade=@unidade)`);
            if (!uc.recordset.length) falha(400, `UC ${d.idTipo} nao disponivel para a unidade do curso. Nenhuma relacao salva.`);
            d.descricao = uc.recordset[0].descricao;
            const existente = await transaction.request().input('curso', sql.Int, Number(idCurso)).input('tipo', sql.Int, d.idTipo).query(`SELECT ativo FROM dbo.CursoUnidadeCurricular WITH (UPDLOCK, HOLDLOCK) WHERE id_curso=@curso AND id_tipo_aula=@tipo`);
            if (existente.recordset.length) falha(409, `UC "${d.descricao}" ja vinculada ao curso. ${existente.recordset[0].ativo ? 'Edite' : 'Reative ou edite'} a relacao existente. Nenhuma relacao salva.`);
        }
        const associacoes = [];
        for (const d of dados) {
            ucAtual = d.descricao;
            associacoes.push(await inserirCursoUc(transaction, idCurso, d));
        }
        await transaction.commit();
        return {message:`${associacoes.length} relacao(oes) salva(s) com sucesso.`, associacoes};
    } catch (error) {
        await transaction.rollback().catch(() => {});
        if ([2627,2601].includes(Number(error.number))) falha(409, `UC "${ucAtual}" ja vinculada ao curso. Atualize a lista e edite ou reative a relacao existente. Nenhuma relacao salva.`);
        if (Number(error.number) === 547) falha(409, `Nao foi possivel vincular a UC "${ucAtual}". Atualize a lista de UCs. Nenhuma relacao salva.`);
        throw error;
    }
}
async function associacaoAutorizada(pool,user,idAssoc){const result=await pool.request().input('id',sql.Int,id(idAssoc,'Associacao')).query('SELECT TOP 1 ca.* FROM dbo.CursoUnidadeCurricular cuc JOIN dbo.CursoAcademico ca ON ca.id_curso=cuc.id_curso WHERE cuc.id_curso_uc=@id');if(!result.recordset.length)falha(404,'Associacao nao encontrada.');unidade(user,result.recordset[0].codigo_unidade);}
async function editarCursoUc(user,idAssoc,body){const pool=await getPool();await associacaoAutorizada(pool,user,idAssoc);const d=dadosCursoUc(body);await pool.request().input('id',sql.Int,id(idAssoc,'Associacao')).input('tipo',sql.Int,d.idTipo).input('carga',sql.Decimal(7,2),d.carga).input('modulo',sql.Int,d.modulo).input('codigo',sql.NVarChar(50),d.codigo).query('UPDATE dbo.CursoUnidadeCurricular SET id_tipo_aula=@tipo,codigo_uc=@codigo,carga_horaria_total=@carga,modulo=@modulo,atualizado_em=SYSUTCDATETIME() WHERE id_curso_uc=@id');return{message:'Relacao Curso x UC atualizada com sucesso.'};}
async function alterarStatusCursoUc(user,idAssoc,ativoValue){const pool=await getPool();await associacaoAutorizada(pool,user,idAssoc);const ativo=booleano(ativoValue);await pool.request().input('id',sql.Int,id(idAssoc,'Associacao')).input('ativo',sql.Bit,ativo?1:0).query('UPDATE dbo.CursoUnidadeCurricular SET ativo=@ativo,atualizado_em=SYSUTCDATETIME() WHERE id_curso_uc=@id');return{message:ativo?'Associacao reativada com sucesso.':'Associacao inativada com sucesso.'};}

function dadosTurma(user,body){const codigo=texto(body.codigo_reduzido,50),u=unidade(user,body.codigo_unidade),idCurso=id(body.id_curso,'Curso'),ano=body.ano===''||body.ano==null?null:Number(body.ano),semestre=texto(body.semestre,10)||null,turno=texto(body.turno,10).toUpperCase()||null;if(!codigo)falha(400,'Codigo reduzido e obrigatorio.');if(ano!==null&&(!Number.isInteger(ano)||ano<2000||ano>2200))falha(400,'Ano invalido.');if(turno&&!TURNOS.has(turno))falha(400,'Turno invalido.');return{codigo,u,idCurso,ano,semestre,turno};}
async function listarTurmas(user,filters){const u=unidade(user,filters.unidade),pool=await getPool(),request=pool.request().input('unidade',sql.VarChar(10),u);let curso='';if(filters.id_curso){request.input('curso',sql.Int,id(filters.id_curso,'Curso'));curso='AND t.id_curso=@curso';}const result=await request.query(`SELECT t.id_turma,t.codigo_reduzido,t.codigo_unidade,t.id_curso,ca.nome_curso,t.ano,t.semestre,t.turno,t.ativo FROM dbo.TurmaAcademica t JOIN dbo.CursoAcademico ca ON ca.id_curso=t.id_curso WHERE t.codigo_unidade=@unidade ${curso} ORDER BY t.ativo DESC,t.codigo_reduzido`);return result.recordset;}
async function criarTurma(user,body){const d=dadosTurma(user,body),pool=await getPool(),curso=await cursoAutorizado(pool,user,d.idCurso);if(!curso.ativo)falha(409,'Reative o curso antes de cadastrar uma turma.');if(String(curso.codigo_unidade)!==d.u)falha(400,'O curso nao pertence a unidade da turma.');try{const result=await pool.request().input('codigo',sql.NVarChar(50),d.codigo).input('unidade',sql.VarChar(10),d.u).input('curso',sql.Int,d.idCurso).input('ano',sql.Int,d.ano).input('semestre',sql.NVarChar(10),d.semestre).input('turno',sql.VarChar(10),d.turno).query('INSERT INTO dbo.TurmaAcademica (codigo_reduzido,codigo_unidade,id_curso,ano,semestre,turno) OUTPUT INSERTED.* VALUES (@codigo,@unidade,@curso,@ano,@semestre,@turno)');return{message:'Turma cadastrada com sucesso.',turma:result.recordset[0]};}catch(error){if(Number(error.number)===2627||Number(error.number)===2601)falha(409,'Ja existe turma com este codigo na unidade.');throw error;}}
async function turmaAutorizada(pool,user,idTurma){const result=await pool.request().input('id',sql.Int,id(idTurma,'Turma')).query('SELECT TOP 1 * FROM dbo.TurmaAcademica WHERE id_turma=@id');if(!result.recordset.length)falha(404,'Turma nao encontrada.');unidade(user,result.recordset[0].codigo_unidade);return result.recordset[0];}
async function editarTurma(user,idTurma,body){const pool=await getPool();await turmaAutorizada(pool,user,idTurma);const d=dadosTurma(user,body),curso=await cursoAutorizado(pool,user,d.idCurso);if(String(curso.codigo_unidade)!==d.u)falha(400,'O curso nao pertence a unidade da turma.');await pool.request().input('id',sql.Int,id(idTurma,'Turma')).input('codigo',sql.NVarChar(50),d.codigo).input('unidade',sql.VarChar(10),d.u).input('curso',sql.Int,d.idCurso).input('ano',sql.Int,d.ano).input('semestre',sql.NVarChar(10),d.semestre).input('turno',sql.VarChar(10),d.turno).query('UPDATE dbo.TurmaAcademica SET codigo_reduzido=@codigo,codigo_unidade=@unidade,id_curso=@curso,ano=@ano,semestre=@semestre,turno=@turno,atualizado_em=SYSUTCDATETIME() WHERE id_turma=@id');return{message:'Turma atualizada com sucesso.'};}
async function alterarStatusTurma(user,idTurma,ativoValue){const pool=await getPool();await turmaAutorizada(pool,user,idTurma);const ativo=booleano(ativoValue);await pool.request().input('id',sql.Int,id(idTurma,'Turma')).input('ativo',sql.Bit,ativo?1:0).query('UPDATE dbo.TurmaAcademica SET ativo=@ativo,atualizado_em=SYSUTCDATETIME() WHERE id_turma=@id');return{message:ativo?'Turma reativada com sucesso.':'Turma inativada com sucesso.'};}

module.exports={listarCursos,criarCurso,editarCurso,alterarStatusCurso,listarCursoUcs,associarCursoUc,associarCursoUcsLote,editarCursoUc,alterarStatusCursoUc,listarTurmas,criarTurma,editarTurma,alterarStatusTurma};
