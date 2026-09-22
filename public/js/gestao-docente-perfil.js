(function () {
    'use strict';
    const q=id=>document.getElementById(id), state={data:null,sequence:0,bookingPage:1,ucPage:1,applied:null};
    const id=location.pathname.split('/').filter(Boolean).at(-1);
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const numero=value=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
    function horas(value) {
        if(value==null)return '--';
        const minutos=Number(value),inteiro=Math.floor(minutos/60),restante=minutos%60;
        return restante===0?`${numero(inteiro)}h`:`${numero(inteiro)}h${numero(restante).padStart(2,'0')}`;
    }
    const percentual=value=>value==null?'--':`${numero(value)}%`;
    const data=value=>value?String(value).slice(0,10).split('-').reverse().join('/'):'--';
    const metric=(value,help,color='')=>`<button type="button" class="gp-metric ${color}" data-help="${escape(help)}">${escape(value)}</button>`;
    const labels={ADEQUADO:'Adequado',ATENCAO:'Atenção',CRITICO:'Crítico',COM_EXCESSO:'Com excesso',SEM_CLASSIFICACAO:'Sem classificação'};
    const colors={ADEQUADO:'green',ATENCAO:'amber',CRITICO:'red',COM_EXCESSO:'purple'};
    const {hideTooltip}=GestaoDocente.inicializarTooltips();
    async function api(url, options = {}) {
        const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',...options});
        if(response.status===401){location.href='/login';throw new Error('Sessão expirada.');}
        if(response.status===404)throw new Error('Professor não encontrado.');
        if(response.status===403)throw new Error('Acesso negado a este perfil ou unidade.');
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload.error||'Não foi possível carregar o perfil. Tente atualizar novamente.');
        return payload;
    }
    function parametros() {
        const p=q('profilePeriod').value==='custom'?{inicio:q('profileStart').value,fim:q('profileEnd').value}:GestaoDocente.obterPeriodo(q('profilePeriod').value);
        if(!p.inicio||!p.fim||p.fim<p.inicio)throw new Error('Informe um período válido.');
        const params=new URLSearchParams({data_inicio:p.inicio,data_fim:p.fim});
        if(q('profileUnit').value)params.set('unidade',q('profileUnit').value);
        return params;
    }
    function renderUcs() {
        hideTooltip();
        const planos=state.data.planejamentos,size=10,paginas=Math.max(1,Math.ceil(planos.length/size));
        state.ucPage=Math.min(state.ucPage,paginas);
        const rows=planos.slice((state.ucPage-1)*size,state.ucPage*size);
        q('profileUcRows').innerHTML=rows.length?rows.map(p=>{
            const cobertura=p.carga_prevista_minutos>0?p.cobertura_percentual:null;
            const scheduled=p.horas_agendadas_minutos===0 && p.carga_prevista_minutos>0?'Existe carga prevista para este professor, mas ainda não há horas agendadas vinculadas a este planejamento.':'Horas dos fatos ativos deste docente vinculados ao planejamento, no período selecionado.';
            const ajuda=p.horas_excesso_minutos>0?`Há ${horas(p.horas_excesso_minutos)} agendadas acima da carga prevista para este planejamento.`:'Percentual da carga prevista que possui horas agendadas.';
            return `<tr><td>${escape(p.unidade_curricular||'--')}</td><td>${escape(p.nome_curso||'--')}</td><td>${escape(p.codigo_reduzido||'--')}</td><td>${data(p.periodo_inicio)}<br>${data(p.periodo_fim)}</td>
                <td>${metric(horas(p.carga_prevista_minutos),'Carga da versão aplicável a este planejamento. Não é somada à carga da alocação.','gp-blue')}</td>
                <td>${metric(horas(p.horas_agendadas_minutos),scheduled,'gp-green')}</td>
                <td>${metric(horas(p.horas_faltantes_minutos),'Carga prevista sem horas de agendamento vinculadas.',p.classificacao==='CRITICO'||p.classificacao==='ATENCAO'?'gp-amber':'')}</td>
                <td>${metric(percentual(cobertura),ajuda,'gp-purple')}${p.horas_excesso_minutos>0?`<small class="gp-shared">Excesso: ${escape(horas(p.horas_excesso_minutos))}</small>`:''}</td>
                <td><button type="button" class="gp-status gp-status-${escape(p.classificacao)}" data-help="Classificação pela regra central da Gestão, considerando cobertura e avanço do período. Não mede presença.">${escape(labels[p.classificacao]||'Sem classificação')}</button></td></tr>`;
        }).join(''):'<tr><td colspan="9" class="gd-empty">Não há planejamentos acadêmicos para este professor no período selecionado.</td></tr>';
        q('ucPageSummary').textContent=`${planos.length} planejamento(s) · Página ${state.ucPage} de ${paginas}`;
        q('ucPrev').disabled=state.ucPage<=1;q('ucNext').disabled=state.ucPage>=paginas;
    }
    function render(payload) {
        state.data=payload;
        const p=payload.professor,r=payload.resumo;
        q('profileClassification').value=p.classificacao_docente==null?'':String(Number(p.classificacao_docente));
        q('professorName').textContent=p.nome||'--';q('profileBreadcrumb').textContent=p.nome||'Professor';
        document.title=`${p.nome||'Professor'} — Gestão Docente`;
        GestaoDocente.avatar(q('professorAvatar'),p.nome,p.foto_url);
        q('professorUnits').textContent=p.unidades.map(u=>`${u.codigo_unidade}${u.nome_unidade?' — '+u.nome_unidade:''}`).join(' / ')||'--';
        q('professorLogin').textContent=p.matricula||p.login||'--';
        q('professorShift').textContent=String(p.turno_principal||'').split(',').map(v=>({manha:'Manhã',tarde:'Tarde',noite:'Noite'})[v.trim().toLowerCase()]||v.trim()).filter(Boolean).join(', ')||'--';
        q('professorWeekly').textContent=p.carga_horaria_semanal==null?'--':`${numero(Number(p.carga_horaria_semanal))}h`;
        const unidade=state.applied.get('unidade')||'';
        q('profileUnit').innerHTML='<option value="">Todas as unidades autorizadas</option>'+p.unidades.map(u=>`<option value="${escape(u.codigo_unidade)}">${escape(u.nome_unidade||u.codigo_unidade)}</option>`).join('');
        q('profileUnit').value=unidade;
        q('selectedPeriod').textContent=`Período aplicado: ${data(payload.periodo.inicio)} a ${data(payload.periodo.fim)}${unidade?' · Unidade '+unidade:''}`;
        q('updatedAt').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(payload.atualizado_em));
        q('profileExpected').textContent=horas(r.horas_previstas_minutos);
        q('profileScheduled').textContent=horas(r.horas_agendadas_minutos);
        q('profileMissing').textContent=horas(r.horas_faltantes_minutos);
        q('profileCoverage').textContent=percentual(r.cobertura_percentual);
        q('profilePlansCount').textContent=`${r.planejamentos_ativos} planejamento(s) ativo(s)`;
        q('profileExcess').textContent=r.horas_excesso_minutos>0?`${horas(r.horas_excesso_minutos)} em excesso`:'Agendadas / previstas';
        q('profileMissing').classList.toggle('gp-amber',payload.distribuicao.CRITICO>0||payload.distribuicao.ATENCAO>0);
        const d=payload.distribuicao_horas;
        q('ringExpected').textContent=horas(r.horas_previstas_minutos);q('ringScheduled').textContent=horas(d.agendadas);
        q('ringMissing').textContent=horas(d.faltantes);q('ringExcess').textContent=horas(d.excesso);
        q('profileRing').style.background=d.percentual_agendadas==null?'var(--gd-line)':`conic-gradient(var(--gd-green) 0% ${d.percentual_agendadas}%, var(--gd-amber) ${d.percentual_agendadas}% 100%)`;
        q('profileRing').setAttribute('aria-label',`${horas(r.horas_previstas_minutos)} previstas, ${horas(d.agendadas)} agendadas, ${horas(d.faltantes)} faltantes, ${horas(d.excesso)} em excesso.`);
        q('profileSituations').innerHTML=Object.entries(labels).map(([key,label])=>`<div><dt><i class="gpp-dot gpp-dot-${colors[key]||'neutral'}" aria-hidden="true"></i>${label}</dt><dd>${payload.distribuicao[key]||0}</dd></div>`).join('');
        q('profileLegacy').textContent=`${payload.legado.total} fato(s) marcado(s) como legado sem classificação acadêmica (${horas(payload.legado.minutos)}). Esses registros não são atribuídos automaticamente a uma UC. A listagem abaixo não permite determinar quais agendamentos originaram esses fatos.`;
        const h=payload.agendamentos;
        q('profileBookingRows').innerHTML=h.registros.length?h.registros.map(a=>`<tr><td>${data(a.data)}</td><td>${a.hora_inicio?escape(a.hora_inicio.slice(0,5)):'--'} – ${a.hora_fim?escape(a.hora_fim.slice(0,5)):'--'}</td><td>${escape(a.nome_sala||'--')}</td><td>--</td><td>--</td><td>${escape(a.motivo||'--')}</td><td>${metric(horas(a.duracao_minutos),'Diferença entre os horários registrados. Não usa blocos fixos por turno.')}</td></tr>`).join(''):'<tr><td colspan="7" class="gd-empty">Não há agendamentos registrados para este professor no período selecionado.</td></tr>';
        state.bookingPage=h.pagina;
        q('bookingPageSummary').textContent=`${h.total} registro(s) · Página ${h.pagina} de ${h.paginas}`;
        q('bookingPrev').disabled=h.pagina<=1;q('bookingNext').disabled=h.pagina>=h.paginas;
        renderUcs();
    }
    function erro(message) {q('profileError').textContent=message;q('profileError').classList.remove('is-hidden');}
    async function load() {
        const seq=++state.sequence;
        hideTooltip();q('profileContent').classList.add('is-hidden');q('profileError').classList.add('is-hidden');q('profileLoading').classList.remove('is-hidden');
        state.data=null;
        try {
            if(!/^\d+$/.test(id)||Number(id)<=0)throw new Error('Professor não encontrado.');
            const params=new URLSearchParams(state.applied);params.set('pagina_agendamentos',state.bookingPage);
            const result=await api(`/api/gestao-docente/professores/${encodeURIComponent(id)}?${params}`);
            if(seq!==state.sequence)return;
            render(result);q('profileContent').classList.remove('is-hidden');
        } catch(e) {if(seq===state.sequence)erro(e.message);}
        finally {if(seq===state.sequence)q('profileLoading').classList.add('is-hidden');}
    }
    function aplicar() {try{state.applied=parametros();state.bookingPage=1;state.ucPage=1;load();}catch(e){erro(e.message);}}
    document.addEventListener('DOMContentLoaded',async()=>{
        q('classificationForm').onsubmit=async event=>{
            event.preventDefault();
            const button=q('saveClassification'),select=q('profileClassification'),message=q('classificationMessage');
            if(button.disabled)return;
            button.disabled=true;select.disabled=true;message.textContent='Salvando...';
            try {
                const value=select.value===''?null:Number(select.value);
                const result=await api(`/api/gestao-docente/professores/${encodeURIComponent(id)}/classificacao-docente`,{
                    method:'PATCH',headers:{Accept:'application/json','Content-Type':'application/json'},
                    body:JSON.stringify({classificacao_docente:value})
                });
                if(state.data)state.data.professor.classificacao_docente=result.classificacao_docente;
                select.value=result.classificacao_docente==null?'':String(result.classificacao_docente);
                message.textContent='Classificação salva com sucesso.';
            } catch(error){message.textContent=error.message;}
            finally{button.disabled=false;select.disabled=false;}
        };
        const query=new URLSearchParams(location.search),mes=GestaoDocente.obterPeriodo('current-month');
        q('profileStart').value=query.get('data_inicio')||mes.inicio;q('profileEnd').value=query.get('data_fim')||mes.fim;
        if(query.get('data_inicio')&&query.get('data_fim'))q('profilePeriod').value='custom';
        if(query.get('unidade'))q('profileUnit').add(new Option(query.get('unidade'),query.get('unidade'),true,true));
        function dates(){const custom=q('profilePeriod').value==='custom';q('profileDates').classList.toggle('is-hidden',!custom);q('profileStart').required=custom;q('profileEnd').required=custom;}
        dates();q('profilePeriod').onchange=()=>{dates();if(q('profilePeriod').value!=='custom')aplicar();};
        q('profileFilters').onsubmit=e=>{e.preventDefault();aplicar();};q('profileUnit').onchange=aplicar;
        q('refreshButton').onclick=aplicar;q('menuToggle').onclick=()=>q('gdSidebar').classList.toggle('is-open');
        q('ucPrev').onclick=()=>{state.ucPage--;renderUcs();};q('ucNext').onclick=()=>{state.ucPage++;renderUcs();};
        q('bookingPrev').onclick=()=>{state.bookingPage--;load();};q('bookingNext').onclick=()=>{state.bookingPage++;load();};
        try {const user=await api('/user-info');GestaoDocente.aplicarUsuario(user);aplicar();}
        catch(e){q('profileLoading').classList.add('is-hidden');erro(e.message);}
    });
})();
