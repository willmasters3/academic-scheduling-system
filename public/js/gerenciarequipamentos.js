const modal = document.getElementById('modalEdicaoMonitor');
const closeButton = modal ? modal.querySelector('.close-button') : null;
const btnRemoverAssociacao = document.getElementById('btnRemoverAssociacao');
const formEditarMonitor = document.getElementById('formEditarMonitor');
const btnExcluirPermanentemente = document.getElementById('btnExcluirPermanentemente');
const modalConfigComputador = document.getElementById('modalConfigComputador');
const modalPatrimonioVinculo = document.getElementById('modalPatrimonioVinculo');
let resolverModalPatrimonioVinculo = null;

let monitorSalaId = null;
let equipamentosVisiveis = false;
let computadores = [];
let salas = {};
let monitores = [];
let paginaAtualComputadores = 1;
let paginaAtualMonitores = 1;
const selectedComputadores = new Set();
const selectedMonitores = new Set();
const selectedSalaComputadores = new Set();
const selectedSalaMonitores = new Set();
let computadoresAssociadosSalaAtual = [];

const itensPorPagina = 24;
const filtrosEstado = {
    computadores: 'all',
    monitores: 'all'
};

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parseComputerNameForSort(nomeComputador) {
    const nome = String(nomeComputador || '').trim().toUpperCase();
    const match = nome.match(/^(.*?)(\d+)$/);

    if (!match) {
        return {
            original: nome,
            hasNumericSuffix: false,
            prefix: nome,
            numericSuffix: Number.POSITIVE_INFINITY
        };
    }

    return {
        original: nome,
        hasNumericSuffix: true,
        prefix: match[1],
        numericSuffix: Number.parseInt(match[2], 10)
    };
}

function compareComputerNamesAscending(itemA, itemB) {
    const nomeA = parseComputerNameForSort(itemA?.nome_computador);
    const nomeB = parseComputerNameForSort(itemB?.nome_computador);

    if (nomeA.hasNumericSuffix !== nomeB.hasNumericSuffix) {
        return nomeA.hasNumericSuffix ? -1 : 1;
    }

    const prefixComparison = nomeA.prefix.localeCompare(nomeB.prefix, 'pt-BR', {
        sensitivity: 'base'
    });

    if (prefixComparison !== 0) {
        return prefixComparison;
    }

    if (nomeA.hasNumericSuffix && nomeB.hasNumericSuffix && nomeA.numericSuffix !== nomeB.numericSuffix) {
        return nomeA.numericSuffix - nomeB.numericSuffix;
    }

    return nomeA.original.localeCompare(nomeB.original, 'pt-BR', {
        sensitivity: 'base'
    });
}

function formatDateTime(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderHistoricoEquipamentos(records) {
    const tbody = document.querySelector('#tabelaHistoricoEquipamentos tbody');
    const status = document.getElementById('historicoStatus');
    tbody.innerHTML = '';
    status.textContent = '';

    if (!Array.isArray(records) || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum registro encontrado para os filtros atuais.</td></tr>';
        return;
    }

    const rows = records.map((registro) => {
        const equipamento = registro.tipo_equipamento === 'monitor'
            ? registro.serial_number || registro.patrimonio_novo || registro.nome_novo || 'Monitor'
            : registro.nome_novo || registro.serial_number || registro.patrimonio_novo || 'Computador';
        const patrimonio = registro.patrimonio_novo || registro.patrimonio_antigo || '-';
        const origem = registro.sala_origem_nome
            ? `${registro.sala_origem_nome}${registro.sala_origem_unidade ? ` [${registro.sala_origem_unidade}]` : ''}`
            : '-';
        const destino = registro.sala_destino_nome
            ? `${registro.sala_destino_nome}${registro.sala_destino_unidade ? ` [${registro.sala_destino_unidade}]` : ''}`
            : '-';

        return `
            <tr>
                <td>${escapeHtml(formatDateTime(registro.data_evento))}</td>
                <td>${escapeHtml(registro.tipo_equipamento || '-')}</td>
                <td>${escapeHtml(registro.acao || '-')}</td>
                <td>${escapeHtml(equipamento)}</td>
                <td>${escapeHtml(patrimonio)}</td>
                <td>${escapeHtml(origem)}</td>
                <td>${escapeHtml(destino)}</td>
                <td>${escapeHtml(registro.observacao || '')}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.join('');
}

async function carregarHistoricoEquipamentos() {
    const tipo = document.getElementById('historicoTipo')?.value || '';
    const nome = document.getElementById('historicoNome')?.value || '';
    const patrimonio = document.getElementById('historicoPatrimonio')?.value || '';
    const sala = document.getElementById('historicoSala')?.value || '';
    const status = document.getElementById('historicoStatus');

    status.textContent = 'Carregando histórico...';
    status.style.color = '';

    try {
        const params = new URLSearchParams();
        if (tipo) params.set('tipo', tipo);
        if (nome) params.set('nome', nome);
        if (patrimonio) params.set('patrimonio', patrimonio);
        if (sala) params.set('sala', sala);
        params.set('limit', '200');

        const response = await fetch(`/historico-equipamentos?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Falha ao carregar o histórico.');
        }

        const data = await response.json();
        renderHistoricoEquipamentos(data);
        historicoCarregado = true;
        status.textContent = '';
    } catch (error) {
        console.error('Erro ao carregar histórico de equipamentos:', error);
        status.textContent = 'Erro ao carregar histórico. Tente novamente.';
        status.style.color = '#c0392b';
    }
}

function configurarHistoricoEventos() {
    document.getElementById('btnAtualizarHistorico')?.addEventListener('click', carregarHistoricoEquipamentos);
}

function ativarHistoricoAoSelecionarAba() {
    // O histórico agora só é carregado quando o usuário clicar no botão Buscar.
}

function getCadastroMonitorElements() {
    return {
        form: document.getElementById('formMonitor'),
        monitorIdInput: document.getElementById('monitorExistenteId'),
        aviso: document.getElementById('monitorExistenteAviso'),
        retorno: document.getElementById('formMonitorRetorno'),
        modelo: document.getElementById('modelo'),
        polegadas: document.getElementById('polegadas'),
        numeroSerie: document.getElementById('numero_serie'),
        patrimonio: document.getElementById('patrimonio'),
        sala: document.getElementById('cadSala')
    };
}

function confirmarSobrescritaMonitor(modeloAtual, polegadasAtual, patrimonioAtual) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmarSobrescritaMonitor');
        const texto = document.getElementById('modalConfirmSobrescritaTexto');
        const btnSim = document.getElementById('btnConfirmarSobrescritaMonitor');
        const btnNao = document.getElementById('btnCancelarSobrescritaMonitor');

        texto.textContent = `O patrimonio "${patrimonioAtual}" ja esta vinculado ao monitor "${modeloAtual || 'desconhecido'}" (${polegadasAtual || '?'} pol.). Ao confirmar, os dados serao sobrescritos com os novos valores digitados. Deseja continuar?`;
        modal.style.display = 'flex';

        function fechar(resultado) {
            modal.style.display = 'none';
            btnSim.removeEventListener('click', onSim);
            btnNao.removeEventListener('click', onNao);
            resolve(resultado);
        }
        function onSim() { fechar(true); }
        function onNao() { fechar(false); }

        btnSim.addEventListener('click', onSim);
        btnNao.addEventListener('click', onNao);
    });
}

function limparAvisoMonitorExistente() {
    const { monitorIdInput, aviso } = getCadastroMonitorElements();
    if (monitorIdInput) {
        monitorIdInput.value = '';
        delete monitorIdInput.dataset.modeloOriginal;
        delete monitorIdInput.dataset.polegadasOriginal;
    }
    if (aviso) {
        aviso.textContent = '';
        aviso.style.color = '';
    }
}

