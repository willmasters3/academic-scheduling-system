//  (VERSÃO COMPLETA E CORRIGIDA)

document.addEventListener('DOMContentLoaded', function () {
    // --- CARREGAMENTO INICIAL DOS DADOS ---
    personalizarSaudacao();
    carregarDadosDashboard();
    inicializarAgendaCalendario();
    carregarSalasMaisUsadas();
    popularSeletorUnidades();

    // --- MANIPULADORES DE ELEMENTOS ---
    const botaoMostrarForm = document.getElementById('mostrarFormularioBtn');
    const formulario = document.getElementById('agendamentoForm');
    const filtros = document.getElementById('filtros');
    const graficoContainer = document.getElementById('graficoContainer');
    const agendaCalendario = document.getElementById('agendaSemanaCalendario');
    const agendamentoFormSlot = document.getElementById('agendamentoFormSlot');
    const agendamentoFormOrigem = document.getElementById('agendamentoFormOrigem');
    const botaoAgendaCompleta = document.getElementById('mostrarAgendaCompletaBtn');
    const secaoAgendaCompletaContainer = document.getElementById('secaoAgendaCompletaContainer');
    const secaoAgendaCompletaOrigem = document.getElementById('secaoAgendaCompletaOrigem');
    const botaoRelatorios = document.getElementById('mostrarRelatoriosBtn');
    const secaoRelatorios = document.getElementById('secaoRelatorios');
    const secaoRelatoriosOrigem = document.getElementById('secaoRelatoriosOrigem');
    const botaoConfiguracoes = document.getElementById('mostrarConfiguracoesBtn');
    const secaoConfiguracoes = document.getElementById('secaoConfiguracoes');
    const secaoConfiguracoesOrigem = document.getElementById('secaoConfiguracoesOrigem');
    const perfilProfessorForm = document.getElementById('perfilProfessorForm');
    const senhaProfessorForm = document.getElementById('senhaProfessorForm');
    const botaoTrocaSala = document.getElementById('mostrarTrocaSalaBtn');
    const secaoTrocaSalaContainer = document.getElementById('secaoTrocaSalaContainer');
    const secaoTrocaSalaOrigem = document.getElementById('secaoTrocaSalaOrigem');
    
    const botaoSalas = document.getElementById('mostrarSalasBtn'); // Seu <li> com ID
    const secaoSalas = document.getElementById('secaoSalas');       // Sua nova <div> com ID
    const secaoSalasOrigem = document.getElementById('secaoSalasOrigem');

    const menuInicio = document.getElementById('menuInicio');
    let relatoriosCarregados = false;
    let configuracoesCarregadas = false;
    let usuarioConfiguracoesAtual = null;

    function restaurarFormularioParaOrigem() {
        if (!formulario || !agendamentoFormOrigem) {
            return;
        }

        if (formulario.parentElement !== agendamentoFormOrigem.parentElement || formulario.previousElementSibling !== agendamentoFormOrigem) {
            agendamentoFormOrigem.insertAdjacentElement('afterend', formulario);
        }

        formulario.classList.remove('agendamentoForm--na-agenda');
        if (agendamentoFormSlot) {
            agendamentoFormSlot.classList.remove('visivel');
            agendamentoFormSlot.innerHTML = '';
        }
        if (typeof window.inicializarFlatpickrDatas === 'function') {
            window.inicializarFlatpickrDatas();
        }
        if (agendaCalendario) {
            agendaCalendario.style.display = 'block';
        }
    }

    function moverFormularioParaAgenda() {
        if (!formulario || !agendamentoFormSlot) {
            return;
        }

        agendamentoFormSlot.appendChild(formulario);
        agendamentoFormSlot.classList.add('visivel');
        formulario.classList.add('agendamentoForm--na-agenda');
        if (typeof window.inicializarFlatpickrDatas === 'function') {
            window.inicializarFlatpickrDatas();
        }
        if (agendaCalendario) {
            agendaCalendario.style.display = 'none';
        }
    }

    function restaurarTrocaSalaParaOrigem() {
        if (!secaoTrocaSalaContainer || !secaoTrocaSalaOrigem) {
            return;
        }

        if (secaoTrocaSalaContainer.parentElement !== secaoTrocaSalaOrigem.parentElement || secaoTrocaSalaContainer.previousElementSibling !== secaoTrocaSalaOrigem) {
            secaoTrocaSalaOrigem.insertAdjacentElement('afterend', secaoTrocaSalaContainer);
        }

        secaoTrocaSalaContainer.classList.remove('secao-troca-container--na-agenda');
        if (agendamentoFormSlot && agendamentoFormSlot.contains(secaoTrocaSalaContainer)) {
            agendamentoFormSlot.classList.remove('visivel');
        }
        if (agendaCalendario) {
            agendaCalendario.style.display = 'block';
        }
    }

    function moverTrocaSalaParaAgenda() {
        if (!secaoTrocaSalaContainer || !agendamentoFormSlot) {
            return;
        }

        agendamentoFormSlot.appendChild(secaoTrocaSalaContainer);
        agendamentoFormSlot.classList.add('visivel');
        secaoTrocaSalaContainer.classList.add('secao-troca-container--na-agenda');
        if (agendaCalendario) {
            agendaCalendario.style.display = 'none';
        }
    }

    function restaurarRelatoriosParaOrigem() {
        if (!secaoRelatorios || !secaoRelatoriosOrigem) {
            return;
        }

        if (secaoRelatorios.parentElement !== secaoRelatoriosOrigem.parentElement || secaoRelatorios.previousElementSibling !== secaoRelatoriosOrigem) {
            secaoRelatoriosOrigem.insertAdjacentElement('afterend', secaoRelatorios);
        }

        secaoRelatorios.classList.remove('secao-relatorios--na-agenda');
        if (agendamentoFormSlot && agendamentoFormSlot.contains(secaoRelatorios)) {
            agendamentoFormSlot.classList.remove('visivel');
        }
        if (agendaCalendario) {
            agendaCalendario.style.display = 'block';
        }
    }

    function moverRelatoriosParaAgenda() {
        if (!secaoRelatorios || !agendamentoFormSlot) {
            return;
        }

        agendamentoFormSlot.appendChild(secaoRelatorios);
        agendamentoFormSlot.classList.add('visivel');
        secaoRelatorios.classList.add('secao-relatorios--na-agenda');
        if (agendaCalendario) {
            agendaCalendario.style.display = 'none';
        }
    }

    function restaurarConfiguracoesParaOrigem() {
        if (!secaoConfiguracoes || !secaoConfiguracoesOrigem) {
            return;
        }

        if (secaoConfiguracoes.parentElement !== secaoConfiguracoesOrigem.parentElement || secaoConfiguracoes.previousElementSibling !== secaoConfiguracoesOrigem) {
            secaoConfiguracoesOrigem.insertAdjacentElement('afterend', secaoConfiguracoes);
        }

        secaoConfiguracoes.classList.remove('secao-configuracoes--na-agenda');
    }

    function moverConfiguracoesParaAgenda() {
        if (!secaoConfiguracoes || !agendamentoFormSlot) {
            return;
        }

        agendamentoFormSlot.appendChild(secaoConfiguracoes);
        agendamentoFormSlot.classList.add('visivel');
        secaoConfiguracoes.classList.add('secao-configuracoes--na-agenda');
        if (agendaCalendario) {
            agendaCalendario.style.display = 'none';
        }
    }

    function setConfigFeedback(elementId, message, tipo = 'sucesso') {
        const feedback = document.getElementById(elementId);
        if (!feedback) return;

        feedback.classList.remove('sucesso', 'erro');
        feedback.classList.add(tipo === 'erro' ? 'erro' : 'sucesso');
        feedback.textContent = message;
    }

    function limparConfigFeedback(elementId) {
        const feedback = document.getElementById(elementId);
        if (!feedback) return;

        feedback.classList.remove('sucesso', 'erro');
        feedback.textContent = '';
    }

    function formatarTurnoParaExibicao(turno) {
        const turnoNormalizado = String(turno || '').trim().toLowerCase();
        if (turnoNormalizado === 'manha') return 'Manhã';
        if (turnoNormalizado === 'tarde') return 'Tarde';
        if (turnoNormalizado === 'noite') return 'Noite';
        return turno;
    }

    function formatarPermissaoParaExibicao(permissao) {
        const permissaoNormalizada = String(permissao || '').trim().toLowerCase();
        if (permissaoNormalizada === 'admin') return 'Administrador';
        if (permissaoNormalizada === 'coordenador') return 'Coordenador';
        if (permissaoNormalizada === 'user') return 'Professor';
        return permissao || 'Usuario';
    }

    function atualizarPreviewFotoProfessor(fotoUrl) {
        const img = document.getElementById('configFotoPreview');
        const icon = document.querySelector('.config-avatar i');

        if (!img) return;

        const url = String(fotoUrl || '').trim();
        if (url) {
            img.src = url.startsWith('/') ? url : `/${url.replace(/^\/+/, '')}`;
            img.style.display = 'block';
            if (icon) icon.style.display = 'none';
            return;
        }

        img.removeAttribute('src');
        img.style.display = 'none';
        if (icon) icon.style.display = 'block';
    }

    function preencherConfiguracoesProfessor(usuario) {
        usuarioConfiguracoesAtual = usuario || null;

        const nome = String(usuario?.nome || '').trim();
        const login = String(usuario?.login || '').trim();
        const email = String(usuario?.email || '').trim();
        const qualificacao = String(usuario?.qualificacao || '').trim();
        const fotoUrl = String(usuario?.foto_url || '').trim();
        const turnosTrabalho = String(usuario?.turno_principal || '').trim();
        const cargaHorariaSemanal = usuario?.carga_horaria_semanal;
        const permissao = String(usuario?.permissao || '').trim();
        const perfilExibicao = formatarPermissaoParaExibicao(permissao);
        const unidades = Array.isArray(usuario?.unidades) ? usuario.unidades.join(', ') : '';

        const sidebarPerfilUsuario = document.getElementById('sidebarPerfilUsuario');
        const configPerfilEyebrow = document.getElementById('configPerfilEyebrow');
        const configNomeExibicao = document.getElementById('configNomeExibicao');
        const configLoginExibicao = document.getElementById('configLoginExibicao');
        const configEmailExibicao = document.getElementById('configEmailExibicao');
        const configQualificacaoExibicao = document.getElementById('configQualificacaoExibicao');
        const configTurnoExibicao = document.getElementById('configTurnoExibicao');
        const configCargaHorariaExibicao = document.getElementById('configCargaHorariaExibicao');
        const configPermissaoExibicao = document.getElementById('configPermissaoExibicao');
        const configUnidadesExibicao = document.getElementById('configUnidadesExibicao');
        const configTurnosHelp = document.getElementById('configTurnosHelp');
        const configNome = document.getElementById('configNome');
        const configLogin = document.getElementById('configLogin');
        const configEmail = document.getElementById('configEmail');
        const configQualificacao = document.getElementById('configQualificacao');
        const configFoto = document.getElementById('configFoto');
        const configCargaHorariaSemanal = document.getElementById('configCargaHorariaSemanal');
        const turnosCheckboxes = Array.from(document.querySelectorAll('#configTurnosTrabalho input[type="checkbox"]'));
        const turnosSelecionados = turnosTrabalho
            ? turnosTrabalho.split(',').map((item) => item.trim()).filter(Boolean)
            : [];

        if (sidebarPerfilUsuario) sidebarPerfilUsuario.textContent = perfilExibicao;
        if (configPerfilEyebrow) configPerfilEyebrow.textContent = `Perfil do ${perfilExibicao.toLowerCase()}`;
        if (configNomeExibicao) configNomeExibicao.textContent = nome || perfilExibicao;
        if (configLoginExibicao) configLoginExibicao.textContent = `Login: ${login || '--'}`;
        if (configEmailExibicao) configEmailExibicao.textContent = `E-mail: ${email || '--'}`;
        if (configQualificacaoExibicao) configQualificacaoExibicao.textContent = `Qualificacao: ${qualificacao || '--'}`;
        if (configTurnosHelp) configTurnosHelp.textContent = `Marque quantos turnos o ${perfilExibicao.toLowerCase()} trabalha.`;
        if (configTurnoExibicao) configTurnoExibicao.textContent = `Turnos: ${turnosSelecionados.length ? turnosSelecionados.map(formatarTurnoParaExibicao).join(', ') : '--'}`;
        if (configCargaHorariaExibicao) configCargaHorariaExibicao.textContent = `Carga horária semanal: ${cargaHorariaSemanal ?? '--'}`;
        if (configPermissaoExibicao) configPermissaoExibicao.textContent = `Permissão: ${perfilExibicao || '--'}`;
        if (configUnidadesExibicao) configUnidadesExibicao.textContent = `Unidades: ${unidades || '--'}`;

        if (configNome) configNome.value = nome;
        if (configLogin) configLogin.value = login;
        if (configLogin) configLogin.readOnly = true;
        if (configEmail) configEmail.value = email;
        if (configQualificacao) configQualificacao.value = qualificacao;
        if (configFoto) configFoto.value = '';
        if (configCargaHorariaSemanal) configCargaHorariaSemanal.value = cargaHorariaSemanal ?? '';
        turnosCheckboxes.forEach((checkbox) => {
            checkbox.checked = turnosSelecionados.includes(checkbox.value);
        });

        atualizarPreviewFotoProfessor(fotoUrl);
    }

    async function carregarConfiguracoesProfessor(force = false) {
        if (configuracoesCarregadas && !force) {
            return;
        }

        try {
            const response = await fetch('/user-info', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Nao foi possivel carregar os dados do professor.');
            }

            const usuario = await response.json();
            preencherConfiguracoesProfessor(usuario);
            configuracoesCarregadas = true;
        } catch (error) {
            console.error('Erro ao carregar configuracoes do professor:', error);
            setConfigFeedback('perfilProfessorFeedback', 'Nao foi possivel carregar os dados do perfil.', 'erro');
        }
    }

    async function salvarPerfilProfessor(event) {
        event.preventDefault();

        const configNome = document.getElementById('configNome');
        const configLogin = document.getElementById('configLogin');
        const configEmail = document.getElementById('configEmail');
        const configQualificacao = document.getElementById('configQualificacao');
        const configFoto = document.getElementById('configFoto');
        const configCargaHorariaSemanal = document.getElementById('configCargaHorariaSemanal');
        const turnosSelecionados = Array.from(document.querySelectorAll('#configTurnosTrabalho input[type="checkbox"]:checked'))
            .map((checkbox) => checkbox.value);

        const nome = String(configNome?.value || '').trim();
        const email = String(configEmail?.value || '').trim();
        const qualificacao = String(configQualificacao?.value || '').trim();
        const cargaHorariaSemanal = String(configCargaHorariaSemanal?.value || '').trim();

        limparConfigFeedback('perfilProfessorFeedback');

        if (!nome) {
            setConfigFeedback('perfilProfessorFeedback', 'Nome é obrigatório.', 'erro');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('nome', nome);
            formData.append('email', email);
            formData.append('qualificacao', qualificacao);
            formData.append('turnosTrabalho', turnosSelecionados.join(','));
            formData.append('cargaHorariaSemanal', cargaHorariaSemanal);

            if (configFoto?.files?.[0]) {
                formData.append('foto', configFoto.files[0]);
            }

            const response = await fetch('/meu-perfil', {
                method: 'PUT',
                body: formData
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.error || data?.message || 'Falha ao atualizar o perfil.');
            }

            setConfigFeedback('perfilProfessorFeedback', data?.message || 'Perfil atualizado com sucesso.');
            configuracoesCarregadas = false;
            await carregarConfiguracoesProfessor(true);
            await personalizarSaudacao();
        } catch (error) {
            console.error('Erro ao salvar perfil do professor:', error);
            setConfigFeedback('perfilProfessorFeedback', error.message || 'Erro ao salvar o perfil.', 'erro');
        }
    }

    async function alterarSenhaProfessor(event) {
        event.preventDefault();

        const senhaAtual = document.getElementById('senhaAtualProfessor');
        const novaSenha = document.getElementById('novaSenhaProfessor');
        const confirmarNovaSenha = document.getElementById('confirmarNovaSenhaProfessor');

        limparConfigFeedback('senhaProfessorFeedback');

        const senhaAtualValor = String(senhaAtual?.value || '');
        const novaSenhaValor = String(novaSenha?.value || '');
        const confirmarNovaSenhaValor = String(confirmarNovaSenha?.value || '');

        if (!senhaAtualValor || !novaSenhaValor || !confirmarNovaSenhaValor) {
            setConfigFeedback('senhaProfessorFeedback', 'Preencha a senha atual, a nova senha e a confirmacao.', 'erro');
            return;
        }

        if (novaSenhaValor !== confirmarNovaSenhaValor) {
            setConfigFeedback('senhaProfessorFeedback', 'A confirmacao da senha nao confere.', 'erro');
            return;
        }

        if (!usuarioConfiguracoesAtual?.id_professor) {
            await carregarConfiguracoesProfessor(true);
        }

        const idProfessor = Number(usuarioConfiguracoesAtual?.id_professor);
        if (!Number.isInteger(idProfessor) || idProfessor <= 0) {
            setConfigFeedback('senhaProfessorFeedback', 'Nao foi possivel identificar o professor logado.', 'erro');
            return;
        }

        try {
            const response = await fetch(`/alterar-senha/${idProfessor}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senhaAtual: senhaAtualValor, novaSenha: novaSenhaValor })
            });

            const texto = await response.text();
            if (!response.ok) {
                throw new Error(texto || 'Falha ao alterar a senha.');
            }

            setConfigFeedback('senhaProfessorFeedback', 'Senha alterada com sucesso.');
            senhaAtual.value = '';
            novaSenha.value = '';
            confirmarNovaSenha.value = '';
        } catch (error) {
            console.error('Erro ao alterar senha do professor:', error);
            setConfigFeedback('senhaProfessorFeedback', error.message || 'Erro ao alterar a senha.', 'erro');
        }
    }

    function restaurarSalasParaOrigem() {
        if (!secaoSalas || !secaoSalasOrigem) {
            return;
        }

        if (secaoSalas.parentElement !== secaoSalasOrigem.parentElement || secaoSalas.previousElementSibling !== secaoSalasOrigem) {
            secaoSalasOrigem.insertAdjacentElement('afterend', secaoSalas);
        }

        secaoSalas.classList.remove('secao-salas--na-agenda');
        if (agendamentoFormSlot && agendamentoFormSlot.contains(secaoSalas)) {
            agendamentoFormSlot.classList.remove('visivel');
        }
        if (agendaCalendario) {
            agendaCalendario.style.display = 'block';
        }
    }

    function moverSalasParaAgenda() {
        if (!secaoSalas || !agendamentoFormSlot) {
            return;
        }

        agendamentoFormSlot.appendChild(secaoSalas);
        agendamentoFormSlot.classList.add('visivel');
        secaoSalas.classList.add('secao-salas--na-agenda');
        if (agendaCalendario) {
            agendaCalendario.style.display = 'none';
        }
    }

    function restaurarAgendaCompletaParaOrigem() {
        if (!secaoAgendaCompletaContainer || !secaoAgendaCompletaOrigem) {
            return;
        }

        if (secaoAgendaCompletaContainer.parentElement !== secaoAgendaCompletaOrigem.parentElement || secaoAgendaCompletaContainer.previousElementSibling !== secaoAgendaCompletaOrigem) {
            secaoAgendaCompletaOrigem.insertAdjacentElement('afterend', secaoAgendaCompletaContainer);
        }

        secaoAgendaCompletaContainer.classList.remove('agenda-completa-container--na-agenda');
        if (agendamentoFormSlot && agendamentoFormSlot.contains(secaoAgendaCompletaContainer)) {
            agendamentoFormSlot.classList.remove('visivel');
        }
        if (agendaCalendario) {
            agendaCalendario.style.display = 'block';
        }
    }

    function moverAgendaCompletaParaAgenda() {
        if (!secaoAgendaCompletaContainer || !agendamentoFormSlot) {
            return;
        }

        agendamentoFormSlot.appendChild(secaoAgendaCompletaContainer);
        agendamentoFormSlot.classList.add('visivel');
        secaoAgendaCompletaContainer.classList.add('agenda-completa-container--na-agenda');
        if (agendaCalendario) {
            agendaCalendario.style.display = 'none';
        }
    }

    function atualizarTamanhoAgendaProfessor() {
        if (agendaProfessorCalendario && typeof agendaProfessorCalendario.updateSize === 'function') {
            requestAnimationFrame(() => agendaProfessorCalendario.updateSize());
        }
    }

    function abrirTrocaSalaSeSolicitada() {
        const parametros = new URLSearchParams(window.location.search);
        const acaoChat = parametros.get('chat') || '';
        let origemLocalStorage = false;
        let deveAbrirTroca = acaoChat === 'troca-sala';

        try {
            if (!deveAbrirTroca && localStorage.getItem('chatbot-pending-action') === 'troca-sala') {
                deveAbrirTroca = true;
                origemLocalStorage = true;
            }
        } catch (_) {}

        if (!deveAbrirTroca) {
            return;
        }

        const secaoTroca = document.getElementById('secaoTrocaSalaContainer');
        const botaoTroca = document.getElementById('mostrarTrocaSalaBtn');

        if (secaoTroca) {
            const estaVisivel = secaoTroca.classList.contains('visivel') && getComputedStyle(secaoTroca).display !== 'none';

            if (!estaVisivel && botaoTroca) {
                botaoTroca.click();
            } else {
                moverTrocaSalaParaAgenda();
                secaoTroca.classList.add('visivel');
                secaoTroca.style.display = 'block';
                graficoContainer.style.display = 'none';
            }

            secaoTroca.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (botaoTroca) {
            botaoTroca.click();
        }

        let tentativas = 0;
        const abrirChatComRetry = () => {
            const abrirChat = window.__abrirChatbotAssistente;
            if (typeof abrirChat === 'function') {
                abrirChat({ acao: 'troca-sala' });
                return;
            }

            tentativas += 1;
            if (tentativas < 20) {
                setTimeout(abrirChatComRetry, 100);
            }
        };

        setTimeout(abrirChatComRetry, 550);

        try {
            if (acaoChat === 'troca-sala') {
                const url = new URL(window.location.href);
                url.searchParams.delete('chat');
                window.history.replaceState({}, '', url.toString());
            }
            if (origemLocalStorage) {
                localStorage.removeItem('chatbot-pending-action');
            }
        } catch (_) {}
    }

    // MUDANÇA 1: Função centralizada para esconder todas as seções interativas
    // e retornar ao estado padrão (gráfico visível).
    /*function esconderSessoesInterativas() {
        formulario.classList.remove('visivel');
        filtros.classList.remove('visivel');
        secaoRelatorios.classList.remove('visivel');
        graficoContainer.style.display = 'block'; // O padrão é sempre mostrar o gráfico
    }
*/
    // MUDANÇA 2: Lógica de clique para "Agendar Sala" atualizada
    if (botaoMostrarForm) {
        botaoMostrarForm.addEventListener('click', () => {
            const estavaVisivel = formulario.classList.contains('visivel');
            
            // Primeiro, fecha tudo e volta ao padrão.
            esconderSessoesInterativas();

            // Se o formulário estava fechado, agora nós o abrimos (e escondemos o gráfico).
            if (!estavaVisivel) {
                moverFormularioParaAgenda();
                formulario.classList.add('visivel');
                filtros.classList.add('visivel');
                graficoContainer.style.display = 'none';
            }
            // Se já estava aberto, a função esconderSessoesInterativas() já cuidou de fechá-lo.
        });
    }

    // MUDANÇA 3: Lógica de clique para "Relatórios" atualizada
    if (botaoRelatorios) {
        botaoRelatorios.addEventListener('click', () => {
            const estavaVisivel = secaoRelatorios.classList.contains('visivel');

            // Primeiro, fecha tudo e volta ao padrão.
            esconderSessoesInterativas();

            // Se os relatórios estavam fechados, agora nós os abrimos (e escondemos o gráfico).
            if (!estavaVisivel) {
                moverRelatoriosParaAgenda();
                secaoRelatorios.classList.add('visivel');
                if (graficoContainer) graficoContainer.style.display = 'block';

                // Carrega os dados dos relatórios se for a primeira vez.
                if (!relatoriosCarregados) {
                    carregarTodosOsRelatorios();
                    relatoriosCarregados = true;
                }
            }
            // Se já estava aberto, a função esconderSessoesInterativas() já cuidou de fechá-lo.
        });
    }

    if (botaoConfiguracoes && secaoConfiguracoes) {
        botaoConfiguracoes.addEventListener('click', async (event) => {
            event.preventDefault();
            const estavaVisivel = secaoConfiguracoes.classList.contains('visivel');

            esconderSessoesInterativas();

            if (!estavaVisivel) {
                moverConfiguracoesParaAgenda();
                secaoConfiguracoes.classList.add('visivel');
                secaoConfiguracoes.style.display = 'block';
                await carregarConfiguracoesProfessor();
            }
        });
    }
    // NOVO: Lógica de clique para "Salas"
    if (botaoSalas && secaoSalas) {
        botaoSalas.addEventListener('click', (event) => {
            event.preventDefault(); // Garante que o <li> não faça nada padrão
            const estavaVisivel = secaoSalas.classList.contains('visivel');
            
            // Primeiro, fecha tudo e volta ao padrão.
            esconderSessoesInterativas();

            // Se a seção de Salas estava fechada, agora nós a abrimos (e escondemos o gráfico).
            if (!estavaVisivel) {
                moverSalasParaAgenda();
                secaoSalas.classList.add('visivel');
                graficoContainer.style.display = 'none';
            }
        });
    }

    if (perfilProfessorForm) {
        perfilProfessorForm.addEventListener('submit', salvarPerfilProfessor);
    }

    if (senhaProfessorForm) {
        senhaProfessorForm.addEventListener('submit', alterarSenhaProfessor);
    }

    carregarConfiguracoesProfessor();

    if (botaoTrocaSala && secaoTrocaSalaContainer) {
        botaoTrocaSala.addEventListener('click', async (event) => {
            event.preventDefault();
            const estavaVisivel = secaoTrocaSalaContainer.classList.contains('visivel');

            esconderSessoesInterativas();

            if (!estavaVisivel) {
                moverTrocaSalaParaAgenda();
                secaoTrocaSalaContainer.classList.add('visivel');
                secaoTrocaSalaContainer.style.display = 'block';
                graficoContainer.style.display = 'none';
                await atualizarPainelTrocaSalaAoAbrir();
            }
        });
    }

    if (botaoAgendaCompleta && secaoAgendaCompletaContainer) {
        botaoAgendaCompleta.addEventListener('click', async (event) => {
            event.preventDefault();
            const estavaVisivel = secaoAgendaCompletaContainer.classList.contains('visivel');

            esconderSessoesInterativas();

            if (!estavaVisivel) {
                moverAgendaCompletaParaAgenda();
                secaoAgendaCompletaContainer.classList.add('visivel');
                secaoAgendaCompletaContainer.style.display = 'block';
                graficoContainer.style.display = 'none';
                await garantirAgendaCompletaPronta();
            }
        });
    }

    // MUDANÇA 4: Cliques nos outros botões do menu agora só precisam chamar a função de reset.
    if (menuInicio) menuInicio.addEventListener('click', esconderSessoesInterativas);

    abrirTrocaSalaSeSolicitada();


    // MUDANÇA 1: Função centralizada para esconder todas as seções interativas
// e retornar ao estado padrão (gráfico visível).
function esconderSessoesInterativas() {
    formulario.classList.remove('visivel');
    filtros.classList.remove('visivel');
    if (secaoAgendaCompletaContainer) secaoAgendaCompletaContainer.classList.remove('visivel');
    if (secaoAgendaCompletaContainer) secaoAgendaCompletaContainer.style.display = 'none';
    restaurarAgendaCompletaParaOrigem();
    secaoRelatorios.classList.remove('visivel');
    restaurarRelatoriosParaOrigem();
    if (secaoSalas) secaoSalas.classList.remove('visivel'); // <-- ATUALIZAÇÃO: Esconder a nova seção
    restaurarSalasParaOrigem();
    if (secaoConfiguracoes) secaoConfiguracoes.classList.remove('visivel');
    if (secaoConfiguracoes) secaoConfiguracoes.style.display = 'none';
    restaurarConfiguracoesParaOrigem();
    if (secaoTrocaSalaContainer) secaoTrocaSalaContainer.classList.remove('visivel');
    if (secaoTrocaSalaContainer) secaoTrocaSalaContainer.style.display = 'none';
    restaurarTrocaSalaParaOrigem();
    restaurarFormularioParaOrigem();
    graficoContainer.style.display = 'block'; // O padrão é sempre mostrar o gráfico
    atualizarTamanhoAgendaProfessor();
}
});


// ==========================================================
// FUNÇÕES ASSÍNCRONAS (NENHUMA MUDANÇA ABAIXO)
// ==========================================================

async function personalizarSaudacao() {
    try {
        const response = await fetch('/user-info');
        if (!response.ok) return;
        const usuario = await response.json();
        const nomeProfessor = usuario.nome.split(' ')[0];
        const fotoUrl = String(usuario?.foto_url || '').trim();
        const hora = new Date().getHours();
        let saudacao;
        if (hora >= 5 && hora < 12) { saudacao = "Bom dia"; }
        else if (hora >= 12 && hora < 18) { saudacao = "Boa tarde"; }
        else { saudacao = "Boa noite"; }
        const elementoTitulo = document.getElementById('saudacaoDashboard');
        if (elementoTitulo) { elementoTitulo.textContent = `${saudacao}, ${nomeProfessor}!`; }

        const avatar = document.getElementById('headerFotoProfessor');
        const avatarIcon = document.querySelector('.user-icon i');
        const sidebarAvatar = document.getElementById('sidebarFotoProfessor');
        const sidebarAvatarIcon = document.querySelector('.sidebar-avatar i');
        if (avatar) {
            if (fotoUrl) {
                const fotoNormalizada = fotoUrl.startsWith('/') ? fotoUrl : `/${fotoUrl.replace(/^\/+/, '')}`;
                avatar.src = fotoNormalizada;
                avatar.style.display = 'block';
                if (avatarIcon) avatarIcon.style.display = 'none';

                if (sidebarAvatar) {
                    sidebarAvatar.src = fotoNormalizada;
                    sidebarAvatar.style.display = 'block';
                    if (sidebarAvatarIcon) sidebarAvatarIcon.style.display = 'none';
                }
            } else {
                avatar.removeAttribute('src');
                avatar.style.display = 'none';
                if (avatarIcon) avatarIcon.style.display = 'block';

                if (sidebarAvatar) {
                    sidebarAvatar.removeAttribute('src');
                    sidebarAvatar.style.display = 'none';
                    if (sidebarAvatarIcon) sidebarAvatarIcon.style.display = 'block';
                }
            }
        }
    } catch (error) { console.error('Erro ao personalizar a saudação:', error); }
}

async function carregarTodosOsRelatorios() {
    carregarRelatorioHorasUc();
    carregarRelatorioUsoSalas();
    criarGraficoSalas();
    carregarRelatorioPorPeriodo();
}

let agendaCompletaInicializada = false;
let agendaCompletaPaginaAtual = 1;
let agendaCompletaResultados = [];
const AGENDA_COMPLETA_PAGE_SIZE = 20;

function formatarDataAgendaCompleta(dataIso) {
    if (!dataIso) return '';
    const [ano, mes, dia] = String(dataIso).split('-');
    if (!ano || !mes || !dia) return String(dataIso);
    return `${dia}/${mes}/${ano}`;
}

function formatarHoraAgendaCompleta(hora) {
    return String(hora || '').slice(0, 5);
}

function setAgendaCompletaFeedback(mensagem, tipo = '') {
    const feedback = document.getElementById('agendaCompletaFeedback');
    if (!feedback) return;
    feedback.classList.remove('erro', 'sucesso');
    if (tipo) {
        feedback.classList.add(tipo);
    }
    feedback.textContent = mensagem;
}

function atualizarResumoAgendaCompleta(texto) {
    const resumo = document.getElementById('agendaCompletaResumo');
    if (!resumo) return;
    resumo.textContent = texto;
}

async function carregarUnidadesAgendaCompleta() {
    const select = document.getElementById('agendaCompletaUnidade');
    if (!select) return;

    try {
        const [userResponse, unidadesResponse] = await Promise.all([
            fetch('/user-info', { cache: 'no-store' }),
            fetch('/unidades', { cache: 'no-store' })
        ]);

        if (!userResponse.ok) {
            throw new Error('Não foi possível carregar os dados do usuário.');
        }
        if (!unidadesResponse.ok) {
            throw new Error('Não foi possível carregar as unidades disponíveis.');
        }

        const usuario = await userResponse.json();
        const todasUnidades = await unidadesResponse.json();
        const unidadesPermitidas = Array.isArray(usuario?.unidades)
            ? usuario.unidades.map((codigo) => String(codigo).trim())
            : [];
        const ehAdmin = usuario?.permissao === 'admin';
        const mapa = new Map((todasUnidades || []).map((item) => [String(item.codigo_unidade).trim(), item.nome_unidade]));

        const unidades = ehAdmin
            ? (todasUnidades || []).map((item) => ({
                codigo: String(item.codigo_unidade).trim(),
                nome: item.nome_unidade
            }))
            : unidadesPermitidas.map((codigo) => ({
                codigo,
                nome: mapa.get(codigo) || codigo
            }));

        select.innerHTML = '<option value="">Selecione uma unidade</option>';
        unidades.forEach((unidade) => {
            const option = document.createElement('option');
            option.value = unidade.codigo;
            option.textContent = unidade.nome;
            select.appendChild(option);
        });

        if (unidades.length === 1) {
            select.value = unidades[0].codigo;
        }
    } catch (error) {
        console.error('Erro ao carregar unidades da agenda completa:', error);
        setAgendaCompletaFeedback(error.message || 'Não foi possível carregar as unidades.', 'erro');
    }
}

function renderizarAgendaCompleta() {
    const body = document.getElementById('agendaCompletaTabelaBody');
    const anterior = document.getElementById('agendaCompletaAnterior');
    const proximo = document.getElementById('agendaCompletaProximo');
    const paginacaoInfo = document.getElementById('agendaCompletaPaginacaoInfo');

    if (!body || !anterior || !proximo || !paginacaoInfo) return;

    const totalItems = agendaCompletaResultados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalItems / AGENDA_COMPLETA_PAGE_SIZE));
    if (agendaCompletaPaginaAtual > totalPaginas) {
        agendaCompletaPaginaAtual = totalPaginas;
    }

    const inicio = (agendaCompletaPaginaAtual - 1) * AGENDA_COMPLETA_PAGE_SIZE;
    const pagina = agendaCompletaResultados.slice(inicio, inicio + AGENDA_COMPLETA_PAGE_SIZE);

    if (!pagina.length) {
        body.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum agendamento encontrado com os filtros informados.</td></tr>';
    } else {
        body.innerHTML = pagina.map((item) => `
            <tr>
                <td>${item.nome_sala || 'N/D'}</td>
                <td>${item.nome || 'N/D'}</td>
                <td>${formatarDataAgendaCompleta(item.data_reservas) || 'N/D'}</td>
                <td>${formatarHoraAgendaCompleta(item.hora_inicio) || 'N/D'}</td>
                <td>${formatarHoraAgendaCompleta(item.hora_fim) || 'N/D'}</td>
                <td>${item.tipo_aula || 'N/D'}</td>
                <td>${item.motivo || 'Nenhum motivo informado'}</td>
            </tr>
        `).join('');
    }

    anterior.disabled = agendaCompletaPaginaAtual <= 1;
    proximo.disabled = agendaCompletaPaginaAtual >= totalPaginas;
    paginacaoInfo.textContent = `Página ${agendaCompletaPaginaAtual} de ${totalPaginas}`;
    atualizarResumoAgendaCompleta(`${totalItems} agendamento(s) encontrado(s).`);
}

async function carregarAgendaCompleta() {
    const unidade = document.getElementById('agendaCompletaUnidade');
    const sala = document.getElementById('agendaCompletaSala');
    const professor = document.getElementById('agendaCompletaProfessor');
    const dataInicio = document.getElementById('agendaCompletaDataInicio');
    const dataFim = document.getElementById('agendaCompletaDataFim');
    const turno = document.getElementById('agendaCompletaTurno');
    const diaSemana = document.getElementById('agendaCompletaDiaSemana');

    if (!unidade?.value) {
        agendaCompletaResultados = [];
        agendaCompletaPaginaAtual = 1;
        renderizarAgendaCompleta();
        atualizarResumoAgendaCompleta('Selecione uma unidade para consultar os agendamentos.');
        setAgendaCompletaFeedback('Selecione uma unidade antes de aplicar os filtros.', 'erro');
        return;
    }

    const params = new URLSearchParams({
        unidadeCodigo: unidade.value,
        sala: sala?.value?.trim() || '',
        professor: professor?.value?.trim() || '',
        dataInicio: dataInicio?.value || '',
        dataFim: dataFim?.value || '',
        turno: turno?.value || '',
        diaSemana: diaSemana?.value || ''
    });

    try {
        setAgendaCompletaFeedback('Carregando agendamentos...');
        const response = await fetch(`/dashboard-agendamentos-filtrados?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json().catch(() => []);

        if (!response.ok) {
            throw new Error(data?.error || 'Não foi possível carregar os agendamentos.');
        }

        agendaCompletaResultados = Array.isArray(data) ? data : [];
        agendaCompletaPaginaAtual = 1;
        renderizarAgendaCompleta();

        if (agendaCompletaResultados.length) {
            setAgendaCompletaFeedback('Consulta atualizada.', 'sucesso');
        } else {
            setAgendaCompletaFeedback('Nenhum agendamento encontrado para os filtros informados.');
        }
    } catch (error) {
        console.error('Erro ao carregar agenda completa:', error);
        agendaCompletaResultados = [];
        agendaCompletaPaginaAtual = 1;
        renderizarAgendaCompleta();
        atualizarResumoAgendaCompleta('Não foi possível carregar os resultados.');
        setAgendaCompletaFeedback(error.message || 'Erro ao carregar os agendamentos.', 'erro');
    }
}

function limparAgendaCompleta() {
    const ids = [
        'agendaCompletaSala',
        'agendaCompletaProfessor',
        'agendaCompletaDataInicio',
        'agendaCompletaDataFim',
        'agendaCompletaTurno',
        'agendaCompletaDiaSemana'
    ];

    ids.forEach((id) => {
        const field = document.getElementById(id);
        if (field) {
            field.value = '';
        }
    });

    agendaCompletaPaginaAtual = 1;
    setAgendaCompletaFeedback('Filtros limpos.');

    const unidade = document.getElementById('agendaCompletaUnidade');
    if (unidade?.value) {
        carregarAgendaCompleta();
        return;
    }

    agendaCompletaResultados = [];
    renderizarAgendaCompleta();
    atualizarResumoAgendaCompleta('Selecione uma unidade para consultar os agendamentos.');
}

async function garantirAgendaCompletaPronta() {
    if (!agendaCompletaInicializada) {
        await inicializarAgendaCompletaDashboard();
    }

    const unidade = document.getElementById('agendaCompletaUnidade');
    if (unidade?.value && !agendaCompletaResultados.length) {
        await carregarAgendaCompleta();
    }
}

async function inicializarAgendaCompletaDashboard() {
    const aplicar = document.getElementById('agendaCompletaAplicar');
    const limpar = document.getElementById('agendaCompletaLimpar');
    const anterior = document.getElementById('agendaCompletaAnterior');
    const proximo = document.getElementById('agendaCompletaProximo');
    const unidade = document.getElementById('agendaCompletaUnidade');

    if (!aplicar || !limpar || !anterior || !proximo || !unidade) {
        return;
    }

    if (!agendaCompletaInicializada) {
        aplicar.addEventListener('click', async () => {
            await carregarAgendaCompleta();
        });

        limpar.addEventListener('click', () => {
            limparAgendaCompleta();
        });

        anterior.addEventListener('click', () => {
            agendaCompletaPaginaAtual = Math.max(1, agendaCompletaPaginaAtual - 1);
            renderizarAgendaCompleta();
        });

        proximo.addEventListener('click', () => {
            agendaCompletaPaginaAtual += 1;
            renderizarAgendaCompleta();
        });

        unidade.addEventListener('change', async () => {
            agendaCompletaResultados = [];
            agendaCompletaPaginaAtual = 1;
            await carregarAgendaCompleta();
        });

        ['agendaCompletaSala', 'agendaCompletaProfessor', 'agendaCompletaDataInicio', 'agendaCompletaDataFim', 'agendaCompletaTurno', 'agendaCompletaDiaSemana'].forEach((id) => {
            const field = document.getElementById(id);
            field?.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await carregarAgendaCompleta();
                }
            });
        });

        agendaCompletaInicializada = true;
    }

    if (!unidade.options.length || unidade.options.length === 1) {
        await carregarUnidadesAgendaCompleta();
    }

    renderizarAgendaCompleta();
}

