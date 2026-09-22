// Função para carregar unidades
async function carregarUnidades() {
    try {
        const response = await fetch('/listar-unidades-publicas');
        if (!response.ok) throw new Error('Erro ao carregar unidades.');

        const unidades = await response.json();
        const unidadeSelect = document.getElementById('unidadeSelect');
        unidadeSelect.innerHTML = '<option value="">Selecione uma unidade</option>';

        unidades.forEach(unidade => {
            const option = document.createElement('option');
            option.value = unidade.codigo;
            option.textContent = unidade.nome;
            unidadeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar as unidades:', error);
        alert('Erro ao carregar unidades.');
    }
}

// Função para formatar a data considerando o formato DD/MM/YYYY e hora HH:mm:ss
function formatarDataCompleta(data, hora) {
    const partesData = data.split('/');
    const dia = partesData[0].padStart(2, '0');
    const mes = partesData[1].padStart(2, '0');
    const ano = partesData[2];

    const dataFormatada = `${ano}-${mes}-${dia}T${hora}`;
    return new Date(dataFormatada);
}
//function para filtros da pagina
async function aplicarFiltros() {
    const filtroProfessor = document.getElementById('filtroProfessor').value || '';
    const filtroDataInicio = document.getElementById('filtroDataInicio').value || '';
    const filtroDataFim = document.getElementById('filtroDataFim').value || '';
    const filtroSala = document.getElementById('filtroSala').value || '';
    const filtroTurno = document.getElementById('filtroTurno').value; // Captura o turno selecionado
    const filtroDiaSemana = document.getElementById('filtroDiaSemana').value; // Captura o dia da semana
    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value;

    try {
        const response = await fetch(`/listar-agendamentos-filtrados?unidadeCodigo=${codigoUnidade}&professor=${filtroProfessor}&dataInicio=${filtroDataInicio}&dataFim=${filtroDataFim}&sala=${filtroSala}`);
        
        if (!response.ok) throw new Error('Erro ao carregar agendamentos filtrados');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList').querySelector('tbody'); // Referência ao tbody
        agendamentosList.innerHTML = ''; // Limpa o conteúdo anterior

        // Verifica se o retorno de agendamentos está vazio
        if (agendamentos.length === 0) {
            const mensagem = document.createElement('tr'); // Criar uma nova linha para mensagem
            mensagem.innerHTML = `<td colspan="6" style="text-align: center;">Nenhum agendamento encontrado com os critérios fornecidos.</td>`;
            agendamentosList.appendChild(mensagem); // Adiciona a mensagem ao tbody
        } else {
            // Ordenação dos agendamentos por data e hora
            agendamentos.sort((a, b) => {
                const dataA = new Date(a.data_reservas + 'T' + a.hora_inicio);
                const dataB = new Date(b.data_reservas + 'T' + b.hora_inicio);
                return dataA - dataB; // Ordena de forma crescente
            });

            agendamentos.forEach(agendamento => {
                const agendamentoData = new Date(agendamento.data_reservas + 'T' + agendamento.hora_inicio);
                
                // Verifica se o agendamento está dentro do turno selecionado
                const horarioValido = verificarHorarioTurno(agendamentoData, filtroTurno);
                
                // Adiciona a verificação para o dia da semana
                const diaDaSemana = agendamentoData.getDay(); // Pega o dia da semana (0 - Domingo, 1 - Segunda, ..., 6 - Sábado)
                const diaValido = filtroDiaSemana === '' || diaDaSemana == filtroDiaSemana; // Verifica se o dia está no filtro

                if (horarioValido && diaValido) {
                    const agendamentoRow = document.createElement('tr'); // Nova linha da tabela
                
                    agendamentoRow.innerHTML = `
                        <td>${agendamento.nome_sala}</td>
                        <td>${agendamento.nome}</td>
                        <td>${formatarData(agendamento.data_reservas)}</td>
                        <td>${formatarHora(agendamento.hora_inicio)}</td>
                        <td>${formatarHora(agendamento.hora_fim)}</td>
                        <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                    `;
                
                    agendamentosList.appendChild(agendamentoRow); // Adiciona a nova linha ao tbody
                }
            });
        }
    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        alert('Erro ao aplicar filtros.');
    }
}

function limparFiltros() {
    document.getElementById('filtroProfessor').value = '';
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    document.getElementById('filtroSala').value = '';
    document.getElementById('filtroTurno').value = '';
    document.getElementById('filtroDiaSemana').value = '';

    const codigoUnidade = document.getElementById('unidadeSelect').value;
    paginaAtual = 1;

    if (codigoUnidade) {
        carregarAgendamentosPorUnidade(codigoUnidade);
    } else {
        const tbody = document.querySelector('#agendamentosList tbody');
        tbody.innerHTML = '';
    }
}



// Função para verificar se o horário do agendamento está dentro do turno selecionado
function verificarHorarioTurno(agendamentoData, filtroTurno) {
    const agendamentoInicio = new Date(agendamentoData); // Data do início do agendamento
    const agendamentoFim = new Date(agendamentoData); // Data do fim do agendamento

    // Definindo os limites de tempo para cada turno
    const turnoManhaInicio = new Date(agendamentoData);
    turnoManhaInicio.setHours(6, 0, 0); // 6:00
    const turnoManhaFim = new Date(agendamentoData);
    turnoManhaFim.setHours(12, 59, 0); // 12:15

    const turnoTardeInicio = new Date(agendamentoData);
    turnoTardeInicio.setHours(13, 0, 0); // 12:15
    const turnoTardeFim = new Date(agendamentoData);
    turnoTardeFim.setHours(17, 15, 0); // 17:15

    const turnoNoiteInicio = new Date(agendamentoData);
    turnoNoiteInicio.setHours(17, 16, 0); // 17:15
    const turnoNoiteFim = new Date(agendamentoData);
    turnoNoiteFim.setHours(23, 59, 59); // 23:59

    // Verificando se o agendamento está dentro do turno selecionado
    if (filtroTurno === 'manha') {
        return agendamentoInicio >= turnoManhaInicio && agendamentoFim <= turnoManhaFim;
    } else if (filtroTurno === 'tarde') {
        return agendamentoInicio >= turnoTardeInicio && agendamentoFim <= turnoTardeFim;
    } else if (filtroTurno === 'noite') {
        return agendamentoInicio >= turnoNoiteInicio && agendamentoFim <= turnoNoiteFim;
    }

    return true; // Retorna true se "Todos os Turnos" estiver selecionado
}




async function carregarProfessoresPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar professores por unidade');

        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar professores por unidade:', error);
        return [];
    }
}

async function carregarTiposDeAtividadePorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-tipos-aula-por-unidade/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar tipos de atividade por unidade');

        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar tipos de atividade por unidade:', error);
        return [];
    }
}




// Evento DOMContentLoaded para inicializar aplicações e listeners
document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades(); // Carrega as unidades ao carregar a página

    const unidadeSelect = document.getElementById('unidadeSelect');
    unidadeSelect.addEventListener('change', async () => {
        const codigoUnidade = unidadeSelect.value;
        if (codigoUnidade) {
            await carregarAgendamentosPorUnidade(codigoUnidade); // Carrega os agendamentos para a unidade selecionada
        } else {
            document.getElementById('agendamentosList').innerHTML = ''; // Limpa a lista
        }
    });

    const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
    if (btnAplicarFiltro) {
        btnAplicarFiltro.addEventListener('click', () => {
            paginaAtual = 1;
            aplicarFiltros();
        }); // Chama a função de aplicação de filtros
    } else {
        console.error('Botão de aplicar filtro não encontrado no DOM.');
    }

    const btnLimparFiltro = document.getElementById('btnLimparFiltro');
    if (btnLimparFiltro) {
        btnLimparFiltro.addEventListener('click', limparFiltros);
    }

    const camposFiltro = document.querySelectorAll('#filtroSala, #filtroProfessor, #filtroDataInicio, #filtroDataFim, #filtroTurno, #filtroDiaSemana');
    camposFiltro.forEach((campo) => {
        campo.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                paginaAtual = 1;
                aplicarFiltros();
            }
        });
    });
});

let paginaAtual = 1; // Página atual
const totalPorPagina = 20; // Total de agendamentos por página

