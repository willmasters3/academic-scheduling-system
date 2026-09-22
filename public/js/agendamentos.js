// Variáveis globais para armazenar agendamentos e navegação
let agendamentos = []; // Array para armazenar todos os agendamentos
let agendamentosDataset = { status: 'empty', unitCode: null, loadedAt: null, requestVersion: 0, appointments: [], rooms: [] };
let agendamentosRequestVersion = 0;
let currentPage = 1; // Página atual
const agendamentosPorPagina = 8; // Total de agendamentos por página
let rolando = false; // Variável para controlar o estado da rolagem automática
const FULLSCREEN_DELAY_MS = 60000;
const CURSOR_HIDE_DELAY_MS = 3000;
let mostrarBotaoEntrarTelaCheia = false;
let cursorHideTimeoutId = null;
let destaqueVoz = null;
let destaqueVozTimeoutId = null;

function limparTimerCursor() {
    if (cursorHideTimeoutId) {
        clearTimeout(cursorHideTimeoutId);
        cursorHideTimeoutId = null;
    }
}

function mostrarCursorTemporariamente() {
    if (!estaEmTelaCheia()) {
        document.body.classList.remove('cursor-hidden');
        limparTimerCursor();
        return;
    }

    document.body.classList.remove('cursor-hidden');
    limparTimerCursor();

    cursorHideTimeoutId = setTimeout(() => {
        if (estaEmTelaCheia()) {
            document.body.classList.add('cursor-hidden');
        }
    }, CURSOR_HIDE_DELAY_MS);
}

function configurarAutoOcultarCursor() {
    const eventosInteracao = ['mousemove', 'mousedown', 'wheel', 'touchstart', 'keydown'];

    eventosInteracao.forEach((evento) => {
        document.addEventListener(evento, mostrarCursorTemporariamente, { passive: true });
    });
}

function estaEmTelaCheia() {
    return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
    );
}

async function solicitarTelaCheia() {
    const elemento = document.documentElement;

    if (elemento.requestFullscreen) {
        return elemento.requestFullscreen();
    }

    if (elemento.webkitRequestFullscreen) {
        elemento.webkitRequestFullscreen();
        return Promise.resolve();
    }

    if (elemento.msRequestFullscreen) {
        elemento.msRequestFullscreen();
        return Promise.resolve();
    }

    return Promise.reject(new Error('Tela cheia nao suportada neste navegador.'));
}

async function sairTelaCheia() {
    if (document.exitFullscreen) {
        return document.exitFullscreen();
    }

    if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
        return Promise.resolve();
    }

    if (document.msExitFullscreen) {
        document.msExitFullscreen();
        return Promise.resolve();
    }

    return Promise.resolve();
}

function atualizarEstadoTelaCheia() {
    const botaoSair = document.getElementById('fullscreenExitBtn');
    const botaoEntrar = document.getElementById('fullscreenEnterBtn');
    const ativo = estaEmTelaCheia();

    if (botaoSair) {
        botaoSair.classList.toggle('is-visible', ativo);
    }

    if (botaoEntrar) {
        botaoEntrar.classList.toggle('is-visible', !ativo && mostrarBotaoEntrarTelaCheia);
    }

    document.body.classList.toggle('fullscreen-active', ativo);

    if (ativo) {
        mostrarCursorTemporariamente();
    } else {
        limparTimerCursor();
        document.body.classList.remove('cursor-hidden');
    }
}

