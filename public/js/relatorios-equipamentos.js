let versaoFiltros = 0;
let salasProntas = false;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatarDataHoraAtual() {
    return new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getElementos() {
    return {
        unidade: document.getElementById('selectUnidade'),
        tipoSala: document.getElementById('selectTipoSala'),
        sala: document.getElementById('selectSala'),
        formato: document.getElementById('selectFormato'),
        preview: document.getElementById('previewRelatorio'),
        status: document.getElementById('relatorioStatus')
    };
}

function setStatus(message, color = '') {
    const status = document.getElementById('relatorioStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = color;
}

async function carregarUnidades() {
    const { unidade } = getElementos();
    try {
        const response = await fetch('/unidades');
        if (!response.ok) throw new Error('Falha ao carregar unidades.');
        const data = await response.json();

        unidade.innerHTML = '<option value="">Selecione a unidade</option>';
        data.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.codigo_unidade;
            option.textContent = item.nome_unidade;
            unidade.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
        setStatus('Erro ao carregar unidades.', '#c0392b');
    }
}

function limparPreview() {
    getElementos().preview.innerHTML = '<div class="empty-state no-print">Selecione os filtros e gere o relatório para visualizar o conteúdo.</div>';
}

async function carregarSalas() {
    const versao = ++versaoFiltros;
    const { unidade, tipoSala, sala } = getElementos();
    salasProntas = false;
    sala.innerHTML = '<option value="">Todas as salas</option>';
    sala.disabled = true;
    limparPreview();
    setStatus('');
    if (!unidade.value || !tipoSala.value) return;

    setStatus('Carregando salas...');
    try {
        const params = new URLSearchParams({ unidadeId: unidade.value, tipoSala: tipoSala.value });
        const response = await fetch(`/api/relatorios/equipamentos/salas-disponiveis?${params.toString()}`);
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.error || 'Erro ao carregar salas.');
        }
        const data = await response.json();
        if (versao !== versaoFiltros) return;
        data.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.id_sala;
            option.textContent = item.nome_sala;
            sala.appendChild(option);
        });
        salasProntas = true;
        sala.disabled = false;
        setStatus(data.length ? '' : 'Nenhuma sala encontrada para unidade e tipo selecionados.');
    } catch (error) {
        if (versao !== versaoFiltros) return;
        setStatus(error.message || 'Erro ao carregar salas. Altere os filtros para tentar novamente.', '#c0392b');
    }
}

function validarFiltros() {
    const { unidade, tipoSala, sala } = getElementos();
    if (!unidade.value || !tipoSala.value) {
        setStatus('Selecione unidade e tipo de sala.', '#c0392b');
        return null;
    }
    if (!salasProntas) {
        setStatus('Aguarde o carregamento das salas. Se ocorreu uma falha, altere os filtros para tentar novamente.', '#c0392b');
        return null;
    }

    return {
        unidadeId: unidade.value,
        tipoSala: tipoSala.value,
        ...(sala.value ? { salaId: sala.value } : {})
    };
}

async function buscarDadosRelatorio() {
    const filtros = validarFiltros();
    if (!filtros) return null;

    const params = new URLSearchParams(filtros);
    const response = await fetch(`/api/relatorios/equipamentos/salas?${params.toString()}`);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Erro ao gerar relatório.');
    }

    return response.json();
}

function montarLinhaEquipamento(tipo, item) {
    const nome = tipo === 'Computador'
        ? item.nome_computador
        : `Monitor: ${item.modelo || '-'}${item.polegadas ? ` (${item.polegadas})` : ''}`;

    return `
        <tr>
            <td>${escapeHtml(tipo)}</td>
            <td>${escapeHtml(nome || '-')}</td>
            <td>${escapeHtml(item.endereco_mac || '-')}</td>
            <td>${escapeHtml(item.cpu_info || '-')}</td>
            <td>${escapeHtml(item.memoria_ram || '-')}</td>
            <td>${escapeHtml(item.disco_info || '-')}</td>
            <td>${escapeHtml(item.SerialNumber || item.numero_serie || '-')}</td>
            <td>${escapeHtml(item.endereco_ip || '-')}</td>
            <td>${escapeHtml(item.patrimonio || '-')}</td>
        </tr>
    `;
}

