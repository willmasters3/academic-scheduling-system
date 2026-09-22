document.addEventListener('DOMContentLoaded', async () => {
    const A=AlocacaoDocente, q=id=>document.getElementById(id), form=q('formAlocacao'), feedback=q('feedback'), overlap=q('sobreposicao');
    const params=new URLSearchParams(location.search), editId=params.get('id'); let context, ucs=[];
    const cancelLink=document.querySelector('a[href="/alocacao-docente/minhas"]');if(cancelLink)cancelLink.href='/alocacao-docente/coordenacao';
    function option(value,label){return `<option value="${A.escape(value)}">${A.escape(label)}</option>`}
    async function loadProfessors(){const unit=q('unidade').value;if(!unit){q('professor').innerHTML=option('','Selecione a unidade');return}const rows=await A.api(`/listar-professores-por-unidade/${encodeURIComponent(unit)}`);rows.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR',{sensitivity:'base'}));q('professor').innerHTML=option('','Selecione')+rows.map(x=>option(x.id_professor,x.nome)).join('')}
    async function loadCourses(){const unit=q('unidade').value;q('curso').innerHTML=option('','Selecione');q('uc').innerHTML=option('','Selecione o curso');q('turma').innerHTML=option('','Selecione o curso');if(!unit)return;const rows=await A.api(`/alocacoes-docentes/cursos?unidade=${encodeURIComponent(unit)}`);q('curso').innerHTML=option('','Selecione')+rows.map(x=>option(x.id_curso,`${x.nome_curso} — ${x.modalidade}`)).join('')}
    async function loadAcademic(){const course=q('curso').value,unit=q('unidade').value;q('uc').innerHTML=option('','Selecione');q('turma').innerHTML=option('','Selecione');q('carga').value='';if(!course)return;const [ucRows,turmas]=await Promise.all([A.api(`/alocacoes-docentes/cursos/${course}/ucs`),A.api(`/alocacoes-docentes/turmas?unidade=${encodeURIComponent(unit)}&id_curso=${course}`)]);ucs=ucRows;q('uc').innerHTML=option('','Selecione')+ucs.map(x=>option(x.id_curso_uc,x.descricao)).join('');q('turma').innerHTML=option('','Selecione')+turmas.map(x=>option(x.id_turma,x.codigo_reduzido)).join('')}
    function prep(){const disabled=q('tipo').value==='PREPARACAO';['curso','uc','turma'].forEach(id=>{q(id).disabled=disabled;q(id).required=!disabled;if(disabled)q(id).value=''});q('carga').value=''}
    function payload(){return {id_alocacao:editId||undefined,id_professor:q('professor').value,codigo_unidade:q('unidade').value,tipo:q('tipo').value,turno:q('turno').value,id_curso_uc:q('uc').value||null,id_turma:q('turma').value||null,data_inicio:q('inicio').value,data_fim:q('fim').value,observacao:q('observacao').value,dias:[...document.querySelectorAll('[name=dias]:checked')].map(x=>Number(x.value))}}
    async function save(data){const result=await A.api(editId?`/alocacoes-docentes/${editId}`:'/alocacoes-docentes',{method:editId?'PUT':'POST',body:JSON.stringify(data)});A.feedback(feedback,result.message,'success');setTimeout(()=>location.href='/alocacao-docente/coordenacao',700)}
    let pendingOverlap = null, checking = false, confirming = false;
    const submitButton = form.querySelector('button[type="submit"]');
    let previousFocus, previousOverflow;
    function openOverlap(registros, data) {
        pendingOverlap = data;
        q('sobreposicaoLista').innerHTML = registros.map(x => A.card(x)).join('');
        q('sobreposicaoFeedback').className = 'feedback';
        q('sobreposicaoFeedback').textContent = '';
        previousFocus = document.activeElement;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        overlap.showModal();
        q('sobreposicaoLista').scrollTop = 0;
        q('cancelOverlap').focus();
    }
    overlap.addEventListener('close', () => {
        pendingOverlap = null;
        document.body.style.overflow = previousOverflow;
        if (previousFocus?.isConnected) previousFocus.focus();
    });
    overlap.addEventListener('cancel', e => {
        if (confirming) e.preventDefault();
    });
    q('cancelOverlap').onclick = () => { if (!confirming) overlap.close(); };
    q('confirmOverlap').onclick = async () => {
        if (confirming || !pendingOverlap) return;
        confirming = true;
        q('cancelOverlap').disabled = true;
        q('confirmOverlap').disabled = true;
        overlap.setAttribute('aria-busy', 'true');
        try {
            await save(pendingOverlap);
            // Keep the confirmation disabled until the existing redirect completes.
        } catch (error) {
            A.feedback(q('sobreposicaoFeedback'), error.message);
            confirming = false;
            q('cancelOverlap').disabled = false;
            q('confirmOverlap').disabled = false;
            q('confirmOverlap').focus();
        } finally { overlap.removeAttribute('aria-busy'); }
    };
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (checking || overlap.open) return;
        checking = true;
        submitButton.disabled = true;
        try {
            const data = payload();
            const check = await A.api('/alocacoes-docentes/verificar-sobreposicao', {method:'POST', body:JSON.stringify(data)});
            if (check.tem_sobreposicao) {
                // Restore the triggering button before opening so focus can return on cancel.
                submitButton.disabled = false;
                openOverlap(check.registros, data);
                return;
            }
            await save(data);
        } catch (error) { A.feedback(feedback, error.message); }
        finally { checking = false; submitButton.disabled = false; }
    });
    q('unidade').addEventListener('change',async()=>{try{await Promise.all([loadProfessors(),loadCourses()])}catch(e){A.feedback(feedback,e.message)}});q('curso').addEventListener('change',()=>loadAcademic().catch(e=>A.feedback(feedback,e.message)));q('uc').addEventListener('change',()=>{const uc=ucs.find(x=>String(x.id_curso_uc)===q('uc').value);q('carga').value=uc?`${uc.carga_horaria_total} h`:''});q('tipo').addEventListener('change',prep);
    try{context=await A.api('/alocacoes-docentes/contexto');q('unidade').innerHTML=option('','Selecione')+context.unidades.map(x=>option(x.codigo_unidade,x.nome_unidade)).join('');if(editId){q('tituloPagina').textContent='Editar Alocação';const item=await A.api(`/alocacoes-docentes/${editId}`);q('unidade').value=item.codigo_unidade;await Promise.all([loadProfessors(),loadCourses()]);q('professor').value=item.id_professor;q('tipo').value=item.tipo;q('turno').value=item.turno;q('curso').value=item.id_curso||'';await loadAcademic();q('uc').value=item.id_curso_uc||'';q('uc').dispatchEvent(new Event('change'));q('turma').value=item.id_turma||'';q('inicio').value=item.data_inicio;q('fim').value=item.data_fim;q('observacao').value=item.observacao||'';(item.dias||[]).forEach(d=>{const el=document.querySelector(`[name=dias][value="${d}"]`);if(el)el.checked=true})}prep()}catch(error){A.feedback(feedback,error.message)}
});