function configurarTelaCheiaAutomatica() {
    const botaoSair = document.getElementById('fullscreenExitBtn');
    const botaoEntrar = document.getElementById('fullscreenEnterBtn');
    const params = new URLSearchParams(window.location.search);
    const autoFullscreenDesativado = params.get('autofs') === '0';

    if (botaoSair) {
        botaoSair.addEventListener('click', () => {
            sairTelaCheia().catch((error) => {
                console.warn('Nao foi possivel sair da tela cheia:', error);
            });
        });
    }

    if (botaoEntrar) {
        botaoEntrar.addEventListener('click', () => {
            solicitarTelaCheia()
                .then(() => {
                    mostrarBotaoEntrarTelaCheia = false;
                    atualizarEstadoTelaCheia();
                })
                .catch((error) => {
                    console.warn('Nao foi possivel entrar em tela cheia pelo botao:', error);
                });
        });
    }

    document.addEventListener('fullscreenchange', atualizarEstadoTelaCheia);
    document.addEventListener('webkitfullscreenchange', atualizarEstadoTelaCheia);
    document.addEventListener('MSFullscreenChange', atualizarEstadoTelaCheia);

    if (!autoFullscreenDesativado) {
        setTimeout(() => {
            if (estaEmTelaCheia()) {
                return;
            }

            const ativacaoUsuarioDisponivel = !navigator.userActivation || navigator.userActivation.isActive;
            if (!ativacaoUsuarioDisponivel) {
                mostrarBotaoEntrarTelaCheia = true;
                atualizarEstadoTelaCheia();
                return;
            }

            solicitarTelaCheia()
                .then(() => {
                    mostrarBotaoEntrarTelaCheia = false;
                    atualizarEstadoTelaCheia();
                })
                .catch(() => {
                    mostrarBotaoEntrarTelaCheia = true;
                    atualizarEstadoTelaCheia();
                });
        }, FULLSCREEN_DELAY_MS);
    }

    atualizarEstadoTelaCheia();
}

function aplicarModoTvSeConfigurado() {
    const params = new URLSearchParams(window.location.search);
    const tvParam = params.get('tv');

    if (tvParam === '1') {
        localStorage.setItem('agendamentosModoTv', '1');
    } else if (tvParam === '0') {
        localStorage.removeItem('agendamentosModoTv');
    }

    const modoTvAtivo = localStorage.getItem('agendamentosModoTv') === '1';
    document.body.classList.toggle('mode-tv', modoTvAtivo);
}

document.addEventListener('DOMContentLoaded', () => {
    aplicarModoTvSeConfigurado();
    configurarTelaCheiaAutomatica();
    configurarAutoOcultarCursor();
    carregarUnidades();

    const unidadeSelect = document.getElementById('unidadeSelect');
    const agendamentosList = document.getElementById('agendamentosList');

    unidadeSelect.addEventListener('change', async () => {
        const codigoUnidade = unidadeSelect.value;
        localStorage.setItem('codigoUnidade', codigoUnidade); // Armazena a unidade selecionada no localStorage
        if (codigoUnidade) {
            currentPage = 1; // Reseta para a primeira página ao mudar a unidade
            await carregarAgendamentosPorUnidade(codigoUnidade);
        } else {
            agendamentosRequestVersion += 1;
            agendamentos = [];
            agendamentosDataset = { status: 'empty', unitCode: null, loadedAt: null, requestVersion: agendamentosRequestVersion, appointments: [], rooms: [] };
            agendamentosList.innerHTML = '';
        }
    });

    // Verifica e remove agendamentos expirados a cada 60 segundos
    setInterval(verificarEExcluirAgendamentosExpirados, 60000);

    // Rolagem
    iniciarRolagem();

    // Atualiza a página a cada 10 min (Apesar da pagina ficar guardado cache ao selecionar a unidade, garanti que a pagina atulize no F5 
    // Fazendo que os agendamento force a entrar na lista, sendo assim automatizando a pagina)
    setInterval(() => {
        console.log("Atualizando a página...");
        location.reload(); // Atualiza a página
    }, 600000); // 1h em milissegundos
});

function iniciarRolagem() {
    if (rolando) return; // Se já estiver rolando, sai da função
    rolando = true; // Marca que a rolagem está ativa
    mostrarAgendamentos(); // Mostra os agendamentos iniciais

    setInterval(() => {
        // Alterna para a próxima página
        currentPage++;
        const totalPaginas = Math.ceil(agendamentos.length / agendamentosPorPagina);
        // Se alcançar a última página, volta para a primeira
        if (currentPage > totalPaginas) {
            currentPage = 1;
        }

        // Mostra os agendamentos da página atual
        mostrarAgendamentos(); // Atualiza a exibição

        // Verifica se não há agendamentos na página atual
        const agendamentosFiltrados = filtrarAgendamentosPorTurno(agendamentos);
        const agendamentosParaMostrar = agendamentosFiltrados.slice((currentPage - 1) * agendamentosPorPagina, currentPage * agendamentosPorPagina);
        if (agendamentosParaMostrar.length === 0) {
            currentPage = 1; // Reseta para a primeira página se não houver agendamentos
            mostrarAgendamentos(); // Atualiza a exibição novamente
        }
    }, 12000); // 10000 ms (10 segundos)
}