function preencherFormularioMonitorExistente(monitor) {
    const { monitorIdInput, aviso, modelo, polegadas, numeroSerie } = getCadastroMonitorElements();

    if (!monitor) {
        limparAvisoMonitorExistente();
        return;
    }

    monitorIdInput.value = monitor.id || '';
    monitorIdInput.dataset.modeloOriginal = monitor.modelo || '';
    monitorIdInput.dataset.polegadasOriginal = monitor.polegadas || '';
    modelo.value = monitor.modelo || '';
    polegadas.value = monitor.polegadas || '';
    numeroSerie.value = monitor.numero_serie || '';

    aviso.style.color = '#a15c00';
    aviso.textContent = monitor.nome_sala
        ? `Patrimonio encontrado. Voce vai atualizar o monitor existente e vinculá-lo para a sala selecionada. Sala atual: ${monitor.nome_sala}.`
        : 'Patrimonio encontrado. Voce vai atualizar o monitor existente e vinculá-lo para a sala selecionada.';
}

async function buscarMonitorPorPatrimonio() {
    const { patrimonio, retorno } = getCadastroMonitorElements();
    const patrimonioValor = patrimonio.value.trim();

    limparAvisoMonitorExistente();

    if (!patrimonioValor) {
        return;
    }

    const monitorLocal = monitores.find((item) => String(item.patrimonio || '').trim().toUpperCase() === patrimonioValor.toUpperCase());
    if (monitorLocal) {
        preencherFormularioMonitorExistente(monitorLocal);
        return;
    }

    try {
        const res = await fetch(`/monitor-por-patrimonio/${encodeURIComponent(patrimonioValor)}`);
        if (res.status === 404) {
            return;
        }

        if (!res.ok) {
            throw new Error(await res.text());
        }

        const monitor = await res.json();
        preencherFormularioMonitorExistente(monitor);
    } catch (error) {
        console.error('Erro ao buscar monitor por patrimonio:', error);
        retorno.style.color = '#c0392b';
        retorno.textContent = 'Nao foi possivel verificar o patrimonio informado agora.';
    }
}

function getSelectedUnidadeCode() {
    return String(document.getElementById('unidade')?.value || '')
        .trim()
        .toUpperCase();
}

function shouldFilterBySelectedUnit() {
    return Boolean(document.getElementById('filtroUnidadeComputadores')?.checked);
}

function matchesSelectedUnit(item) {
    const unidadeCode = getSelectedUnidadeCode();
    if (!unidadeCode || !shouldFilterBySelectedUnit()) {
        return true;
    }

    return String(item?.nome_computador || '')
        .trim()
        .toUpperCase()
        .startsWith(unidadeCode);
}

function getAssociationBadge(item) {
    if (!item?.id_sala) {
        return { label: 'Disponivel', className: 'badge badge-available' };
    }

    const typeLabel = item.tipo_sala_assoc === 'administrativa' ? 'Administrativa' : 'Academica';
    return {
        label: `Vinculado: ${item.nome_sala || 'Sala'} • ${typeLabel}`,
        className: 'badge badge-associated'
    };
}

function getMonitorAssociationBadge(item) {
    if (!item?.id_sala) {
        return { label: 'Disponivel', className: 'badge badge-available' };
    }

    return {
        label: `Vinculado: ${item.nome_sala || 'Sala'}`,
        className: 'badge badge-associated'
    };
}

function formatRoomContext() {
    const unidadeSelect = document.getElementById('unidade');
    const salaSelect = document.getElementById('sala');
    const tipoSala = document.getElementById('tipoSala').value;
    const unidadeNome = unidadeSelect?.selectedOptions?.[0]?.textContent || 'Nenhuma unidade selecionada';
    const salaNome = salaSelect?.selectedOptions?.[0]?.textContent || 'Nenhuma sala selecionada';
    const tipoNome = tipoSala === 'administrativa' ? 'Sala administrativa' : tipoSala === 'academico' ? 'Sala academica' : 'Tipo de sala nao selecionado';

    document.getElementById('roomContext').textContent = `${unidadeNome} • ${tipoNome} • ${salaNome}`;
}

function hasSalaSelecionada() {
    const salaId = document.getElementById('sala')?.value;
    const tipoSala = document.getElementById('tipoSala')?.value;
    return Boolean(salaId && tipoSala);
}

function updatePrintRoomHeader() {
    const header = document.getElementById('printSalaHeader');
    if (!header) {
        return;
    }

    const unidadeSelect = document.getElementById('unidade');
    const salaSelect = document.getElementById('sala');
    const tipoSala = document.getElementById('tipoSala')?.value || '';
    const unidadeNome = unidadeSelect?.selectedOptions?.[0]?.textContent || '-';
    const salaNome = salaSelect?.selectedOptions?.[0]?.textContent || '-';
    const tipoNome = tipoSala === 'administrativa' ? 'Administrativa' : tipoSala === 'academico' ? 'Acadêmica' : '-';
    const geradoEm = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    header.innerHTML = `
        <p><strong>Unidade:</strong> ${escapeHtml(unidadeNome)}</p>
        <p><strong>Tipo de sala:</strong> ${escapeHtml(tipoNome)}</p>
        <p><strong>Sala:</strong> ${escapeHtml(salaNome)}</p>
        <p><strong>Gerado em:</strong> ${escapeHtml(geradoEm)}</p>
    `;
}

function updatePrintButtonVisibility() {
    const botaoImprimir = document.getElementById('btnImprimirSala');
    if (!botaoImprimir) {
        return;
    }

    botaoImprimir.hidden = !hasSalaSelecionada();
}

function imprimirSalaSelecionada() {
    if (!hasSalaSelecionada()) {
        return;
    }

    updatePrintRoomHeader();
    window.print();
}

function updateSummaryCards() {
    const computadoresAssociados = computadores.filter((item) => item.id_sala).length;
    const monitoresAssociados = monitores.filter((item) => item.id_sala).length;

    document.getElementById('resumoComputadoresTotal').textContent = computadores.length;
    document.getElementById('resumoComputadoresDisponiveis').textContent = computadores.length - computadoresAssociados;
    document.getElementById('resumoMonitoresTotal').textContent = monitores.length;
    document.getElementById('resumoItensVinculados').textContent = computadoresAssociados + monitoresAssociados;
}

function bindFilterChips() {
    document.querySelectorAll('.filter-chips').forEach((group) => {
        group.addEventListener('click', (event) => {
            const chip = event.target.closest('.filter-chip');
            if (!chip) {
                return;
            }

            const target = group.dataset.target;
            filtrosEstado[target] = chip.dataset.status;

            group.querySelectorAll('.filter-chip').forEach((button) => {
                button.classList.toggle('active', button === chip);
            });

            if (target === 'computadores') {
                paginaAtualComputadores = 1;
                renderComputadores();
                return;
            }

            paginaAtualMonitores = 1;
            renderMonitores();
        });
    });
}

function highlightSelection(checkbox) {
    const item = checkbox.closest('.equip-item');
    if (!item) {
        return;
    }

    item.classList.toggle('is-selected', checkbox.checked);
}

function updateInventarioSelecaoResumo() {
    const contador = document.getElementById('inventarioSelecaoResumo');
    if (!contador) {
        return;
    }

    const total = selectedComputadores.size + selectedMonitores.size;
    contador.textContent = `${total} item(ns) selecionado(s)`;
}

function updateSalaSelecaoResumo() {
    const contador = document.getElementById('contadorSelecionadosSala');
    const contadorPanel = document.getElementById('salaSelecaoResumo');
    const total = selectedSalaComputadores.size + selectedSalaMonitores.size;
    if (contador) {
        contador.textContent = `${total} selecionados`;
    }
    if (contadorPanel) {
        contadorPanel.textContent = `${total} item(ns) selecionado(s)`;
    }
}

function matchesAssociationFilter(item, tipo) {
    if (filtrosEstado[tipo] === 'available') {
        return !item.id_sala;
    }

    if (filtrosEstado[tipo] === 'associated') {
        return Boolean(item.id_sala);
    }

    return true;
}

