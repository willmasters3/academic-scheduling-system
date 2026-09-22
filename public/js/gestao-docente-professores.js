(function () {
    'use strict';
    const q = id => document.getElementById(id);
    const labels = {CRITICO:'Crítico',ATENCAO:'Atenção',ADEQUADO:'Adequado',COM_EXCESSO:'Com excesso'};
    const state = {filters:null,applied:null,page:1,size:25,sort:'nome',direction:'asc',sequence:0};
    const number = value => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
    const hours = minutes => `${number(minutes/60)}h`;
    const percent = value => value == null ? '--' : `${number(value)}%`;
    const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const metric = (value, help, className='') => `<button type="button" class="gp-metric ${className}" data-help="${escape(help)}">${escape(value)}</button>`;

    async function api(url) {
        const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
        if (response.status===401) { location.href='/login'; throw new Error('Sessão expirada.'); }
        const body=await response.json().catch(()=>({}));
        if (!response.ok) throw new Error(body.error||'Não foi possível carregar os professores.');
        return body;
    }
    function courses() {
        const value=q('filterCourse').value, unit=q('filterUnit').value;
        q('filterCourse').innerHTML='<option value="">Todos os cursos</option>'+(state.filters?.cursos||[])
            .filter(c=>!unit||String(c.codigo_unidade)===unit)
            .map(c=>`<option value="${Number(c.id_curso)}">${escape(c.nome_curso)}</option>`).join('');
        if ([...q('filterCourse').options].some(o=>o.value===value)) q('filterCourse').value=value;
    }
    function captureFilters() {
        const period=q('filterPeriod').value==='custom'
            ? {inicio:q('filterStart').value,fim:q('filterEnd').value}
            : GestaoDocente.obterPeriodo(q('filterPeriod').value);
        if (!period.inicio||!period.fim||period.fim<period.inicio) throw new Error('Informe um período válido.');
        const params=new URLSearchParams({data_inicio:period.inicio,data_fim:period.fim});
        for (const [id,key] of [['filterUnit','unidade'],['filterName','busca'],['filterShift','turno'],['filterCourse','curso'],['filterStatus','situacao']]) {
            if (q(id).value) params.set(key,q(id).value);
        }
        params.set('somente_professores',q('filterOnlyTeachers').checked?'1':'0');
        return params;
    }
    function render(data) {
        const r=data.resumo;
        q('kpiTotal').textContent=number(r.total_professores);
        q('kpiExpected').textContent=hours(r.previsto);
        q('kpiScheduled').textContent=hours(r.agendado);
        q('kpiMissing').textContent=hours(r.faltante);
        q('kpiCoverage').textContent=percent(r.cobertura);
        q('excessTotal').textContent=r.excesso>0?`${hours(r.excesso)} em excesso`:r.previsto>0?'Sobre a carga prevista':'Sem carga prevista';
        q('excessTotal').dataset.help='Horas agendadas acima da carga prevista, apuradas por planejamento.';
        q('excessTotal').tabIndex=0;
        q('updatedAt').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(data.atualizado_em));
        q('professorRows').innerHTML=data.professores.length?data.professores.map(p=>{
            const situacoes=Object.entries(p.situacoes);
            const atenção=situacoes.some(([key])=>key==='CRITICO'||key==='ATENCAO');
            const turnos=String(p.turno_principal||'').split(',').map(t=>({manha:'Manhã',tarde:'Tarde',noite:'Noite'})[t.trim().toLowerCase()]||t.trim()).filter(Boolean).join(', ')||'--';
            const hint=p.previsto>0 && p.agendado===0 ? `Este professor possui ${hours(p.previsto)} previstas e ainda não possui horas agendadas vinculadas aos planejamentos deste período.` : 'Carga dos planejamentos vinculados ao docente. Obrigações compartilhadas não representam uma carga extra por professor.';
            const cobertura=p.cobertura==null?'Sem carga prevista aplicável.':p.cobertura>100?'Há horas agendadas acima da carga prevista para o período selecionado.':'Percentual da carga prevista que possui horas agendadas para este docente.';
            const perfilParams = new URLSearchParams();
            for (const key of ['data_inicio','data_fim','unidade']) if (state.applied?.get(key)) perfilParams.set(key,state.applied.get(key));
            const perfilHref = `/gestao-docente/professores/${Number(p.id_professor)}?${perfilParams}`;
            return `<tr><th scope="row"><a class="gp-person gp-profile-link" data-perfil href="${escape(perfilHref)}"><span class="gd-avatar" data-avatar="${Number(p.id_professor)}" aria-hidden="true"></span><span class="gp-person-name">${escape(p.nome||'--')}<small>${escape(p.matricula||p.login||'--')}</small></span></a></th>
                <td>${escape(p.unidades.join(', ')||'--')}</td><td>${escape(turnos)}</td>
                <td>${metric(p.carga_horaria_semanal==null?'--':`${number(Number(p.carga_horaria_semanal))}h`,'Jornada semanal contratual cadastrada. Não é soma das cargas de UCs.')}</td>
                <td>${metric(hours(p.previsto),hint,'gp-blue')}${p.compartilhados?`<small class="gp-shared">${p.compartilhados} compartilhado(s)</small>`:''}</td>
                <td>${metric(hours(p.agendado),'Soma dos fatos de agendamento ativos deste docente, no período, vinculados aos planejamentos. Não mede presença ou aulas executadas.','gp-green')}</td>
                <td>${metric(hours(p.faltante),'Saldo positivo por planejamento entre carga prevista e horas agendadas deste docente.',atenção?'gp-amber':'')}</td>
                <td>${metric(percent(p.cobertura),cobertura,'gp-purple')}<span class="gd-progress gp-progress" tabindex="0" role="img" aria-label="${escape(percent(p.cobertura))}" data-help="${escape(cobertura)}"><i style="width:${Math.min(100,Math.max(0,p.cobertura||0))}%"></i></span>${p.excesso>0?metric(`+${hours(p.excesso)}`, 'Horas agendadas acima da carga prevista.','gp-purple'):''}</td>
                <td><div class="gp-statuses">${situacoes.length?situacoes.map(([key,count])=>`<button type="button" class="gp-status gp-status-${key}" data-help="${escape(`${count} planejamento(s) ${labels[key]}. Classificação da obrigação completa pela regra da Visão Geral, considerando cobertura e período.`)}">${escape(labels[key])} · ${count}</button>`).join(''):'<span class="gp-no-plan">Sem planejamento</span>'}</div></td>
                <td><a class="gd-button gd-button-outline gp-profile-link" data-perfil href="${escape(perfilHref)}">Ver perfil</a></td></tr>`;
        }).join(''):'<tr><td colspan="10" class="gd-empty">Nenhum professor encontrado para os filtros aplicados.</td></tr>';
        for (const p of data.professores) GestaoDocente.avatar(document.querySelector(`[data-avatar="${Number(p.id_professor)}"]`),p.nome,p.foto_url);
        state.page=data.pagina;
        q('resultCount').textContent=`${number(data.total)} professor(es)`;
        const first=data.total?(data.pagina-1)*data.por_pagina+1:0, last=Math.min(data.pagina*data.por_pagina,data.total);
        q('pageSummary').textContent=`Mostrando ${first} a ${last} de ${number(data.total)}`;
        q('pageNumber').textContent=`${data.pagina} / ${data.paginas}`;
        q('prevPage').disabled=data.pagina<=1; q('nextPage').disabled=data.pagina>=data.paginas;
        document.querySelectorAll('[data-sort]').forEach(b=>b.closest('th').setAttribute('aria-sort',b.dataset.sort===state.sort?(state.direction==='asc'?'ascending':'descending'):'none'));
    }
    function error(message) {
        q('screenMessage').textContent=message;q('screenMessage').classList.remove('is-hidden');
    }
    async function load() {
        const seq=++state.sequence;
        hideTooltip();
        q('screenMessage').classList.add('is-hidden');q('loadingState').classList.remove('is-hidden');
        q('professoresContent').classList.add('is-hidden');
        q('professorKpis').setAttribute('aria-busy','true');
        ['kpiTotal','kpiExpected','kpiScheduled','kpiMissing','kpiCoverage'].forEach(id=>q(id).textContent='--');
        q('excessTotal').textContent='Carregando...';
        q('prevPage').disabled=true;q('nextPage').disabled=true;
        try {
            const params=new URLSearchParams(state.applied);
            params.set('pagina',state.page);params.set('por_pagina',state.size);params.set('ordenacao',state.sort);params.set('direcao',state.direction);
            const data=await api(`/api/gestao-docente/professores?${params}`);
            if (seq!==state.sequence) return;
            render(data);q('professoresContent').classList.remove('is-hidden');
        } catch (e) { if(seq===state.sequence) {error(e.message);q('excessTotal').textContent='Dados indisponíveis';} }
        finally {if(seq===state.sequence){q('loadingState').classList.add('is-hidden');q('professorKpis').removeAttribute('aria-busy');}}
    }
    const {hideTooltip} = GestaoDocente.inicializarTooltips();
    function guardarRetorno(e) {
        if (!e.target.closest('[data-perfil]')) return;
        const campos={};
        for (const [id,key] of [['filterUnit','unidade'],['filterName','busca'],['filterShift','turno'],['filterCourse','curso'],['filterStatus','situacao'],['filterStart','data_inicio'],['filterEnd','data_fim']]) campos[id]=state.applied.get(key)||'';
        campos.filterPeriod='custom';
        const somenteProfessores=state.applied.get('somente_professores')!=='0';
        try {sessionStorage.setItem('gd-professores-filtros',JSON.stringify({campos,somenteProfessores,page:state.page,size:state.size,sort:state.sort,direction:state.direction}));} catch (_) {}
    }
    document.addEventListener('click',guardarRetorno);
    document.addEventListener('auxclick',guardarRetorno);
    document.addEventListener('DOMContentLoaded',async()=>{
        document.querySelectorAll('#professorKpis .gd-kpi').forEach(card=>{
            const value=card.querySelector('strong');
            value.dataset.help=card.querySelector('[data-help]').dataset.help;
            value.tabIndex=0;
        });
        const period=GestaoDocente.obterPeriodo('current-month');q('filterStart').value=period.inicio;q('filterEnd').value=period.fim;
        q('menuToggle').onclick=()=>q('gdSidebar').classList.toggle('is-open');
        q('filterUnit').onchange=courses;
        q('filterPeriod').onchange=()=>{const custom=q('filterPeriod').value==='custom';q('customDates').classList.toggle('is-hidden',!custom);q('filterStart').required=custom;q('filterEnd').required=custom;};
        q('professorFilters').onsubmit=e=>{e.preventDefault();try{state.applied=captureFilters();state.page=1;load();}catch(e){error(e.message);}};
        q('refreshButton').onclick=()=>{if(state.applied)load();};
        q('clearFilters').onclick=()=>{q('professorFilters').reset();q('filterPeriod').onchange();courses();state.page=1;state.applied=captureFilters();load();};
        q('pageSize').onchange=()=>{state.size=Number(q('pageSize').value);state.page=1;load();};
        q('prevPage').onclick=()=>{state.page--;load();};q('nextPage').onclick=()=>{state.page++;load();};
        document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{state.direction=state.sort===b.dataset.sort&&state.direction==='asc'?'desc':'asc';state.sort=b.dataset.sort;state.page=1;load();});
        try {
            const [user,filters]=await Promise.all([api('/user-info'),api('/api/gestao-docente/filtros?tela=professores')]);
            GestaoDocente.aplicarUsuario(user);state.filters=filters;
            q('filterUnit').innerHTML='<option value="">Todas as unidades</option>'+filters.unidades.map(u=>`<option value="${escape(u.codigo_unidade)}">${escape(u.nome_unidade)} — ${escape(u.codigo_unidade)}</option>`).join('');
            if (!filters.suporta_turno) {q('turnoFilter').classList.add('is-hidden');q('filterShift').disabled=true;}
            courses();
            if (new URLSearchParams(location.search).get('restaurar')==='1') {
                try {
                    const saved=JSON.parse(sessionStorage.getItem('gd-professores-filtros')||'null');
                    if (saved) {
                        q('filterOnlyTeachers').checked=saved.somenteProfessores!==false;
                        for (const [id,value] of Object.entries(saved.campos||{})) if (q(id)) q(id).value=value;
                        courses();q('filterCourse').value=saved.campos.filterCourse||'';
                        q('filterPeriod').onchange();
                        state.page=saved.page;state.size=saved.size;state.sort=saved.sort;state.direction=saved.direction;
                        q('pageSize').value=state.size;
                    }
                } catch (_) { /* Storage is optional; retain the default filters. */ }
            }
            state.applied=captureFilters();await load();
        } catch(e) {q('loadingState').classList.add('is-hidden');error(e.message);}
    });
})();