async function verificarEExcluirAgendamentosExpirados() {
    const agendamentosList = document.getElementById('agendamentosList');
    const agendamentoItems = agendamentosList.getElementsByClassName('agendamento-item');

    const now = new Date(); // Data e hora atuais em São Paulo
    console.log('Data e Hora Atual:', now);

    for (let agendamentoItem of agendamentoItems) {
        const dataFimText = agendamentoItem.querySelector('.data-fim').textContent.split(': ')[1];
        const horaFimText = agendamentoItem.querySelector('.hora-fim').textContent.split(': ')[1];

        // Extrair as partes da data final
        const dataFimParts = dataFimText.split('/');
        const horaFimParts = horaFimText.split(':');

        // Convertendo data e hora final do agendamento para um objeto Date
        const dataFimDate = new Date(dataFimParts[2], dataFimParts[1] - 1, dataFimParts[0], horaFimParts[0], horaFimParts[1], horaFimParts[2] || 0);

        console.log('Data e Hora Final do Agendamento:', dataFimDate);

        if (now >= dataFimDate) { // Comparação para ver se o agendamento expirou
            const agendamentoId = agendamentoItem.dataset.agendamentoId;
            console.log(`Agendamento expirado detectado: ID ${agendamentoId}`);
            // Remova as duas linhas abaixo para não excluir mais.
            // await excluirAgendamento(agendamentoId); 
            // agendamentoItem.remove(); // Remover o agendamento do DOM
        } else {
            console.log(`Agendamento ainda ativo: ID ${agendamentoItem.dataset.agendamentoId}`);
        }
    }

    const codigoUnidade = unidadeSelect.value;
    if (codigoUnidade) {
        await carregarAgendamentosPorUnidade(codigoUnidade);
    }
}

// Variáveis globais para os turnos
const turnoManhaInicio = new Date(new Date().setHours(6, 0, 0)); // 6:00
const turnoManhaFim = new Date(new Date().setHours(12, 0, 0)); // 12:20
const turnoTardeInicio = new Date(new Date().setHours(12, 1, 0)); // 12:21
const turnoTardeFim = new Date(new Date().setHours(17, 15, 0)); // 17:15
const turnoNoiteInicio = new Date(new Date().setHours(17, 15, 0)); // 17:15
const turnoNoiteFim = new Date(new Date().setHours(23, 59, 59)); // 23:59

function obterTurnoAtivoDaPagina(agora = new Date()) {
    if (agora >= turnoManhaInicio && agora <= turnoManhaFim) return 'manha';
    if (agora > turnoTardeInicio && agora <= turnoTardeFim) return 'tarde';
    if (agora > turnoNoiteInicio && agora <= turnoNoiteFim) return 'noite';
    return null;
}

