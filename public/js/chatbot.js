function initializeChatbot() {
    if (window.__chatbotInitialized) {
        return;
    }

    window.__chatbotInitialized = true;

    // Atenção: O HTML tem dois elementos com id="chatContainer".
    // Certifique-se de que o JS está referenciando o correto.
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendMessageButton = document.getElementById('sendMessage');
    const stopResponseButton = document.getElementById('stopResponse');
    const chatbot = document.getElementById('chatbot'); // O container do widget

    if (!chatContainer || !userInput || !sendMessageButton || !chatbot) {
        return;
    }

    let welcomeShown = false;
    let userContext = null;
    let userContextLoaded = false;
    let userContextPromise = null;
    let trocaStreamInicializado = false;
    let trocaEventSource = null;
    let ultimaAssinaturaAvisoTrocaNoChat = '';
    let activeTyping = null;

    let currentStep = 'greeting'; // Controla o fluxo (greeting, askUnit, askRoom)
    let selectedUnit = null; 
    let selectedRoom = null; 

    function obterSaudacao() {
        const horaAtual = new Date().getHours();
        if (horaAtual < 12) return 'Bom dia!';
        if (horaAtual < 18) return 'Boa tarde!';
        return 'Boa noite!';
    }

    function getPrimeiroNome(nomeCompleto) {
        const nome = String(nomeCompleto || '').trim();
        if (!nome) return null;
        return nome.split(/\s+/)[0];
    }

    async function carregarContextoUsuario() {
        if (userContextLoaded) {
            return userContext;
        }

        if (!userContextPromise) {
            userContextPromise = fetch('/user-info', { cache: 'no-store' })
                .then(async (response) => {
                    if (!response.ok) {
                        return null;
                    }

                    return response.json();
                })
                .catch(() => null)
                .then((data) => {
                    userContextLoaded = true;
                    userContext = data;
                    return data;
                });
        }

        return userContextPromise;
    }

    function montarMensagemBoasVindas() {
        const nome = getPrimeiroNome(userContext?.nome);
        const permissoes = String(userContext?.permissao || '').trim();
        const unidades = Array.isArray(userContext?.unidades) ? userContext.unidades : [];

        if (nome) {
            const detalhes = [permissoes ? `perfil ${permissoes}` : null, unidades.length ? `${unidades.length} unidade(s)` : null]
                .filter(Boolean)
                .join(' • ');

            return detalhes
                ? `${obterSaudacao()} ${nome}. Você está logado${detalhes ? ` com ${detalhes}` : ''}. Posso te ajudar com seus agendamentos, unidades e troca de sala.`
                : `${obterSaudacao()} ${nome}. Você está logado. Posso te ajudar com seus agendamentos, unidades e troca de sala.`;
        }

        return `${obterSaudacao()} Eu sou o seu assistente. Digite 'iniciar' para buscar salas ou faça uma pergunta livre.`;
    }

    function montarDicaContextual() {
        if (!userContext?.nome) {
            return 'Dica: sem login eu posso conversar e consultar unidades, salas e agendamentos já disponíveis publicamente.';
        }

        return 'Dica rápida: você pode pedir "minhas unidades", "listar unidades" ou falar sobre troca de sala.';
    }

    function getPageContext() {
        const unitSelect = document.getElementById('unidadeSelect');
        const selectedUnit = String(unitSelect?.value || '').trim() || null;
        return {
            path: window.location.pathname,
            title: document.title,
            section: document.querySelector('.main-content h1, .header h1, main h1')?.textContent || null,
            selectedUnit
        };
    }

    function isDashboardPage() {
        return /dashboardagenda|agendasala|dashboard/i.test(window.location.pathname);
    }

    function isSwapPage() {
        return /dashboardagenda|agendasala/i.test(window.location.pathname);
    }

    function getDashboardTrocaUrl() {
        const basePath = '/dashboard-professor';
        return `${basePath}?chat=troca-sala`;
    }

    function abrirTrocaSalaNoDashboard() {
        const secaoTroca = document.getElementById('secaoTrocaSalaContainer');
        const botaoTroca = document.getElementById('mostrarTrocaSalaBtn');

        if (secaoTroca) {
            const estaVisivel = secaoTroca.classList.contains('visivel') && getComputedStyle(secaoTroca).display !== 'none';
            if (!estaVisivel && botaoTroca) {
                botaoTroca.click();
                return true;
            }

            secaoTroca.classList.add('visivel');
            secaoTroca.style.display = 'block';
            return true;
        }

        if (botaoTroca) {
            botaoTroca.click();
            return true;
        }

        return false;
    }

    function registrarAcaoTrocaSalaPendente() {
        try {
            localStorage.setItem('chatbot-pending-action', 'troca-sala');
        } catch (_) {}
    }

    function consumirAcaoTrocaSalaPendente() {
        try {
            const pendingAction = localStorage.getItem('chatbot-pending-action');
            if (pendingAction === 'troca-sala') {
                localStorage.removeItem('chatbot-pending-action');
                return pendingAction;
            }
        } catch (_) {}

        return null;
    }

    function getChatButton() {
        return document.getElementById('chatButton');
    }

    function getOrCreateChatBadge() {
        const chatButton = getChatButton();
        if (!chatButton) {
            return null;
        }

        let badge = document.getElementById('chatPendingBadge');
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'chatPendingBadge';
            badge.className = 'chat-notification-badge hidden';
            chatButton.appendChild(badge);
        }

        return badge;
    }

    function atualizarBadgeIconeChat(quantidadePendentes) {
        const chatButton = getChatButton();
        const badge = getOrCreateChatBadge();
        if (!chatButton || !badge) {
            return;
        }

        if (quantidadePendentes > 0) {
            badge.textContent = quantidadePendentes > 99 ? '99+' : String(quantidadePendentes);
            badge.classList.remove('hidden');
            chatButton.classList.add('has-alert');
        } else {
            badge.classList.add('hidden');
            chatButton.classList.remove('has-alert');
        }
    }

    window.__atualizarBadgeChatTrocaSala = atualizarBadgeIconeChat;

    function sincronizarBadgeComEstadoGlobalTroca() {
        const quantidade = Number(window.__trocaSalaPendentesCount);
        if (Number.isFinite(quantidade) && quantidade >= 0) {
            atualizarBadgeIconeChat(quantidade);
        }
    }

    window.addEventListener('troca-sala:pendentes', (event) => {
        const quantidade = Number(event?.detail?.quantidadePendentes);
        if (Number.isFinite(quantidade) && quantidade >= 0) {
            atualizarBadgeIconeChat(quantidade);
        }
    });

    function notificarTrocaTempoRealNoChat(texto) {
        const mensagem = String(texto || '').trim();
        if (!mensagem || chatbot.style.display !== 'flex') {
            return;
        }

        addMessage(mensagem, 'chatbot');
    }

    async function buscarTrocasEnviadas() {
        if (!userContext?.nome) {
            return [];
        }

        try {
            const response = await fetch('/troca-sala/enviadas', { cache: 'no-store' });
            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            if (Array.isArray(data)) {
                return data;
            }

            return Array.isArray(data?.items) ? data.items : [];
        } catch (_) {
            return [];
        }
    }

    async function obterNomeDestinoDaUltimaSolicitacao() {
        const enviadas = await buscarTrocasEnviadas();
        if (!enviadas.length) {
            return '';
        }

        const maisRecentePendente = enviadas.find((item) => String(item.status || '').toUpperCase() === 'PENDENTE');
        const alvo = maisRecentePendente || enviadas[0];
        return String(alvo?.professor_destino_nome || '').trim();
    }

    async function sincronizarBadgeTrocaSala() {
        const pendentes = await buscarTrocasRecebidasPendentes();
        atualizarBadgeIconeChat(pendentes.length);
        return pendentes;
    }

    async function sincronizarBadgeEAvisoTrocaSala() {
        const pendentes = await sincronizarBadgeTrocaSala();

        if (chatbot.style.display === 'flex' && pendentes.length) {
            await sincronizarAvisoTrocaAoAbrirChat();
        }

        return pendentes;
    }

    async function montarMensagemEventoTroca(payload) {
        const idUsuario = Number(userContext?.id_professor || 0);
        const evento = String(payload?.evento || '').trim().toLowerCase();
        const status = String(payload?.status || '').trim().toUpperCase();
        const idOrigem = Number(payload?.id_professor_origem || 0);
        const idDestino = Number(payload?.id_professor_destino || 0);

        if (evento === 'solicitacao-criada') {
            if (idDestino && idDestino === idUsuario) {
                return 'Nova solicitação de troca de sala recebida. Quando quiser, abra "Troca de sala" para responder.';
            }
            if (idOrigem && idOrigem === idUsuario) {
                const nomeDestino = await obterNomeDestinoDaUltimaSolicitacao();
                return nomeDestino
                    ? `Sua solicitação de troca de sala foi enviada para ${nomeDestino}.`
                    : 'Sua solicitação de troca de sala foi enviada e está aguardando resposta.';
            }
        }

        if (evento === 'solicitacao-atualizada') {
            if (status === 'ACEITA') {
                if (idOrigem && idOrigem === idUsuario) {
                    return 'Sua solicitação de troca de sala foi aceita.';
                }
                if (idDestino && idDestino === idUsuario) {
                    return 'Troca de sala aceita. A solicitação foi concluída com sucesso.';
                }
                return 'Uma solicitação de troca de sala foi aceita.';
            }

            if (status === 'RECUSADA') {
                if (idOrigem && idOrigem === idUsuario) {
                    return 'Sua solicitação de troca de sala foi recusada.';
                }
                if (idDestino && idDestino === idUsuario) {
                    return 'Troca de sala recusada.';
                }
                return 'Uma solicitação de troca de sala foi recusada.';
            }
        }

        return '';
    }

    function encerrarMonitoramentoTrocaTempoReal() {
        if (trocaEventSource) {
            try {
                trocaEventSource.close();
            } catch (_) {}
        }

        trocaEventSource = null;
        trocaStreamInicializado = false;
    }

    async function inicializarBadgeTrocaSalaAoCarregar() {
        await carregarContextoUsuario();
        if (!userContext?.nome) {
            atualizarBadgeIconeChat(0);
            return;
        }

        await sincronizarBadgeTrocaSala();
    }

    async function inicializarMonitoramentoTrocaTempoReal() {
        if (trocaStreamInicializado || !userContext?.nome) {
            return;
        }

        trocaStreamInicializado = true;
        await sincronizarBadgeEAvisoTrocaSala();

        try {
            trocaEventSource = new EventSource('/troca-sala/stream');
        } catch (_) {
            trocaStreamInicializado = false;
            return;
        }

        trocaEventSource.addEventListener('connected', async () => {
            await sincronizarBadgeEAvisoTrocaSala();
        });

        trocaEventSource.addEventListener('troca-sala', async (event) => {
            let payload = {};
            try {
                payload = event?.data ? JSON.parse(event.data) : {};
            } catch (_) {
                payload = {};
            }

            const mensagem = await montarMensagemEventoTroca(payload);
            if (mensagem) {
                notificarTrocaTempoRealNoChat(mensagem);
            }

            await sincronizarBadgeEAvisoTrocaSala();
        });
    }

    async function buscarTrocasRecebidasPendentes() {
        if (!userContext?.nome) {
            return [];
        }

        try {
            const response = await fetch('/troca-sala/recebidas', { cache: 'no-store' });
            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            const items = Array.isArray(data)
                ? data
                : (Array.isArray(data?.items) ? data.items : []);

            return items
                ? items.filter((item) => String(item.status || '').toUpperCase() === 'PENDENTE')
                : [];
        } catch (_) {
            return [];
        }
    }

    function gerarAssinaturaTrocasPendentes(solicitacoes) {
        return (solicitacoes || [])
            .map((item) => `${item.id_solicitacao}:${item.created_at || ''}`)
            .sort()
            .join('|');
    }

    function aguardarRenderizacaoChat() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(() => resolve());
        });
    }

    async function exibirAvisoTrocaSalaPendente() {
        const pendentes = await buscarTrocasRecebidasPendentes();
        if (!pendentes.length) {
            ultimaAssinaturaAvisoTrocaNoChat = '';
            return false;
        }

        const assinaturaAtual = gerarAssinaturaTrocasPendentes(pendentes);
        if (assinaturaAtual && assinaturaAtual === ultimaAssinaturaAvisoTrocaNoChat) {
            return false;
        }

        ultimaAssinaturaAvisoTrocaNoChat = assinaturaAtual;

        const quantidade = pendentes.length;
        const primeira = pendentes[0];
        const nomeOrigem = String(primeira?.professor_origem_nome || '').trim();
        const textoPrincipal = quantidade === 1
            ? `Você tem 1 troca de sala pendente. ${nomeOrigem ? `${nomeOrigem} pediu troca de sala com você.` : 'Há uma solicitação esperando sua resposta.'}`
            : `Você tem ${quantidade} trocas de sala pendentes. Há solicitações esperando sua resposta.`;

        await typeMessage(textoPrincipal, 'chatbot');

        const avisoId = `aviso-troca-sala-${Date.now()}`;
        const html = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                <div>
                    Clique no botão abaixo para abrir a seção de Troca de Sala e resolver agora.
                </div>
                <button type="button" id="${avisoId}" style="align-self:flex-start; padding:8px 12px; border:0; border-radius:8px; background:#0b5ed7; color:#fff; font-weight:600; cursor:pointer; box-shadow:0 1px 4px rgba(11, 94, 215, 0.25);">
                    Abrir troca de sala
                </button>
            </div>
        `;

        addMessage(html, 'chatbot', true);

        setTimeout(() => {
            const botao = document.getElementById(avisoId);
            if (!botao) {
                return;
            }

            botao.addEventListener('click', () => {
                const abriu = abrirTrocaSalaNoDashboard();
                if (!abriu && !isSwapPage()) {
                    window.location.href = getDashboardTrocaUrl();
                }
            });
        }, 0);

        return true;
    }

    async function sincronizarAvisoTrocaAoAbrirChat() {
        if (!userContext?.nome || chatbot.style.display !== 'flex') {
            return false;
        }

        await aguardarRenderizacaoChat();
        return exibirAvisoTrocaSalaPendente();
    }

    async function processarAcaoTrocaSala() {
        if (!userContext?.nome) {
            return;
        }

        const mostrouAvisoPendente = await exibirAvisoTrocaSalaPendente();
        if (mostrouAvisoPendente) {
            return;
        }

        if (isSwapPage()) {
            abrirTrocaSalaNoDashboard();
        }

        addMessage('Troca de sala', 'user');
        await handleInputAndRoute('troca de sala', { typeReply: true });
    }

    function buildQuickActions() {
        if (!userContext?.nome) {
            return [];
        }

        const actions = [
            { label: 'Minhas unidades', message: 'minhas unidades' },
            { label: 'Troca de sala', action: 'troca-sala' },
            { label: 'Meus agendamentos', message: 'meus agendamentos' }
        ];

        if (isDashboardPage()) {
            actions.unshift({ label: 'Resumo da tela', message: 'me mostra um resumo da tela atual' });
        }

        return actions;
    }

    function renderQuickActions() {
        const actions = buildQuickActions();
        if (!actions.length) {
            return;
        }

        const existing = document.getElementById('chatbotQuickActions');
        if (existing) {
            existing.remove();
        }

        const container = document.createElement('div');
        container.id = 'chatbotQuickActions';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '8px';
        container.style.padding = '10px 12px 0';

        actions.forEach((action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = action.label;
            button.style.display = 'inline-flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.width = 'auto';
            button.style.minWidth = 'fit-content';
            button.style.flex = '0 0 auto';
            button.style.padding = '8px 12px';
            button.style.margin = '0';
            button.style.border = '1px solid #c7d5e6';
            button.style.background = '#ffffff';
            button.style.color = '#0b2750';
            button.style.borderRadius = '999px';
            button.style.fontSize = '0.88rem';
            button.style.fontWeight = '600';
            button.style.lineHeight = '1.2';
            button.style.cursor = 'pointer';
            button.style.boxShadow = '0 1px 4px rgba(11, 39, 80, 0.08)';
            button.style.whiteSpace = 'nowrap';
            button.addEventListener('click', () => {
                if (action.action === 'troca-sala') {
                    if (!isSwapPage()) {
                        registrarAcaoTrocaSalaPendente();
                        window.location.href = getDashboardTrocaUrl();
                        return;
                    }

                    abrirTrocaSalaNoDashboard();
                    addMessage(action.label, 'user');
                    handleInputAndRoute('troca de sala', { typeReply: true });
                    return;
                }

                addMessage(action.label, 'user');
                handleInputAndRoute(action.message);
            });
            container.appendChild(button);
        });

        chatContainer.appendChild(container);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function abrirChatbotAssistente({ acao = null } = {}) {
        const estavaFechado = chatbot.style.display === 'none' || chatbot.style.display === '';

        if (estavaFechado) {
            chatbot.style.display = 'flex';
        }

        if (estavaFechado && currentStep === 'greeting' && !welcomeShown) {
            await carregarContextoUsuario();
            addMessage(montarMensagemBoasVindas(), 'chatbot');
            addMessage(montarDicaContextual(), 'chatbot');
            renderQuickActions();
            welcomeShown = true;
        }

        if (userContext?.nome) {
            await inicializarMonitoramentoTrocaTempoReal();
        }

        if (acao === 'troca-sala') {
            if (!userContext?.nome) {
                await carregarContextoUsuario();
            }

            await processarAcaoTrocaSala();
            return;
        }

        if (estavaFechado) {
            await sincronizarAvisoTrocaAoAbrirChat();
        }

        userInput.focus();
        return true;
    }

    function fecharChatbotAssistente() {
        chatbot.style.display = 'none';
    }

    window.__abrirChatbotAssistente = abrirChatbotAssistente;
    window.__fecharChatbotAssistente = fecharChatbotAssistente;

    function setTypingControls(active) {
        if (stopResponseButton) {
            stopResponseButton.hidden = !active;
        }
        sendMessageButton.disabled = active;
        userInput.disabled = active;
    }

    function typeMessage(content, sender, speed = 18) {
        if (activeTyping?.finish) {
            activeTyping.finish(true);
        }

        return new Promise((resolve) => {
            const messageElement = document.createElement('div');
            messageElement.className = (sender === 'user' ? 'user-message' : 'chatbot-message');
            messageElement.textContent = '';

            chatContainer.appendChild(messageElement);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            const text = String(content ?? '');
            let index = 0;
            let finished = false;
            const interval = Math.max(12, speed);
            const maxDuration = 5000;
            const maxSteps = Math.max(1, Math.floor(maxDuration / interval));
            const chunkSize = Math.max(1, Math.ceil(text.length / maxSteps));

            const timer = window.setInterval(() => {
                index = Math.min(text.length, index + chunkSize);
                messageElement.textContent = text.slice(0, index);
                chatContainer.scrollTop = chatContainer.scrollHeight;

                if (index >= text.length) {
                    finish(false);
                }
            }, interval);

            function finish(revealFullText) {
                if (finished) return;
                finished = true;
                window.clearInterval(timer);
                if (revealFullText) {
                    messageElement.textContent = text;
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                if (activeTyping?.messageElement === messageElement) {
                    activeTyping = null;
                    setTypingControls(false);
                }
                resolve(messageElement);
            }

            activeTyping = { finish, messageElement };
            setTypingControls(true);
        });
    }

    if (stopResponseButton) {
        stopResponseButton.addEventListener('click', () => {
            activeTyping?.finish?.(true);
        });
    }

    // Função para adicionar mensagens
    function addMessage(content, sender, allowHtml = false) {
        const messageElement = document.createElement('div');
        // Usamos 'user' e 'chatbot' internamente
        messageElement.className = (sender === 'user' ? 'user-message' : 'chatbot-message');

        if (allowHtml) {
            messageElement.innerHTML = content;
        } else {
            messageElement.textContent = String(content ?? '');
        }

        chatContainer.appendChild(messageElement);
        
        // Rola automaticamente para baixo
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function renderContextualOptions(options) {
        const safeOptions = Array.isArray(options)
            ? options.filter((option) => ['unit', 'professor'].includes(option?.kind) && option?.label && option?.message)
            : [];
        if (!safeOptions.length) return;

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '8px';
        container.style.padding = '8px 12px';

        safeOptions.forEach((option) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = String(option.label);
            button.style.width = 'auto';
            button.style.padding = '8px 12px';
            button.style.border = '1px solid #c7d5e6';
            button.style.borderRadius = '999px';
            button.style.background = '#ffffff';
            button.style.color = '#0b2750';
            button.style.cursor = 'pointer';
            button.addEventListener('click', async () => {
                Array.from(container.querySelectorAll('button')).forEach((item) => {
                    item.disabled = true;
                });
                addMessage(String(option.label), 'user');
                await handleInputAndRoute(String(option.message));
            });
            container.appendChild(button);
        });

        chatContainer.appendChild(container);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // --------------------------------------------------------
    // FUNÇÃO QUE CHAMA O BACKEND LOCAL DO CHATBOT
    // --------------------------------------------------------
    async function fetchChatReply(message) {
        try {
            // Adiciona um placeholder de "digitando"
            addMessage('🤖 digitando...', 'chatbot'); 
            
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, pageContext: getPageContext() })
            });

            // Remove o feedback 'digitando...'
            if (chatContainer.lastElementChild && chatContainer.lastElementChild.textContent.includes('digitando')) {
                 chatContainer.lastElementChild.remove();
            }

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: Falha na API do Chatbot.`);
            }

            const data = await response.json();
            return {
                reply: String(data.reply || ''),
                options: Array.isArray(data.options) ? data.options : []
            };

        } catch (error) {
            console.error("Erro na comunicação com o chatbot:", error);
            // Retorna uma resposta amigável em caso de falha
            return {
                reply: 'Desculpe, a IA está indisponível ou ocorreu um erro de comunicação.',
                options: []
            };
        }
    }
    
    // --------------------------------------------------------
    // FLUXO FIXO DE INVENTÁRIO (Sua lógica original)
    // --------------------------------------------------------

    function startChat() {
        const saudacao = obterSaudacao();
        addMessage(saudacao, 'chatbot');
        currentStep = 'askUnit'; 
        addMessage('Qual unidade você deseja acessar?', 'chatbot');
        
        fetchUnidades().then(unidades => {
            unidades.forEach(unit => {
                // Escapa valores dinamicos do banco mantendo tags HTML intactas
                addMessage(`<a href="#" class="link-unidade" data-codigo="${sanitizeAttribute(unit.codigo_unidade)}">${escapeHtml(unit.nome_unidade)}</a>`, 'chatbot', true);
            });
            handleLinks(); 
        });
    }

    async function fetchUnidades() {
        const response = await fetch('/unidades');
        return response.ok ? await response.json() : [];
    }

    async function fetchSalas(unit) {
        const response = await fetch(`/salas/${unit}`);
        return response.ok ? await response.json() : [];
    }

    async function obterInformacoesSala(roomId) {
        const response = await fetch(`/sala/${roomId}`);
        return response.ok ? await response.json() : null;
    }

    // Função para lidar com o clique em links (Navegação Fixa)
    async function handleInventoryNavigation(input) {
        // Se o input não é um link, mas o fluxo espera um código, ele é tratado aqui (ex: se o usuário digitar o código da sala)

        if (currentStep === 'askUnit') {
            selectedUnit = input; 
            const unitLink = chatContainer.querySelector(`.link-unidade[data-codigo="${input}"]`);
            const unitName = unitLink ? unitLink.textContent : selectedUnit; // Tenta pegar o nome

            addMessage(`Você escolheu a unidade **${unitName}**. Quais salas você deseja acessar?`, 'chatbot');
            currentStep = 'askRoom';
            
            const salas = await fetchSalas(selectedUnit);
            if (salas.length > 0) {
                salas.forEach(room => {
                    // Escapa valores dinamicos do banco mantendo tags HTML intactas
                    addMessage(`<a href="#" class="link-sala" data-id="${sanitizeAttribute(String(room.id_sala))}">${escapeHtml(room.nome_sala)}</a>`, 'chatbot', true);
                });
            } else {
                addMessage(`Não há salas disponíveis para a unidade ${unitName}.`, 'chatbot');
            }
            handleLinks(); 
            return;
        }

        if (currentStep === 'askRoom') {
            selectedRoom = input; 
            const salaInfo = await obterInformacoesSala(selectedRoom);
            
            if (salaInfo) {
                // Escapa valores dinamicos do banco mantendo tags HTML intactas
                const detalhes = `
                    <strong>Unidade:</strong> ${escapeHtml(salaInfo.codigo_unidade)}<br>
                    <strong>Nome:</strong> ${escapeHtml(salaInfo.nome_sala)}<br>
                    <strong>Computadores:</strong> ${escapeHtml(String(salaInfo.computadores ?? 'N/A'))}<br>
                    <strong>Recursos:</strong> ${escapeHtml(String(salaInfo.maquinario ?? 'N/A'))}<br>
                `;
                addMessage(`Detalhes da Sala ${escapeHtml(salaInfo.nome_sala)}:<br>${detalhes}`, 'chatbot', true);
            } else {
                addMessage('Desculpe, não consegui encontrar informações sobre esta sala.', 'chatbot');
            }
            
            currentStep = 'greeting'; 
            addMessage('Em que mais posso ajudar? (Diga "iniciar" para buscar outra sala)', 'chatbot');
            return;
        }
    }


    // --------------------------------------------------------
    // FUNÇÃO PRINCIPAL QUE FUNDE INVENTÁRIO E IA
    // --------------------------------------------------------

    // Função PRINCIPAL QUE FUNDE INVENTÁRIO E IA