function gerarPaginacao(total, atual, tipo) {
    if (total <= 1) {
        return '';
    }

    let html = '';
    const paginaAnterior = Math.max(1, atual - 1);
    const proximaPagina = Math.min(total, atual + 1);

    html += `<button onclick="mudarPagina('${tipo}', 1)"><<</button>`;
    html += `<button onclick="mudarPagina('${tipo}', ${paginaAnterior})"><</button>`;

    const maxPaginas = 5;
    let startPage = Math.max(1, atual - Math.floor(maxPaginas / 2));
    let endPage = Math.min(total, startPage + maxPaginas - 1);
    if (endPage - startPage + 1 < maxPaginas) {
        startPage = Math.max(1, endPage - maxPaginas + 1);
    }

    for (let i = startPage; i <= endPage; i += 1) {
        html += `<button onclick="mudarPagina('${tipo}', ${i})" class="${i === atual ? 'active' : ''}">${i}</button>`;
    }

    html += `<button onclick="mudarPagina('${tipo}', ${proximaPagina})">></button>`;
    html += `<button onclick="mudarPagina('${tipo}', ${total})">>></button>`;
    return html;
}

function renderComputadores() {
    const filtro = normalizeText(document.getElementById('filtroComputadores').value);
    const lista = document.getElementById('listaComputadores');
    const paginacao = document.getElementById('paginacaoComputadores');
    const resumo = document.getElementById('resumoListaComputadores');
    const unidadeCode = getSelectedUnidadeCode();

    const filtrados = computadores.filter((item) => {
        const textoBusca = normalizeText([
            item.nome_computador,
            item.patrimonio,
            item.endereco_ip,
            item.SerialNumber,
            item.nome_sala,
            item.endereco_mac,
            item.last_logged_user
        ].join(' '));

        return textoBusca.includes(filtro)
            && matchesAssociationFilter(item, 'computadores')
            && matchesSelectedUnit(item);
    });

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina));
    paginaAtualComputadores = Math.min(paginaAtualComputadores, totalPaginas);
    const inicio = (paginaAtualComputadores - 1) * itensPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

    resumo.textContent = shouldFilterBySelectedUnit() && unidadeCode
        ? `${filtrados.length} computador(es) encontrados para a unidade ${unidadeCode}`
        : `${filtrados.length} computador(es) encontrados`;
    lista.innerHTML = '';

    if (!pagina.length) {
        lista.innerHTML = '<li class="empty-state">Nenhum computador encontrado com os filtros atuais.</li>';
        paginacao.innerHTML = '';
        return;
    }

    pagina.forEach((item) => {
        const badge = getAssociationBadge(item);
        const li = document.createElement('li');
        li.className = `equip-item ${item.id_sala ? 'is-associated' : ''}`;
        li.innerHTML = `
            <div class="equip-item__header">
                <div>
                    <div class="equip-item__title">${item.nome_computador || 'Computador sem nome'}</div>
                    <div class="equip-item__subtitle">IP: ${item.endereco_ip || '-'} • Usuario: ${item.last_logged_user || '-'}</div>
                </div>
                <div class="status-badges">
                    <span class="${badge.className}">${badge.label}</span>
                    <span class="badge badge-neutral">Patrimonio: ${item.patrimonio || '-'}</span>
                </div>
            </div>
            <div class="equip-item__meta">
                <div class="meta-block">
                    <span class="meta-label">Serial</span>
                    <span class="meta-value">${item.SerialNumber || '-'}</span>
                </div>
                <div class="meta-block">
                    <span class="meta-label">MAC</span>
                    <span class="meta-value">${item.endereco_mac || '-'}</span>
                </div>
                <div class="meta-block">
                    <span class="meta-label">Sala atual</span>
                    <span class="meta-value">${item.nome_sala || 'Nao vinculado'}</span>
                </div>
                <div class="meta-block">
                    <span class="meta-label">CPU</span>
                    <span class="meta-value">${item.cpu_info || '-'}</span>
                </div>
                <div class="meta-block">
                    <span class="meta-label">Memoria RAM</span>
                    <span class="meta-value">${item.memoria_ram || '-'}</span>
                </div>
            </div>
            <div class="equip-item__footer">
                <label class="equip-item__checkbox">
                    <input type="checkbox" class="computador-checkbox" value="${item.id}" ${selectedComputadores.has(item.id) ? 'checked' : ''}>
                    <span>${item.id_sala ? 'Selecionar para mover/vincular' : 'Selecionar para vincular'}</span>
                </label>
            </div>
        `;

        const checkbox = li.querySelector('.computador-checkbox');
        if (checkbox) {
            highlightSelection(checkbox);
            checkbox.addEventListener('change', () => {
                const id = parseInt(checkbox.value, 10);
                if (checkbox.checked) {
                    selectedComputadores.add(id);
                } else {
                    selectedComputadores.delete(id);
                }
                highlightSelection(checkbox);
                updateInventarioSelecaoResumo();
            });
        }
        lista.appendChild(li);
    });

    paginacao.innerHTML = gerarPaginacao(totalPaginas, paginaAtualComputadores, 'computadores');
}

function abrirModalEdicaoMonitor(event) {
    const button = event.currentTarget;
    document.getElementById('monitorTitulo').textContent = `${button.dataset.modelo} - ${button.dataset.patrimonio}`;
    document.getElementById('editMonitorId').value = button.dataset.id;
    document.getElementById('editModelo').value = button.dataset.modelo;
    document.getElementById('editPolegadas').value = button.dataset.polegadas;
    document.getElementById('editNumeroSerie').value = button.dataset.serie;
    document.getElementById('editPatrimonio').value = button.dataset.patrimonio;

    monitorSalaId = button.dataset.idSala;
    if (monitorSalaId) {
        btnRemoverAssociacao.style.display = 'inline-flex';
        btnRemoverAssociacao.onclick = () => desassociarMonitor(parseInt(button.dataset.id, 10), parseInt(monitorSalaId, 10));
    } else {
        btnRemoverAssociacao.style.display = 'none';
        btnRemoverAssociacao.onclick = null;
    }

    modal.style.display = 'flex';
}

function renderMonitores() {
    const filtro = normalizeText(document.getElementById('filtroMonitores').value);
    const lista = document.getElementById('listaMonitores');
    const paginacao = document.getElementById('paginacaoMonitores');
    const resumo = document.getElementById('resumoListaMonitores');

    const filtrados = monitores.filter((item) => {
        const textoBusca = normalizeText([
            item.modelo,
            item.patrimonio,
            item.numero_serie,
            item.nome_sala
        ].join(' '));

        return textoBusca.includes(filtro) && matchesAssociationFilter(item, 'monitores');
    });

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itensPorPagina));
    paginaAtualMonitores = Math.min(paginaAtualMonitores, totalPaginas);
    const inicio = (paginaAtualMonitores - 1) * itensPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itensPorPagina);

    resumo.textContent = `${filtrados.length} monitor(es) encontrados`;
    lista.innerHTML = '';

    if (!pagina.length) {
        lista.innerHTML = '<li class="empty-state">Nenhum monitor encontrado com os filtros atuais.</li>';
        paginacao.innerHTML = '';
        return;
    }

    pagina.forEach((item) => {
        const badge = getMonitorAssociationBadge(item);
        const li = document.createElement('li');
        li.className = `equip-item ${item.id_sala ? 'is-associated' : ''}`;
        li.innerHTML = `
            <div class="equip-item__header">
                <div>
                    <div class="equip-item__title">${item.modelo || 'Monitor sem modelo'}</div>
                    <div class="equip-item__subtitle">${item.polegadas || '-'} polegadas • Serie: ${item.numero_serie || '-'}</div>
                </div>
                <div class="status-badges">
                    <span class="${badge.className}">${badge.label}</span>
                    <span class="badge badge-neutral">Patrimonio: ${item.patrimonio || '-'}</span>
                </div>
            </div>
            <div class="equip-item__meta">
                <div class="meta-block">
                    <span class="meta-label">Sala atual</span>
                    <span class="meta-value">${item.nome_sala || 'Nao vinculado'}</span>
                </div>
                <div class="meta-block">
                    <span class="meta-label">Registro</span>
                    <span class="meta-value">${item.data_registro ? new Date(item.data_registro).toLocaleDateString('pt-BR') : '-'}</span>
                </div>
            </div>
            <div class="equip-item__footer">
                <label class="equip-item__checkbox">
                    <input type="checkbox" class="monitor-checkbox" value="${item.id}" ${selectedMonitores.has(item.id) ? 'checked' : ''}>
                    <span>${item.id_sala ? 'Selecionar para mover/vincular' : 'Selecionar para vincular'}</span>
                </label>
                <div class="equip-item__actions">
                    <button type="button" class="btn-editar-monitor"
                        data-id="${item.id}"
                        data-modelo="${item.modelo || ''}"
                        data-polegadas="${item.polegadas || ''}"
                        data-serie="${item.numero_serie || ''}"
                        data-patrimonio="${item.patrimonio || ''}"
                        data-id-sala="${item.id_sala || ''}">
                        Editar
                    </button>
                </div>
            </div>
        `;

        const checkbox = li.querySelector('.monitor-checkbox');
        if (checkbox) {
            highlightSelection(checkbox);
            checkbox.addEventListener('change', () => {
                const id = parseInt(checkbox.value, 10);
                if (checkbox.checked) {
                    selectedMonitores.add(id);
                } else {
                    selectedMonitores.delete(id);
                }
                highlightSelection(checkbox);
                updateInventarioSelecaoResumo();
            });
        }
        li.querySelector('.btn-editar-monitor')?.addEventListener('click', abrirModalEdicaoMonitor);
        lista.appendChild(li);
    });

    paginacao.innerHTML = gerarPaginacao(totalPaginas, paginaAtualMonitores, 'monitores');
}

