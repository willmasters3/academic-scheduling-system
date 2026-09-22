const state = {
    page: 1,
    pageSize: 25,
    totalPages: 1,
    user: null,
    loading: false
};

const els = {};

function byId(id) {
    return document.getElementById(id);
}

function cacheElements() {
    Object.assign(els, {
        subtitle: byId('audit-subtitle'),
        form: byId('audit-filters'),
        tableBody: byId('audit-table-body'),
        unidade: byId('filter-unidade'),
        pageSize: byId('filter-page-size'),
        paginationLabel: byId('pagination-label'),
        paginationCount: byId('pagination-count'),
        prevPage: byId('prev-page'),
        nextPage: byId('next-page'),
        refresh: byId('refresh-audit'),
        clear: byId('clear-filters'),
        backDashboard: byId('back-dashboard'),
        detailPanel: byId('detail-panel'),
        detailContent: byId('detail-content'),
        detailTitle: byId('detail-title'),
        closeDetail: byId('close-detail'),
        detailScrim: byId('detail-scrim'),
        summaryTotal: byId('summary-total'),
        summaryCriacoes: byId('summary-criacoes'),
        summaryEdicoes: byId('summary-edicoes'),
        summaryExclusoes: byId('summary-exclusoes'),
        summaryBloqueios: byId('summary-bloqueios'),
        summaryErros: byId('summary-erros')
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(value) {
    const text = String(value || '').trim();
    if (!text) return '-';
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return text;
}

function formatTime(value) {
    const text = String(value || '').trim();
    if (!text) return '-';
    return text.slice(0, 5);
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function badge(value) {
    const normalized = String(value || '').toLowerCase();
    return `<span class="badge badge-${escapeHtml(normalized)}">${escapeHtml(value || '-')}</span>`;
}

async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        const text = await response.text();
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (_) {}
        throw new Error(parsed?.error || parsed?.message || text || 'Nao foi possivel carregar os dados.');
    }
    return response.json();
}

function getDashboardPath() {
    if (state.user?.permissao === 'coordenador') return '/dashboard-coordenador';
    return '/dashboard';
}

async function loadUser() {
    try {
        state.user = await fetchJson('/user-info');
    } catch (_) {
        window.location.href = '/login';
        return;
    }

    if (!['admin', 'coordenador'].includes(state.user?.permissao)) {
        els.tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">Acesso negado.</td></tr>';
        return;
    }

    els.backDashboard.addEventListener('click', () => {
        window.location.href = getDashboardPath();
    });

    const nome = state.user.nome || state.user.login || 'usuario';
    els.subtitle.textContent = `Consulta somente leitura para ${nome}. Coordenadores visualizam apenas suas unidades.`;
}

async function loadUnits() {
    if (!els.unidade) return;

    try {
        const unidades = await fetchJson('/listar-unidades');
        unidades.forEach((unidade) => {
            const option = document.createElement('option');
            option.value = unidade.codigo || unidade.codigo_unidade || '';
            option.textContent = `${option.value} - ${unidade.nome || unidade.nome_unidade || 'Unidade'}`;
            els.unidade.appendChild(option);
        });
    } catch (error) {
        console.warn('Nao foi possivel carregar unidades para filtro:', error.message);
    }
}

function getFilterValue(id) {
    return String(byId(id)?.value || '').trim();
}

function buildQuery() {
    const params = new URLSearchParams();
    const fields = [
        ['dataInicio', 'filter-data-inicio'],
        ['dataFim', 'filter-data-fim'],
        ['unidade', 'filter-unidade'],
        ['acao', 'filter-acao'],
        ['resultado', 'filter-resultado'],
        ['usuario', 'filter-usuario'],
        ['sala', 'filter-sala'],
        ['professor', 'filter-professor'],
        ['idAgendamento', 'filter-id-agendamento'],
        ['idCorrelacao', 'filter-id-correlacao']
    ];

    fields.forEach(([paramName, id]) => {
        const value = getFilterValue(id);
        if (value) params.set(paramName, value);
    });

    state.pageSize = Number.parseInt(els.pageSize.value, 10) || 25;
    params.set('page', String(state.page));
    params.set('pageSize', String(state.pageSize));
    return params;
}

function resetAuditView(message) {
    renderSummary({});
    renderPagination({ page: 1, totalPages: 1, total: 0 });
    els.tableBody.innerHTML = `<tr><td colspan="8" class="empty-cell">${escapeHtml(message)}</td></tr>`;
}

function validatePeriodSelection() {
    const dataInicio = getFilterValue('filter-data-inicio');
    const dataFim = getFilterValue('filter-data-fim');

    if (!dataInicio || !dataFim) {
        resetAuditView('Selecione data de inicio e data de fim antes de filtrar.');
        if (!dataInicio) {
            byId('filter-data-inicio')?.focus();
        } else {
            byId('filter-data-fim')?.focus();
        }
        return false;
    }

    if (dataInicio > dataFim) {
        resetAuditView('A data de inicio nao pode ser maior que a data de fim.');
        byId('filter-data-inicio')?.focus();
        return false;
    }

    return true;
}

function setLoading(message) {
    els.tableBody.innerHTML = `<tr><td colspan="8" class="empty-cell">${escapeHtml(message)}</td></tr>`;
}

function renderSummary(resumo = {}) {
    els.summaryTotal.textContent = resumo.total || 0;
    els.summaryCriacoes.textContent = resumo.criacoes || 0;
    els.summaryEdicoes.textContent = resumo.edicoes || 0;
    els.summaryExclusoes.textContent = resumo.exclusoes || 0;
    els.summaryBloqueios.textContent = resumo.bloqueios || 0;
    els.summaryErros.textContent = resumo.erros || 0;
}

function renderPagination(pagination = {}) {
    state.totalPages = pagination.totalPages || 1;
    state.page = pagination.page || 1;
    els.paginationLabel.textContent = `Pagina ${state.page} de ${state.totalPages}`;
    els.paginationCount.textContent = `${pagination.total || 0} registro(s)`;
    els.prevPage.disabled = state.page <= 1 || state.loading;
    els.nextPage.disabled = state.page >= state.totalPages || state.loading;
}

function buildTargetCell(row) {
    const sala = row.nome_sala || (row.id_sala ? `Sala ${row.id_sala}` : 'Sala nao informada');
    const professor = row.nome_professor || (row.id_professor ? `Professor ${row.id_professor}` : 'Professor nao informado');
    const unidade = row.nome_unidade || row.codigo_unidade || 'Unidade nao informada';
    return `
        <div class="target-cell">
            <strong>${escapeHtml(sala)}</strong>
            <span class="muted">${escapeHtml(professor)}</span>
            <span class="muted">${escapeHtml(unidade)}</span>
        </div>
    `;
}

function renderRows(registros = []) {
    if (!registros.length) {
        els.tableBody.innerHTML = '<tr><td colspan="8" class="empty-cell">Nenhum evento encontrado para os filtros atuais.</td></tr>';
        return;
    }

    els.tableBody.innerHTML = registros.map((row) => `
        <tr>
            <td>
                <strong>#${escapeHtml(row.id_auditoria)}</strong><br>
                <span class="muted">${escapeHtml(formatDateTime(row.data_evento))}</span>
            </td>
            <td>${badge(row.acao)}</td>
            <td>${badge(row.resultado)}</td>
            <td>
                <div class="user-cell">
                    <strong>${escapeHtml(row.usuario_responsavel_nome || 'Usuario')}</strong>
                    <span class="muted">${escapeHtml(row.usuario_responsavel_login || row.usuario_responsavel_permissao || '-')}</span>
                </div>
            </td>
            <td>${buildTargetCell(row)}</td>
            <td>
                ${escapeHtml(formatDate(row.data_reserva))}<br>
                <span class="muted">${escapeHtml(formatTime(row.hora_inicio))} - ${escapeHtml(formatTime(row.hora_fim))}</span>
            </td>
            <td>${escapeHtml(row.resumo || '-')}</td>
            <td>
                <button class="details-button" type="button" data-detail-id="${escapeHtml(row.id_auditoria)}">
                    <i class="fas fa-eye"></i>
                    <span>Ver</span>
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadAudit() {
    if (state.loading) return;
    if (!validatePeriodSelection()) return;

    state.loading = true;
    renderPagination({ page: state.page, totalPages: state.totalPages, total: 0 });
    setLoading('Carregando auditoria...');

    try {
        const params = buildQuery();
        const data = await fetchJson(`/agendamento-auditoria?${params.toString()}`);
        renderSummary(data.resumo);
        renderRows(data.registros);
        renderPagination(data.pagination);
    } catch (error) {
        els.tableBody.innerHTML = `<tr><td colspan="8" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    } finally {
        state.loading = false;
        renderPagination({ page: state.page, totalPages: state.totalPages, total: Number(els.summaryTotal.textContent || 0) });
    }
}

function humanizeKey(key) {
    const labels = {
        id_agendamento: 'ID agendamento',
        id_sala: 'ID sala',
        nome_sala: 'Sala',
        codigo_unidade: 'Codigo unidade',
        nome_unidade: 'Unidade',
        id_professor: 'ID professor',
        nome_professor: 'Professor',
        data_reservas: 'Data',
        hora_inicio: 'Hora inicio',
        hora_fim: 'Hora fim',
        tipo_aula: 'Tipo de aula',
        motivo: 'Motivo',
        idsCriados: 'IDs criados',
        idsExcluidos: 'IDs excluidos',
        totalSolicitadas: 'Datas solicitadas',
        totalCriadas: 'Datas criadas',
        conflitosSala: 'Conflitos de sala',
        avisosProfessor: 'Avisos do professor'
    };
    return labels[key] || String(key).replace(/_/g, ' ');
}

function valueToHtml(value) {
    if (value === null || value === undefined || value === '') return '<span class="muted">Nao informado</span>';
    if (Array.isArray(value)) {
        if (!value.length) return '<span class="muted">Nenhum item</span>';
        return `<ol class="audit-list">${value.map((item) => `<li>${valueToHtml(item)}</li>`).join('')}</ol>`;
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (!entries.length) return '<span class="muted">Sem dados</span>';
        return `<ul class="audit-list">${entries.map(([key, item]) => `<li><strong>${escapeHtml(humanizeKey(key))}:</strong> ${valueToHtml(item)}</li>`).join('')}</ul>`;
    }
    return escapeHtml(value);
}

function renderDetailFields(row) {
    const fields = [
        ['Evento', `#${row.id_auditoria}`],
        ['Data do evento', formatDateTime(row.data_evento)],
        ['Acao', row.acao],
        ['Resultado', row.resultado],
        ['Usuario', row.usuario_responsavel_nome || row.usuario_responsavel_login],
        ['Permissao', row.usuario_responsavel_permissao],
        ['Unidade', row.nome_unidade || row.codigo_unidade],
        ['Sala', row.nome_sala || row.id_sala],
        ['Professor', row.nome_professor || row.id_professor],
        ['Data reserva', formatDate(row.data_reserva)],
        ['Horario', `${formatTime(row.hora_inicio)} - ${formatTime(row.hora_fim)}`],
        ['Correlacao', row.id_correlacao],
        ['Resumo', row.resumo],
        ['Erro', row.erro_mensagem]
    ];

    return fields.map(([label, value]) => `
        <div class="detail-field">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || '-')}</strong>
        </div>
    `).join('');
}

function renderDetailSection(title, value) {
    return `
        <section class="detail-section">
            <h3>${escapeHtml(title)}</h3>
            ${valueToHtml(value)}
            ${value && typeof value === 'object' ? `
                <details class="technical-json">
                    <summary>Ver estrutura tecnica</summary>
                    <pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>
                </details>
            ` : ''}
        </section>
    `;
}

function openDetailPanel() {
    els.detailPanel.classList.add('is-open');
    els.detailPanel.setAttribute('aria-hidden', 'false');
}

function closeDetailPanel() {
    els.detailPanel.classList.remove('is-open');
    els.detailPanel.setAttribute('aria-hidden', 'true');
}

async function showDetail(id) {
    openDetailPanel();
    els.detailTitle.textContent = `Evento #${id}`;
    els.detailContent.innerHTML = '<p class="empty-cell">Carregando detalhes...</p>';

    try {
        const row = await fetchJson(`/agendamento-auditoria/${encodeURIComponent(id)}`);
        els.detailTitle.textContent = `Evento #${row.id_auditoria}`;
        els.detailContent.innerHTML = `
            <section class="detail-section">
                <h3>Resumo do evento</h3>
                <div class="detail-grid">${renderDetailFields(row)}</div>
            </section>
            ${renderDetailSection('Detalhes da operacao', row.detalhes)}
            ${renderDetailSection('Dados anteriores', row.dados_anteriores)}
            ${renderDetailSection('Dados posteriores', row.dados_posteriores)}
        `;
    } catch (error) {
        els.detailContent.innerHTML = `<p class="empty-cell">${escapeHtml(error.message)}</p>`;
    }
}

function bindEvents() {
    els.form.addEventListener('submit', (event) => {
        event.preventDefault();
        state.page = 1;
        loadAudit();
    });

    els.clear.addEventListener('click', () => {
        els.form.reset();
        state.page = 1;
        resetAuditView('Selecione o periodo e clique em Filtrar.');
    });

    els.refresh.addEventListener('click', loadAudit);

    els.prevPage.addEventListener('click', () => {
        if (state.page > 1) {
            state.page -= 1;
            loadAudit();
        }
    });

    els.nextPage.addEventListener('click', () => {
        if (state.page < state.totalPages) {
            state.page += 1;
            loadAudit();
        }
    });

    els.tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('[data-detail-id]');
        if (button) {
            showDetail(button.dataset.detailId);
        }
    });

    els.closeDetail.addEventListener('click', closeDetailPanel);
    els.detailScrim.addEventListener('click', closeDetailPanel);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeDetailPanel();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    bindEvents();
    await loadUser();
    if (!['admin', 'coordenador'].includes(state.user?.permissao)) return;
    await loadUnits();
    resetAuditView('Selecione o periodo e clique em Filtrar.');
});
