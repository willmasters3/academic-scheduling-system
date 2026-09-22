(function () {
    'use strict';

    const state = { filters: null, dashboard: null };
    const byId = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function api(url) {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('Sessão expirada.');
        }
        if (response.status === 403) {
            throw new Error('Seu perfil não possui acesso à Gestão Docente.');
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os dados.');
        return payload;
    }

    const obterPeriodo = GestaoDocente.obterPeriodo;

    function formatarHoras(minutos) {
        const total = Number(minutos) || 0;
        if (total % 60 === 0) return `${new Intl.NumberFormat('pt-BR').format(total / 60)}h`;
        const horas = Math.floor(total / 60);
        const restante = total % 60;
        return `${new Intl.NumberFormat('pt-BR').format(horas)}h${String(restante).padStart(2, '0')}`;
    }

    function formatarPercentual(valor) {
        return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(Number(valor) || 0)}%`;
    }

    function formatarData(value) {
        if (!value) return '—';
        const partes = String(value).slice(0, 10).split('-');
        return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(value);
    }

    function formatarDataHora(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    }

    function nomePerfil(perfil) {
        const valor = String(perfil || '').toLowerCase();
        if (valor === 'admin') return 'Administrador / TI';
        if (valor === 'coordenador') return 'Coordenação';
        if (valor === 'user') return 'Professor';
        return perfil || '—';
    }

    function preencherSelect(select, rows, valueKey, labelKey, placeholder) {
        const atual = select.value;
        const unicos = [...new Map(rows.map((row) => [String(row[valueKey]), row])).values()];
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + unicos.map((row) =>
            `<option value="${escapeHtml(row[valueKey])}">${escapeHtml(row[labelKey])}</option>`
        ).join('');
        if ([...select.options].some((option) => option.value === atual)) select.value = atual;
    }

    function aplicarDependencias() {
        const unidade = byId('filterUnit').value;
        const curso = byId('filterCourse').value;
        const dados = state.filters || { cursos: [], turmas: [], ucs: [], professores: [] };
        const naUnidade = (row) => !unidade || String(row.codigo_unidade) === unidade;
        const noCurso = (row) => !curso || String(row.id_curso) === curso;

        preencherSelect(byId('filterCourse'), dados.cursos.filter(naUnidade), 'id_curso', 'nome_curso', 'Todos os cursos');
        const cursoAtual = byId('filterCourse').value;
        preencherSelect(byId('filterClass'), dados.turmas.filter((row) => naUnidade(row) && (!cursoAtual || String(row.id_curso) === cursoAtual)), 'id_turma', 'codigo_reduzido', 'Todas as turmas');
        preencherSelect(byId('filterUc'), dados.ucs.filter((row) => naUnidade(row) && (!cursoAtual || String(row.id_curso) === cursoAtual)), 'id_curso_uc', 'descricao', 'Todas as UCs');
        preencherSelect(byId('filterProfessor'), dados.professores.filter(naUnidade), 'id_professor', 'nome', 'Todos os professores');
    }

    function parametrosAtuais() {
        const tipo = byId('filterPeriod').value;
        const periodo = tipo === 'custom'
            ? { inicio: byId('filterStart').value, fim: byId('filterEnd').value }
            : obterPeriodo(tipo);
        const params = new URLSearchParams({ data_inicio: periodo.inicio, data_fim: periodo.fim });
        for (const [id, key] of [
            ['filterUnit', 'unidade'], ['filterCourse', 'curso'], ['filterClass', 'turma'],
            ['filterUc', 'uc'], ['filterProfessor', 'professor'], ['filterStatus', 'situacao']
        ]) {
            const value = byId(id).value;
            if (value) params.set(key, value);
        }
        return params;
    }

    function mostrarLoading() {
        byId('screenMessage').classList.add('is-hidden');
        byId('dashboardContent').classList.add('is-hidden');
        byId('loadingState').classList.remove('is-hidden');
    }

    function mostrarErro(error) {
        byId('loadingState').classList.add('is-hidden');
        byId('dashboardContent').classList.add('is-hidden');
        byId('screenMessage').textContent = error.message;
        byId('screenMessage').classList.remove('is-hidden');
    }

    function renderKpis(data) {
        const resumo = data.resumo;
        byId('kpiExpected').textContent = formatarHoras(resumo.horas_previstas_minutos);
        byId('kpiScheduled').textContent = formatarHoras(resumo.horas_agendadas_minutos);
        byId('kpiMissing').textContent = formatarHoras(resumo.horas_faltantes_minutos);
        byId('kpiExcess').textContent = formatarHoras(resumo.horas_excesso_minutos);
        byId('kpiCoverage').textContent = formatarPercentual(resumo.cobertura_percentual);
        byId('kpiActivePlans').textContent = resumo.planejamentos_ativos;
        byId('kpiPendingPlans').textContent = resumo.planejamentos_atencao;
        byId('coverageHint').textContent = resumo.horas_previstas_minutos > 0 ? 'Cobertura sobre a carga vigente' : 'Sem carga prevista';
        byId('coverageProgress').style.width = `${Math.min(100, Math.max(0, resumo.cobertura_percentual))}%`;
    }

    function renderPlanningChart(rows) {
        const root = byId('planningChart');
        if (!rows.length) {
            root.innerHTML = '<div class="gd-empty"><i class="far fa-chart-bar"></i><span>Nenhum planejamento encontrado para os filtros selecionados.</span></div>';
            return;
        }
        const max = Math.max(...rows.flatMap((row) => [row.carga_prevista_minutos, row.horas_agendadas_minutos]), 1);
        root.innerHTML = rows.map((row) => `
            <div class="gd-bar-row" title="${escapeHtml(row.nome_curso)} — ${escapeHtml(row.unidade_curricular)}">
                <div class="gd-bar-label"><strong>${escapeHtml(row.unidade_curricular)}</strong><span>${escapeHtml(row.codigo_reduzido)}</span></div>
                <div class="gd-bars">
                    <span class="gd-bar-track is-expected"><i style="width:${(row.carga_prevista_minutos / max) * 100}%"></i></span>
                    <span class="gd-bar-track is-scheduled"><i style="width:${(row.horas_agendadas_minutos / max) * 100}%"></i></span>
                </div>
                <div class="gd-bar-values">${formatarHoras(row.carga_prevista_minutos)}<br>${formatarHoras(row.horas_agendadas_minutos)}</div>
            </div>
        `).join('') + '<div class="gd-chart-legend"><span><i></i>Previsto</span><span><i></i>Agendado</span></div>';
    }

    function renderSituationChart(distribuicao) {
        const root = byId('situationChart');
        const itens = [
            ['ADEQUADO', 'Adequado', '#44a92e'],
            ['ATENCAO', 'Atenção', '#f29a08'],
            ['CRITICO', 'Crítico', '#e3342f'],
            ['COM_EXCESSO', 'Com excesso', '#7652c7'],
            ['SEM_CLASSIFICACAO', 'Sem classificação', '#9aa4b2']
        ];
        const total = itens.reduce((sum, [key]) => sum + (Number(distribuicao[key]) || 0), 0);
        if (!total) {
            root.innerHTML = '<div class="gd-empty" style="grid-column:1/-1"><i class="fas fa-chart-pie"></i><span>Não há cobertura para exibir neste período.</span></div>';
            return;
        }
        let acumulado = 0;
        const partes = itens.map(([key, , cor]) => {
            const inicio = acumulado;
            acumulado += ((Number(distribuicao[key]) || 0) / total) * 100;
            return `${cor} ${inicio}% ${acumulado}%`;
        });
        root.innerHTML = `
            <div class="gd-donut" style="background:conic-gradient(${partes.join(',')})"><div class="gd-donut-center"><strong>${total}</strong><span>Itens</span></div></div>
            <div class="gd-coverage-list">${itens.map(([key, label, cor]) => {
                const valor = Number(distribuicao[key]) || 0;
                const percentual = total ? Math.round((valor / total) * 100) : 0;
                return `<div class="gd-coverage-item"><i class="gd-dot" style="background:${cor}"></i><span>${label}</span><strong>${valor} (${percentual}%)</strong></div>`;
            }).join('')}</div>`;
    }

    function renderUnitCoverage(rows) {
        const root = byId('unitCoverageChart');
        if (!rows.length) {
            root.innerHTML = '<div class="gd-empty"><i class="fas fa-chart-column"></i><span>Nenhuma unidade encontrada para os filtros selecionados.</span></div>';
            return;
        }
        const escala = Math.max(100, ...rows.map((row) => Number(row.cobertura_percentual) || 0));
        root.innerHTML = rows.map((row) => {
            const percentual = Number(row.cobertura_percentual) || 0;
            return `<div class="gd-unit-row">
                <span title="${escapeHtml(row.nome_unidade)}">${escapeHtml(row.nome_unidade)}</span>
                <i><b style="width:${Math.min(100, (percentual / escala) * 100)}%"></b></i>
                <strong>${formatarPercentual(percentual)}</strong>
            </div>`;
        }).join('') + '<small class="gd-unit-caption">Cobertura = horas agendadas / horas previstas</small>';
    }

    function renderAlerts(alertas) {
        const root = byId('dashboardAlerts');
        const itens = [
            ['CRITICO', 'fa-triangle-exclamation', 'is-critical', 'Planejamentos críticos', alertas.planejamentos_criticos],
            ['ATENCAO', 'fa-triangle-exclamation', 'is-attention', 'Planejamentos em atenção', alertas.planejamentos_atencao],
            ['COM_EXCESSO', 'fa-arrow-trend-up', 'is-excess', 'Planejamentos com excesso', alertas.planejamentos_excesso],
            ['LEGADO_NAO_CLASSIFICADO', 'fa-database', 'is-legacy', 'Registros sem classificação', alertas.registros_sem_classificacao]
        ];
        root.innerHTML = itens.map(([situacao, icone, classe, titulo, valor]) => `
            <button type="button" class="gd-alert ${classe}" data-alert-status="${situacao}">
                <i class="fas ${icone}"></i><span><strong>${escapeHtml(titulo)}</strong><small>Clique para filtrar a visão geral</small></span><b>${Number(valor) || 0}</b><i class="fas fa-chevron-right"></i>
            </button>
        `).join('');
    }

    function renderPendingUcs(rows) {
        const body = byId('pendingUcTable');
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="7"><div class="gd-empty"><i class="fas fa-circle-check"></i><span>Nenhuma UC possui horas pendentes nos filtros atuais.</span></div></td></tr>';
            return;
        }
        body.innerHTML = rows.map((row) => `
            <tr>
                <td><span class="gd-cell-title">${escapeHtml(row.unidade_curricular)}</span></td>
                <td>${escapeHtml(row.nome_curso)}</td>
                <td>${escapeHtml(row.codigo_reduzido)}</td>
                <td>${formatarHoras(row.carga_prevista_minutos)}</td>
                <td>${formatarHoras(row.horas_agendadas_minutos)}</td>
                <td class="gd-value-danger">${formatarHoras(row.horas_faltantes_minutos)}</td>
                <td class="gd-coverage-cell"><span class="gd-mini-progress"><i style="width:${Math.min(100, row.cobertura_percentual)}%"></i></span>${formatarPercentual(row.cobertura_percentual)}</td>
            </tr>
        `).join('');
    }

    function renderOccurrences(rows) {
        const body = byId('occurrencesTable');
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="4"><div class="gd-empty"><i class="far fa-clock"></i><span>Nenhuma ocorrência disponível.</span></div></td></tr>';
            return;
        }
        body.innerHTML = rows.map((row) => `
            <tr>
                <td>${formatarDataHora(row.data_evento)}</td>
                <td><span class="gd-cell-title">${escapeHtml(String(row.tipo_ocorrencia || '').replaceAll('_', ' '))}</span></td>
                <td>${escapeHtml(row.responsavel_nome || 'Sistema')}<span class="gd-cell-subtitle">${escapeHtml(nomePerfil(row.responsavel_perfil))}</span></td>
                <td>${escapeHtml(row.alvo || '—')}<span class="gd-cell-subtitle">${escapeHtml(row.resumo || '')}</span></td>
            </tr>
        `).join('');
    }

    function renderDashboard(data) {
        state.dashboard = data;
        renderKpis(data);
        renderSituationChart(data.situacoes_planejamentos || {});
        renderUnitCoverage(data.cobertura_por_unidade || []);
        renderAlerts(data.alertas || {});
        renderPendingUcs(data.ucs_maior_pendencia || []);
        renderOccurrences(data.ocorrencias || []);
        byId('updatedAt').textContent = formatarDataHora(data.atualizado_em);

        const legado = Number(data.resumo.fatos_legados) || 0;
        byId('legacyNotice').classList.toggle('is-hidden', legado === 0);
        byId('legacyHours').textContent = formatarHoras(data.resumo.horas_legadas_minutos);
        byId('legacyCount').textContent = legado;
        byId('partialPeriodNotice').classList.toggle('is-hidden', byId('filterPeriod').value !== 'custom');
        byId('loadingState').classList.add('is-hidden');
        byId('dashboardContent').classList.remove('is-hidden');
    }

    async function carregarDashboard() {
        const params = parametrosAtuais();
        if (!params.get('data_inicio') || !params.get('data_fim')) return;
        mostrarLoading();
        try {
            renderDashboard(await api(`/api/gestao-docente/dashboard?${params}`));
        } catch (error) {
            mostrarErro(error);
        }
    }

    function registrarEventos() {
        byId('filterUnit').addEventListener('change', () => { aplicarDependencias(); carregarDashboard(); });
        byId('filterCourse').addEventListener('change', () => { aplicarDependencias(); carregarDashboard(); });
        ['filterClass', 'filterUc', 'filterProfessor', 'filterStatus'].forEach((id) => byId(id).addEventListener('change', carregarDashboard));
        byId('filterPeriod').addEventListener('change', () => {
            const custom = byId('filterPeriod').value === 'custom';
            byId('customDates').classList.toggle('is-hidden', !custom);
            if (!custom) carregarDashboard();
        });
        byId('dashboardFilters').addEventListener('submit', (event) => { event.preventDefault(); carregarDashboard(); });
        byId('refreshButton').addEventListener('click', carregarDashboard);
        byId('clearFilters').addEventListener('click', () => {
            byId('dashboardFilters').reset();
            byId('customDates').classList.add('is-hidden');
            aplicarDependencias();
            carregarDashboard();
        });
        byId('dashboardAlerts').addEventListener('click', async (event) => {
            const alerta = event.target.closest('[data-alert-status]');
            if (!alerta) return;
            byId('filterStatus').value = alerta.dataset.alertStatus;
            await carregarDashboard();
            const destino = alerta.dataset.alertStatus === 'LEGADO_NAO_CLASSIFICADO' ? byId('legacyNotice') : byId('pendingUcSection');
            destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        byId('menuToggle').addEventListener('click', () => byId('gdSidebar').classList.toggle('is-open'));
    }

    async function iniciar() {
        registrarEventos();
        const mes = obterPeriodo('current-month');
        byId('filterStart').value = mes.inicio;
        byId('filterEnd').value = mes.fim;
        try {
            const [user, filters] = await Promise.all([
                api('/user-info'),
                api('/api/gestao-docente/filtros')
            ]);
            if (!['admin', 'coordenador'].includes(user.permissao)) {
                throw new Error('Seu perfil não possui acesso à Gestão Docente.');
            }
            GestaoDocente.aplicarUsuario(user);
            state.filters = filters;
            preencherSelect(byId('filterUnit'), filters.unidades, 'codigo_unidade', 'nome_unidade', 'Todas as unidades');
            aplicarDependencias();
            await carregarDashboard();
        } catch (error) {
            mostrarErro(error);
        }
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();