function mudarPagina(tipo, pagina) {
    if (tipo === 'computadores') {
        paginaAtualComputadores = pagina;
        renderComputadores();
        return;
    }

    paginaAtualMonitores = pagina;
    renderMonitores();
}

window.mudarPagina = mudarPagina;

async function carregarTodasAsSalas() {
    try {
        const [salasAcademicas, salasAdministrativas] = await Promise.all([
            fetch('/todas-salas-academicas').then((res) => res.json()),
            fetch('/todas-salas-administrativas').then((res) => res.json())
        ]);

        salas = {};
        [...salasAcademicas, ...salasAdministrativas].forEach((sala) => {
            salas[sala.id_sala] = sala.nome_sala;
        });
    } catch (error) {
        console.error('Erro ao carregar todas as salas:', error);
    }
}

function carregarUnidades() {
    fetch('/unidades')
        .then((response) => response.json())
        .then((data) => {
            const unidadeSelect = document.getElementById('unidade');
            unidadeSelect.innerHTML = '<option value="">Selecione a unidade</option>';
            data.forEach((unidade) => {
                const option = document.createElement('option');
                option.value = unidade.codigo_unidade;
                option.textContent = unidade.nome_unidade;
                unidadeSelect.appendChild(option);
            });
            formatRoomContext();
        })
        .catch((error) => console.error('Erro ao carregar unidades:', error));
}

function carregarUnidadesDestino(selectId) {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    fetch('/unidades')
        .then((response) => response.json())
        .then((data) => {
            select.innerHTML = '<option value="">Selecione a unidade</option>';
            data.forEach((unidade) => {
                const option = document.createElement('option');
                option.value = unidade.codigo_unidade;
                option.textContent = unidade.nome_unidade;
                select.appendChild(option);
            });
        })
        .catch((error) => console.error(`Erro ao carregar unidades (${selectId}):`, error));
}

function carregarSalasDestino(unidadeId, tipoId, salaId) {
    const unidade = document.getElementById(unidadeId)?.value;
    const tipoSala = document.getElementById(tipoId)?.value;
    const salaSelect = document.getElementById(salaId);

    if (!salaSelect) {
        return;
    }

    if (!unidade || !tipoSala) {
        salaSelect.innerHTML = '<option value="">Selecione unidade e tipo de sala</option>';
        return;
    }

    const rota = tipoSala === 'administrativa' ? `/SalasAdministrativas/${unidade}` : `/salas/${unidade}`;

    fetch(rota)
        .then((response) => response.json())
        .then((data) => {
            salaSelect.innerHTML = '<option value="">Selecione a sala</option>';
            data.forEach((sala) => {
                const option = document.createElement('option');
                option.value = sala.id_sala;
                option.textContent = sala.nome_sala;
                salaSelect.appendChild(option);
            });
        })
        .catch((error) => console.error(`Erro ao carregar salas (${salaId}):`, error));
}

function carregarSalas() {
    const unidade = document.getElementById('unidade').value;
    const tipoSala = document.getElementById('tipoSala').value;
    const salaSelect = document.getElementById('sala');

    if (!unidade || !tipoSala) {
        salaSelect.innerHTML = '<option value="">Selecione unidade e tipo de sala</option>';
        formatRoomContext();
        return;
    }

    const rota = tipoSala === 'administrativa' ? `/SalasAdministrativas/${unidade}` : `/salas/${unidade}`;

    fetch(rota)
        .then((response) => response.json())
        .then((data) => {
            salaSelect.innerHTML = '<option value="">Selecione a sala</option>';
            data.forEach((sala) => {
                const option = document.createElement('option');
                option.value = sala.id_sala;
                option.textContent = sala.nome_sala;
                salaSelect.appendChild(option);
            });
            formatRoomContext();
        })
        .catch((error) => console.error('Erro ao carregar salas:', error));
}

function carregarEquipamentos() {
    Promise.all([
        fetch('/infocomputadores').then((res) => res.json()),
        fetch('/monitores').then((res) => res.json())
    ])
        .then(([computadoresData, monitoresData]) => {
            computadores = computadoresData;
            monitores = monitoresData;
            selectedComputadores.clear();
            selectedMonitores.clear();
            paginaAtualComputadores = 1;
            paginaAtualMonitores = 1;
            equipamentosVisiveis = true;
            updateSummaryCards();
            renderComputadores();
            renderMonitores();
            updateInventarioSelecaoResumo();
        })
        .catch((error) => {
            console.error('Erro ao carregar equipamentos:', error);
            alert('Erro ao carregar inventario de equipamentos.');
        });
}