async function carregarAgendamentosPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-agendamento/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar agendamentos');

        const agendamentos = await response.json();
        const tbody = document.querySelector('#agendamentosList tbody'); // Referência única ao tbody
        tbody.innerHTML = ''; // Limpa o conteúdo anterior

        const totalAgendamentos = agendamentos.length; // Total de agendamentos
        const totalPaginas = Math.ceil(totalAgendamentos / totalPorPagina); // Total de páginas

        // Paginação
        const agendamentosPagados = agendamentos.slice((paginaAtual - 1) * totalPorPagina, paginaAtual * totalPorPagina);
        
        if (agendamentosPagados.length === 0) {
            const mensagem = document.createElement('tr'); // Criar uma nova linha para mensagem
            mensagem.innerHTML = `<td colspan="6" style="text-align: center;">Nenhum agendamento encontrado para esta unidade no momento.</td>`;
            tbody.appendChild(mensagem); // Adiciona a mensagem ao tbody
        } else {
            // Loop para adicionar agendamentos paginados
            agendamentosPagados.forEach(agendamento => {
                const agendamentoRow = document.createElement('tr'); // Nova linha da tabela
            
                agendamentoRow.innerHTML = `
                    <td>${agendamento.nome_sala}</td>
                    <td>${agendamento.nome}</td>
                    <td>${formatarData(agendamento.data_reservas)}</td>
                    <td>${formatarHora(agendamento.hora_inicio)}</td>
                    <td>${formatarHora(agendamento.hora_fim)}</td>
                    <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                `;
            
                tbody.appendChild(agendamentoRow); // Adiciona a nova linha ao tbody
            });
        }

        // Adicionar controles de paginação
        adicionarControlesPaginacao(totalPaginas);
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        alert('Erro ao carregar agendamentos.');
    }
}


// Adicionar controles de paginação
function adicionarControlesPaginacao(totalPaginas) {
    const paginacao = document.getElementById('paginacao');
    paginacao.innerHTML = ''; // Limpa a página anterior

    if (totalPaginas <= 0) {
        return;
    }

    const codigoUnidadeAtual = document.getElementById('unidadeSelect').value;

    const criarBotaoPagina = (numeroPagina) => {
        const botaoPagina = document.createElement('button');
        botaoPagina.textContent = numeroPagina;
        botaoPagina.disabled = (numeroPagina === paginaAtual);

        if (numeroPagina === paginaAtual) {
            botaoPagina.classList.add('pagina-ativa');
        }

        botaoPagina.addEventListener('click', () => {
            paginaAtual = numeroPagina;
            carregarAgendamentosPorUnidade(codigoUnidadeAtual);
        });

        return botaoPagina;
    };

    const criarReticencias = () => {
        const reticencias = document.createElement('span');
        reticencias.className = 'paginacao-reticencias';
        reticencias.textContent = '...';
        return reticencias;
    };

    // Controle de página anterior
    const botaoAnterior = document.createElement('button');
    botaoAnterior.textContent = 'Anterior';
    botaoAnterior.disabled = paginaAtual === 1; // Desabilita se estiver na primeira página
    botaoAnterior.addEventListener('click', () => {
        paginaAtual--;
        carregarAgendamentosPorUnidade(codigoUnidadeAtual);
    });
    paginacao.appendChild(botaoAnterior);

    const paginasVisiveis = [];
    paginasVisiveis.push(1);

    let inicio = Math.max(2, paginaAtual - 1);
    let fim = Math.min(totalPaginas - 1, paginaAtual + 1);

    if (paginaAtual <= 3) {
        inicio = 2;
        fim = Math.min(totalPaginas - 1, 4);
    }

    if (paginaAtual >= totalPaginas - 2) {
        inicio = Math.max(2, totalPaginas - 3);
        fim = totalPaginas - 1;
    }

    if (inicio > 2) {
        paginasVisiveis.push('...');
    }

    for (let i = inicio; i <= fim; i++) {
        paginasVisiveis.push(i);
    }

    if (fim < totalPaginas - 1) {
        paginasVisiveis.push('...');
    }

    if (totalPaginas > 1) {
        paginasVisiveis.push(totalPaginas);
    }

    paginasVisiveis.forEach((item) => {
        if (item === '...') {
            paginacao.appendChild(criarReticencias());
            return;
        }

        paginacao.appendChild(criarBotaoPagina(item));
    });

    // Controle de próxima página
    const botaoProximo = document.createElement('button');
    botaoProximo.textContent = 'Próximo';
    botaoProximo.disabled = paginaAtual === totalPaginas; // Desabilita se estiver na última página
    botaoProximo.addEventListener('click', () => {
        paginaAtual++;
        carregarAgendamentosPorUnidade(codigoUnidadeAtual);
    });
    paginacao.appendChild(botaoProximo);

    if (totalPaginas <= 7) {
        return;
    }
}


// Função para formatar a data no formato brasileiro
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