function montarSalaRelatorio(sala, geradoEm) {
    const linhasComputadores = (sala.computadores || []).map((item) => montarLinhaEquipamento('Computador', item)).join('');
    const linhasMonitores = (sala.monitores || []).map((item) => montarLinhaEquipamento('Monitor', item)).join('');
    const linhas = linhasComputadores + linhasMonitores || '<tr><td colspan="9">Nenhum equipamento vinculado.</td></tr>';

    return `
        <section class="sala-relatorio">
            <header class="report-header">
                <h2>EQUIPAMENTOS DA SALA</h2>
                <div class="report-meta">
                    <p><strong>Unidade:</strong> ${escapeHtml(sala.unidade || '-')}</p>
                    <p><strong>Tipo de sala:</strong> ${escapeHtml(sala.tipoSala || '-')}</p>
                    <p><strong>Sala:</strong> ${escapeHtml(sala.salaNome || '-')}</p>
                    <p><strong>Gerado em:</strong> ${escapeHtml(geradoEm)}</p>
                </div>
            </header>

            <div class="report-summary">
                <strong>Resumo:</strong>
                <span>Computadores: ${escapeHtml(sala.totais?.computadores ?? 0)}</span>
                <span>Monitores: ${escapeHtml(sala.totais?.monitores ?? 0)}</span>
                <span>Total: ${escapeHtml(sala.totais?.total ?? 0)}</span>
            </div>

            <div class="table-wrap report-table-wrap">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Nome</th>
                            <th>MAC</th>
                            <th>CPU</th>
                            <th>Memória</th>
                            <th>Disco</th>
                            <th>Serial</th>
                            <th>IP</th>
                            <th>Patrimônio</th>
                        </tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        </section>
    `;
}

function renderizarRelatorio(salas) {
    const { preview } = getElementos();
    const geradoEm = formatarDataHoraAtual();

    if (!Array.isArray(salas) || !salas.length) {
        preview.innerHTML = '<div class="empty-state no-print">Nenhuma sala encontrada para os filtros selecionados.</div>';
        return false;
    }

    preview.innerHTML = salas.map((sala) => montarSalaRelatorio(sala, geradoEm)).join('');
    return true;
}

async function gerarRelatorioVisual() {
    const versao = versaoFiltros;
    setStatus('Gerando relatório...', '');
    try {
        const data = await buscarDadosRelatorio();
        if (!data || versao !== versaoFiltros) return false;

        const gerou = renderizarRelatorio(data);
        setStatus(gerou ? `${data.length} sala(s) carregada(s).` : 'Nenhuma sala encontrada.', gerou ? '#12795a' : '#a15c00');
        return gerou;
    } catch (error) {
        if (versao !== versaoFiltros) return false;
        console.error('Erro ao gerar relatório:', error);
        setStatus(error.message || 'Erro ao gerar relatório.', '#c0392b');
        return false;
    }
}

async function imprimirRelatorio() {
    const gerou = await gerarRelatorioVisual();
    if (gerou) {
        window.print();
    }
}

function exportarExcel() {
    const filtros = validarFiltros();
    if (!filtros) return;

    const params = new URLSearchParams(filtros);
    window.location.href = `/api/relatorios/equipamentos/excel?${params.toString()}`;
}

function configurarEventos() {
    document.getElementById('selectUnidade').addEventListener('change', carregarSalas);
    document.getElementById('selectTipoSala').addEventListener('change', carregarSalas);
    document.getElementById('selectSala').addEventListener('change', () => {
        versaoFiltros++;
        limparPreview();
        setStatus('');
    });
    document.getElementById('btnGerarPdf')?.addEventListener('click', imprimirRelatorio);
    document.getElementById('btnExportarExcel')?.addEventListener('click', exportarExcel);
    document.getElementById('selectFormato')?.addEventListener('change', (event) => {
        if (event.target.value === 'excel') {
            document.getElementById('btnExportarExcel')?.focus();
        } else {
            document.getElementById('btnGerarPdf')?.focus();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades();
    configurarEventos();
});