async function carregarAssociados() {
    const salaId = document.getElementById('sala').value;
    const tipoSala = document.getElementById('tipoSala').value;
    const tabela = document.querySelector('#tabelaComputadoresAssociados tbody');
    const contador = document.getElementById('contadorComputadores');
    tabela.innerHTML = '';
    selectedSalaComputadores.clear();
    selectedSalaMonitores.clear();
    computadoresAssociadosSalaAtual = [];
    updateSalaSelecaoResumo();
    formatRoomContext();
    updatePrintRoomHeader();
    updatePrintButtonVisibility();

    if (!salaId || !tipoSala) {
        tabela.innerHTML = '<tr><td colspan="10">Selecione unidade, tipo de sala e sala para visualizar os vinculados.</td></tr>';
        contador.textContent = '';
        return;
    }

    try {
        const computadoresAssociados = await fetch(`/computadores-associados/${salaId}/${tipoSala}`).then((res) => res.json());
        const monitoresAssociados = await fetch(`/monitores-associados/${salaId}`).then((res) => res.json());

        computadoresAssociadosSalaAtual = Array.isArray(computadoresAssociados) ? computadoresAssociados : [];
    
        computadoresAssociados.sort(compareComputerNamesAscending);

        computadoresAssociados.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="row-select-checkbox" data-equipment-type="computador" value="${item.id_computador}"></td>
                <td>${item.nome_computador || '-'}</td>
                <td>${item.endereco_mac || '-'}</td>
                <td>${item.cpu_info || '-'}</td>
                <td>${item.memoria_ram || '-'}</td>
                <td>${item.disco_info || '-'}</td>
                <td>${item.SerialNumber || '-'}</td>
                <td>${item.endereco_ip || '-'}</td>
                <td>${item.patrimonio || '-'}</td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn-config-pc">Config</button>
                        <button type="button" class="btn-remover-pc">Remover</button>
                    </div>
                </td>
            `;

            tr.querySelector('.btn-config-pc')?.addEventListener('click', () => {
                abrirConfigComputador(item.SerialNumber || '', item.nome_computador || '', item.endereco_ip || '', item.patrimonio || '', item.id_computador || '', Boolean(item.cadastro_manual), item.cpu_info || '', item.endereco_mac || '', item.memoria_ram || '', item.disco_info || '');
            });

            tr.querySelector('.btn-remover-pc')?.addEventListener('click', () => {
                removerComputador(item.id_computador, salaId);
            });

            tr.querySelector('.row-select-checkbox')?.addEventListener('change', (event) => {
                const id = parseInt(event.target.value, 10);
                if (event.target.checked) {
                    selectedSalaComputadores.add(id);
                } else {
                    selectedSalaComputadores.delete(id);
                }
                updateSalaSelecaoResumo();
            });

            tabela.appendChild(tr);
        });

        monitoresAssociados.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" class="row-select-checkbox" data-equipment-type="monitor" value="${item.id}"></td>
                <td>Monitor: ${item.modelo || '-'} (${item.polegadas || '-'})</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>${item.numero_serie || '-'}</td>
                <td>-</td>
                <td>${item.patrimonio || '-'}</td>
                <td>
                    <div class="table-actions">
                        <button type="button" class="btn-editar-monitor"
                            data-id="${item.id}"
                            data-modelo="${item.modelo || ''}"
                            data-polegadas="${item.polegadas || ''}"
                            data-serie="${item.numero_serie || ''}"
                            data-patrimonio="${item.patrimonio || ''}"
                            data-id-sala="${salaId}">
                            Editar
                        </button>
                        <button type="button" class="btn-remover-pc">Remover</button>
                    </div>
                </td>
            `;

            tr.querySelector('.btn-editar-monitor')?.addEventListener('click', abrirModalEdicaoMonitor);

            tr.querySelector('.btn-remover-pc')?.addEventListener('click', () => {
                removerMonitor(item.id, salaId);
            });

            tr.querySelector('.row-select-checkbox')?.addEventListener('change', (event) => {
                const id = parseInt(event.target.value, 10);
                if (event.target.checked) {
                    selectedSalaMonitores.add(id);
                } else {
                    selectedSalaMonitores.delete(id);
                }
                updateSalaSelecaoResumo();
            });

            tabela.appendChild(tr);
        });

        const totalEquipamentos = computadoresAssociados.length + monitoresAssociados.length;
        if (!totalEquipamentos) {
            tabela.innerHTML = '<tr><td colspan="10">Nenhum equipamento associado a esta sala.</td></tr>';
            contador.textContent = '0 item(ns) vinculado(s) • 0 PC(s) • 0 monitor(es)';
                    return;
        }

        contador.textContent = `${totalEquipamentos} item(ns) vinculado(s) • ${computadoresAssociados.length} PC(s) • ${monitoresAssociados.length} monitor(es)`;
        updateSalaSelecaoResumo();
    } catch (error) {
        console.error('Erro ao carregar equipamentos associados:', error);
        tabela.innerHTML = '<tr><td colspan="10">Erro ao carregar os equipamentos vinculados.</td></tr>';
        contador.textContent = '';
        }
}

async function processarVinculoEmMassa(destinoSalaId, destinoTipoSala, computadoresSelecionados, monitoresSelecionados) {
    let sucesso = 0;
    let falhas = 0;

    for (const id of computadoresSelecionados) {
        try {
            const resposta = await fetch('/associar-computador', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ salaId: destinoSalaId, computadorId: id, tipoSala: destinoTipoSala })
            });

            if (!resposta.ok) {
                falhas += 1;
                continue;
            }

            sucesso += 1;
        } catch (error) {
            console.error('Erro ao associar/mover computador:', error);
            falhas += 1;
        }
    }

    for (const id of monitoresSelecionados) {
        try {
            const resposta = await fetch('/associar-monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ salaId: destinoSalaId, monitorId: id })
            });

            if (!resposta.ok) {
                falhas += 1;
                continue;
            }

            sucesso += 1;
        } catch (error) {
            console.error('Erro ao associar/mover monitor:', error);
            falhas += 1;
        }
    }

    return { sucesso, falhas };
}

function abrirModalPatrimonioParaVinculo(computadoresSelecionados) {
    if (!modalPatrimonioVinculo) {
        return Promise.resolve(true);
    }

    const lista = document.getElementById('listaPatrimonioVinculo');
    const resumo = document.getElementById('resumoPatrimonioVinculo');
    const pcs = computadoresSelecionados
        .map((id) => computadores.find((item) => Number(item.id) === Number(id)))
        .filter(Boolean);

    if (resumo) {
        resumo.textContent = `${pcs.length} PC(s) selecionado(s). Informe somente o patrimonio que deseja ajustar agora.`;
    }

    if (lista) {
        lista.innerHTML = '';
        pcs.forEach((item) => {
            const bloco = document.createElement('div');
            bloco.className = 'form-group';
            bloco.innerHTML = `
                <label for="patrimonioVinculo_${item.id}">${escapeHtml(item.nome_computador || 'Computador sem nome')} • Serial: ${escapeHtml(item.SerialNumber || '-')}</label>
                <input type="text" id="patrimonioVinculo_${item.id}" class="patrimonio-vinculo-input" data-id="${item.id}" value="${escapeHtml(item.patrimonio || '')}" placeholder="Patrimonio">
            `;
            lista.appendChild(bloco);
        });
    }

    modalPatrimonioVinculo.style.display = 'flex';
    return new Promise((resolve) => {
        resolverModalPatrimonioVinculo = resolve;
    });
}

function fecharModalPatrimonioParaVinculo(confirmado) {
    if (!modalPatrimonioVinculo) {
        return;
    }

    modalPatrimonioVinculo.style.display = 'none';
    if (resolverModalPatrimonioVinculo) {
        resolverModalPatrimonioVinculo(confirmado);
        resolverModalPatrimonioVinculo = null;
    }
}

async function salvarPatrimoniosSelecionadosNoVinculo() {
    const inputs = Array.from(document.querySelectorAll('.patrimonio-vinculo-input'));

    for (const input of inputs) {
        const id = parseInt(input.dataset.id, 10);
        const patrimonio = input.value.trim();
        const pcLocal = computadores.find((item) => Number(item.id) === id);
        const patrimonioAtual = String(pcLocal?.patrimonio || '').trim();

        if (!id || !patrimonio || patrimonio === patrimonioAtual) {
            continue;
        }

        const response = await fetch(`/computadores/id/${id}/patrimonio`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patrimonio })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || `Falha ao salvar patrimonio para o PC ${id}.`);
        }

        if (pcLocal) {
            pcLocal.patrimonio = patrimonio;
        }
    }
}

function selecionarTodosVisiveisInventario() {
    document.querySelectorAll('.computador-checkbox').forEach((checkbox) => {
        checkbox.checked = true;
        selectedComputadores.add(parseInt(checkbox.value, 10));
        highlightSelection(checkbox);
    });

    document.querySelectorAll('.monitor-checkbox').forEach((checkbox) => {
        checkbox.checked = true;
        selectedMonitores.add(parseInt(checkbox.value, 10));
        highlightSelection(checkbox);
    });

    updateInventarioSelecaoResumo();
}

function limparSelecaoInventario() {
    selectedComputadores.clear();
    selectedMonitores.clear();
    document.querySelectorAll('.computador-checkbox, .monitor-checkbox').forEach((checkbox) => {
        checkbox.checked = false;
        highlightSelection(checkbox);
    });
    updateInventarioSelecaoResumo();
}

