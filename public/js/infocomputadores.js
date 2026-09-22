let computadoresCache = [];
const COMPUTADORES_REFRESH_INTERVAL_MS = 60000;
let computadoresRefreshHandle = null;

function normalizarSerial(serial) {
    return String(serial || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function formatarDataRegistro(dataRegistro) {
    if (!dataRegistro) {
        return '-';
    }

    const data = new Date(dataRegistro);
    if (Number.isNaN(data.getTime())) {
        return '-';
    }

    return data.toLocaleString('pt-BR', { timeZone: 'UTC' });
}

function extrairMenorEspacoEmGb(discoInfo) {
    const texto = String(discoInfo || '');
    const regex = /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)/gi;
    const valoresEmGb = [];
    let match;

    while ((match = regex.exec(texto)) !== null) {
        const valor = Number.parseFloat(match[1].replace(',', '.'));
        const unidade = match[2].toUpperCase();

        if (Number.isNaN(valor)) {
            continue;
        }

        if (unidade === 'TB') {
            valoresEmGb.push(valor * 1024);
            continue;
        }

        if (unidade === 'MB') {
            valoresEmGb.push(valor / 1024);
            continue;
        }

        valoresEmGb.push(valor);
    }

    if (!valoresEmGb.length) {
        return null;
    }

    return Math.min(...valoresEmGb);
}

function computadorTemDiscoCritico(computador) {
    const menorEspacoEmGb = extrairMenorEspacoEmGb(computador.disco_info);
    return menorEspacoEmGb !== null && menorEspacoEmGb < 10;
}

function deduplicarComputadores(data) {
    const unicos = new Map();

    data.forEach((computador) => {
        const chave = normalizarSerial(computador.SerialNumber) || `ID_${computador.id}`;
        if (!unicos.has(chave)) {
            unicos.set(chave, computador);
            return;
        }

        const atual = unicos.get(chave);
        const dataAtual = new Date(atual.data_registro || 0).getTime();
        const dataNova = new Date(computador.data_registro || 0).getTime();

        if (dataNova > dataAtual) {
            unicos.set(chave, computador);
        }
    });

    return Array.from(unicos.values());
}

function renderComputadores() {
    const listElement = document.getElementById('computadores-list');
    const filtroDiscoCriticoAtivo = document.getElementById('filtroDiscoCritico').checked;
    listElement.innerHTML = '';

    const computadoresFiltrados = filtroDiscoCriticoAtivo
        ? computadoresCache.filter(computadorTemDiscoCritico)
        : computadoresCache;

    computadoresFiltrados.forEach((computador) => {
        const discoCritico = computadorTemDiscoCritico(computador);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(String(computador.id ?? '-'))}</td>
            <td>${escapeHtml(computador.last_logged_user || '-')}</td>
            <td class="${discoCritico ? 'alerta-disco' : ''}">${escapeHtml(computador.nome_computador || '-')}</td>
            <td>${escapeHtml(computador.SerialNumber || '-')}</td>
            <td>${escapeHtml(computador.endereco_mac || '-')}</td>
            <td>${escapeHtml(computador.patrimonio || '-')}</td>
            <td class="${discoCritico ? 'alerta-disco' : ''}">${escapeHtml(formatarDataRegistro(computador.data_registro))}</td>
            <td>${escapeHtml(computador.cpu_info || '-')}</td>
            <td>${escapeHtml(computador.memoria_ram || '-')}</td>
            <td class="${discoCritico ? 'alerta-disco' : ''}">${escapeHtml(computador.disco_info || '-')}</td>
            <td>${escapeHtml(computador.endereco_ip || '-')}</td>
        `;
        listElement.appendChild(row);
    });

    if (!computadoresFiltrados.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="11" class="sem-resultados">Nenhum computador encontrado para esse filtro.</td>';
        listElement.appendChild(row);
    }
}

async function fetchComputadores() {
    try {
        const response = await fetch('/infocomputadores');
        const data = await response.json();
        computadoresCache = deduplicarComputadores(data);
        renderComputadores();
    } catch (error) {
        console.error('Erro ao buscar os computadores:', error);
    }
}

window.onload = () => {
    document.getElementById('filtroDiscoCritico').addEventListener('change', renderComputadores);
    fetchComputadores();

    if (computadoresRefreshHandle) {
        clearInterval(computadoresRefreshHandle);
    }

    computadoresRefreshHandle = window.setInterval(() => {
        fetchComputadores();
    }, COMPUTADORES_REFRESH_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            fetchComputadores();
        }
    });
};
