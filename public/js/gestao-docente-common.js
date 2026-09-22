/* Shared shell, dates and cadastro photo rendering for Gestao Docente. */
window.GestaoDocente = (() => {
    const sidebar = `        <aside class="gd-sidebar" id="gdSidebar">
            <div class="gd-brand">
                <strong>Demo</strong>
                <span>Sistema de Agendamentos</span>
            </div>
            <div class="gd-nav-label">Gestão Docente</div>
            <nav class="gd-nav" aria-label="Navegação da Gestão Docente">
                <a class="gd-nav-item is-active" href="/gestao-docente" aria-current="page">
                    <i class="fas fa-chart-line"></i><span>Visão Geral</span>
                </a>
                <a class="gd-nav-item" href="/gestao-docente/professores"><i class="far fa-user"></i><span>Professores</span></a>
                <span class="gd-nav-item is-disabled" aria-disabled="true" title="Disponível em uma próxima etapa">
                    <i class="fas fa-book-open"></i><span>Planejamentos</span>
                </span>
                <span class="gd-nav-sub is-disabled">Cursos / UCs</span>
                <span class="gd-nav-sub is-disabled">Turmas</span>
                <span class="gd-nav-item is-disabled" aria-disabled="true" title="Disponível em uma próxima etapa">
                    <i class="far fa-clock"></i><span>Histórico / Ocorrências</span>
                </span>
            </nav>
            <div class="gd-sidebar-footer">
                <a id="backDashboard" class="gd-nav-item" href="/dashboard">
                    <i class="fas fa-arrow-left"></i><span>Voltar ao Dashboard</span>
                </a>
            </div>
        </aside>`;
    const header = `            <header class="gd-topbar">
                <button id="menuToggle" class="gd-icon-button gd-menu-toggle" type="button" aria-label="Abrir menu">
                    <i class="fas fa-bars"></i>
                </button>
                <div class="gd-heading">
                    <div class="gd-breadcrumb"><i class="fas fa-home"></i><span>Gestão Docente</span><i class="fas fa-chevron-right"></i><strong>Visão Geral</strong></div>
                    <h1>Gestão Docente</h1>
                    <p>Acompanhamento de carga prevista, horas registradas e cobertura dos planejamentos acadêmicos.</p>
                </div>
                <div class="gd-user-area">
                    <div class="gd-updated">Última atualização: <strong id="updatedAt">—</strong></div>
                    <button id="refreshButton" class="gd-button gd-button-outline" type="button"><i class="fas fa-rotate"></i> Atualizar</button>
                    <div class="gd-user">
                        <span class="gd-avatar"><i class="fas fa-user"></i></span>
                        <span><strong id="userName">Usuário</strong><small id="userRole">—</small></span>
                    </div>
                </div>
            </header>`;
    document.getElementById('gdSidebarMount').outerHTML = sidebar;
    document.getElementById('gdHeaderMount').outerHTML = header;
    const paginaPerfil = /^\/gestao-docente\/professores\/[^/]+\/?$/.test(location.pathname);
    const paginaProfessores = location.pathname === '/gestao-docente/professores';
    document.querySelectorAll('.gd-nav a[href^="/gestao-docente"]').forEach(a => {
        const active = a.getAttribute('href') === location.pathname || (paginaPerfil && a.getAttribute('href') === '/gestao-docente/professores');
        a.classList.toggle('is-active', active);
        active ? a.setAttribute('aria-current','page') : a.removeAttribute('aria-current');
    });
    if (paginaProfessores) {
        document.querySelector('.gd-heading h1').textContent = 'Professores';
        document.querySelector('.gd-breadcrumb strong').textContent = 'Professores';
        document.querySelector('.gd-heading p').textContent = 'Vis\u00e3o geral da carga prevista, agendamentos e cobertura por docente.';
    }
    if (paginaPerfil) {
        document.querySelector('.gd-heading h1').textContent='Perfil do Professor';
        document.querySelector('.gd-heading p').textContent='Vis\u00e3o individual da carga prevista, agendamentos e planejamentos acad\u00eamicos.';
        document.querySelector('.gd-breadcrumb').innerHTML='<a href="/gestao-docente">Gest\u00e3o Docente</a><i class="fas fa-chevron-right"></i><a href="/gestao-docente/professores?restaurar=1">Professores</a><i class="fas fa-chevron-right"></i><strong id="profileBreadcrumb">Professor</strong>';
    }
    function avatar(element, nome, foto) {
        element.replaceChildren();
        element.textContent = String(nome||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase() || '?';
        const valor=String(foto||'').trim();
        if (!valor) return;
        // Existing cadastro stores /imagens/filename. Never fetch another origin.
        const normalized=valor.startsWith('/')?valor:'/'+valor;
        let url;
        try { url=new URL(normalized, location.origin); } catch (_) { return; }
        if (url.origin!==location.origin || !url.pathname.startsWith('/imagens/')) return;
        const img=document.createElement('img'); img.alt='';
        img.onload=()=>element.replaceChildren(img);
        img.onerror=()=>img.remove();
        img.src=url.href;
    }
    function aplicarUsuario(user) {
        document.getElementById('userName').textContent=user.nome||'Usu\u00e1rio';
        document.getElementById('userRole').textContent=({admin:'Administrador / TI',coordenador:'Coordena\u00e7\u00e3o',user:'Professor'})[user.permissao]||'--';
        document.getElementById('backDashboard').href=user.permissao==='admin'?'/dashboard':'/dashboard-coordenador';
        avatar(document.querySelector('.gd-user .gd-avatar'),user.nome,user.foto_url);
    }
    function isoLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function obterPeriodo(tipo) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (tipo === 'current-week' || tipo === 'next-week') {
            const dia = hoje.getDay() || 7;
            const inicio = new Date(hoje);
            inicio.setDate(hoje.getDate() - dia + 1 + (tipo === 'next-week' ? 7 : 0));
            const fim = new Date(inicio);
            fim.setDate(inicio.getDate() + 6);
            return { inicio: isoLocal(inicio), fim: isoLocal(fim) };
        }
        const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        return { inicio: isoLocal(inicio), fim: isoLocal(fim) };
    }

    function inicializarTooltips() {
        const q=id=>document.getElementById(id);
    let tooltipTarget=null;
    function hideTooltip() { tooltipTarget?.removeAttribute('aria-describedby');tooltipTarget=null;q('metricTooltip').classList.add('is-hidden'); }
    function showTooltip(target) {
        if (!target) return;
        hideTooltip();tooltipTarget=target;
        const tip=q('metricTooltip');tip.textContent=target.dataset.help;tip.classList.remove('is-hidden');target.setAttribute('aria-describedby','metricTooltip');
        const rect=target.getBoundingClientRect();
        tip.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-tip.offsetWidth-8))}px`;
        tip.style.top=`${Math.max(8,rect.bottom+8+tip.offsetHeight>innerHeight?rect.top-tip.offsetHeight-8:rect.bottom+8)}px`;
    }
    document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-help]');if(t)showTooltip(t);});
    document.addEventListener('mouseout',e=>{if(e.target.closest('[data-help]')&&!e.target.closest('[data-help]').contains(e.relatedTarget))hideTooltip();});
    document.addEventListener('focusin',e=>showTooltip(e.target.closest('[data-help]')));
    document.addEventListener('focusout',hideTooltip);
    document.addEventListener('click',e=>{const t=e.target.closest('[data-help]');t?showTooltip(t):hideTooltip();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTooltip();});
    window.addEventListener('resize',hideTooltip);document.addEventListener('scroll',hideTooltip,true);
        return {hideTooltip};
    }
    return {avatar,aplicarUsuario,obterPeriodo,inicializarTooltips};
})();