async function vincularSelecionadosNoInventario() {
    const salaId = document.getElementById('inventarioSala')?.value;
    const tipoSala = document.getElementById('inventarioTipoSala')?.value;

    if (!salaId || !tipoSala) {
        alert('Selecione unidade, tipo de sala e sala destino no bloco de vinculacao rapida.');
        return;
    }

    const computadoresSelecionados = Array.from(selectedComputadores);
    const monitoresSelecionados = Array.from(selectedMonitores);

    if (!computadoresSelecionados.length && !monitoresSelecionados.length) {
        alert('Selecione ao menos um equipamento no inventario.');
        return;
    }

    if (computadoresSelecionados.length) {
        const confirmouPatrimonio = await abrirModalPatrimonioParaVinculo(computadoresSelecionados);
        if (!confirmouPatrimonio) {
            return;
        }

        try {
            await salvarPatrimoniosSelecionadosNoVinculo();
        } catch (error) {
            console.error('Erro ao salvar patrimonio no vinculo rapido:', error);
            alert(error.message || 'Erro ao salvar patrimonio antes de vincular.');
            return;
        }
    }

    const { sucesso, falhas } = await processarVinculoEmMassa(salaId, tipoSala, computadoresSelecionados, monitoresSelecionados);

    if (!sucesso && falhas) {
        alert('Nao foi possivel vincular os equipamentos selecionados.');
    } else if (falhas) {
        alert(`${sucesso} equipamento(s) processado(s) com sucesso e ${falhas} falha(s).`);
    } else {
        alert(`${sucesso} equipamento(s) vinculado(s) com sucesso.`);
    }

    limparSelecaoInventario();
    carregarEquipamentos();
    carregarAssociados();
}

function selecionarTodosDaSalaAtual() {
    document.querySelectorAll('#tabelaComputadoresAssociados .row-select-checkbox').forEach((checkbox) => {
        checkbox.checked = true;
        const id = parseInt(checkbox.value, 10);
        if (checkbox.dataset.equipmentType === 'monitor') {
            selectedSalaMonitores.add(id);
        } else {
            selectedSalaComputadores.add(id);
        }
    });
    updateSalaSelecaoResumo();
}

function limparSelecaoSalaAtual() {
    selectedSalaComputadores.clear();
    selectedSalaMonitores.clear();
    document.querySelectorAll('#tabelaComputadoresAssociados .row-select-checkbox').forEach((checkbox) => {
        checkbox.checked = false;
    });
    updateSalaSelecaoResumo();
}

function toggleMoverSelecionadosPanel(show) {
    const panel = document.getElementById('moverSelecionadosPanel');
    if (!panel) {
        return;
    }

    panel.style.display = show ? 'block' : 'none';
}

async function confirmarMoverSelecionados() {
    const salaOrigemId = document.getElementById('sala')?.value;
    const tipoOrigem = document.getElementById('tipoSala')?.value;
    const salaDestinoId = document.getElementById('moverSala')?.value;
    const tipoDestino = document.getElementById('moverTipoSala')?.value;

    const computadoresSelecionados = Array.from(selectedSalaComputadores);
    const monitoresSelecionados = Array.from(selectedSalaMonitores);

    if (!computadoresSelecionados.length && !monitoresSelecionados.length) {
        alert('Selecione ao menos um item na tabela de equipamentos associados.');
        return;
    }

    if (!salaDestinoId || !tipoDestino) {
        alert('Selecione unidade, tipo e sala de destino para mover os itens.');
        return;
    }

    if (String(salaOrigemId) === String(salaDestinoId) && String(tipoOrigem) === String(tipoDestino)) {
        alert('A sala de destino e igual a origem. Selecione outro destino.');
        return;
    }

    const { sucesso, falhas } = await processarVinculoEmMassa(salaDestinoId, tipoDestino, computadoresSelecionados, monitoresSelecionados);

    if (!sucesso && falhas) {
        alert('Nao foi possivel mover os equipamentos selecionados.');
        return;
    }

    if (falhas) {
        alert(`${sucesso} equipamento(s) movido(s) com sucesso e ${falhas} falha(s).`);
    } else {
        alert(`${sucesso} equipamento(s) movido(s) com sucesso.`);
    }

    limparSelecaoSalaAtual();
    toggleMoverSelecionadosPanel(false);
    carregarEquipamentos();
    carregarAssociados();
}

function removerComputador(computadorId, salaId) {
    const tipoSala = document.getElementById('tipoSala').value;
    if (!confirm('Tem certeza que deseja remover este computador da sala?')) {
        return;
    }

    fetch(`/desassociar-computador/${computadorId}/${salaId}/${tipoSala}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok) {
                throw new Error('Erro ao remover computador.');
            }

            carregarAssociados();
            carregarEquipamentos();
        })
        .catch((error) => {
            console.error('Erro ao remover computador:', error);
            alert('Erro ao remover computador.');
        });
}

function removerMonitor(monitorId, salaId) {
    if (!confirm('Tem certeza que deseja remover este monitor da sala?')) {
        return;
    }

    fetch(`/desassociar-monitor/${monitorId}/${salaId}`, { method: 'DELETE' })
        .then((res) => {
            if (!res.ok) {
                throw new Error('Erro ao remover monitor.');
            }

            carregarAssociados();
            carregarEquipamentos();
        })
        .catch((error) => {
            console.error('Erro ao remover monitor:', error);
            alert('Erro ao remover monitor.');
        });
}

function desassociarMonitor(monitorId, salaId) {
    if (!confirm('Tem certeza que deseja remover este monitor da sala?')) {
        return;
    }

    if (modal) {
        modal.style.display = 'none';
    }

    removerMonitor(monitorId, salaId);
}

async function excluirMonitorPermanentemente(monitorId, patrimonio) {
    if (!confirm(`ATENCAO! Voce ira EXCLUIR PERMANENTEMENTE o monitor ${patrimonio} (ID: ${monitorId}) do inventario. Esta acao e irreversivel. Deseja continuar?`)) {
        return;
    }

    try {
        const res = await fetch(`/excluir-monitor/${monitorId}`, { method: 'DELETE' });
        if (!res.ok) {
            throw new Error(await res.text());
        }

        modal.style.display = 'none';
        carregarEquipamentos();
        carregarAssociados();
    } catch (error) {
        console.error('Erro ao excluir monitor permanentemente:', error);
        alert('Erro ao excluir monitor permanentemente.');
    }
}

async function salvarEdicaoMonitor(event) {
    event.preventDefault();

    const id = document.getElementById('editMonitorId').value;
    const modelo = document.getElementById('editModelo').value;
    const polegadas = parseInt(document.getElementById('editPolegadas').value, 10);
    const numero_serie = document.getElementById('editNumeroSerie').value;
    const patrimonio = document.getElementById('editPatrimonio').value;

    try {
        const res = await fetch(`/editar-monitor/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelo, polegadas, numero_serie, patrimonio })
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        modal.style.display = 'none';
        carregarEquipamentos();
        carregarAssociados();
    } catch (error) {
        console.error('Erro ao salvar monitor:', error);
        alert('Erro ao salvar monitor.');
    }
}

function configurarCamposEdicaoComputador(isManual) {
    const nomeInput = document.getElementById('cfgNomeComputador');
    const macInput = document.getElementById('cfgEnderecoMac');
    const serialInput = document.getElementById('cfgSerialComputador');
    const cpuInput = document.getElementById('cfgCpuInfo');
    const memoriaInput = document.getElementById('cfgMemoriaRam');
    const discoInput = document.getElementById('cfgDiscoInfo');
    const ipInput = document.getElementById('cfgIpComputador');
    const aviso = document.getElementById('cfgAvisoEdicaoManual');
    const botaoSalvar = document.getElementById('btnSalvarPatrimonioComputador');

    [nomeInput, macInput, serialInput, cpuInput, memoriaInput, discoInput, ipInput].forEach((input) => {
        if (!input) {
            return;
        }

        input.readOnly = !isManual;
        input.classList.toggle('input-readonly', !isManual);
    });

    if (aviso) {
        aviso.innerText = isManual
            ? 'Este computador foi cadastrado manualmente. Todos os campos do cadastro podem ser corrigidos.'
            : 'Este computador veio do inventario automatico. Os dados tecnicos permanecem bloqueados.';
    }

    if (botaoSalvar) {
        botaoSalvar.innerHTML = isManual
            ? '<i class="fas fa-save"></i> Salvar Dados do Computador'
            : '<i class="fas fa-save"></i> Salvar Patrimonio';
    }
}