async function carregarUnidades() {
    try {
        const response = await fetch('/listar-unidades-publicas');
        if (!response.ok) throw new Error('Erro ao carregar unidades');
        
        const unidades = await response.json();
        const unidadeSelect = document.getElementById('unidadeSelect');
        unidadeSelect.innerHTML = ''; // Limpa as opções antes de adicionar novas

        // Adiciona a opção padrão "Selecione uma unidade"
        const optionDefault = document.createElement('option');
        optionDefault.value = ''; // Valor vazio para a opção padrão
        optionDefault.textContent = 'Selecione uma unidade'; // Texto exibido
        unidadeSelect.appendChild(optionDefault);
        
        unidades.forEach(unidade => {
            const option = document.createElement('option');
            option.value = unidade.codigo;
            option.textContent = unidade.nome;
            unidadeSelect.appendChild(option);
        });
        const codigoSalvo = localStorage.getItem('codigoUnidade');
        if (codigoSalvo && Array.from(unidadeSelect.options).some((option) => option.value === codigoSalvo)) {
            unidadeSelect.value = codigoSalvo;
            currentPage = 1;
            await carregarAgendamentosPorUnidade(codigoSalvo);
        }
    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
        alert('Erro ao carregar unidades.');
    }
}
function atualizarContagemRegressiva() {
    const agora = new Date();
    let tempoRestante = 0;
    let turnoAtivo = '';

    // Verifica o turno atual e calcula o tempo restante até o fim
    if (agora >= turnoManhaInicio && agora <= turnoManhaFim) {
        tempoRestante = turnoManhaFim - agora; // Tempo restante no turno da manhã
        turnoAtivo = 'Manhã';
    } else if (agora > turnoTardeInicio && agora <= turnoTardeFim) {
        tempoRestante = turnoTardeFim - agora; // Tempo restante no turno da tarde
        turnoAtivo = 'Tarde';
    } else if (agora > turnoNoiteInicio && agora <= turnoNoiteFim) {
        tempoRestante = turnoNoiteFim - agora; // Tempo restante no turno da noite
        turnoAtivo = 'Noite';
    } else {
        // Caso contrário, ajusta-se para o início do próximo turno
        if (agora < turnoManhaInicio) {
            tempoRestante = turnoManhaInicio - agora; // Início do turno da manhã
            turnoAtivo = 'Proximo Manhã';
        } else {
            // Calculate next morning's start time
            const proximaManha = new Date();
            proximaManha.setDate(proximaManha.getDate() + 1);
            proximaManha.setHours(6, 0, 0, 0); // Próxima manhã
            tempoRestante = proximaManha - agora; 
            turnoAtivo = 'Proximo Manhã';
        }
    }

    // Converte o tempo restante em horas, minutos e segundos
    const horas = Math.floor((tempoRestante % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((tempoRestante % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((tempoRestante % (1000 * 60)) / 1000);

    // Atualiza o elemento de contagem regressiva
    const contadorDiv = document.getElementById('contadorTurno');
    contadorDiv.textContent = `Turno atual: ${turnoAtivo} - Tempo até a mudança de turno: ${horas}h ${minutos}m ${segundos}s`;

    // Atualiza a contagem a cada segundo
    setTimeout(atualizarContagemRegressiva, 1000);
}

// Chama a função quando o DOM está carregado
document.addEventListener('DOMContentLoaded', () => {
    // Inicia apenas a contagem regressiva; as unidades ja sao carregadas no listener principal.
    atualizarContagemRegressiva();
});

async function carregarAgendamentosPorUnidade(codigoUnidade) {
    const requestVersion = ++agendamentosRequestVersion;
    agendamentos = [];
    agendamentosDataset = { status: 'loading', unitCode: codigoUnidade, loadedAt: null, requestVersion, appointments: [], rooms: [] };
    mostrarAgendamentos();
    try {
        const [response, roomsResponse] = await Promise.all([
            fetch(`/listar-agendamento/${codigoUnidade}`),
            fetch(`/salas/${codigoUnidade}`)
        ]);
        if (!response.ok || !roomsResponse.ok) throw new Error('Erro ao carregar o contexto da unidade');
        const [novosAgendamentos, rooms] = await Promise.all([response.json(), roomsResponse.json()]);
        if (requestVersion !== agendamentosRequestVersion || document.getElementById('unidadeSelect')?.value !== codigoUnidade) return;
        agendamentos = novosAgendamentos;
        agendamentosDataset = { status: 'ready', unitCode: codigoUnidade, loadedAt: Date.now(), requestVersion, appointments: agendamentos, rooms };
        mostrarAgendamentos(); // Chama para exibir os agendamentos após o carregamento
    } catch (error) {
        if (requestVersion !== agendamentosRequestVersion) return;
        agendamentos = [];
        agendamentosDataset = { status: 'error', unitCode: codigoUnidade, loadedAt: null, requestVersion, appointments: [], rooms: [], error: 'load_failed' };
        mostrarAgendamentos();
        console.error('Erro ao carregar agendamentos:', error);
        alert('Erro ao carregar agendamentos.');
    }
}
function mostrarAgendamentos() {
    const agendamentosList = document.getElementById('agendamentosList');
    agendamentosList.innerHTML = ''; // Limpa a lista de agendamentos

    if (agendamentosDataset.status === 'loading') {
        agendamentosList.innerHTML = '<tr><td colspan="6" class="text-center">Carregando dados da unidade...</td></tr>';
        return;
    }
    if (agendamentosDataset.status === 'error') {
        agendamentosList.innerHTML = '<tr><td colspan="6" class="text-center">Não foi possível carregar os dados desta unidade.</td></tr>';
        return;
    }

    if (destaqueVoz && destaqueVoz.expiraEm > Date.now()) {
        destaqueVoz.registros.forEach(agendamento => {
            agendamentosList.appendChild(criarLinhaAgendamento(agendamento, true));
        });
        return;
    }

    const agendamentosOrdenados = ordenarAgendamentos(agendamentos); // Ordena os agendamentos
    const agendamentosFiltrados = filtrarAgendamentosPorTurno(agendamentosOrdenados); // Filtra por turno

    // Paginando os agendamentos filtrados
    const totalPaginas = Math.ceil(agendamentosFiltrados.length / agendamentosPorPagina);
    const inicio = (currentPage - 1) * agendamentosPorPagina;
    const fim = inicio + agendamentosPorPagina;
    const agendamentosParaMostrar = agendamentosFiltrados.slice(inicio, fim);

    // Exibe os agendamentos filtrados na tabela
    agendamentosParaMostrar.forEach(agendamento => agendamentosList.appendChild(criarLinhaAgendamento(agendamento)));

    if (agendamentosList.childElementCount === 0) {
        agendamentosList.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum agendamento para hoje.</td></tr>'; // Mensagem quando não há agendamentos
    }
}

function criarLinhaAgendamento(agendamento, destacado = false) {
    const row = document.createElement('tr');
    if (destacado) row.classList.add('voice-result-highlight');
    const valores = [
        agendamento.nome_sala,
        agendamento.tipo_aula || 'Nenhuma aula fornecida',
        agendamento.nome || 'Não especificado',
        agendamento.motivo || 'Nenhum motivo fornecido',
        agendamento.hora_inicio || 'Não especificada',
        agendamento.hora_fim || 'Não especificada'
    ];
    valores.forEach(valor => {
        const cell = document.createElement('td');
        cell.textContent = valor;
        row.appendChild(cell);
    });
    return row;
}

function obterDatasetVozAgendamentos() {
    return agendamentos.map((item, voiceIndex) => ({
        voiceIndex,
        id_agendamento: item.id_agendamento,
        id_professor: item.id_professor,
        id_sala: item.id_sala,
        codigo_unidade: item.codigo_unidade,
        data_reservas: item.data_reservas,
        nome_sala: item.nome_sala,
        tipo_aula: item.tipo_aula,
        nome: item.nome,
        motivo: item.motivo,
        hora_inicio: item.hora_inicio,
        hora_fim: item.hora_fim
    }));
}

function destacarAgendamentosPorVoz(indices, duracaoMs = 7000) {
    const selecionados = Array.from(new Set(indices || []))
        .map(index => agendamentos[Number(index)])
        .filter(Boolean);
    if (!selecionados.length) return;
    clearTimeout(destaqueVozTimeoutId);
    destaqueVoz = { registros: selecionados, expiraEm: Date.now() + duracaoMs };
    mostrarAgendamentos();
    document.querySelector('.voice-result-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    destaqueVozTimeoutId = setTimeout(() => {
        destaqueVoz = null;
        mostrarAgendamentos();
    }, duracaoMs);
}

window.agendamentosPageVoiceData = {
    debugEnabled: localStorage.getItem('VOICE_DEBUG') === '1',
    getAppointments: obterDatasetVozAgendamentos,
    getDatasetSnapshot: () => ({
        status: agendamentosDataset.status,
        unitCode: agendamentosDataset.unitCode,
        loadedAt: agendamentosDataset.loadedAt,
        requestVersion: agendamentosDataset.requestVersion,
        appointments: obterDatasetVozAgendamentos(),
        catalogRecords: [
            ...obterDatasetVozAgendamentos(),
            ...(agendamentosDataset.rooms || []).map((room) => ({
                id_sala: room.id_sala,
                nome_sala: room.nome_sala,
                codigo_unidade: agendamentosDataset.unitCode
            }))
        ]
    }),
    getContext: () => ({
        date: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date()),
        unit: document.getElementById('unidadeSelect')?.value || null,
        currentShift: obterTurnoAtivoDaPagina()
    }),
    highlight: destacarAgendamentosPorVoz
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.AgendamentosVoiceAssistant && window.agendamentosPageVoiceData) {
        window.AgendamentosVoiceAssistant.init(window.agendamentosPageVoiceData);
    }
});


