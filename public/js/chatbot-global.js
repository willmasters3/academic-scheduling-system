(function () {
    const STYLE_ID = 'chatbot-global-style';
    const LOGIC_SCRIPT_ID = 'chatbot-logic-script';

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const link = document.createElement('link');
        link.id = STYLE_ID;
        link.rel = 'stylesheet';
        link.href = '/css/chatbot-global.css';
        document.head.appendChild(link);
    }

    function ensureMarkup() {
        if (document.getElementById('chatButton') && document.getElementById('chatbot')) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = [
            '<button id="chatButton" class="chat-button" type="button" aria-label="Abrir chat">',
            '  <span class="chat-emoji" aria-hidden="true">💬</span>',
            '</button>',
            '<aside id="chatbot" class="chatbot-panel" aria-label="Chatbot" style="display: none;">',
            '  <div id="chat-header" class="chat-header">',
            '    <strong>Assistente IA</strong>',
            '    <button id="close-chat" class="chat-close" type="button" aria-label="Fechar chat">×</button>',
            '  </div>',
            '  <div id="chatContainer" class="chat-container" aria-live="polite"></div>',
            '  <div class="chat-input-wrap">',
            '    <input type="text" id="userInput" placeholder="Digite sua mensagem..." />',
            '    <button id="stopResponse" class="chat-stop-response" type="button" hidden>Parar</button>',
            '    <button id="sendMessage" type="button">Enviar</button>',
            '  </div>',
            '</aside>'
        ].join('');

        document.body.appendChild(wrapper);
    }

    function ensureSecurityUtils() {
        if (window.__securityUtilsLoaded) return;

        const script = document.createElement('script');
        script.src = '/js/security-utils.js';
        document.body.appendChild(script);
        window.__securityUtilsLoaded = true;
    }

    function ensureLogicScript() {
        if (document.getElementById(LOGIC_SCRIPT_ID)) return;

        const script = document.createElement('script');
        script.id = LOGIC_SCRIPT_ID;
        script.src = '/js/chatbot.js';
        document.body.appendChild(script);
    }

    function initGlobalChatbot() {
        ensureStyle();
        ensureMarkup();
        ensureSecurityUtils();
        ensureLogicScript();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalChatbot);
    } else {
        initGlobalChatbot();
    }
})();