function abrirConfigComputador(serial, nome, ip, patrimonio, computadorId, cadastroManual, cpuInfo, enderecoMac, memoriaRam, discoInfo) {
    document.getElementById('cfgComputadorId').value = computadorId || '';
    document.getElementById('cfgCadastroManual').value = cadastroManual ? '1' : '0';
    document.getElementById('cfgSerialComputador').value = serial || '';
    document.getElementById('cfgNomeComputador').value = nome || '';
    document.getElementById('cfgEnderecoMac').value = enderecoMac || '';
    document.getElementById('cfgCpuInfo').value = cpuInfo || '';
    document.getElementById('cfgMemoriaRam').value = memoriaRam || '';
    document.getElementById('cfgDiscoInfo').value = discoInfo || '';
    document.getElementById('cfgIpComputador').value = ip || '';
    document.getElementById('cfgPatrimonioComputador').value = patrimonio || '';
    document.getElementById('cfgRetornoPatrimonio').innerText = '';
    configurarCamposEdicaoComputador(Boolean(cadastroManual));
    modalConfigComputador.style.display = 'flex';
}

function fecharModalConfigComputador() {
    modalConfigComputador.style.display = 'none';
    document.getElementById('cfgRetornoPatrimonio').innerText = '';
    document.getElementById('cfgAvisoEdicaoManual').innerText = '';
}

// ── Selects do cadastro de monitor (cadUnidade / cadTipoSala / cadSala) ──
function carregarUnidadesCadastro() {
    fetch('/unidades')
        .then((r) => r.json())
        .then((data) => {
            const sel = document.getElementById('cadUnidade');
            sel.innerHTML = '<option value="">Selecione a unidade</option>';
            data.forEach((u) => {
                const opt = document.createElement('option');
                opt.value = u.codigo_unidade;
                opt.textContent = u.nome_unidade;
                sel.appendChild(opt);
            });
        })
        .catch((err) => console.error('Erro ao carregar unidades cadastro:', err));
}

function carregarSalasCadastro() {
    const unidade = document.getElementById('cadUnidade').value;
    const tipo = document.getElementById('cadTipoSala').value;
    const sel = document.getElementById('cadSala');

    if (!unidade || !tipo) {
        sel.innerHTML = '<option value="">Selecione unidade e tipo primeiro</option>';
        return;
    }

    const rota = tipo === 'administrativa' ? `/SalasAdministrativas/${unidade}` : `/salas/${unidade}`;
    fetch(rota)
        .then((r) => r.json())
        .then((data) => {
            sel.innerHTML = '<option value="">Selecione a sala</option>';
            data.forEach((sala) => {
                const opt = document.createElement('option');
                opt.value = sala.id_sala;
                opt.textContent = sala.nome_sala;
                sel.appendChild(opt);
            });
        })
        .catch((err) => console.error('Erro ao carregar salas cadastro:', err));
}

document.getElementById('formMonitor').addEventListener('submit', async (event) => {
    event.preventDefault();

    const {
        form,
        monitorIdInput,
        retorno,
        modelo: modeloInput,
        polegadas: polegadasInput,
        numeroSerie: numeroSerieInput,
        patrimonio: patrimonioInput,
        sala
    } = getCadastroMonitorElements();
    const modelo = modeloInput.value.trim();
    const polegadas = parseInt(polegadasInput.value, 10);
    const numero_serie = numeroSerieInput.value.trim();
    const patrimonio = patrimonioInput.value.trim();
    const salaId = sala.value || null;
    const monitorId = monitorIdInput.value || null;

    retorno.textContent = '';

    if (monitorId) {
        const modeloAtual = monitorIdInput.dataset.modeloOriginal || modelo;
        const polegadasAtual = monitorIdInput.dataset.polegadasOriginal || polegadas;
        const confirmado = await confirmarSobrescritaMonitor(modeloAtual, polegadasAtual, patrimonio);
        if (!confirmado) {
            return;
        }
    }

    try {
        const res = await fetch('/cadastrar-monitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monitorId, modelo, polegadas, numero_serie, patrimonio, salaId })
        });

        const data = await res.json().catch(() => null);
        const message = data?.message || 'Operacao concluida.';

        if (!res.ok) {
            retorno.style.color = '#c0392b';
            retorno.textContent = data?.error || message;
            return;
        }

        retorno.style.color = '#12795a';
        retorno.textContent = message;
        form.reset();
        limparAvisoMonitorExistente();
        document.getElementById('cadSala').innerHTML = '<option value="">Selecione a sala</option>';
        carregarEquipamentos();
    } catch (error) {
        console.error('Erro ao cadastrar monitor:', error);
        retorno.style.color = '#c0392b';
        retorno.textContent = 'Erro de conexao ao cadastrar monitor.';
    }
});