async function carregarRelatorioHorasUc() {
    const container = document.getElementById('relatorioHorasUc');
    try {
        const response = await fetch('/relatorio/horas-por-uc');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const data = await response.json();
        if (data.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>';
            return;
        }
        let html = '<ul>';
        data.forEach(item => {
            html += `<li><strong>${item.tipo_aula}:</strong> ${item.horas}h ${item.minutos}min</li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erro ao carregar relatório.</p>';
        console.error('Erro no relatório Horas/UC:', error);
    }
}

async function carregarRelatorioUsoSalas() {
    const container = document.getElementById('relatorioUsoSalas');
    try {
        const response = await fetch('/relatorio/uso-salas');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const data = await response.json();
        if (data.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>';
            return;
        }
        let html = '<ul>';
        data.forEach(item => {
            html += `<li><strong>${item.nome_sala}:</strong> ${item.quantidade_usos} vez(es) - Total: ${item.horas}h ${item.minutos}min</li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erro ao carregar relatório.</p>';
        console.error('Erro no relatório Uso de Salas:', error);
    }
}

async function carregarRelatorioPorPeriodo() {
    const container = document.getElementById('relatorioPorPeriodo');
    try {
        const response = await fetch('/relatorio/agendamentos-periodo');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const data = await response.json();
        if (data.length === 0) {
            container.innerHTML = '<p>Nenhum dado encontrado para este relatório.</p>';
            return;
        }
        let html = '<ul>';
        data.forEach(item => {
            html += `<li><strong>${item.dia_semana} (${item.turno}):</strong> ${item.quantidade} agendamento(s)</li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erro ao carregar relatório.</p>';
        console.error('Erro no relatório por Período:', error);
    }
}

function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
}

async function carregarDadosDashboard() {
    try {
        const response = await fetch('/horas-agendadas-mes');
        const data = await response.json();
        document.getElementById('horasAgendadasMes').textContent = `${data.horas}h ${data.minutos}min`;
        document.getElementById('agendamentosMes').textContent = data.agendamentos;
        document.getElementById('salasUtilizadasMes').textContent = data.salas_utilizadas;
        document.getElementById('taxaOcupacaoMes').textContent = `${data.taxa_ocupacao.toFixed(2)}%`;
    } catch (error) {
        console.error('Erro ao carregar dados da dashboard:', error);
        document.getElementById('horasAgendadasMes').textContent = 'Erro';
        document.getElementById('agendamentosMes').textContent = 'Erro';
        document.getElementById('salasUtilizadasMes').textContent = 'Erro';
        document.getElementById('taxaOcupacaoMes').textContent = 'Erro';
    }
}

async function carregarAgendaSemana() {
    try {
        const response = await fetch('/agenda-semanal-professor');
        const data = await response.json();
        const container = document.getElementById('agendaSemana');
        container.innerHTML = '';
        const dias = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const nomesDias = { Monday: 'Segunda-feira', Tuesday: 'Terça-feira', Wednesday: 'Quarta-feira', Thursday: 'Quinta-feira', Friday: 'Sexta-feira', Saturday: 'Sábado', Sunday: 'Domingo' };
        dias.forEach(dia => {
            const eventos = data[dia] || [];
            const div = document.createElement('div');
            div.innerHTML = `<strong>${nomesDias[dia]}</strong><br><br>` + (eventos.length ? eventos.map(e => `${e.replace('(', '<br>(')}<br><br>`).join('') : 'Nenhum agendamento.');
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar agenda da semana:', error);
    }
}

let agendaProfessorCalendario = null;
let agendaProfessorModal = null;

function montarTituloEventoAgenda(eventInfo) {
    const tipoEvento = String(eventInfo?.tipo_evento || '').trim().toLowerCase();
    if (tipoEvento === 'compromisso_pessoal') {
        return String(eventInfo?.titulo_original || eventInfo?.title || 'Compromisso pessoal').trim();
    }

    const sala = eventInfo?.nome_sala || eventInfo?.title || 'Sala';
    const motivo = String(eventInfo?.motivo || '').trim();
    return motivo ? `${sala} - ${motivo}` : sala;
}

function montarTituloCompactoEventoAgenda(eventInfo) {
    const tipoEvento = String(eventInfo?.tipo_evento || '').trim().toLowerCase();
    if (tipoEvento === 'compromisso_pessoal') {
        return String(eventInfo?.titulo_original || eventInfo?.title || 'Compromisso pessoal').trim();
    }

    const sala = eventInfo?.nome_sala || eventInfo?.title || 'Sala';
    return sala;
}

function formatarHorarioEventoAgenda(evento) {
    const inicio = evento.start
        ? evento.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';
    const fim = evento.end
        ? evento.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';

    if (!inicio) return 'Horário não informado';
    return fim ? `${inicio} - ${fim}` : inicio;
}

function fecharModalAgendaProfessor() {
    if (!agendaProfessorModal) return;
    agendaProfessorModal.remove();
    agendaProfessorModal = null;
}

function formatarDataPtBr(dataIso) {
    const data = moment(String(dataIso || ''), 'YYYY-MM-DD', true);
    return data.isValid() ? data.format('DD/MM/YYYY') : String(dataIso || '');
}

function normalizarDataHoraCliqueAgenda(arg) {
    const dataClique = arg?.date instanceof Date ? arg.date : new Date();
    const dataIso = moment(dataClique).format('YYYY-MM-DD');

    if (arg?.allDay) {
        return {
            dataIso,
            horaInicio: '08:00',
            horaFim: '09:00'
        };
    }

    const inicio = moment(dataClique);
    const fim = inicio.clone().add(1, 'hour');

    return {
        dataIso,
        horaInicio: inicio.format('HH:mm'),
        horaFim: fim.format('HH:mm')
    };
}

async function salvarCompromissoAgendaProfessor(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const titulo = String(form.querySelector('#compromissoTitulo')?.value || '').trim();
    const data = String(form.querySelector('#compromissoData')?.value || '').trim();
    const horaInicio = String(form.querySelector('#compromissoHoraInicio')?.value || '').trim();
    const horaFim = String(form.querySelector('#compromissoHoraFim')?.value || '').trim();
    const descricao = String(form.querySelector('#compromissoDescricao')?.value || '').trim();
    const feedback = form.querySelector('.agenda-compromisso-feedback');

    if (feedback) {
        feedback.textContent = '';
    }

    if (!titulo || !data || !horaInicio || !horaFim) {
        if (feedback) {
            feedback.textContent = 'Preencha título, data, hora de início e hora de fim.';
        }
        return;
    }

    try {
        const response = await fetch('/agenda-professor-compromisso', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                titulo,
                data,
                hora_inicio: horaInicio,
                hora_fim: horaFim,
                descricao
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || 'Não foi possível salvar o compromisso.');
        }

        fecharModalAgendaProfessor();
        if (agendaProfessorCalendario) {
            agendaProfessorCalendario.refetchEvents();
        }
    } catch (error) {
        if (feedback) {
            feedback.textContent = error.message || 'Erro ao salvar compromisso.';
        }
    }
}

function abrirModalNovoCompromissoAgendaProfessor(arg) {
    fecharModalAgendaProfessor();

    const { dataIso, horaInicio, horaFim } = normalizarDataHoraCliqueAgenda(arg);

    const overlay = document.createElement('div');
    overlay.className = 'agenda-evento-modal-overlay';
    overlay.innerHTML = `
        <div class="agenda-evento-modal" role="dialog" aria-modal="true" aria-label="Novo compromisso pessoal">
            <button type="button" class="agenda-evento-modal-fechar" aria-label="Fechar">&times;</button>
            <h3>Novo compromisso pessoal</h3>
            <form id="agendaCompromissoForm" class="agenda-compromisso-form">
                <label for="compromissoTitulo">Título</label>
                <input id="compromissoTitulo" type="text" maxlength="150" required>

                <label for="compromissoData">Data</label>
                <input id="compromissoData" type="date" value="${dataIso}" required>

                <div class="agenda-compromisso-grid">
                    <div>
                        <label for="compromissoHoraInicio">Hora início</label>
                        <input id="compromissoHoraInicio" type="time" value="${horaInicio}" required>
                    </div>
                    <div>
                        <label for="compromissoHoraFim">Hora fim</label>
                        <input id="compromissoHoraFim" type="time" value="${horaFim}" required>
                    </div>
                </div>

                <label for="compromissoDescricao">Descrição / Motivo</label>
                <textarea id="compromissoDescricao" rows="3" placeholder="Ex.: Viagem, curso, consulta..." ></textarea>

                <p class="agenda-compromisso-feedback" aria-live="polite"></p>

                <div class="agenda-compromisso-acoes">
                    <button type="button" class="btn btn-light" id="cancelarCompromissoBtn">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Salvar</button>
                </div>
            </form>
            <small class="agenda-compromisso-ajuda">Data selecionada: ${formatarDataPtBr(dataIso)}</small>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            fecharModalAgendaProfessor();
        }
    });

    const botaoFechar = overlay.querySelector('.agenda-evento-modal-fechar');
    botaoFechar?.addEventListener('click', fecharModalAgendaProfessor);

    const botaoCancelar = overlay.querySelector('#cancelarCompromissoBtn');
    botaoCancelar?.addEventListener('click', fecharModalAgendaProfessor);

    const form = overlay.querySelector('#agendaCompromissoForm');
    form?.addEventListener('submit', salvarCompromissoAgendaProfessor);

    document.addEventListener('keydown', function escHandler(event) {
        if (event.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            fecharModalAgendaProfessor();
        }
    }, { once: true });

    document.body.appendChild(overlay);
    agendaProfessorModal = overlay;
}

function abrirModalAgendaProfessor(evento) {
    fecharModalAgendaProfessor();

    const overlay = document.createElement('div');
    overlay.className = 'agenda-evento-modal-overlay';

    const tipoEvento = String(evento.extendedProps?.tipo_evento || '').trim().toLowerCase();
    const data = evento.start
        ? evento.start.toLocaleDateString('pt-BR')
        : 'Data não informada';
    const horario = formatarHorarioEventoAgenda(evento);
    const sala = evento.extendedProps?.nome_sala || evento.title || 'Sala não informada';
    const motivo = String(evento.extendedProps?.motivo || '').trim() || 'Não informado';
    const tipoAula = String(evento.extendedProps?.tipo_aula || '').trim() || 'Não informado';
    const tituloCompromisso = String(evento.extendedProps?.titulo_original || evento.title || '').trim();

    const detalhesHtml = tipoEvento === 'compromisso_pessoal'
        ? `
            <p><strong>Título:</strong> ${tituloCompromisso || 'Compromisso pessoal'}</p>
            <p><strong>Data:</strong> ${data}</p>
            <p><strong>Horário:</strong> ${horario}</p>
            <p><strong>Descrição:</strong> ${motivo}</p>
          `
        : `
            <p><strong>Sala:</strong> ${sala}</p>
            <p><strong>Data:</strong> ${data}</p>
            <p><strong>Horário:</strong> ${horario}</p>
            <p><strong>Motivo/Turma:</strong> ${motivo}</p>
            <p><strong>Unidade curricular:</strong> ${tipoAula}</p>
          `;

    overlay.innerHTML = `
        <div class="agenda-evento-modal" role="dialog" aria-modal="true" aria-label="Detalhes do agendamento">
            <button type="button" class="agenda-evento-modal-fechar" aria-label="Fechar detalhes">&times;</button>
            <h3>${tipoEvento === 'compromisso_pessoal' ? 'Detalhes do compromisso' : 'Detalhes do agendamento'}</h3>
            <div class="agenda-evento-modal-lista">
                ${detalhesHtml}
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            fecharModalAgendaProfessor();
        }
    });

    const botaoFechar = overlay.querySelector('.agenda-evento-modal-fechar');
    botaoFechar?.addEventListener('click', fecharModalAgendaProfessor);

    document.addEventListener('keydown', function escHandler(event) {
        if (event.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            fecharModalAgendaProfessor();
        }
    }, { once: true });

    document.body.appendChild(overlay);
    agendaProfessorModal = overlay;
}

async function buscarEventosAgendaProfessor(info, successCallback, failureCallback) {
    try {
        const start = info.startStr.slice(0, 10);
        const end = info.endStr.slice(0, 10);
        const response = await fetch(`/agenda-professor-periodo?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            const mensagem = await response.text().catch(() => 'Erro ao carregar agenda do professor.');
            throw new Error(mensagem || 'Erro ao carregar agenda do professor.');
        }

        const eventos = await response.json();
        successCallback((eventos || []).map((evento) => ({
            ...evento,
            title: montarTituloEventoAgenda(evento.extendedProps ? { ...evento.extendedProps, title: evento.title } : evento),
            extendedProps: {
                ...(evento.extendedProps || {}),
                titulo_compacto: montarTituloCompactoEventoAgenda(evento.extendedProps ? { ...evento.extendedProps, title: evento.title } : evento)
            }
        })));
    } catch (error) {
        console.error('Erro ao buscar agenda por período:', error);
        failureCallback(error);
    }
}

