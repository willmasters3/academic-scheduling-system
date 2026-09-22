document.addEventListener('DOMContentLoaded', () => {
    const selectUnidade = document.getElementById('select-unidade');
    const selectProfessor = document.getElementById('select-professor');
    const form = document.getElementById('form-disponibilidade');
    const resultadoDiv = document.getElementById('disponibilidade-resultado');
    const listaDisponibilidade = document.getElementById('lista-disponibilidade');
    const resultadoTitulo = document.getElementById('resultado-titulo');
    const resultadoMetadata = document.getElementById('resultado-metadata');
    const msgErro = document.getElementById('msg-erro');
    const msgSemDisp = document.getElementById('msg-sem-disponibilidade');
    const usarJornadaPerfil = document.getElementById('usar-jornada-perfil');
    const jornadaInicio = document.getElementById('jornada-inicio');
    const jornadaFim = document.getElementById('jornada-fim');
    const filtroTurno = document.getElementById('filtro-turno');
    const filtroDiaSemana = document.getElementById('filtro-dia-semana');
    const filtroDuracaoMinima = document.getElementById('filtro-duracao-minima');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    const btnExportarCsv = document.getElementById('btn-exportar-csv');
    const btnImprimir = document.getElementById('btn-imprimir');

    let professoresData = [];
    let ultimoResultado = null;

    function formatarData(dataISO) {
        const [ano, mes, dia] = String(dataISO).split('-');
        return `${dia}/${mes}/${ano}`;
    }

    function obterDiaSemana(dataISO) {
        const [ano, mes, dia] = String(dataISO).split('-').map(Number);
        const dataCorrigida = new Date(ano, mes - 1, dia, 12);
        return dataCorrigida.toLocaleDateString('pt-BR', { weekday: 'short' });
    }

    function mostrarMensagemErro(mensagem) {
        msgErro.textContent = mensagem;
        msgErro.classList.remove('hidden');
        resultadoDiv.classList.add('hidden');
    }

    function limparMensagens() {
        msgErro.classList.add('hidden');
        msgSemDisp.classList.add('hidden');
    }

    function atualizarEstadoCamposJornada() {
        const usarAuto = Boolean(usarJornadaPerfil.checked);
        jornadaInicio.disabled = usarAuto;
        jornadaFim.disabled = usarAuto;
    }

    async function carregarUnidades() {
        try {
            const response = await fetch('/listar-unidades');
            if (!response.ok) {
                throw new Error('Falha ao carregar unidades.');
            }

            const unidadesData = await response.json();
            selectUnidade.innerHTML = '<option value="">-- Selecione a Unidade --</option>';
            unidadesData.forEach((unidade) => {
                const option = document.createElement('option');
                option.value = unidade.codigo;
                option.textContent = unidade.nome;
                selectUnidade.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar unidades:', error);
            selectUnidade.innerHTML = '<option value="">Erro ao carregar unidades</option>';
            mostrarMensagemErro('Erro ao carregar a lista de unidades.');
        }
    }

    async function carregarProfessoresPorUnidade(codigoUnidade) {
        selectProfessor.innerHTML = '<option value="">Carregando Professores...</option>';
        selectProfessor.disabled = true;
        professoresData = [];
        limparMensagens();

        try {
            const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
            if (!response.ok) {
                if (response.status === 404 || response.status === 204) {
                    selectProfessor.innerHTML = '<option value="">Nenhum professor encontrado</option>';
                    return;
                }
                throw new Error('Falha ao carregar professores.');
            }

            professoresData = await response.json();
            selectProfessor.innerHTML = '<option value="">-- Selecione o Professor --</option>';

            professoresData.forEach((prof) => {
                const option = document.createElement('option');
                option.value = prof.id_professor;
                option.textContent = `${prof.nome} (${prof.matricula})`;
                selectProfessor.appendChild(option);
            });

            selectProfessor.disabled = false;
        } catch (error) {
            console.error('Erro ao carregar professores:', error);
            selectProfessor.innerHTML = '<option value="">Erro ao carregar</option>';
            mostrarMensagemErro('Erro ao carregar a lista de professores.');
        }
    }

    function renderizarMetadata(meta) {
        if (!resultadoMetadata) {
            return;
        }

        const origemMap = {
            manual: 'Jornada manual',
            perfil_disponibilidade: 'Jornada automática: disponibilidade cadastrada',
            perfil_turno: 'Jornada automática: turnos do perfil',
            fallback: 'Jornada automática: fallback padrão'
        };

        const chips = [];
        chips.push(origemMap[meta?.origem_jornada] || 'Jornada automática');

        if (Array.isArray(meta?.turnos_professor) && meta.turnos_professor.length) {
            chips.push(`Turnos do professor: ${meta.turnos_professor.join(', ')}`);
        }

        if (meta?.carga_horaria_semanal !== null && meta?.carga_horaria_semanal !== undefined) {
            chips.push(`Carga semanal: ${meta.carga_horaria_semanal}h`);
        }

        chips.push(`Dias com disponibilidade: ${meta?.total_dias_livres || 0}`);
        chips.push(`Intervalos livres: ${meta?.total_intervalos || 0}`);

        resultadoMetadata.innerHTML = chips
            .map((texto) => `<span class="meta-chip">${texto}</span>`)
            .join('');
    }

    function renderizarResultado(data, nomeProfessor) {
        resultadoTitulo.textContent = `Disponibilidade de: ${nomeProfessor}`;
        listaDisponibilidade.innerHTML = '';
        renderizarMetadata(data?.meta || {});

        const disponibilidades = data?.disponibilidade || {};
        const datasLivre = Object.keys(disponibilidades).sort();

        if (datasLivre.length === 0) {
            msgSemDisp.textContent = 'Não há horários livres no período/filtros selecionados.';
            msgSemDisp.classList.remove('hidden');
            resultadoDiv.classList.remove('hidden');
            return;
        }

        msgSemDisp.classList.add('hidden');

        datasLivre.forEach((dataISO) => {
            const intervalos = disponibilidades[dataISO];
            const diaDiv = document.createElement('div');
            diaDiv.classList.add('dia-disponivel');

            const htmlIntervalos = intervalos
                .map((intervalo) => `<span class="intervalo">${intervalo.inicio} - ${intervalo.fim}</span>`)
                .join('');

            const diaSemana = obterDiaSemana(dataISO);

            diaDiv.innerHTML = `
                <h3>${diaSemana.toUpperCase()} ${formatarData(dataISO)}</h3>
                <div class="intervalo-container">${htmlIntervalos}</div>
            `;

            listaDisponibilidade.appendChild(diaDiv);
        });

        resultadoDiv.classList.remove('hidden');
    }

    function montarCsv(resultado, nomeProfessor) {
        const linhas = [['Professor', nomeProfessor], ['Data', 'Dia', 'Início', 'Fim']];
        const disponibilidades = resultado?.disponibilidade || {};

        Object.keys(disponibilidades).sort().forEach((dataISO) => {
            const diaSemana = obterDiaSemana(dataISO).toUpperCase();
            disponibilidades[dataISO].forEach((intervalo) => {
                linhas.push([formatarData(dataISO), diaSemana, intervalo.inicio, intervalo.fim]);
            });
        });

        return linhas.map((linha) => linha.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(';')).join('\n');
    }

    function exportarCsv() {
        if (!ultimoResultado) {
            mostrarMensagemErro('Faça uma consulta antes de exportar.');
            return;
        }

        const nomeProfessor = selectProfessor.options[selectProfessor.selectedIndex]?.text || 'Professor';
        const csv = montarCsv(ultimoResultado, nomeProfessor);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `disponibilidade_${String(nomeProfessor).replace(/\s+/g, '_')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function limparFiltros() {
        filtroTurno.value = '';
        filtroDiaSemana.value = '';
        filtroDuracaoMinima.value = '0';
        usarJornadaPerfil.checked = true;
        atualizarEstadoCamposJornada();
        jornadaInicio.value = '07:00';
        jornadaFim.value = '13:00';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        limparMensagens();
        resultadoDiv.classList.add('hidden');
        listaDisponibilidade.innerHTML = '';
        ultimoResultado = null;

        const idProfessor = selectProfessor.value;
        const dataInicioInput = document.getElementById('data-inicio').value;
        const dataFimInput = document.getElementById('data-fim').value;

        if (!idProfessor) {
            mostrarMensagemErro('Selecione um professor para continuar.');
            return;
        }

        if (!dataInicioInput || !dataFimInput) {
            mostrarMensagemErro('Informe data de início e data de fim.');
            return;
        }

        if (dataFimInput < dataInicioInput) {
            mostrarMensagemErro('A data final não pode ser menor que a data inicial.');
            return;
        }

        const params = new URLSearchParams({
            dataInicio: dataInicioInput,
            dataFim: dataFimInput,
            modoJornada: usarJornadaPerfil.checked ? 'auto' : 'manual'
        });

        if (!usarJornadaPerfil.checked) {
            params.set('horaInicioJornada', jornadaInicio.value || '07:00');
            params.set('horaFimJornada', jornadaFim.value || '13:00');
        }

        if (filtroTurno.value) {
            params.set('filtroTurno', filtroTurno.value);
        }

        if (filtroDiaSemana.value !== '') {
            params.set('filtroDiaSemana', filtroDiaSemana.value);
        }

        const duracaoMinima = Number(filtroDuracaoMinima.value || 0);
        if (!Number.isNaN(duracaoMinima) && duracaoMinima > 0) {
            params.set('duracaoMinima', String(duracaoMinima));
        }

        const url = `/professor-disponibilidade/${idProfessor}?${params.toString()}`;

        try {
            const response = await fetch(url);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || 'Erro ao verificar disponibilidade.');
            }

            ultimoResultado = data;
            const nomeProfessor = selectProfessor.options[selectProfessor.selectedIndex]?.text || 'Professor';
            renderizarResultado(data, nomeProfessor);
        } catch (error) {
            console.error('Erro ao buscar disponibilidade:', error);
            mostrarMensagemErro(`Erro ao buscar disponibilidade: ${error.message}`);
        }
    });

    selectUnidade.addEventListener('change', () => {
        const codigoUnidade = selectUnidade.value;
        if (codigoUnidade) {
            carregarProfessoresPorUnidade(codigoUnidade);
        } else {
            selectProfessor.innerHTML = '<option value="">Selecione uma Unidade Primeiro</option>';
            selectProfessor.disabled = true;
        }
        resultadoDiv.classList.add('hidden');
        limparMensagens();
        ultimoResultado = null;
    });

    usarJornadaPerfil.addEventListener('change', atualizarEstadoCamposJornada);
    btnLimparFiltros.addEventListener('click', limparFiltros);
    btnExportarCsv.addEventListener('click', exportarCsv);
    btnImprimir.addEventListener('click', () => window.print());

    atualizarEstadoCamposJornada();
    carregarUnidades();
});