document.getElementById('formComputadorManual')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = document.getElementById('formComputadorManual');
    const retorno = document.getElementById('formComputadorManualRetorno');
    const payload = {
        nome_computador: document.getElementById('manualNomeComputador')?.value?.trim() || null,
        endereco_mac: document.getElementById('manualEnderecoMac')?.value?.trim() || null,
        cpu_info: document.getElementById('manualCpuInfo')?.value?.trim() || null,
        memoria_ram: document.getElementById('manualMemoriaRam')?.value?.trim() || null,
        disco_info: document.getElementById('manualDiscoInfo')?.value?.trim() || null,
        SerialNumber: document.getElementById('manualSerialNumber')?.value?.trim() || null,
        endereco_ip: document.getElementById('manualEnderecoIp')?.value?.trim() || null,
        patrimonio: document.getElementById('manualPatrimonio')?.value?.trim() || '',
        tipoSala: document.getElementById('manualPcTipoSala')?.value || '',
        salaId: document.getElementById('manualPcSala')?.value || ''
    };

    retorno.textContent = '';

    if (!payload.patrimonio) {
        retorno.style.color = '#c0392b';
        retorno.textContent = 'Patrimonio e obrigatorio.';
        return;
    }

    if (!payload.tipoSala || !payload.salaId) {
        retorno.style.color = '#c0392b';
        retorno.textContent = 'Selecione o tipo e a sala para vinculacao obrigatoria.';
        return;
    }

    try {
        const res = await fetch('/cadastrar-computador-manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);
        const message = data?.message || 'Operacao concluida.';

        if (!res.ok) {
            retorno.style.color = '#c0392b';
            retorno.textContent = data?.error || message;
            return;
        }

        retorno.style.color = '#12795a';
        retorno.textContent = message;
        form.reset();
        document.getElementById('manualPcSala').innerHTML = '<option value="">Selecione a sala</option>';
        carregarEquipamentos();
        carregarAssociados();
    } catch (error) {
        console.error('Erro ao cadastrar computador manual:', error);
        retorno.style.color = '#c0392b';
        retorno.textContent = 'Erro de conexao ao cadastrar computador manualmente.';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades();
    carregarUnidadesDestino('inventarioUnidade');
    carregarUnidadesDestino('moverUnidade');
    carregarUnidadesDestino('manualPcUnidade');
    carregarTodasAsSalas();
    carregarUnidadesCadastro();
    formatRoomContext();
    updatePrintButtonVisibility();
    bindFilterChips();
    updateInventarioSelecaoResumo();
    updateSalaSelecaoResumo();
    document.getElementById('cadUnidade').addEventListener('change', carregarSalasCadastro);
    document.getElementById('cadTipoSala').addEventListener('change', carregarSalasCadastro);
    document.getElementById('patrimonio').addEventListener('blur', buscarMonitorPorPatrimonio);
    document.getElementById('patrimonio').addEventListener('input', () => {
        document.getElementById('formMonitorRetorno').textContent = '';
        if (!document.getElementById('patrimonio').value.trim()) {
            limparAvisoMonitorExistente();
        }
    });

    document.getElementById('btnCarregarEquipamentos').addEventListener('click', carregarEquipamentos);
    document.getElementById('btnSelecionarTodosVisiveisInventario')?.addEventListener('click', selecionarTodosVisiveisInventario);
    document.getElementById('btnLimparSelecaoInventario')?.addEventListener('click', limparSelecaoInventario);
    document.getElementById('btnVincularSelecionadosInventario')?.addEventListener('click', vincularSelecionadosNoInventario);
    document.getElementById('btnSelecionarTodosSalaAtual')?.addEventListener('click', selecionarTodosDaSalaAtual);
    document.getElementById('btnImprimirSala')?.addEventListener('click', imprimirSalaSelecionada);
    document.getElementById('btnAbrirMoverSelecionados')?.addEventListener('click', () => toggleMoverSelecionadosPanel(true));
    document.getElementById('btnCancelarMoverSelecionados')?.addEventListener('click', () => {
        toggleMoverSelecionadosPanel(false);
        limparSelecaoSalaAtual();
    });
    document.getElementById('btnConfirmarMoverSelecionados')?.addEventListener('click', confirmarMoverSelecionados);
    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        document.getElementById('filtroComputadores').value = '';
        document.getElementById('filtroMonitores').value = '';
        filtrosEstado.computadores = 'all';
        filtrosEstado.monitores = 'all';
        document.querySelectorAll('.filter-chip').forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.status === 'all');
        });
        paginaAtualComputadores = 1;
        paginaAtualMonitores = 1;
        renderComputadores();
        renderMonitores();
        limparSelecaoInventario();
    });

    document.getElementById('unidade').addEventListener('change', () => {
        carregarSalas();
        carregarAssociados();
    });

    document.getElementById('tipoSala').addEventListener('change', () => {
        carregarSalas();
        carregarAssociados();
    });

    document.getElementById('sala').addEventListener('change', carregarAssociados);
    document.getElementById('inventarioUnidade')?.addEventListener('change', () => carregarSalasDestino('inventarioUnidade', 'inventarioTipoSala', 'inventarioSala'));
    document.getElementById('inventarioTipoSala')?.addEventListener('change', () => carregarSalasDestino('inventarioUnidade', 'inventarioTipoSala', 'inventarioSala'));
    document.getElementById('moverUnidade')?.addEventListener('change', () => carregarSalasDestino('moverUnidade', 'moverTipoSala', 'moverSala'));
    document.getElementById('moverTipoSala')?.addEventListener('change', () => carregarSalasDestino('moverUnidade', 'moverTipoSala', 'moverSala'));
    document.getElementById('manualPcUnidade')?.addEventListener('change', () => carregarSalasDestino('manualPcUnidade', 'manualPcTipoSala', 'manualPcSala'));
    document.getElementById('manualPcTipoSala')?.addEventListener('change', () => carregarSalasDestino('manualPcUnidade', 'manualPcTipoSala', 'manualPcSala'));
    document.getElementById('filtroComputadores').addEventListener('input', () => {
        paginaAtualComputadores = 1;
        renderComputadores();
    });
    document.getElementById('filtroMonitores').addEventListener('input', () => {
        paginaAtualMonitores = 1;
        renderMonitores();
    });
    document.getElementById('filtroUnidadeComputadores').addEventListener('change', () => {
        paginaAtualComputadores = 1;
        renderComputadores();
    });

    configurarHistoricoEventos();

    if (modal && closeButton) {
        closeButton.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (btnExcluirPermanentemente) {
        btnExcluirPermanentemente.addEventListener('click', () => {
            const monitorId = document.getElementById('editMonitorId').value;
            const monitorPatrimonio = document.getElementById('editPatrimonio').value;
            if (monitorId) {
                excluirMonitorPermanentemente(parseInt(monitorId, 10), monitorPatrimonio);
            }
        });
    }

    if (formEditarMonitor) {
        formEditarMonitor.addEventListener('submit', salvarEdicaoMonitor);
    }
    document.getElementById('btnRecarregarUsuariosLocais')?.addEventListener('click', carregarUsuariosLocaisComputador);
    document.getElementById('btnSalvarPatrimonioComputador')?.addEventListener('click', salvarPatrimonioComputador);
    document.getElementById('cfgListaUsuariosLocais')?.addEventListener('click', selecionarUsuarioLocalDoPainel);
    document.getElementById('btnConfirmarPatrimonioVinculo')?.addEventListener('click', () => fecharModalPatrimonioParaVinculo(true));
    document.getElementById('btnCancelarPatrimonioVinculo')?.addEventListener('click', () => fecharModalPatrimonioParaVinculo(false));
    document.getElementById('btnFecharPatrimonioVinculo')?.addEventListener('click', () => fecharModalPatrimonioParaVinculo(false));

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }

        if (event.target === modalConfigComputador) {
            fecharModalConfigComputador();
        }

        if (event.target === modalPatrimonioVinculo) {
            fecharModalPatrimonioParaVinculo(false);
        }
    });
});

window.fecharModalConfigComputador = fecharModalConfigComputador;
async function salvarPatrimonioComputador() {
    const computadorId = parseInt(document.getElementById('cfgComputadorId').value, 10);
    const cadastroManual = document.getElementById('cfgCadastroManual').value === '1';
    const serial = document.getElementById('cfgSerialComputador').value.trim();
    const nomeComputador = document.getElementById('cfgNomeComputador').value.trim();
    const enderecoMac = document.getElementById('cfgEnderecoMac').value.trim();
    const cpuInfo = document.getElementById('cfgCpuInfo').value.trim();
    const memoriaRam = document.getElementById('cfgMemoriaRam').value.trim();
    const discoInfo = document.getElementById('cfgDiscoInfo').value.trim();
    const enderecoIp = document.getElementById('cfgIpComputador').value.trim();
    const patrimonio = document.getElementById('cfgPatrimonioComputador').value.trim();
    const retorno = document.getElementById('cfgRetornoPatrimonio');

    if (!Number.isInteger(computadorId) && !serial) {
        retorno.style.color = '#c0392b';
        retorno.innerText = 'Computador nao identificado para salvar patrimonio.';
        return;
    }

    try {
        const rota = cadastroManual && Number.isInteger(computadorId)
            ? `/computadores/id/${computadorId}/dados-manual`
            : Number.isInteger(computadorId)
                ? `/computadores/id/${computadorId}/patrimonio`
                : `/computadores/${encodeURIComponent(serial)}/patrimonio`;

        const payload = cadastroManual && Number.isInteger(computadorId)
            ? {
                nome_computador: nomeComputador || null,
                endereco_mac: enderecoMac || null,
                SerialNumber: serial || null,
                cpu_info: cpuInfo || null,
                memoria_ram: memoriaRam || null,
                disco_info: discoInfo || null,
                endereco_ip: enderecoIp || null,
                patrimonio
            }
            : { patrimonio };

        const response = await fetch(rota, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        retorno.style.color = response.ok ? '#12795a' : '#c0392b';
        retorno.innerText = data.message || data.error || 'Resposta recebida.';

        if (response.ok) {
            const comp = Number.isInteger(computadorId)
                ? computadores.find((c) => Number(c.id) === computadorId)
                : computadores.find((c) => String(c.SerialNumber || '').trim().toUpperCase() === serial.toUpperCase());

            if (comp) {
                comp.patrimonio = patrimonio;
                if (cadastroManual) {
                    comp.nome_computador = nomeComputador || null;
                    comp.endereco_mac = enderecoMac || null;
                    comp.SerialNumber = serial || null;
                    comp.cpu_info = cpuInfo || null;
                    comp.memoria_ram = memoriaRam || null;
                    comp.disco_info = discoInfo || null;
                    comp.endereco_ip = enderecoIp || null;
                }
            }

            renderComputadores();
            carregarAssociados();
            setTimeout(() => {
                retorno.innerText = '';
            }, 2000);
        }
    } catch (error) {
        retorno.style.color = '#c0392b';
        retorno.innerText = 'Erro ao salvar patrimonio.';
        console.error(error);
    }
}

window.salvarPatrimonioComputador = salvarPatrimonioComputador;
