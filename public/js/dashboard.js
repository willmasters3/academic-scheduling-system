document.addEventListener('DOMContentLoaded', () => {
    const q = id => document.getElementById(id);
    const timeZone = 'America/Sao_Paulo';
    let nome = 'usuário';
    function updateClock() {
        const now = new Date();
        const hour = Number(new Intl.DateTimeFormat('pt-BR', {timeZone, hour:'2-digit', hourCycle:'h23'}).format(now));
        const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
        q('welcome-message').textContent = `${greeting}, ${nome}!`;
        q('current-date').textContent = new Intl.DateTimeFormat('pt-BR', {timeZone, weekday:'long', day:'2-digit', month:'long', year:'numeric'}).format(now);
        q('current-datetime').textContent = new Intl.DateTimeFormat('pt-BR', {timeZone, hour:'2-digit', minute:'2-digit'}).format(now);
        q('current-date').dateTime = now.toISOString();
        q('current-datetime').dateTime = now.toISOString();
    }
    async function loadUser() {
        try {
            const response = await fetch('/user-info', {cache:'no-store'});
            if (!response.ok) return;
            const user = await response.json();
            nome = user.nome || 'usuário';
            q('user-name').textContent = nome;
            q('user-role').textContent = {admin:'Administrador / TI', coordenador:'Coordenação', user:'Usuário'}[user.permissao] || '';
            const avatar = q('user-avatar');
            avatar.textContent = nome.trim().split(/\s+/).slice(0,2).map(part => part[0]).join('').toUpperCase();
            if (Array.isArray(user.unidades) && user.unidades.length) {
                q('user-units').textContent = user.unidades.join(' · ');
                q('unit-detail').hidden = false;
            }
            updateClock();
            // Existing session photo, with initials when the image is unavailable.
            if (user.foto_url) {
                const url = new URL(user.foto_url, location.origin);
                if (url.origin === location.origin && url.pathname.startsWith('/imagens/')) {
                    const img = new Image();
                    img.alt = '';
                    img.onload = () => avatar.replaceChildren(img);
                    img.src = url.href;
                }
            }
        } catch (error) { console.error('Erro ao buscar informações do usuário:', error); }
    }
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const cards = [...document.querySelectorAll('.card-container .card')];
    q('module-search').addEventListener('input', event => {
        const term = normalize(event.target.value.trim());
        cards.forEach(card => { card.hidden = !normalize(card.textContent).includes(term); });
        q('search-empty').hidden = cards.some(card => !card.hidden);
    });
    updateClock();
    setInterval(updateClock, 60000);
    loadUser();
});