// Função para filtrar agendamentos com base no turno ativo
function filtrarAgendamentosPorTurno(agendamentos) {
    const agora = new Date(); // horário atual
    const turnoAtivo = obterTurnoAtivoDaPagina(agora);

    // Filtrar agendamentos com base no turno ativo e verificar se ainda estão dentro do horário
    return agendamentos.filter(agendamento => {
        const horaInicio = new Date(`${agendamento.data_reservas}T${agendamento.hora_inicio}`);
        const horaFim = new Date(`${agendamento.data_reservas}T${agendamento.hora_fim}`);
        
        // Verifica se o agendamento já expirou
        const agendamentoExpirado = agora > horaFim; 
        
        return !agendamentoExpirado && (
            (turnoAtivo === 'manha' && horaInicio < turnoManhaFim && horaFim > turnoManhaInicio) ||
            (turnoAtivo === 'tarde' && horaInicio < turnoTardeFim && horaFim > turnoTardeInicio) ||
            (turnoAtivo === 'noite' && horaInicio < turnoNoiteFim && horaFim > turnoNoiteInicio)
        );
    });
}

/*
function filtrarAgendamentosPorTurno(agendamentos) {
    const agora = new Date(); // horário atual
    let turnoAtivo = null;

    // Determina o turno ativo com base no horário atual
    if (agora >= turnoManhaInicio && agora <= turnoManhaFim) {
        turnoAtivo = 'manha';
    } else if (agora > turnoTardeInicio && agora <= turnoTardeFim) {
        turnoAtivo = 'tarde';
    } else if (agora > turnoNoiteInicio && agora <= turnoNoiteFim) {
        turnoAtivo = 'noite';
    }

    // Filtrar agendamentos com base no turno ativo
    return agendamentos.filter(agendamento => {
        const horaInicio = new Date(`${agendamento.data_reservas}T${agendamento.hora_inicio}`);
        const horaFim = new Date(`${agendamento.data_reservas}T${agendamento.hora_fim}`);
        return (
            (turnoAtivo === 'manha' && horaInicio < turnoManhaFim && horaFim > turnoManhaInicio) ||
            (turnoAtivo === 'tarde' && horaInicio < turnoTardeFim && horaFim > turnoTardeInicio) ||
            (turnoAtivo === 'noite' && horaInicio < turnoNoiteFim && horaFim > turnoNoiteInicio)
        );
    });
}
*/

