(function () {
    function isPublicPage() {
        const path = window.location.pathname.toLowerCase();
        return path === '/login'
            || path === '/agendamentos'
            || path === '/agendas-api'
            || path === '/info-computadores'
            || path.endsWith('/html/login.html')
            || path.endsWith('/html/agendamentos.html')
            || path.endsWith('/html/agendas-api.html')
            || path.endsWith('/html/infocomputadores.html')
            || path === '/' || path.endsWith('/index.html');
    }

    function injectStyles() {
        if (document.getElementById('global-logout-style')) return;

        const style = document.createElement('style');
        style.id = 'global-logout-style';
        style.textContent = "\n            .global-logout-btn {\n                border: none;\n                border-radius: 999px;\n                padding: 10px 14px;\n                font-size: 14px;\n                font-weight: 700;\n                font-family: 'Source Sans 3', 'Segoe UI', Tahoma, sans-serif;\n                cursor: pointer;\n                color: #fff;\n                background: linear-gradient(135deg, #ec5f56, #c23d34);\n                box-shadow: 0 10px 20px rgba(194, 61, 52, 0.28);\n                transition: transform .16s ease, box-shadow .16s ease;\n                white-space: nowrap;\n            }\n            .global-logout-btn:hover {\n                transform: translateY(-1px);\n                box-shadow: 0 14px 24px rgba(194, 61, 52, 0.34);\n            }\n            .global-logout-btn:disabled {\n                opacity: .8;\n                cursor: wait;\n            }\n            .global-logout-btn--floating {\n                position: fixed;\n                right: 18px;\n                bottom: 18px;\n                z-index: 9999;\n            }\n            .global-logout-btn--inline {\n                position: static;\n                z-index: auto;\n                padding: 9px 12px;\n                font-size: 13px;\n                box-shadow: 0 8px 18px rgba(194, 61, 52, 0.24);\n                margin-left: 2px;\n            }\n        ";
        document.head.appendChild(style);
    }

    function getInlineContainer() {
        return document.querySelector('[data-logout-container]')
            || document.querySelector('.header .text-right')
            || document.querySelector('.topbar-actions')
            || document.querySelector('.quick-links')
            || document.querySelector('.hero-side')
            || null;
    }

    async function handleLogout(btn) {
        if (!confirm('Deseja encerrar sua sessao?')) return;

        btn.disabled = true;
        btn.textContent = 'Saindo...';

        try {
            await fetch('/logout', { method: 'POST' });
        } catch (e) {
            console.error('Erro ao sair:', e);
        }

        window.location.href = '/login';
    }

    function createButton(extraClass) {
        const btn = document.createElement('button');
        btn.id = 'global-logout-btn';
        btn.className = `global-logout-btn ${extraClass}`;
        btn.type = 'button';
        btn.textContent = 'Sair do sistema';
        btn.addEventListener('click', function () {
            handleLogout(btn);
        });
        return btn;
    }

    function injectButton() {
        if (document.getElementById('global-logout-btn')) return;

        const inlineContainer = getInlineContainer();
        if (inlineContainer) {
            const btn = createButton('global-logout-btn--inline');
            inlineContainer.appendChild(btn);
            return;
        }

        const btn = createButton('global-logout-btn--floating');
        document.body.appendChild(btn);
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (isPublicPage()) return;
        injectStyles();
        injectButton();
    });
})();