async function handleInputAndRoute(input, options = {}) {
    const normalizedInput = input.toLowerCase().trim();
    
    // 1. COMANDO DE NAVEGAÇÃO FIXA (Inicia/Continua o Fluxo de Inventário)
    if (normalizedInput === 'iniciar' || normalizedInput === 'start') {
        startChat();
        return;
    }
    
    // 2. CONTINUA O FLUXO DE NAVEGAÇÃO
    if (currentStep !== 'greeting') {
        // Se já estamos em um fluxo fixo (askUnit ou askRoom), chamamos o handleInventoryNavigation
        if (currentStep === 'askUnit' || currentStep === 'askRoom') {
             // Tratamos o input como uma seleção de unidade ou sala
             return handleInventoryNavigation(input);
        }
    }
    
    // 3. MODO CHAT GERAL (BACKEND LOCAL)
    // Se não for um comando fixo nem parte de um fluxo em andamento, vá para a IA.
    const chatReply = await fetchChatReply(input);
    await typeMessage(chatReply.reply, 'chatbot');
    renderContextualOptions(chatReply.options);
}

    // A função para lidar com links de unidade e sala
    function handleLinks() {
        const linkHandler = (e) => {
            e.preventDefault();
            const value = e.currentTarget.dataset.codigo || e.currentTarget.dataset.id;
            const text = e.currentTarget.textContent;
            
            addMessage(text, 'user'); 
            handleInputAndRoute(value); // Envia o valor (código ou ID) para o roteador
        };

        // Remove e adiciona listeners para evitar duplicidade de eventos
        const existingLinks = chatContainer.querySelectorAll('.link-unidade, .link-sala');
        existingLinks.forEach(link => {
            link.removeEventListener('click', linkHandler);
            link.addEventListener('click', linkHandler);
        });
        
    }


    // --------------------------------------------------------
    // LISTENERS GLOBAIS
    // --------------------------------------------------------
    
    // Listener para o botão Enviar (ou Enter)
    sendMessageButton.addEventListener('click', () => {
        const input = userInput.value.trim();
        if (input) {
            addMessage(input, 'user');
            userInput.value = '';
            // Roteia a entrada digitada
            handleInputAndRoute(input); 
        }
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Impede que o form seja submetido (se houver)
            sendMessageButton.click(); 
        }
    });

    // Listener para Abre/Fecha o Chatbot (A Bolinha/Ícone)
    const chatButton = document.getElementById('chatButton');
    if (chatButton) {
        chatButton.addEventListener('click', async () => {
            const isOpen = chatbot.style.display === 'flex';

            if (isOpen) {
                fecharChatbotAssistente();
                return;
            }

            const acaoPendente = consumirAcaoTrocaSalaPendente();
            if (acaoPendente === 'troca-sala') {
                await abrirChatbotAssistente({ acao: 'troca-sala' });
                return;
            }

            await abrirChatbotAssistente();
        });
    }

    // NOVO LISTENER: Fechar o Chatbot (Se o botão X for adicionado ao HTML)
    const closeChatButton = document.getElementById('close-chat');
    if (closeChatButton) {
        closeChatButton.addEventListener('click', () => {
            fecharChatbotAssistente();
        });
    }

    Promise.resolve()
        .then(async () => {
            sincronizarBadgeComEstadoGlobalTroca();
            await inicializarBadgeTrocaSalaAoCarregar();
            if (userContext?.nome) {
                await inicializarMonitoramentoTrocaTempoReal();
            }
        })
        .catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChatbot);
} else {
    initializeChatbot();
}