function inicializarAgendaCalendario() {
    const calendarEl = document.getElementById('agendaSemanaCalendario');
    if (!calendarEl || typeof FullCalendar === 'undefined') {
        return;
    }

    if (agendaProfessorCalendario) {
        agendaProfessorCalendario.destroy();
    }

    agendaProfessorCalendario = new FullCalendar.Calendar(calendarEl, {
        locale: 'pt-br',
        initialView: 'dayGridMonth',
        firstDay: 1,
        height: 'auto',
        allDaySlot: false,
        nowIndicator: true,
        buttonText: {
            today: 'Hoje',
            week: 'Semana',
            month: 'Mês'
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,dayGridMonth'
        },
        views: {
            timeGridWeek: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
            },
            dayGridMonth: {
                dayMaxEvents: true
            }
        },
        events: buscarEventosAgendaProfessor,
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        eventContent(arg) {
            const viewType = arg.view?.type;
            const horario = arg.timeText ? `${arg.timeText} ` : '';
            const isCompromisso = String(arg.event.extendedProps?.tipo_evento || '').toLowerCase() === 'compromisso_pessoal';
            const classeCompacto = isCompromisso ? 'agenda-evento-compacto agenda-evento-compacto--compromisso' : 'agenda-evento-compacto';
            const classeDetalhado = isCompromisso ? 'agenda-evento-detalhado agenda-evento-detalhado--compromisso' : 'agenda-evento-detalhado';

            if (viewType === 'dayGridMonth') {
                return {
                    html: `<div class="${classeCompacto}">${horario}${arg.event.extendedProps?.titulo_compacto || arg.event.title}</div>`
                };
            }

            return {
                html: `<div class="${classeDetalhado}"><strong>${horario}</strong><span>${arg.event.title}</span></div>`
            };
        },
        eventClick(info) {
            info.jsEvent.preventDefault();
            abrirModalAgendaProfessor(info.event);
        },
        dateClick(arg) {
            abrirModalNovoCompromissoAgendaProfessor(arg);
        },
        eventDidMount(info) {
            const motivo = info.event.extendedProps?.motivo ? ` | ${info.event.extendedProps.motivo}` : '';
            info.el.title = `${info.event.title}${motivo}`;
        }
    });

    agendaProfessorCalendario.render();
    setTimeout(() => {
        if (agendaProfessorCalendario && typeof agendaProfessorCalendario.updateSize === 'function') {
            agendaProfessorCalendario.updateSize();
        }
    }, 0);
}