// Função para formatar a data considerando o fuso horário de São Paulo (Brazil)
function formatarData(data) {
    const dataObj = new Date(data);
    const utcDay = dataObj.getUTCDate();
    const utcMonth = dataObj.getUTCMonth() + 1; // Os meses são indexados de 0 a 11
    const utcYear = dataObj.getUTCFullYear();

    const day = utcDay < 10 ? '0' + utcDay : utcDay;
    const month = utcMonth < 10 ? '0' + utcMonth : utcMonth;

    return `${day}/${month}/${utcYear}`; // Formato brasileiro
}

// Função para formatar a hora considerando o fuso horário de São Paulo (Brazil)
function formatarHora(hora) {
    const [hours = '00', minutes = '00'] = String(hora || '').split(':');
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
function mudarPagina(direcao) {
    const totalPaginas = Math.ceil(agendamentos.length / agendamentosPorPagina);
    currentPage += direcao;

    // Verifica limites da página
    if (currentPage < 1) {
        currentPage = 1; // Limita a página para não ir abaixo de 1
    } else if (currentPage > totalPaginas) {
        currentPage = totalPaginas; // Limita a página para não passar do total
    }
    
    mostrarAgendamentos(); // Atualiza a exibição dos agendamentos na nova página
}
function ordenarAgendamentos(agendamentos) {
    return agendamentos.sort((a, b) => {
        // Extrai o número da sala
        const numeroSalaA = extrairNumeroSala(a.nome_sala);
        const numeroSalaB = extrairNumeroSala(b.nome_sala);

        // Compara os números das salas
        if (numeroSalaA !== numeroSalaB) {
            return numeroSalaA - numeroSalaB; // Ordena numericamente
        } else {
            // Se os números forem iguais, ordena alfabeticamente
            return a.nome_sala.localeCompare(b.nome_sala);
        }
    });
}

function extrairNumeroSala(nomeSala) {
    // Usa expressão regular para capturar o número da sala
    const match = nomeSala.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : Infinity; // Retorna um número grande se não encontrar
}