async function carregarSalasMaisUsadas() {
    try {
        const response = await fetch('/top-salas-professor');
        const salas = await response.json();
        const container = document.getElementById('salasMaisUsadas');
        container.innerHTML = '';
        const maxAgendamentos = salas[0]?.quantidade || 1;
        salas.forEach(sala => {
            const porcentagem = (sala.quantidade / maxAgendamentos) * 100;
            const div = document.createElement('div');
            div.classList.add('room');
            div.innerHTML = `<span>${sala.nome_sala} - ${sala.quantidade} agendamentos</span><div class="bar" style="width: ${porcentagem}%"></div>`;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Erro ao carregar salas mais utilizadas:', error);
    }
}

function voltarParaLayoutAntigo() {
    localStorage.setItem('layoutPreferido', 'antigo');
    window.location.href = '/agenda-sala';
}

async function criarGraficoSalas() {
    const containerGrafico = document.getElementById('graficoContainer');
    const canvas = document.getElementById('meuGraficoDonut');
    const resumo = document.getElementById('relatorioUsoSalasResumo');

    if (!containerGrafico || !canvas) {
        return;
    }

    try {
        const response = await fetch('/relatorio/salas-porcentagem');
        if (!response.ok) throw new Error('Falha ao buscar dados para o gráfico.');
        
        const dadosGrafico = await response.json();

        if (dadosGrafico.data.length === 0) {
            if (resumo) {
                resumo.textContent = 'Não há dados de agendamentos suficientes para exibir o gráfico neste momento.';
            }
            return;
        }

        const maiorValor = Math.max(...dadosGrafico.data);
        const indiceMaior = dadosGrafico.data.findIndex((valor) => valor === maiorValor);
        const salaDestaque = indiceMaior >= 0 ? dadosGrafico.labels[indiceMaior] : null;

        if (resumo && salaDestaque) {
            const total = dadosGrafico.data.reduce((acc, atual) => acc + atual, 0);
            const percentual = total > 0 ? ((maiorValor / total) * 100).toFixed(1) : '0.0';
            resumo.textContent = `Destaque atual: ${salaDestaque} (${maiorValor} agendamento(s), ${percentual}% do total).`;
        }

        if (window.graficoUsoSalasChart && typeof window.graficoUsoSalasChart.destroy === 'function') {
            window.graficoUsoSalasChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        window.graficoUsoSalasChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: dadosGrafico.labels,
                datasets: [{
                    label: 'Nº de Agendamentos',
                    data: dadosGrafico.data,
                    backgroundColor: [
                        '#17498f', '#1f5db7', '#2d73d2', '#4a90e2', '#6aa9ee', '#8cc1f6', '#a9d3fb'
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '56%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            color: '#1f3f64',
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(13, 39, 73, 0.94)',
                        titleColor: '#ffffff',
                        bodyColor: '#eaf3ff',
                        borderColor: '#2d73d2',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed !== null) { label += context.parsed + ' agendamento(s)'; }
                                return label;
                            }
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error("Erro ao criar gráfico:", error);
        if (resumo) {
            resumo.textContent = 'Não foi possível carregar o gráfico de uso de salas.';
        }
    }
}
// ==========================================================
// FUNÇÕES PARA VISUALIZAÇÃO DE SALAS (Integração)
// ==========================================================

// MUDANÇA: Nova função para popular o seletor de UNIDADES
async function popularSeletorUnidades() {
    const seletorUnidade = document.getElementById('seletorDeUnidade');
    const seletorSala = document.getElementById('seletorDeSala');
    if (!seletorUnidade || !seletorSala) return;

    try {
        const response = await fetch('/user-info');
        if (!response.ok) throw new Error('Não foi possível buscar dados do usuário.');
        const usuario = await response.json();
        
        // CORREÇÃO: Precisamos do nome da unidade junto com o código
        const unidadesDoUsuario = usuario.unidades || [];
        
        // Busca os nomes de todas as unidades para fazer um mapeamento
        const unidadesResponse = await fetch('/unidades');
        const todasUnidades = await unidadesResponse.json();
        const mapaUnidades = new Map(todasUnidades.map(u => [u.codigo_unidade, u.nome_unidade]));

        const unidadesComNome = unidadesDoUsuario.map(codigo => ({
            codigo: codigo,
            nome: mapaUnidades.get(codigo) || codigo // Usa o nome se encontrar, senão o código
        }));

        seletorUnidade.innerHTML = '';

        if (unidadesComNome.length === 0) {
            seletorUnidade.innerHTML = '<option value="">Nenhuma unidade associada</option>';
            seletorSala.disabled = true;
            return;
        }

        if (unidadesComNome.length > 1) {
            seletorUnidade.innerHTML = '<option value="">-- Escolha uma unidade --</option>';
        }

        unidadesComNome.forEach(unidade => {
            seletorUnidade.innerHTML += `<option value="${unidade.codigo}">${unidade.nome}</option>`;
        });
        
        // Se houver apenas uma unidade, selecione-a e carregue as salas
        if (unidadesComNome.length === 1) {
            seletorUnidade.value = unidadesComNome[0].codigo;
            popularSeletorSalas(unidadesComNome[0].codigo);
        }

    } catch (error) {
        console.error("Erro ao popular seletor de unidades:", error);
        seletorUnidade.innerHTML = '<option value="">Erro ao carregar unidades</option>';
    }
}

// MUDANÇA: A função agora aceita um parâmetro `codigoUnidade`
async function popularSeletorSalas(codigoUnidade) {
    const seletor = document.getElementById('seletorDeSala');
    if (!seletor) return;
    
    seletor.innerHTML = '<option value="">-- Carregando salas... --</option>';
    seletor.disabled = true;

    if (!codigoUnidade) {
        seletor.innerHTML = '<option value="">-- Aguardando seleção da unidade --</option>';
        return;
    }

    try {
        const response = await fetch(`/salas/${codigoUnidade}`);
        if (!response.ok) throw new Error(`Falha ao buscar salas`);
        const salas = await response.json();
        
        seletor.innerHTML = '<option value="">-- Escolha uma sala --</option>';
        salas.forEach(sala => {
            seletor.innerHTML += `<option value="${sala.id_sala}">${sala.nome_sala}</option>`;
        });
        seletor.disabled = false;
    } catch (error) {
        console.error("Erro ao popular seletor de salas:", error);
        seletor.innerHTML = '<option value="">-- Erro ao carregar salas --</option>';
    }
}
// --- EVENT LISTENERS PARA OS SELETORES DE SALAS ---
    const seletorDeUnidade = document.getElementById('seletorDeUnidade');
    if (seletorDeUnidade) {
        seletorDeUnidade.addEventListener('change', (event) => {
            const codigoUnidade = event.target.value;
            popularSeletorSalas(codigoUnidade);
            // Oculta os detalhes da sala antiga ao mudar de unidade
            const containerDetalheSala = document.getElementById('containerDetalheSala');
            if(containerDetalheSala) containerDetalheSala.style.display = 'none';
        });
    }

    const seletorDeSala = document.getElementById('seletorDeSala');
    if (seletorDeSala) {
        seletorDeSala.addEventListener('change', (event) => {
            const salaId = event.target.value;
            if (salaId) {
                desenharSala(salaId);
            } else {
                const containerDetalheSala = document.getElementById('containerDetalheSala');
                if(containerDetalheSala) containerDetalheSala.style.display = 'none';
            }
        });
    }
    
async function desenharSala(idSala) {
    const containerDetalhe = document.getElementById('containerDetalheSala');
    const areaDesenho = document.getElementById('desenhoSala');
    const areaInfo = document.getElementById('infoSala');
    const tituloSala = document.getElementById('nomeSalaDetalhe');
    
    if (!containerDetalhe || !areaDesenho || !areaInfo || !tituloSala) return;

    try {
        const response = await fetch(`/salas/detalhes/${idSala}`);
        if (!response.ok) throw new Error('Falha ao buscar detalhes da sala.');
        
        const { detalhes, computadores = [], monitores = [] } = await response.json();
        
        tituloSala.textContent = detalhes.nome_sala;
        areaDesenho.innerHTML = '';

        const projetorAtivo = String(detalhes.projetor || '').toLowerCase() === 'sim';
        const totalCadeiras = Number(detalhes.cadeiras || 0);
        const totalPcPlanejado = Number(detalhes.computadores || 0);
        const totalPcCadastrado = Number(detalhes.computadores_associados || computadores.length || 0);
        const totalMonitores = Number(detalhes.monitores_associados || monitores.length || 0);

        const totalPostosComPc = Math.max(totalPcPlanejado, totalPcCadastrado);
        const totalSlots = Math.max(totalPostosComPc, totalCadeiras);
        const maxPorFileira = Math.max(4, Math.min(6, Math.ceil(totalSlots / 3)));

        const quadro = document.createElement('div');
        quadro.className = 'quadro';
        quadro.innerHTML = 'Quadro Branco';
        areaDesenho.appendChild(quadro);

        const frente = document.createElement('div');
        frente.className = 'frente-sala';
        frente.innerHTML = `
            <div class="mesa-professor"><i class="fas fa-user-tie"></i> Mesa do Professor</div>
            ${projetorAtivo ? '<div class="projetor-centro" title="Projetor da sala"><i class="fas fa-video"></i> Projetor</div>' : ''}
        `;
        areaDesenho.appendChild(frente);

        const fileirasContainer = document.createElement('div');
        fileirasContainer.className = 'fileiras-container';

        const fileiraConfigs = [
            { className: 'fileira-meio', titulo: 'Fileira do meio 1' },
            { className: 'fileira-meio', titulo: 'Fileira do meio 2' },
            { className: 'fileira-porta', titulo: 'Fileira perto da porta' }
        ];

        const maxSlotsDesenho = Math.max(maxPorFileira * 3, totalSlots);

        function formatDisco(raw) {
            if (!raw) return 'Não informado';
            const texto = String(raw);
            return texto.length > 80 ? `${texto.slice(0, 80)}...` : texto;
        }

        function getPcInfo(index) {
            if (index < computadores.length) {
                const pc = computadores[index];
                return {
                    nome: pc.nome_computador || `PC ${index + 1}`,
                    patrimonio: pc.patrimonio || 'Não informado',
                    memoria: pc.memoria_ram || 'Não informado',
                    disco: formatDisco(pc.disco_info),
                    cadastrado: true
                };
            }

            return {
                nome: `PC ${index + 1}`,
                patrimonio: 'PC ainda não cadastrado',
                memoria: 'PC ainda não cadastrado informações',
                disco: 'PC ainda não cadastrado informações',
                cadastrado: false
            };
        }

        function getMonitorInfo(index) {
            if (index < monitores.length) {
                const monitor = monitores[index];
                return {
                    titulo: monitor.modelo || `Monitor ${index + 1}`,
                    patrimonio: monitor.patrimonio || 'Não informado',
                    serie: monitor.numero_serie || 'Não informado'
                };
            }
            return null;
        }

        let slotIndex = 0;
        fileiraConfigs.forEach((cfg) => {
            const row = document.createElement('div');
            row.className = `fileira ${cfg.className}`;
            row.setAttribute('aria-label', cfg.titulo);

            for (let i = 0; i < maxPorFileira && slotIndex < maxSlotsDesenho; i += 1, slotIndex += 1) {
                const temPc = slotIndex < totalPostosComPc;
                const temCadeira = slotIndex < totalCadeiras;

                const posto = document.createElement('div');
                posto.className = 'posto-trabalho';

                if (temPc) {
                    const pcInfo = getPcInfo(slotIndex);
                    const monitorInfo = getMonitorInfo(slotIndex);
                    const tooltip = [
                        `PC: ${pcInfo.nome}`,
                        `Patrimônio: ${pcInfo.patrimonio}`,
                        `Memória RAM: ${pcInfo.memoria}`,
                        `Disco: ${pcInfo.disco}`,
                        monitorInfo ? `Monitor: ${monitorInfo.titulo} | Patrimônio: ${monitorInfo.patrimonio}` : 'Monitor: sem associação definida'
                    ].join('\n');

                    posto.innerHTML += `<i class="fas fa-desktop pc ${pcInfo.cadastrado ? '' : 'pc-pendente'}" title="${tooltip}"></i>`;

                    if (monitorInfo) {
                        posto.innerHTML += `<i class="fas fa-tv monitor" title="Monitor: ${monitorInfo.titulo}\nPatrimônio: ${monitorInfo.patrimonio}\nSérie: ${monitorInfo.serie}"></i>`;
                    }
                }

                if (temCadeira) {
                    posto.innerHTML += '<i class="fas fa-chair cadeira" title="Cadeira"></i>';
                }

                if (temPc || temCadeira) {
                    row.appendChild(posto);
                }
            }

            fileirasContainer.appendChild(row);
        });

        areaDesenho.appendChild(fileirasContainer);

        areaInfo.innerHTML = `
            <p><strong>Total de Cadeiras:</strong> ${totalCadeiras}</p>
            <p><strong>PCs Planejados (Alteradados):</strong> ${totalPcPlanejado}</p>
            <p><strong>PCs Cadastrados (Gerência):</strong> ${totalPcCadastrado}</p>
            <p><strong>Monitores Associados:</strong> ${totalMonitores}</p>
            <p><strong>Projetor:</strong> ${projetorAtivo ? 'Sim' : 'Não'}</p>
        `;
        
        containerDetalhe.style.display = 'block'; // Mostra o container de detalhes
    } catch (error) {
        console.error("Erro ao desenhar a sala:", error);
        areaDesenho.innerHTML = "<p class='text-danger'>Não foi possível carregar os detalhes desta sala.</p>";
        containerDetalhe.style.display = 'block';
    }
}

// ==========================================================
// TROCA DE SALA (MODO SIMPLES)
// ==========================================================

document.addEventListener('DOMContentLoaded', function () {
    inicializarTrocaSalaSimples();
});

async function inicializarTrocaSalaSimples() {
    const selectMeu = document.getElementById('trocaMeuAgendamento');
    const selectDestino = document.getElementById('trocaAgendamentoDestino');
    const botaoEnviar = document.getElementById('trocaEnviarSolicitacao');

    if (!selectMeu || !selectDestino || !botaoEnviar) {
        return;
    }

    await inicializarEscopoUsuarioTroca();

    selectMeu.addEventListener('change', async () => {
        await carregarPossiveisTrocas(selectMeu.value);
    });

    botaoEnviar.addEventListener('click', async () => {
        await enviarSolicitacaoTroca();
    });

    await carregarMeusAgendamentosTroca();
    await carregarSolicitacoesRecebidas();
    await carregarSolicitacoesEnviadas();

    conectarTrocaSalaEmTempoReal();

    if (!window.__trocaAlertPollingId) {
        window.__trocaAlertPollingId = setInterval(async () => {
            await sincronizarPainelTrocaSala();
        }, 60000);
    }
}

async function atualizarPainelTrocaSalaAoAbrir() {
    const selectDestino = document.getElementById('trocaAgendamentoDestino');
    const mensagem = document.getElementById('trocaMensagem');

    if (selectDestino) {
        selectDestino.innerHTML = '<option value="">-- Escolha primeiro seu agendamento --</option>';
    }
    if (mensagem) {
        mensagem.value = '';
    }

    await carregarMeusAgendamentosTroca();
    await carregarSolicitacoesRecebidas();
    await carregarSolicitacoesEnviadas();

    if (typeof carregarMeusAgendamentosTrocaMultipla === 'function') {
        await carregarMeusAgendamentosTrocaMultipla();
    }
}

function formatarDataIsoParaBr(dataIso) {
    const [ano, mes, dia] = String(dataIso || '').split('-');
    if (!ano || !mes || !dia) return dataIso;
    return `${dia}/${mes}/${ano}`;
}

function limparHorario(horario) {
    return String(horario || '').slice(0, 5);
}

function isHojeOuFuturo(dataIso) {
    const data = new Date(`${dataIso}T00:00:00`);
    if (Number.isNaN(data.getTime())) {
        return false;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return data >= hoje;
}

function setTrocaFeedback(mensagem, tipo = 'sucesso') {
    const feedback = document.getElementById('trocaFeedback');
    if (!feedback) return;

    feedback.classList.remove('sucesso', 'erro');
    feedback.classList.add(tipo === 'erro' ? 'erro' : 'sucesso');
    feedback.textContent = mensagem;
}

let trocaAlertUserScope = 'anonimo';
const TROCA_PAGE_SIZE = 8;
let trocaRecebidasPaginaAtual = 1;
let trocaEnviadasPaginaAtual = 1;

async function inicializarEscopoUsuarioTroca() {
    try {
        const response = await fetch('/user-info', { cache: 'no-store' });
        if (!response.ok) return;
        const user = await response.json();
        if (user && user.id_professor) {
            trocaAlertUserScope = String(user.id_professor);
        }
    } catch (_) {}
}

function getTrocaDismissStorageKey() {
    return `troca-alert-dismissed-signature:${trocaAlertUserScope}`;
}

function gerarAssinaturaSolicitacoesPendentes(solicitacoes) {
    return solicitacoes
        .filter((item) => String(item.status || '').toUpperCase() === 'PENDENTE')
        .map((item) => `${item.id_solicitacao}:${item.created_at || ''}`)
        .sort()
        .join('|');
}

function atualizarBadgeTrocaSala(quantidadePendentes) {
    const menuTroca = document.getElementById('mostrarTrocaSalaBtn');
    if (!menuTroca) return;

    window.__trocaSalaPendentesCount = quantidadePendentes;
    window.dispatchEvent(new CustomEvent('troca-sala:pendentes', {
        detail: { quantidadePendentes }
    }));

    if (typeof window.__atualizarBadgeChatTrocaSala === 'function') {
        window.__atualizarBadgeChatTrocaSala(quantidadePendentes);
    }

    let badge = document.getElementById('trocaSalaBadge');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'trocaSalaBadge';
        badge.className = 'troca-sala-badge hidden';
        menuTroca.appendChild(badge);
    }

    if (quantidadePendentes > 0) {
        badge.textContent = String(quantidadePendentes);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function renderizarPaginacaoTroca(targetId, pagination, onChangePage) {
    const alvo = document.getElementById(targetId);
    if (!alvo) {
        return;
    }

    const totalPages = Number(pagination?.totalPages || 1);
    const currentPage = Number(pagination?.page || 1);

    if (totalPages <= 1) {
        alvo.innerHTML = '';
        return;
    }

    let html = '<div class="troca-paginacao">';
    for (let i = 1; i <= totalPages; i += 1) {
        const activeClass = i === currentPage ? ' active' : '';
        html += `<button type="button" class="troca-paginacao-btn${activeClass}" onclick="${onChangePage}(${i})">${i}</button>`;
    }
    html += '</div>';

    alvo.innerHTML = html;
}

window.irParaPaginaTrocaRecebidas = async function irParaPaginaTrocaRecebidas(page) {
    trocaRecebidasPaginaAtual = Math.max(1, Number(page) || 1);
    await carregarSolicitacoesRecebidas(trocaRecebidasPaginaAtual);
};

window.irParaPaginaTrocaEnviadas = async function irParaPaginaTrocaEnviadas(page) {
    trocaEnviadasPaginaAtual = Math.max(1, Number(page) || 1);
    await carregarSolicitacoesEnviadas(trocaEnviadasPaginaAtual);
};

function abrirSecaoTrocaESolicitacoes() {
    const botaoTroca = document.getElementById('mostrarTrocaSalaBtn');
    const secaoTroca = document.getElementById('secaoTrocaSalaContainer');
    const recebidas = document.getElementById('trocaRecebidas');

    if (botaoTroca && secaoTroca && !secaoTroca.classList.contains('visivel')) {
        botaoTroca.click();
    }

    if (recebidas) {
        recebidas.scrollIntoView({ behavior: 'smooth', block: 'start' });
        recebidas.classList.add('troca-lista-destaque');
        setTimeout(() => recebidas.classList.remove('troca-lista-destaque'), 1800);
    }
}

function tornarAlertaArrastavel(rootElement, handleElement) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (event) => {
        if (!dragging) return;
        const x = event.clientX - offsetX;
        const y = event.clientY - offsetY;

        rootElement.style.left = `${Math.max(10, x)}px`;
        rootElement.style.top = `${Math.max(10, y)}px`;
        rootElement.style.right = 'auto';
    };

    const onPointerUp = () => {
        dragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
    };

    handleElement.addEventListener('pointerdown', (event) => {
        const rect = rootElement.getBoundingClientRect();
        dragging = true;
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        rootElement.style.transform = 'none';
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    });
}

async function sincronizarPainelTrocaSala() {
    await carregarSolicitacoesRecebidas();
    await carregarSolicitacoesEnviadas();
}

function conectarTrocaSalaEmTempoReal() {
    if (window.__trocaSalaEventSource) {
        return;
    }

    try {
        const eventSource = new EventSource('/troca-sala/stream');
        window.__trocaSalaEventSource = eventSource;

        eventSource.addEventListener('troca-sala', async (event) => {
            try {
                const payload = event?.data ? JSON.parse(event.data) : null;
                if (payload?.evento === 'coordenador-troca-direta') {
                    exibirAlertaTrocaDiretaCoordenador(payload);
                    return;
                }
            } catch (_) {}

            await sincronizarPainelTrocaSala();
        });

        eventSource.addEventListener('connected', async () => {
            await sincronizarPainelTrocaSala();
        });

        eventSource.onerror = () => {
            console.warn('Stream de troca de sala indisponível no momento. Mantendo fallback por atualização periódica.');
        };
    } catch (error) {
        console.warn('Não foi possível conectar ao stream de troca de sala:', error);
    }
}

function obterOuCriarAlertaFlutuanteTroca() {
    let root = document.getElementById('trocaAlertaFlutuante');
    if (root) return root;

    root = document.createElement('div');
    root.id = 'trocaAlertaFlutuante';
    root.className = 'troca-alerta-flutuante hidden';
    root.innerHTML = `
        <div class="troca-alerta-handle" id="trocaAlertaHandle">Aviso de troca de sala</div>
        <div class="troca-alerta-body">
            <p id="trocaAlertaTexto"></p>
            <div class="troca-alerta-acoes">
                <button type="button" class="btn btn-primary btn-sm" id="trocaAlertaVerSolicitacoes">Ver solicitações</button>
                <button type="button" class="btn btn-light btn-sm" id="trocaAlertaIgnorar">Não ver mais este aviso</button>
            </div>
        </div>
    `;

    const agendaSemana = document.querySelector('.weekly-agenda') || document.body;
    agendaSemana.appendChild(root);

    const handle = document.getElementById('trocaAlertaHandle');
    const btnVer = document.getElementById('trocaAlertaVerSolicitacoes');
    const btnIgnorar = document.getElementById('trocaAlertaIgnorar');

    tornarAlertaArrastavel(root, handle);

    btnVer.addEventListener('click', () => {
        abrirSecaoTrocaESolicitacoes();
        const signature = root.dataset.signature || '';
        if (signature) {
            localStorage.setItem(getTrocaDismissStorageKey(), signature);
        }
        root.classList.add('hidden');
    });

    btnIgnorar.addEventListener('click', () => {
        const signature = root.dataset.signature || '';
        if (signature) {
            localStorage.setItem(getTrocaDismissStorageKey(), signature);
        }
        root.classList.add('hidden');
    });

    return root;
}

function atualizarAlertaTrocaFlutuante(solicitacoesRecebidas, totalPendentes = null) {
    const pendentes = (solicitacoesRecebidas || []).filter((item) => String(item.status || '').toUpperCase() === 'PENDENTE');
    const quantidadePendentes = Number.isInteger(totalPendentes) ? totalPendentes : pendentes.length;
    atualizarBadgeTrocaSala(quantidadePendentes);

    const alerta = obterOuCriarAlertaFlutuanteTroca();
    if (!quantidadePendentes) {
        alerta.classList.add('hidden');
        alerta.dataset.signature = '';
        return;
    }

    const signature = gerarAssinaturaSolicitacoesPendentes(pendentes);
    const dismissedSignature = localStorage.getItem(getTrocaDismissStorageKey()) || '';
    if (signature && signature === dismissedSignature) {
        alerta.classList.add('hidden');
        alerta.dataset.signature = signature;
        return;
    }

    const primeira = pendentes[0];
    const texto = quantidadePendentes === 1
        ? `${primeira.professor_origem_nome} pediu troca de sala com você.`
        : `Você recebeu ${quantidadePendentes} solicitações pendentes de troca de sala.`;

    const handleEl = document.getElementById('trocaAlertaHandle');
    const textoEl = document.getElementById('trocaAlertaTexto');
    const btnVer = document.getElementById('trocaAlertaVerSolicitacoes');
    const btnIgnorar = document.getElementById('trocaAlertaIgnorar');

    if (handleEl) handleEl.textContent = 'Aviso de troca de sala';
    if (btnVer) btnVer.style.display = '';
    if (btnIgnorar) btnIgnorar.textContent = 'Não ver mais este aviso';

    textoEl.textContent = texto;
    alerta.dataset.signature = signature;
    alerta.classList.remove('hidden');
}

function exibirAlertaTrocaDiretaCoordenador(payload) {
    const alerta = obterOuCriarAlertaFlutuanteTroca();
    const handleEl = document.getElementById('trocaAlertaHandle');
    const textoEl = document.getElementById('trocaAlertaTexto');
    const btnVer = document.getElementById('trocaAlertaVerSolicitacoes');
    const btnIgnorar = document.getElementById('trocaAlertaIgnorar');

    const professorOrigem = String(payload?.professor_origem_nome || '').trim();
    const professorDestino = String(payload?.professor_destino_nome || '').trim();
    const salaAnterior = String(payload?.sala_origem_anterior || '').trim();
    const salaNova = String(payload?.sala_destino_anterior || '').trim();
    const data = payload?.data_reservas ? formatarDataIsoParaBr(payload.data_reservas) : '';
    const horario = payload?.hora_inicio && payload?.hora_fim
        ? `${limparHorario(payload.hora_inicio)}-${limparHorario(payload.hora_fim)}`
        : '';

    const detalhes = [
        data,
        horario
    ].filter(Boolean).join(' ');

    const mensagem = professorOrigem && professorDestino && salaAnterior && salaNova
        ? `Um coordenador trocou as salas entre ${professorOrigem} (${salaAnterior}) e ${professorDestino} (${salaNova}).${detalhes ? ` (${detalhes})` : ''}`
        : 'Um coordenador realizou uma troca direta de sala em um de seus agendamentos.';

    if (handleEl) handleEl.textContent = 'Aviso do coordenador';
    if (textoEl) textoEl.textContent = mensagem;
    if (btnVer) btnVer.style.display = 'none';
    if (btnIgnorar) btnIgnorar.textContent = 'Fechar aviso';

    alerta.dataset.signature = `coordenador-${Date.now()}`;
    alerta.classList.remove('hidden');
}

async function carregarMeusAgendamentosTroca() {
    const selectMeu = document.getElementById('trocaMeuAgendamento');
    const selectDestino = document.getElementById('trocaAgendamentoDestino');

    if (!selectMeu || !selectDestino) return;

    try {
        const response = await fetch('/listar-agendamentos-professor-logado', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Falha ao listar agendamentos do professor.');
        }

        const agendamentos = await response.json();

        const proximos = agendamentos
            .filter(item => isHojeOuFuturo(item.data_reservas))
            .sort((a, b) => {
                const d1 = new Date(`${a.data_reservas}T${limparHorario(a.hora_inicio)}`);
                const d2 = new Date(`${b.data_reservas}T${limparHorario(b.hora_inicio)}`);
                return d1 - d2;
            });

        selectMeu.innerHTML = '<option value="">-- Escolha um agendamento seu --</option>';
        selectDestino.innerHTML = '<option value="">-- Escolha primeiro seu agendamento --</option>';

        proximos.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id_agendamento;
            option.textContent = `${item.nome_sala} | ${formatarDataIsoParaBr(item.data_reservas)} ${limparHorario(item.hora_inicio)}-${limparHorario(item.hora_fim)}`;
            selectMeu.appendChild(option);
        });

        if (proximos.length === 0) {
            setTrocaFeedback('Você não possui agendamentos futuros para trocar.', 'erro');
        }
    } catch (error) {
        console.error('Erro ao carregar agendamentos para troca:', error);
        setTrocaFeedback('Não foi possível carregar seus agendamentos para troca.', 'erro');
    }
}

async function carregarPossiveisTrocas(idAgendamentoOrigem) {
    const selectDestino = document.getElementById('trocaAgendamentoDestino');

    if (!selectDestino) return;

    if (!idAgendamentoOrigem) {
        selectDestino.innerHTML = '<option value="">-- Escolha primeiro seu agendamento --</option>';
        return;
    }

    selectDestino.innerHTML = '<option value="">Carregando opções...</option>';

    try {
        const response = await fetch(`/troca-sala/possiveis/${idAgendamentoOrigem}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha ao listar opções de troca.');
        }

        selectDestino.innerHTML = '<option value="">-- Escolha o agendamento destino --</option>';

        const grupos = data.possiveis.reduce((accumulator, item) => {
            const chave = item.turno_label || 'Compatíveis';
            if (!accumulator[chave]) {
                accumulator[chave] = [];
            }

            accumulator[chave].push(item);
            return accumulator;
        }, {});

        Object.entries(grupos).forEach(([turno, itens]) => {
            const group = document.createElement('optgroup');
            group.label = turno;

            itens.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id_agendamento;
                option.textContent = `${item.nome_professor} | ${item.nome_sala} | ${formatarDataIsoParaBr(item.data_reservas)} ${limparHorario(item.hora_inicio)}-${limparHorario(item.hora_fim)}`;
                group.appendChild(option);
            });

            selectDestino.appendChild(group);
        });

        if (!data.possiveis.length) {
            selectDestino.innerHTML = '<option value="">Nenhuma opção compatível neste horário</option>';
        }
    } catch (error) {
        console.error('Erro ao carregar opções de troca:', error);
        selectDestino.innerHTML = '<option value="">Erro ao carregar opções</option>';
        setTrocaFeedback(error.message || 'Erro ao carregar opções de troca.', 'erro');
    }
}

async function enviarSolicitacaoTroca() {
    const selectMeu = document.getElementById('trocaMeuAgendamento');
    const selectDestino = document.getElementById('trocaAgendamentoDestino');
    const mensagem = document.getElementById('trocaMensagem');

    if (!selectMeu || !selectDestino || !mensagem) return;

    const idOrigem = Number(selectMeu.value);
    const idDestino = Number(selectDestino.value);

    if (!idOrigem || !idDestino) {
        setTrocaFeedback('Selecione o seu agendamento e o agendamento de destino.', 'erro');
        return;
    }

    try {
        const response = await fetch('/troca-sala/solicitar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_agendamento_origem: idOrigem,
                id_agendamento_destino: idDestino,
                mensagem: mensagem.value
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível enviar a solicitação.');
        }

        mensagem.value = '';
        setTrocaFeedback('Solicitação enviada com sucesso. Agora aguarde a decisão do outro professor.');

        await carregarSolicitacoesEnviadas();
        await carregarSolicitacoesRecebidas();
    } catch (error) {
        console.error('Erro ao enviar solicitação de troca:', error);
        setTrocaFeedback(error.message || 'Erro ao enviar solicitação.', 'erro');
    }
}

async function carregarSolicitacoesRecebidas(page = trocaRecebidasPaginaAtual) {
    const container = document.getElementById('trocaRecebidas');
    const paginacaoContainer = document.getElementById('trocaRecebidasPaginacao');
    if (!container) return;

    trocaRecebidasPaginaAtual = Math.max(1, Number(page) || 1);

    try {
        const response = await fetch(`/troca-sala/recebidas?page=${trocaRecebidasPaginaAtual}&pageSize=${TROCA_PAGE_SIZE}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar solicitações recebidas.');
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        const pagination = data?.pagination || { page: 1, totalPages: 1, totalItems: items.length };

        if (!items.length) {
            container.innerHTML = '<p>Nenhuma solicitação pendente.</p>';
            if (paginacaoContainer) {
                paginacaoContainer.innerHTML = '';
            }
            atualizarAlertaTrocaFlutuante([], Number(pagination.totalItems || 0));
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="troca-item">
                <p><strong>Professor:</strong> ${item.professor_origem_nome}</p>
                <p><strong>Troca:</strong> ${item.sala_origem} ↔ ${item.sala_destino}</p>
                <p><strong>Quando:</strong> ${formatarDataIsoParaBr(item.data_reservas)} ${limparHorario(item.hora_inicio)}-${limparHorario(item.hora_fim)}</p>
                <p><strong>Mensagem:</strong> ${item.mensagem || 'Sem mensagem.'}</p>
                <div class="troca-acoes">
                    <button class="btn btn-success btn-sm" onclick="decidirTrocaSala(${item.id_solicitacao}, 'aceitar')">Aceitar</button>
                    <button class="btn btn-danger btn-sm" onclick="decidirTrocaSala(${item.id_solicitacao}, 'recusar')">Recusar</button>
                </div>
            </div>
        `).join('');

        renderizarPaginacaoTroca('trocaRecebidasPaginacao', pagination, 'irParaPaginaTrocaRecebidas');
        atualizarAlertaTrocaFlutuante(items, Number(pagination.totalItems || items.length));
        return items;
    } catch (error) {
        console.error('Erro ao carregar recebidas:', error);
        container.innerHTML = '<p>Erro ao carregar solicitações recebidas.</p>';
        if (paginacaoContainer) {
            paginacaoContainer.innerHTML = '';
        }
        atualizarAlertaTrocaFlutuante([]);
        return [];
    }
}

async function carregarSolicitacoesEnviadas(page = trocaEnviadasPaginaAtual) {
    const container = document.getElementById('trocaEnviadas');
    const paginacaoContainer = document.getElementById('trocaEnviadasPaginacao');
    if (!container) return;

    trocaEnviadasPaginaAtual = Math.max(1, Number(page) || 1);

    try {
        const response = await fetch(`/troca-sala/enviadas?page=${trocaEnviadasPaginaAtual}&pageSize=${TROCA_PAGE_SIZE}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar solicitações enviadas.');
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        const pagination = data?.pagination || { page: 1, totalPages: 1 };

        if (!items.length) {
            container.innerHTML = '<p>Você ainda não enviou solicitações.</p>';
            if (paginacaoContainer) {
                paginacaoContainer.innerHTML = '';
            }
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="troca-item">
                <p><strong>Para:</strong> ${item.professor_destino_nome}</p>
                <p><strong>Troca:</strong> ${item.sala_origem} ↔ ${item.sala_destino}</p>
                <p><strong>Quando:</strong> ${formatarDataIsoParaBr(item.data_reservas)} ${limparHorario(item.hora_inicio)}-${limparHorario(item.hora_fim)}</p>
                <p><strong>Status:</strong> ${item.status}</p>
            </div>
        `).join('');

        renderizarPaginacaoTroca('trocaEnviadasPaginacao', pagination, 'irParaPaginaTrocaEnviadas');
        return items;
    } catch (error) {
        console.error('Erro ao carregar enviadas:', error);
        container.innerHTML = '<p>Erro ao carregar solicitações enviadas.</p>';
        if (paginacaoContainer) {
            paginacaoContainer.innerHTML = '';
        }
        return [];
    }
}

async function decidirTrocaSala(idSolicitacao, acao) {
    try {
        const response = await fetch(`/troca-sala/${idSolicitacao}/decidir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível processar a solicitação.');
        }

        setTrocaFeedback(data.message || 'Solicitação processada com sucesso.');

        await sincronizarPainelTrocaSala();
        await carregarMeusAgendamentosTroca();

        if (typeof carregarAgendamentos === 'function') {
            await carregarAgendamentos();
        }
    } catch (error) {
        console.error('Erro ao decidir troca:', error);
        setTrocaFeedback(error.message || 'Erro ao processar decisão.', 'erro');
    }
}

// ==========================================================
// TROCA DE SALA (MODO MULTIPLO)
// ==========================================================

document.addEventListener('DOMContentLoaded', function () {
    inicializarTrocaSalaMultipla();
});

function setTrocaMultiplaFeedback(mensagem, tipo = 'sucesso') {
    const feedback = document.getElementById('trocaMultiplaFeedback');
    if (!feedback) return;

    feedback.classList.remove('sucesso', 'erro');
    feedback.classList.add(tipo === 'erro' ? 'erro' : 'sucesso');
    feedback.textContent = mensagem;
}

function setTrocaMultiplaResumo(mensagem) {
    const resumo = document.getElementById('trocaMultiplaResumo');
    if (!resumo) return;
    resumo.textContent = mensagem;
}

let trocaMultiplaMapeamentos = [];

async function buscarMeusAgendamentosFuturos() {
    const response = await fetch('/listar-agendamentos-professor-logado', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Falha ao listar agendamentos do professor.');
    }

    const agendamentos = await response.json();

    return agendamentos
        .filter(item => isHojeOuFuturo(item.data_reservas))
        .sort((a, b) => {
            const d1 = new Date(`${a.data_reservas}T${limparHorario(a.hora_inicio)}`);
            const d2 = new Date(`${b.data_reservas}T${limparHorario(b.hora_inicio)}`);
            return d1 - d2;
        });
}

async function inicializarTrocaSalaMultipla() {
    const select = document.getElementById('trocaMultiplaMeusAgendamentos');
    const botaoCarregar = document.getElementById('trocaMultiplaCarregarOpcoes');
    const botaoEnviar = document.getElementById('trocaMultiplaEnviar');

    if (!select || !botaoCarregar || !botaoEnviar) {
        return;
    }

    botaoCarregar.addEventListener('click', async () => {
        await carregarMapeamentoTrocaMultipla();
    });

    botaoEnviar.addEventListener('click', async () => {
        await enviarPacoteTrocaMultipla();
    });

    await carregarMeusAgendamentosTrocaMultipla();
    renderResultadoTrocaMultipla();
}

async function carregarMeusAgendamentosTrocaMultipla() {
    const select = document.getElementById('trocaMultiplaMeusAgendamentos');
    if (!select) return;

    try {
        const agendamentos = await buscarMeusAgendamentosFuturos();
        select.innerHTML = '';

        agendamentos.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id_agendamento;
            option.textContent = `${item.nome_sala} | ${formatarDataIsoParaBr(item.data_reservas)} ${limparHorario(item.hora_inicio)}-${limparHorario(item.hora_fim)}`;
            select.appendChild(option);
        });

        trocaMultiplaMapeamentos = [];
        renderResultadoTrocaMultipla();
        setTrocaMultiplaResumo('Nenhuma simulação realizada.');

        if (!agendamentos.length) {
            setTrocaMultiplaFeedback('Você não possui agendamentos de hoje/futuro para troca múltipla.', 'erro');
        }
    } catch (error) {
        console.error('Erro ao carregar agendamentos da troca múltipla:', error);
        setTrocaMultiplaFeedback('Não foi possível carregar seus agendamentos para troca múltipla.', 'erro');
    }
}

function renderResultadoTrocaMultipla() {
    const body = document.getElementById('trocaMultiplaResultadoBody');
    if (!body) return;

    body.innerHTML = '';
    if (!trocaMultiplaMapeamentos.length) {
        body.innerHTML = '<tr><td colspan="4">Escolha seus agendamentos e clique em Simular opções por item.</td></tr>';
        return;
    }

    trocaMultiplaMapeamentos.forEach((item, index) => {
        const tr = document.createElement('tr');

        const tdUsar = document.createElement('td');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'troca-multipla-check';
        check.dataset.index = String(index);
        check.checked = item.ativo;
        tdUsar.appendChild(check);

        const tdOrigem = document.createElement('td');
        const nomeSalaOrigem = item.origem.nome_sala || 'Sala não informada';
        tdOrigem.textContent = `${formatarDataIsoParaBr(item.origem.data_reservas)} ${limparHorario(item.origem.hora_inicio)}-${limparHorario(item.origem.hora_fim)} | ${nomeSalaOrigem}`;

        const tdDestino = document.createElement('td');
        const select = document.createElement('select');
        select.className = 'form-control troca-multipla-destino';
        select.dataset.index = String(index);

        const vazio = document.createElement('option');
        vazio.value = '';
        vazio.textContent = item.possiveis.length ? '-- Escolha o destino deste item --' : 'Nenhuma opção compatível para este item';
        select.appendChild(vazio);

        item.possiveis.forEach((destino) => {
            const option = document.createElement('option');
            option.value = String(destino.id_agendamento);
            option.textContent = `${destino.nome_professor} | ${destino.nome_sala} | ${formatarDataIsoParaBr(destino.data_reservas)} ${limparHorario(destino.hora_inicio)}-${limparHorario(destino.hora_fim)}`;
            if (Number(destino.id_agendamento) === Number(item.destinoSelecionadoId)) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        if (!item.possiveis.length) {
            item.ativo = false;
            select.disabled = true;
            check.checked = false;
        }

        tdDestino.appendChild(select);

        const tdStatus = document.createElement('td');
        tdStatus.className = 'troca-multipla-status';
        tdStatus.dataset.index = String(index);
        tdStatus.textContent = item.possiveis.length ? 'Pronto para revisar' : 'Sem opção compatível';

        tr.appendChild(tdUsar);
        tr.appendChild(tdOrigem);
        tr.appendChild(tdDestino);
        tr.appendChild(tdStatus);

        body.appendChild(tr);
    });

    body.querySelectorAll('.troca-multipla-check').forEach((check) => {
        check.addEventListener('change', (event) => {
            const index = Number.parseInt(event.target.dataset.index, 10);
            if (!Number.isInteger(index)) return;
            trocaMultiplaMapeamentos[index].ativo = event.target.checked;
            validarResultadoTrocaMultipla();
        });
    });

    body.querySelectorAll('.troca-multipla-destino').forEach((select) => {
        select.addEventListener('change', (event) => {
            const index = Number.parseInt(event.target.dataset.index, 10);
            if (!Number.isInteger(index)) return;
            const destino = Number.parseInt(event.target.value, 10);
            trocaMultiplaMapeamentos[index].destinoSelecionadoId = Number.isInteger(destino) ? destino : null;
            validarResultadoTrocaMultipla();
        });
    });

    validarResultadoTrocaMultipla();
}

function validarResultadoTrocaMultipla() {
    const statusEls = document.querySelectorAll('.troca-multipla-status');
    let prontos = 0;

    statusEls.forEach((statusEl) => {
        const index = Number.parseInt(statusEl.dataset.index, 10);
        if (!Number.isInteger(index)) return;

        const item = trocaMultiplaMapeamentos[index];
        statusEl.classList.remove('swap-row-status-ok', 'swap-row-status-pending', 'swap-row-status-error');

        if (!item.possiveis.length) {
            statusEl.textContent = 'Sem opção compatível';
            statusEl.classList.add('swap-row-status-error');
            return;
        }

        if (!item.ativo) {
            statusEl.textContent = 'Ignorado';
            statusEl.classList.add('swap-row-status-pending');
            return;
        }

        if (!Number.isInteger(item.destinoSelecionadoId)) {
            statusEl.textContent = 'Selecione um destino';
            statusEl.classList.add('swap-row-status-error');
            return;
        }

        prontos += 1;
        statusEl.textContent = 'Pronto';
        statusEl.classList.add('swap-row-status-ok');
    });

    const total = trocaMultiplaMapeamentos.length;
    const faltantes = Math.max(total - prontos, 0);
    setTrocaMultiplaResumo(`Selecionados ${total} origem(ns): ${prontos} pronto(s), ${faltantes} pendente(s).`);
}

async function carregarMapeamentoTrocaMultipla() {
    const select = document.getElementById('trocaMultiplaMeusAgendamentos');
    if (!select) return;

    const idsSelecionados = Array.from(select.selectedOptions)
        .map(option => Number(option.value))
        .filter(Boolean);

    if (!idsSelecionados.length) {
        trocaMultiplaMapeamentos = [];
        renderResultadoTrocaMultipla();
        setTrocaMultiplaResumo('Nenhuma simulação realizada.');
        setTrocaMultiplaFeedback('Selecione pelo menos 1 agendamento seu para simular.', 'erro');
        return;
    }

    try {
        const respostas = await Promise.all(idsSelecionados.map(async (idAgendamento) => {
            const response = await fetch(`/troca-sala/possiveis/${idAgendamento}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao carregar opções de um dos itens do pacote.');
            }

            return data;
        }));

        trocaMultiplaMapeamentos = respostas
            .map((item) => {
                const possiveis = (item.possiveis || []).filter((destino) => isHojeOuFuturo(destino.data_reservas));
                return {
                    origem: item.origem,
                    possiveis,
                    destinoSelecionadoId: possiveis.length ? Number(possiveis[0].id_agendamento) : null,
                    ativo: Boolean(possiveis.length)
                };
            })
            .filter((item) => isHojeOuFuturo(item.origem?.data_reservas));

        renderResultadoTrocaMultipla();

        const prontos = trocaMultiplaMapeamentos.filter((item) => item.ativo && Number.isInteger(item.destinoSelecionadoId)).length;
        const faltantes = Math.max(trocaMultiplaMapeamentos.length - prontos, 0);

        if (faltantes > 0) {
            setTrocaMultiplaFeedback(
                `Simulação parcial: ${prontos} pronto(s), ${faltantes} sem par imediato. Escolha mais horários para completar.`,
                'erro'
            );
        } else {
            setTrocaMultiplaFeedback(`Simulação concluída: ${prontos} item(ns) pronto(s) para envio.`, 'sucesso');
        }
    } catch (error) {
        console.error('Erro ao montar pacote múltiplo:', error);
        trocaMultiplaMapeamentos = [];
        renderResultadoTrocaMultipla();
        setTrocaMultiplaFeedback(error.message || 'Erro ao simular as opções da troca múltipla.', 'erro');
    }
}

async function enviarPacoteTrocaMultipla() {
    const mensagem = document.getElementById('trocaMultiplaMensagem');

    if (!trocaMultiplaMapeamentos.length) {
        setTrocaMultiplaFeedback('Simule as opções antes de enviar solicitações.', 'erro');
        return;
    }

    const selecionados = trocaMultiplaMapeamentos
        .filter((item) => item.ativo)
        .filter((item) => Number.isInteger(item.destinoSelecionadoId));

    if (!selecionados.length) {
        setTrocaMultiplaFeedback('Nenhum item válido selecionado para envio.', 'erro');
        return;
    }

    const confirmar = confirm(`Enviar ${selecionados.length} solicitação(ões) de troca?`);
    if (!confirmar) return;

    const botaoEnviar = document.getElementById('trocaMultiplaEnviar');
    if (botaoEnviar) botaoEnviar.disabled = true;

    try {
        let sucesso = 0;
        let falhas = 0;
        let primeiraFalha = '';

        for (const item of selecionados) {
            const response = await fetch('/troca-sala/solicitar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_agendamento_origem: Number(item.origem.id_agendamento),
                    id_agendamento_destino: Number(item.destinoSelecionadoId),
                    mensagem: mensagem ? mensagem.value : ''
                })
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                falhas += 1;
                if (!primeiraFalha) {
                    primeiraFalha = data?.error || 'Falha em uma das solicitações.';
                }
                continue;
            }

            sucesso += 1;
        }

        if (mensagem) {
            mensagem.value = '';
        }

        if (falhas) {
            setTrocaMultiplaFeedback(`Concluído com parcial: ${sucesso} enviada(s), ${falhas} falha(s). ${primeiraFalha}`, 'erro');
        } else {
            setTrocaMultiplaFeedback(`Solicitações enviadas com sucesso: ${sucesso}.`, 'sucesso');
        }

        trocaMultiplaMapeamentos = [];
        renderResultadoTrocaMultipla();
        setTrocaMultiplaResumo('Nenhuma simulação realizada.');

        await carregarSolicitacoesRecebidas();
        await carregarSolicitacoesEnviadas();
        await carregarMeusAgendamentosTroca();
        await carregarMeusAgendamentosTrocaMultipla();

        if (typeof carregarAgendamentos === 'function') {
            await carregarAgendamentos();
        }
    } catch (error) {
        console.error('Erro ao enviar solicitações da troca múltipla:', error);
        setTrocaMultiplaFeedback(error.message || 'Erro ao enviar solicitações da troca múltipla.', 'erro');
    } finally {
        if (botaoEnviar) botaoEnviar.disabled = false;
    }
}

function formatarPeriodoPacote(primeiraData, ultimaData) {
    if (!primeiraData) {
        return 'Período não informado';
    }

    const inicio = formatarDataIsoParaBr(primeiraData);
    const fim = ultimaData ? formatarDataIsoParaBr(ultimaData) : inicio;
    return inicio === fim ? inicio : `${inicio} até ${fim}`;
}

async function carregarPacotesRecebidosTrocaMultipla() {
    const container = document.getElementById('trocaMultiplaRecebidas');
    if (!container) return;

    try {
        const response = await fetch('/troca-sala/lotes/recebidos');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar pacotes recebidos.');
        }

        if (!data.length) {
            container.innerHTML = '<p>Nenhum pacote recebido.</p>';
            return;
        }

        container.innerHTML = data.map(item => `
            <div class="troca-item">
                <p><strong>Professor:</strong> ${item.professor_origem_nome}</p>
                <p><strong>Itens:</strong> ${item.quantidade_itens}</p>
                <p><strong>Período:</strong> ${formatarPeriodoPacote(item.primeira_data, item.ultima_data)}</p>
                <p><strong>Status:</strong> ${item.status}</p>
                <div class="troca-acoes">
                    <button class="btn btn-secondary btn-sm" onclick="toggleDetalhesLoteTroca(${item.id_lote})">Detalhes</button>
                    ${item.status === 'PENDENTE' ? `<button class="btn btn-success btn-sm" onclick="decidirLoteTroca(${item.id_lote}, 'aceitar')">Aceitar pacote</button>` : ''}
                    ${item.status === 'PENDENTE' ? `<button class="btn btn-danger btn-sm" onclick="decidirLoteTroca(${item.id_lote}, 'recusar')">Recusar pacote</button>` : ''}
                </div>
                <div id="detalhesLoteTroca-${item.id_lote}" class="troca-detalhes" style="display:none;"></div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar pacotes recebidos:', error);
        container.innerHTML = '<p>Erro ao carregar pacotes recebidos.</p>';
    }
}

async function carregarPacotesEnviadosTrocaMultipla() {
    const container = document.getElementById('trocaMultiplaEnviadas');
    if (!container) return;

    try {
        const response = await fetch('/troca-sala/lotes/enviados');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar pacotes enviados.');
        }

        if (!data.length) {
            container.innerHTML = '<p>Nenhum pacote enviado.</p>';
            return;
        }

        container.innerHTML = data.map(item => `
            <div class="troca-item">
                <p><strong>Para:</strong> ${item.professor_destino_nome}</p>
                <p><strong>Itens:</strong> ${item.quantidade_itens}</p>
                <p><strong>Período:</strong> ${formatarPeriodoPacote(item.primeira_data, item.ultima_data)}</p>
                <p><strong>Status:</strong> ${item.status}</p>
                <div class="troca-acoes">
                    <button class="btn btn-secondary btn-sm" onclick="toggleDetalhesLoteTroca(${item.id_lote})">Detalhes</button>
                </div>
                <div id="detalhesLoteTroca-${item.id_lote}" class="troca-detalhes" style="display:none;"></div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar pacotes enviados:', error);
        container.innerHTML = '<p>Erro ao carregar pacotes enviados.</p>';
    }
}

async function toggleDetalhesLoteTroca(idLote) {
    const container = document.getElementById(`detalhesLoteTroca-${idLote}`);
    if (!container) return;

    if (container.dataset.loaded === 'true') {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = '<p>Carregando detalhes...</p>';

    try {
        const response = await fetch(`/troca-sala/lote/${idLote}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar detalhes do pacote.');
        }

        container.innerHTML = `
            <p><strong>Mensagem:</strong> ${data.lote.mensagem || 'Sem mensagem.'}</p>
            <ul>
                ${data.itens.map(item => `
                    <li>
                        ${formatarDataIsoParaBr(item.data_reservas)} ${limparHorario(item.hora_inicio)}-${limparHorario(item.hora_fim)} | ${item.sala_origem} ↔ ${item.sala_destino}
                    </li>
                `).join('')}
            </ul>
        `;
        container.dataset.loaded = 'true';
    } catch (error) {
        console.error('Erro ao carregar detalhes do lote:', error);
        container.innerHTML = '<p>Erro ao carregar detalhes do pacote.</p>';
    }
}

async function decidirLoteTroca(idLote, acao) {
    try {
        const response = await fetch(`/troca-sala/lote/${idLote}/decidir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível processar o pacote.');
        }

        setTrocaMultiplaFeedback(data.message || 'Pacote processado com sucesso.');

        await carregarPacotesRecebidosTrocaMultipla();
        await carregarPacotesEnviadosTrocaMultipla();
        await carregarMeusAgendamentosTrocaMultipla();
        await carregarSolicitacoesRecebidas();
        await carregarSolicitacoesEnviadas();
        await carregarMeusAgendamentosTroca();

        if (typeof carregarAgendamentos === 'function') {
            await carregarAgendamentos();
        }
    } catch (error) {
        console.error('Erro ao decidir lote:', error);
        setTrocaMultiplaFeedback(error.message || 'Erro ao processar pacote.', 'erro');
    }
}

