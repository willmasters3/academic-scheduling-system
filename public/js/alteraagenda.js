// Função para carregar informações do usuário
async function carregarInfoUsuario() {
    try {
        const response = await fetch('/user-info');
        if (!response.ok) throw new Error('Erro ao carregar informações do usuário.');

        return await response.json();
    } catch (error) {
        console.error('Erro ao carregar informações do usuário:', error);
        return null;
    }
}

// Função para carregar unidades, filtrando pela unidade do usuário
async function carregarUnidades() {
    const userInfo = await carregarInfoUsuario();

    if (!userInfo) {
        alert('Erro ao carregar unidades. Por favor, faça login novamente.');
        return;
    }

    try {
        const response = await fetch('/listar-unidades');
        if (!response.ok) throw new Error('Erro ao carregar unidades.');

        const unidades = await response.json();
        const unidadeSelect = document.getElementById('unidadeSelect');
        unidadeSelect.innerHTML = '<option value="">Selecione uma unidade</option>';

        unidades.forEach(unidade => {
            if (userInfo.unidades.includes(unidade.codigo)) {
                const option = document.createElement('option');
                option.value = unidade.codigo;
                option.textContent = unidade.nome;
                unidadeSelect.appendChild(option);
            }
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
// Função para verificar e atualizar o botão "Editar"
const verificaCheckboxes = () => {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    const anyChecked = Array.from(checkboxes).some(item => item.checked);
    document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
    document.getElementById('btnExcluirSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
};

// Selecionar Todos
document.getElementById('selectAllAgendamentos').addEventListener('change', (event) => {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    const isChecked = event.target.checked;
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });

    // Atualiza o botão de editar com base na seleção
    document.getElementById('btnEditarSelecionados').style.display = isChecked ? 'inline-block' : 'none';
    document.getElementById('btnExcluirSelecionados').style.display = isChecked ? 'inline-block' : 'none';
});

// Adiciona evento de mudança a todos os checkboxes após serem carregados
async function atualizarCheckboxes() {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', verificaCheckboxes);
    });
}

/*
// Função para aplicar filtros
async function aplicarFiltros() {
    const filtroSala = document.getElementById("filtroSala").value || '';
    const filtroProfessor = document.getElementById("filtroProfessor").value || '';
    const filtroDataInicio = document.getElementById("filtroDataInicio").value || '';
    const filtroDataFim = document.getElementById("filtroDataFim").value || '';
    const filtroTurno = document.getElementById("filtroTurno").value || '';
    const filtroDiaSemana = document.getElementById("filtroDiaSemana").value || '';
    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value;

    if (!codigoUnidade) {
        alert('Por favor, selecione uma unidade antes de aplicar os filtros.');
        return;
    }

    try {
        const response = await fetch(`/listar-agendamentos-filtrados?unidadeCodigo=${codigoUnidade}&professor=${filtroProfessor}&dataInicio=${filtroDataInicio}&dataFim=${filtroDataFim}&sala=${filtroSala}&turno=${filtroTurno}&diaSemana=${filtroDiaSemana}`);

        if (!response.ok) throw new Error('Erro ao carregar agendamentos filtrados');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList');

        if (!agendamentosList) {
            console.error('Elemento agendamentosList não encontrado no DOM.');
            return;
        }

        agendamentosList.innerHTML = ''; // Limpa o conteúdo anterior

        
        if (agendamentos.length === 0) {
            agendamentosList.innerHTML = '<tr><td colspan="10" style="text-align: center;">Nenhum agendamento encontrado com os critérios fornecidos.</td></tr>';
        } else {
            agendamentos.forEach(agendamento => {
                const agendamentoRow = document.createElement('tr');
                agendamentoRow.innerHTML = `
                    <td><input type="checkbox" class="agendamento-checkbox" value="${agendamento.id_agendamento}"></td>
                    <td>${agendamento.nome_sala || 'N/D'}</td>
                    <td>${agendamento.nome || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_inicio) || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_fim) || 'N/D'}</td>
                    <td>${agendamento.tipo_aula || 'N/D'}</td>
                    <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                    <td><button class="btn-editar" data-id="${agendamento.id_agendamento}">Editar</button></td>
                `;
                agendamentosList.appendChild(agendamentoRow);

                // Adiciona o evento para o checkbox
                const checkbox = agendamentoRow.querySelector('.agendamento-checkbox');
                checkbox.addEventListener('change', () => {
                    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
                    const anyChecked = Array.from(checkboxes).some(item => item.checked);
                    document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
                });
            });
        }

        // Atualiza o estado do botão de editar após adicionar os agendamentos
        const checkboxes = document.querySelectorAll('.agendamento-checkbox');
        const anyChecked = Array.from(checkboxes).some(item => item.checked);
        document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        alert('Erro ao aplicar filtros.');
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
    turnoManhaFim.setHours(13, 0, 0); // 13:00

    const turnoTardeInicio = new Date(agendamentoData);
    turnoTardeInicio.setHours(13, 15, 0); // 13:15
    const turnoTardeFim = new Date(agendamentoData);
    turnoTardeFim.setHours(17, 15, 0); // 17:15

    const turnoNoiteInicio = new Date(agendamentoData);
    turnoNoiteInicio.setHours(17, 15, 0); // 17:15
    const turnoNoiteFim = new Date(agendamentoData);
    turnoNoiteFim.setHours(23, 59, 0); // 23:59

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

*/
// Função para aplicar filtros
async function aplicarFiltros() {
    const filtroSala = document.getElementById("filtroSala").value || '';
    const filtroProfessor = document.getElementById("filtroProfessor").value || '';
    const filtroDataInicio = document.getElementById("filtroDataInicio").value || '';
    const filtroDataFim = document.getElementById("filtroDataFim").value || '';
    const filtroTurno = document.getElementById("filtroTurno").value || '';
    const filtroDiaSemana = document.getElementById("filtroDiaSemana").value || '';
    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value;

    if (!codigoUnidade) {
        alert('Por favor, selecione uma unidade antes de aplicar os filtros.');
        return;
    }

    try {
        const response = await fetch(`/listar-agendamentos-filtrados?unidadeCodigo=${codigoUnidade}&professor=${filtroProfessor}&dataInicio=${filtroDataInicio}&dataFim=${filtroDataFim}&sala=${filtroSala}`);
        if (!response.ok) throw new Error('Erro ao carregar agendamentos filtrados');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList');
        agendamentosList.innerHTML = '';

        // Aplica os filtros de turno e dia da semana no frontend
        const agendamentosFiltrados = agendamentos.filter(agendamento => {
            const inicio = new Date(`${agendamento.data_reservas}T${agendamento.hora_inicio}`);
            const fim = new Date(`${agendamento.data_reservas}T${agendamento.hora_fim}`);

            const turnoOk = filtroTurno ? verificarHorarioTurno(inicio, fim, filtroTurno) : true;
            const diaSemanaOk = filtroDiaSemana ? inicio.getDay().toString() === filtroDiaSemana : true;

            return turnoOk && diaSemanaOk;
        });

        if (agendamentosFiltrados.length === 0) {
            agendamentosList.innerHTML = '<tr><td colspan="10" style="text-align: center;">Nenhum agendamento encontrado com os critérios fornecidos.</td></tr>';
        } else {
            agendamentosFiltrados.forEach(agendamento => {
                const agendamentoRow = document.createElement('tr');
                agendamentoRow.innerHTML = `
                    <td><input type="checkbox" class="agendamento-checkbox" value="${agendamento.id_agendamento}"></td>
                    <td>${agendamento.nome_sala || 'N/D'}</td>
                    <td>${agendamento.nome || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_inicio) || 'N/D'}</td>
                    <td>${formatarData(agendamento.data_reservas) || 'N/D'}</td>
                    <td>${formatarHora(agendamento.hora_fim) || 'N/D'}</td>
                    <td>${agendamento.tipo_aula || 'N/D'}</td>
                    <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                    <td><button class="btn-editar" data-id="${agendamento.id_agendamento}">Editar</button></td>
                `;
                agendamentosList.appendChild(agendamentoRow);
            });

            atualizarCheckboxes();
        }

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        alert('Erro ao aplicar filtros.');
    }
}

// Função para verificar se o horário do agendamento está dentro do turno selecionado
function verificarHorarioTurno(agendamentoInicio, agendamentoFim, filtroTurno) {
    // Definindo os limites de tempo para cada turno
    const turnos = {
        manha: { inicio: 6 * 60, fim: 13 * 60 }, // de 06:00 até 13:00
        tarde: { inicio: (13 * 60 + 1), fim: (17 * 60 + 15) }, // de 13:01 até 17:15
        noite: { inicio: (17 * 60 + 16), fim: (23 * 60 + 59) } // de 17:16 até 23:59
    };

    const inicioMinutos = (agendamentoInicio.getHours() * 60) + agendamentoInicio.getMinutes();
    const fimMinutos = (agendamentoFim.getHours() * 60) + agendamentoFim.getMinutes();

    // Verificando o turno
    if (filtroTurno === 'manha') {
        return inicioMinutos >= turnos.manha.inicio && fimMinutos <= turnos.manha.fim;
    } else if (filtroTurno === 'tarde') {
        return inicioMinutos >= turnos.tarde.inicio && fimMinutos <= turnos.tarde.fim;
    } else if (filtroTurno === 'noite') {
        return inicioMinutos >= turnos.noite.inicio && fimMinutos <= turnos.noite.fim;
    }

    return true; // Retorna true se "Todos os Turnos" estiver selecionado
}


document.getElementById("btnEditarSelecionados").addEventListener("click", async () => {
    const checkboxes = document.querySelectorAll('#agendamentosList input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        alert("Selecione ao menos um agendamento para editar.");
        return;
    }

    // Cria o modal para edição
    const modal = document.createElement('div');
    modal.classList.add('modal');

    const unidadeSelect = document.getElementById('unidadeSelect');
    const unidadeCodigo = unidadeSelect.value;

    const professores = await carregarProfessoresPorUnidade(unidadeCodigo);
    const tiposAtividade = await carregarTiposDeAtividadePorUnidade(unidadeCodigo);

    tiposAtividade.sort((a, b) => a.descricao.localeCompare(b.descricao));

    modal.innerHTML = `
        <div class="modal-content">
            <h3>Editar Agendamentos Selecionados</h3>
            <div class="modal-form-group">
                <label for="novoProfessor">Novo Professor</label>
                <select id="novoProfessor">
                    ${professores.map(professor => `
                        <option value="${professor.id_professor}">${professor.nome}</option>
                    `).join('')}
                </select>
            </div>
            <div class="modal-form-group">
                <label for="novoTipoAtividade">Tipo de Atividade</label>
                <select id="novoTipoAtividade">
                    <option value="">Selecione um Tipo de Atividade</option>
                    ${tiposAtividade.map(tipo => `
                        <option value="${tipo.id_tipo_aula}">${tipo.descricao}</option>
                    `).join('')}
                </select>
            </div>
            <div class="modal-form-group">
                <label for="novoMotivo">Motivo</label>
                <input type="text" id="novoMotivo" placeholder="Motivo para os agendamentos selecionados">
            </div>
            <div class="modal-actions">
                <button id="salvarEdicoes" class="btn-save">Salvar Edições</button>
                <button id="fecharModal" class="btn-ghost">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Função para fechar o modal
    const fecharModal = () => {
        modal.remove();
        document.removeEventListener('keydown', escPressHandler); // Remove o listener da tecla ESC
    };

    // Lógica para fechar o modal com o botão
    document.getElementById("fecharModal").addEventListener("click", fecharModal);

    // Lógica para fechar o modal com a tecla ESC
    const escPressHandler = (event) => {
        if (event.key === 'Escape') {
            fecharModal();
        }
    };

    document.addEventListener('keydown', escPressHandler);



    // Evento para salvar as edições
    document.getElementById("salvarEdicoes").addEventListener("click", async () => {
        const novoProfessorId = document.getElementById("novoProfessor").value;
        const novoTipoAtividadeId = document.getElementById("novoTipoAtividade").value; // Aqui é o ID que está sendo pego
        const novoMotivo = document.getElementById("novoMotivo").value;

        // Obtenha a descrição correspondente ao ID
        const tipoAtividade = tiposAtividadeMap[novoTipoAtividadeId]; // Transforma o ID em descrição

        if (!tipoAtividade) {
            alert("Tipo de atividade selecionado é inválido.");
            return;
        }

        let sucesso = true;
        let mensagemSucesso = '';

        // Atualiza cada agendamento selecionado
        for (let checkbox of checkboxes) {
            const idAgendamento = checkbox.value;
            try {
                await editarAgendamento(idAgendamento, novoProfessorId, tipoAtividade, novoMotivo); // Agora você usa a descrição correta
            } catch (error) {
                console.error('Erro ao editar agendamento:', error);
                sucesso = false;
                mensagemSucesso = "Houve um erro ao atualizar alguns agendamentos.";
            }
        }

        if (sucesso) {
            mensagemSucesso = "Agendamentos atualizados com sucesso!";
        }

        alert(mensagemSucesso);
        // Fechar o modal e recarregar edições
        fecharModal();
        carregarAgendamentosPorUnidade(unidadeCodigo);
    });

});

document.getElementById("btnExcluirSelecionados").addEventListener("click", async () => {
    const checkboxes = document.querySelectorAll('#agendamentosList input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        alert("Selecione ao menos um agendamento para excluir.");
        return;
    }

    const primeiraConfirmacao = confirm(
        `⚠️ ATENÇÃO — EXCLUSÃO DE AGENDAMENTOS SELECIONADOS\n\n` +
        `Você selecionou ${checkboxes.length} agendamento(s) para excluir.\n\n` +
        `Todos os registros selecionados serão removidos permanentemente do sistema. ` +
        `Esta ação não pode ser desfeita.\n\n` +
        `Deseja continuar?`
    );

    if (!primeiraConfirmacao) return;

    const segundaConfirmacao = confirm(
        `🚨 CONFIRMAÇÃO FINAL\n\n` +
        `Você está prestes a excluir definitivamente ${checkboxes.length} agendamento(s).\n\n` +
        `Clique em OK apenas se tiver certeza absoluta. Não será possível recuperar esses dados.`
    );

    if (!segundaConfirmacao) return;

    const unidadeSelect = document.getElementById('unidadeSelect');
    const unidadeCodigo = unidadeSelect.value;

    let erros = 0;
    for (let checkbox of checkboxes) {
        const idAgendamento = checkbox.value;
        try {
            const response = await fetch(`/excluir-agendamento/${idAgendamento}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Falha na exclusão');
        } catch (error) {
            console.error('Erro ao excluir agendamento:', error);
            erros++;
        }
    }

    if (erros === 0) {
        alert(`${checkboxes.length} agendamento(s) excluído(s) com sucesso!`);
    } else {
        alert(`Concluído com ${erros} erro(s). Verifique o console para detalhes.`);
    }

    carregarAgendamentosPorUnidade(unidadeCodigo);
});

// Função para editar apenas o professor de um agendamento
async function editarProfessorAgendamento(idAgendamento, novoProfessorId) {
    try {
        const response = await fetch(`/editar-professor-agendamento/${idAgendamento}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ professor: novoProfessorId }), // Somente o professor é editado
        });

        if (!response.ok) throw new Error('Erro ao editar professor do agendamento.');

        return true; // Retorna verdadeiro se a edição foi bem-sucedida
    } catch (error) {
        console.error('Erro ao editar professor do agendamento:', error);
        return false; // Retorna falso se ocorreu um erro
    }
}


// Função para abrir modal de edição
async function abrirModalEdicao(agendamento) {
    const modal = document.createElement('div');
    modal.classList.add('modal');

    // Obtem o código da unidade da propriedade do agendamento
    const unidadeSelect = document.getElementById('unidadeSelect'); // Obtendo o select da unidade
    const unidadeCodigo = unidadeSelect.value; // Pega o valor da seleção atual

    // Valida se a unidade está definida
    if (!unidadeCodigo) {
        console.error('Código da unidade não encontrado ao abrir o modal de edição.');
        alert('Erro: Nenhuma unidade selecionada.'); // Mensagem de erro
        return; // Retorna se nenhuma unidade foi selecionada
    }

    // Carregar os professores e tipos de atividade apenas da unidade selecionada
    const professores = await carregarProfessoresPorUnidade(unidadeCodigo);
    const tiposAtividade = await carregarTiposDeAtividadePorUnidade(unidadeCodigo);

    modal.innerHTML = `
    <div class="modal-content">
        <h3>Editar Agendamento</h3>
        <div class="modal-form-group">
            <label for="novoProfessor">Professor</label>
            <select id="novoProfessor">
                ${professores.map(professor => `
                    <option value="${professor.id_professor}" ${professor.nome === agendamento.nome ? 'selected' : ''}>${professor.nome}</option>
                `).join('')}
            </select>
        </div>
        <div class="modal-form-group">
            <label for="novoTipoAtividade">Tipo de Atividade</label>
            <select id="novoTipoAtividade">
                ${tiposAtividade.map(tipo => `
                    <option value="${tipo.id_tipo_aula}" ${tipo.id_tipo_aula === agendamento.tipo_aula ? 'selected' : ''}>${tipo.descricao}</option>
                `).join('')}
            </select>
        </div>
        <div class="modal-form-group">
            <label for="novoMotivo">Motivo</label>
            <input type="text" id="novoMotivo" value="${agendamento.motivo || ''}" placeholder="Informe o motivo">
        </div>
        <div class="modal-actions">
            <button id="salvarEdicao" class="btn-save">Salvar</button>
            <button id="fecharModal" class="btn-ghost">Fechar</button>
        </div>
    </div>
`;


    document.body.appendChild(modal);

    // Função para fechar o modal
    const fecharModal = () => {
        modal.remove();
        document.removeEventListener('keydown', escPressHandler); // Remove o listener da tecla ESC
    };

    // Lógica para fechar o modal com o botão
    document.getElementById("fecharModal").addEventListener("click", fecharModal);

    // Lógica para fechar o modal com a tecla ESC
    const escPressHandler = (event) => {
        if (event.key === 'Escape') {
            fecharModal();
        }
    };

    document.addEventListener('keydown', escPressHandler);


}


async function carregarProfessoresPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar professores por unidade');

        const professores = await response.json();

        // Classificando os professores em ordem alfabética
        professores.sort((a, b) => a.nome.localeCompare(b.nome));

        return professores;
    } catch (error) {
        console.error('Erro ao carregar professores por unidade:', error);
        return [];
    }
}

let tiposAtividadeMap = {};
let agendamentosTrocaCoordenador = [];
let trocaCoordPares = [];

// Função para carregar tipos de atividade
async function carregarTiposDeAtividadePorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-tipos-aula-por-unidade/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar tipos de atividade por unidade');

        const tiposAtividade = await response.json();
        tiposAtividadeMap = {}; // Limpa o mapeamento anterior

        tiposAtividade.forEach(tipo => {
            tiposAtividadeMap[tipo.id_tipo_aula] = tipo.descricao; // Mapeia o ID para a descrição
        });

        return tiposAtividade;
    } catch (error) {
        console.error('Erro ao carregar tipos de atividade por unidade:', error);
        return [];
    }
}

function atualizarFeedbackTrocaCoordenador(mensagem, tipo = '') {
    const feedback = document.getElementById('trocaCoordFeedback');
    if (!feedback) return;
    feedback.textContent = mensagem || '';
    feedback.className = 'swap-feedback';
    if (tipo) {
        feedback.classList.add(tipo);
    }
}

function atualizarResumoTrocaCoordenador(texto) {
    const resumo = document.getElementById('trocaCoordResumo');
    if (resumo) {
        resumo.textContent = texto;
    }
}

function limparSelectTroca(selectEl, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
}

function limparSelectTrocaMulti(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
}

function preencherProfessoresTroca(selectEl, professores, placeholder) {
    limparSelectTroca(selectEl, placeholder);
    professores.forEach((professor) => {
        const option = document.createElement('option');
        option.value = String(professor.id_professor);
        option.textContent = professor.nome;
        selectEl.appendChild(option);
    });
}

function montarTextoAgendamentoTroca(agendamento) {
    const data = formatarData(agendamento.data_reservas);
    const horaInicio = formatarHora(agendamento.hora_inicio).slice(0, 5);
    const horaFim = formatarHora(agendamento.hora_fim).slice(0, 5);
    return `${data} | ${horaInicio} - ${horaFim} | Sala ${agendamento.nome_sala}`;
}

function montarTextoAgendamentoDestinoTroca(agendamento) {
    const data = formatarData(agendamento.data_reservas);
    const horaInicio = formatarHora(agendamento.hora_inicio).slice(0, 5);
    const horaFim = formatarHora(agendamento.hora_fim).slice(0, 5);
    return `${agendamento.nome_professor} | Sala ${agendamento.nome_sala} | ${data} ${horaInicio}-${horaFim}`;
}

function ehHojeOuFuturo(dataIso) {
    if (!dataIso) return false;
    const [ano, mes, dia] = String(dataIso).split('-').map(Number);
    if (!ano || !mes || !dia) return false;

    const data = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
    return data.getTime() >= inicioHoje.getTime();
}

function montarTextoAgendamentoOrigemTroca(agendamento) {
    const data = formatarData(agendamento.data_reservas);
    const horaInicio = formatarHora(agendamento.hora_inicio).slice(0, 5);
    const horaFim = formatarHora(agendamento.hora_fim).slice(0, 5);
    return `${data} ${horaInicio}-${horaFim} | Sala ${agendamento.nome_sala}`;
}

function popularAgendamentosOrigemTroca() {
    const professorOrigemEl = document.getElementById('trocaCoordProfessorOrigem');
    const agendamentoOrigemEl = document.getElementById('trocaCoordAgendamentosOrigem');
    const professorOrigemId = Number.parseInt(professorOrigemEl?.value, 10);

    limparSelectTrocaMulti(agendamentoOrigemEl);
    trocaCoordPares = [];
    renderizarResultadoTrocaCoordenador();

    if (!Number.isInteger(professorOrigemId)) {
        atualizarResumoTrocaCoordenador('Nenhuma simulação realizada.');
        return;
    }

    const origemDoProfessor = agendamentosTrocaCoordenador
        .filter((item) => item.id_professor === professorOrigemId)
        .filter((item) => ehHojeOuFuturo(item.data_reservas))
        .sort((a, b) => {
            const aKey = `${a.data_reservas} ${a.hora_inicio}`;
            const bKey = `${b.data_reservas} ${b.hora_inicio}`;
            return aKey.localeCompare(bKey);
        });

    origemDoProfessor.forEach((agendamento) => {
        const option = document.createElement('option');
        option.value = String(agendamento.id_agendamento);
        option.textContent = montarTextoAgendamentoOrigemTroca(agendamento);
        agendamentoOrigemEl.appendChild(option);
    });

    atualizarFeedbackTrocaCoordenador(
        origemDoProfessor.length
            ? 'Selecione um ou mais agendamentos de origem e clique em Simular pares de troca.'
            : 'Este professor não possui agendamentos de hoje/futuro para troca.',
        origemDoProfessor.length ? '' : 'error'
    );
}

function construirDestinosCompativeis(origem, professorOrigemId) {
    return agendamentosTrocaCoordenador
        .filter((item) => Number(item.id_agendamento) !== Number(origem.id_agendamento))
        .filter((item) => item.id_professor !== professorOrigemId)
        .filter((item) => item.id_sala !== origem.id_sala)
        .filter((item) => item.data_reservas === origem.data_reservas)
        .filter((item) => item.hora_inicio === origem.hora_inicio)
        .filter((item) => item.hora_fim === origem.hora_fim)
        .filter((item) => ehHojeOuFuturo(item.data_reservas))
        .sort((a, b) => {
            const nomeA = String(a.nome_professor || '');
            const nomeB = String(b.nome_professor || '');
            const compNome = nomeA.localeCompare(nomeB);
            if (compNome !== 0) return compNome;
            return Number(a.id_agendamento) - Number(b.id_agendamento);
        });
}

function renderizarResultadoTrocaCoordenador() {
    const corpo = document.getElementById('trocaCoordResultadoBody');
    if (!corpo) return;

    corpo.innerHTML = '';

    if (!trocaCoordPares.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.textContent = 'Escolha professor e agendamentos de origem, depois clique em Simular pares de troca.';
        tr.appendChild(td);
        corpo.appendChild(tr);
        return;
    }

    trocaCoordPares.forEach((par, idx) => {
        const tr = document.createElement('tr');

        const tdCheck = document.createElement('td');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'troca-coord-check';
        check.checked = par.ativo;
        check.dataset.index = String(idx);
        tdCheck.appendChild(check);

        const tdOrigem = document.createElement('td');
        tdOrigem.textContent = `${par.origem.nome_professor} | ${montarTextoAgendamentoOrigemTroca(par.origem)}`;

        const tdDestino = document.createElement('td');
        const selectDestino = document.createElement('select');
        selectDestino.className = 'troca-coord-destino-select';
        selectDestino.dataset.index = String(idx);
        const optVazio = document.createElement('option');
        optVazio.value = '';
        optVazio.textContent = par.destinos.length ? 'Selecione um destino' : 'Sem destino compatível';
        selectDestino.appendChild(optVazio);

        par.destinos.forEach((destino) => {
            const option = document.createElement('option');
            option.value = String(destino.id_agendamento);
            option.textContent = montarTextoAgendamentoDestinoTroca(destino);
            if (Number(destino.id_agendamento) === Number(par.destinoSelecionadoId)) {
                option.selected = true;
            }
            selectDestino.appendChild(option);
        });

        if (!par.destinos.length) {
            selectDestino.disabled = true;
            check.checked = false;
            par.ativo = false;
        }

        tdDestino.appendChild(selectDestino);

        const tdStatus = document.createElement('td');
        tdStatus.className = 'troca-coord-status';
        tdStatus.dataset.index = String(idx);
        tdStatus.textContent = par.destinos.length ? 'Pronto para revisar' : 'Sem opção compatível';
        tdStatus.classList.add(par.destinos.length ? 'swap-row-status-pending' : 'swap-row-status-error');

        tr.appendChild(tdCheck);
        tr.appendChild(tdOrigem);
        tr.appendChild(tdDestino);
        tr.appendChild(tdStatus);
        corpo.appendChild(tr);
    });

    corpo.querySelectorAll('.troca-coord-check').forEach((check) => {
        check.addEventListener('change', (event) => {
            const idx = Number.parseInt(event.target.dataset.index, 10);
            if (!Number.isInteger(idx)) return;
            trocaCoordPares[idx].ativo = event.target.checked;
            validarDuplicidadeDestinoTrocaCoord();
        });
    });

    corpo.querySelectorAll('.troca-coord-destino-select').forEach((select) => {
        select.addEventListener('change', (event) => {
            const idx = Number.parseInt(event.target.dataset.index, 10);
            if (!Number.isInteger(idx)) return;
            const novoDestino = Number.parseInt(event.target.value, 10);
            trocaCoordPares[idx].destinoSelecionadoId = Number.isInteger(novoDestino) ? novoDestino : null;
            validarDuplicidadeDestinoTrocaCoord();
        });
    });

    validarDuplicidadeDestinoTrocaCoord();
}

function validarDuplicidadeDestinoTrocaCoord() {
    const counts = new Map();

    trocaCoordPares.forEach((par) => {
        if (!par.ativo || !Number.isInteger(par.destinoSelecionadoId)) return;
        const chave = String(par.destinoSelecionadoId);
        counts.set(chave, (counts.get(chave) || 0) + 1);
    });

    const statusEls = document.querySelectorAll('.troca-coord-status');
    let possuiDuplicidade = false;
    let prontos = 0;
    let semPar = 0;

    statusEls.forEach((el) => {
        const idx = Number.parseInt(el.dataset.index, 10);
        if (!Number.isInteger(idx)) return;

        const par = trocaCoordPares[idx];
        el.className = 'troca-coord-status';

        if (!par.destinos.length) {
            semPar += 1;
            el.textContent = 'Sem opção compatível';
            el.classList.add('swap-row-status-error');
            return;
        }

        if (!par.ativo) {
            el.textContent = 'Ignorado';
            el.classList.add('swap-row-status-pending');
            return;
        }

        if (!Number.isInteger(par.destinoSelecionadoId)) {
            el.textContent = 'Selecione um destino';
            el.classList.add('swap-row-status-error');
            return;
        }

        const repetido = (counts.get(String(par.destinoSelecionadoId)) || 0) > 1;
        if (repetido) {
            possuiDuplicidade = true;
            el.textContent = 'Destino repetido';
            el.classList.add('swap-row-status-error');
            return;
        }

        prontos += 1;
        el.textContent = 'Pronto';
        el.classList.add('swap-row-status-ok');
    });

    const total = trocaCoordPares.length;
    const faltantes = Math.max(total - prontos, 0);
    atualizarResumoTrocaCoordenador(
        `Selecionados ${total} origem(ns): ${prontos} pronto(s), ${faltantes} pendente(s).`
    );

    if (possuiDuplicidade) {
        atualizarFeedbackTrocaCoordenador('Há destinos repetidos na seleção. Ajuste antes de executar.', 'error');
    }
}

function simularTrocaDiretaCoordenador() {
    const professorOrigemEl = document.getElementById('trocaCoordProfessorOrigem');
    const agendamentoOrigemEl = document.getElementById('trocaCoordAgendamentosOrigem');
    const professorOrigemId = Number.parseInt(professorOrigemEl?.value, 10);
    const selecionados = Array.from(agendamentoOrigemEl?.selectedOptions || []).map((opt) => Number.parseInt(opt.value, 10)).filter(Number.isInteger);

    if (!Number.isInteger(professorOrigemId)) {
        atualizarFeedbackTrocaCoordenador('Selecione o professor de origem para simular as trocas.', 'error');
        return;
    }

    if (!selecionados.length) {
        atualizarFeedbackTrocaCoordenador('Selecione pelo menos um agendamento de origem para simular.', 'error');
        trocaCoordPares = [];
        renderizarResultadoTrocaCoordenador();
        atualizarResumoTrocaCoordenador('Nenhuma simulação realizada.');
        return;
    }

    const origens = selecionados
        .map((id) => agendamentosTrocaCoordenador.find((item) => Number(item.id_agendamento) === id))
        .filter((item) => item && ehHojeOuFuturo(item.data_reservas))
        .sort((a, b) => `${a.data_reservas} ${a.hora_inicio}`.localeCompare(`${b.data_reservas} ${b.hora_inicio}`));

    const destinosUsados = new Set();
    trocaCoordPares = origens.map((origem) => {
        const destinos = construirDestinosCompativeis(origem, professorOrigemId);
        const livre = destinos.find((destino) => !destinosUsados.has(Number(destino.id_agendamento)));
        const destinoSelecionadoId = livre ? Number(livre.id_agendamento) : null;
        if (destinoSelecionadoId) destinosUsados.add(destinoSelecionadoId);

        return {
            origem,
            destinos,
            destinoSelecionadoId,
            ativo: Boolean(destinoSelecionadoId)
        };
    });

    renderizarResultadoTrocaCoordenador();

    const prontas = trocaCoordPares.filter((par) => par.ativo && Number.isInteger(par.destinoSelecionadoId)).length;
    const faltantes = Math.max(trocaCoordPares.length - prontas, 0);

    if (faltantes > 0) {
        atualizarFeedbackTrocaCoordenador(
            `Foram escolhidas ${trocaCoordPares.length} origem(ns), mas apenas ${prontas} têm par imediato. Faltam ${faltantes}. Escolha outros horários para completar.`,
            'error'
        );
    } else {
        atualizarFeedbackTrocaCoordenador(`Simulação concluída: ${prontas} origem(ns) prontas para executar.`, 'success');
    }
}

async function carregarDadosTrocaDiretaCoordenador(codigoUnidade) {
    const professorOrigemEl = document.getElementById('trocaCoordProfessorOrigem');
    const agendamentoOrigemEl = document.getElementById('trocaCoordAgendamentosOrigem');

    if (!codigoUnidade) {
        agendamentosTrocaCoordenador = [];
        trocaCoordPares = [];
        limparSelectTroca(professorOrigemEl, 'Selecione um professor');
        limparSelectTrocaMulti(agendamentoOrigemEl);
        renderizarResultadoTrocaCoordenador();
        atualizarResumoTrocaCoordenador('Nenhuma simulação realizada.');
        atualizarFeedbackTrocaCoordenador('Selecione uma unidade para montar a troca direta.');
        return;
    }

    try {
        const [professores, respostaAgendamentos] = await Promise.all([
            carregarProfessoresPorUnidade(codigoUnidade),
            fetch(`/troca-sala/coordenador/agendamentos/${encodeURIComponent(codigoUnidade)}`)
        ]);

        if (!respostaAgendamentos.ok) {
            const erroPayload = await respostaAgendamentos.json().catch(() => null);
            throw new Error(erroPayload?.error || 'Erro ao carregar agendamentos para troca direta.');
        }

        agendamentosTrocaCoordenador = await respostaAgendamentos.json();
        trocaCoordPares = [];

        preencherProfessoresTroca(professorOrigemEl, professores, 'Selecione um professor');
        limparSelectTrocaMulti(agendamentoOrigemEl);
        renderizarResultadoTrocaCoordenador();
        atualizarResumoTrocaCoordenador('Nenhuma simulação realizada.');

        if (agendamentosTrocaCoordenador.length === 0) {
            atualizarFeedbackTrocaCoordenador('Nenhum agendamento futuro encontrado para troca direta nesta unidade.');
        } else {
            atualizarFeedbackTrocaCoordenador('Selecione professor de origem para carregar as datas de troca.');
        }
    } catch (error) {
        console.error('Erro ao carregar dados da troca direta do coordenador:', error);
        atualizarFeedbackTrocaCoordenador(error.message || 'Não foi possível carregar dados da troca direta.', 'error');
    }
}

async function executarTrocaDiretaCoordenador() {
    const unidadeCodigo = document.getElementById('unidadeSelect')?.value;

    if (!unidadeCodigo) {
        atualizarFeedbackTrocaCoordenador('Selecione uma unidade antes de executar a troca direta.', 'error');
        return;
    }

    if (!trocaCoordPares.length) {
        atualizarFeedbackTrocaCoordenador('Simule os pares antes de executar as trocas.', 'error');
        return;
    }

    const destinosContagem = new Map();
    const paresValidos = [];

    trocaCoordPares.forEach((par) => {
        if (!par.ativo) return;
        if (!Number.isInteger(par.destinoSelecionadoId)) return;

        const chave = String(par.destinoSelecionadoId);
        destinosContagem.set(chave, (destinosContagem.get(chave) || 0) + 1);
        paresValidos.push(par);
    });

    const possuiDuplicidade = [...destinosContagem.values()].some((total) => total > 1);
    if (possuiDuplicidade) {
        atualizarFeedbackTrocaCoordenador('Existem destinos repetidos entre as linhas selecionadas. Ajuste para continuar.', 'error');
        return;
    }

    if (!paresValidos.length) {
        atualizarFeedbackTrocaCoordenador('Nenhuma linha válida foi selecionada para executar.', 'error');
        return;
    }

    const confirmar = confirm(`Confirmar execução de ${paresValidos.length} troca(s) direta(s)?`);
    if (!confirmar) return;

    const btnExecutarTroca = document.getElementById('btnExecutarTrocaCoordenador');
    btnExecutarTroca.disabled = true;

    try {
        let sucesso = 0;
        const falhas = [];

        for (const par of paresValidos) {
            const response = await fetch('/troca-sala/coordenador/trocar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id_agendamento_origem: Number(par.origem.id_agendamento),
                    id_agendamento_destino: Number(par.destinoSelecionadoId)
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                falhas.push(data?.error || `Falha na origem ${par.origem.id_agendamento}.`);
                continue;
            }

            sucesso += 1;
        }

        if (falhas.length) {
            atualizarFeedbackTrocaCoordenador(
                `Concluído com parcial: ${sucesso} sucesso(s) e ${falhas.length} falha(s). ${falhas[0]}`,
                'error'
            );
        } else {
            atualizarFeedbackTrocaCoordenador(`Trocas concluídas com sucesso: ${sucesso}. Professores notificados.`, 'success');
        }

        paginaAtual = 1;
        await Promise.all([
            carregarAgendamentosPorUnidade(unidadeCodigo),
            carregarDadosTrocaDiretaCoordenador(unidadeCodigo)
        ]);
    } catch (error) {
        console.error('Erro ao executar troca direta do coordenador:', error);
        atualizarFeedbackTrocaCoordenador(error.message || 'Erro ao executar troca direta.', 'error');
    } finally {
        btnExecutarTroca.disabled = false;
    }
}




// Função para editar agendamento
async function editarAgendamento(idAgendamento, novoProfessor, novoTipoAtividade, novoMotivo) {
    try {
        const response = await fetch(`/editar-agendamento/${idAgendamento}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                professor: novoProfessor,
                tipoAtividade: novoTipoAtividade,
                motivo: novoMotivo,
            }),
        });

        if (!response.ok) throw new Error('Erro ao editar agendamento.');
        // Removido o alert daqui
    } catch (error) {
        console.error('Erro ao editar agendamento:', error);
        throw error; // Propaga o erro para ser tratado no loop
    }
}


document.getElementById('btnFiltroExclusao').addEventListener('click', () => {
    const btnFiltroExclusao = document.getElementById('btnFiltroExclusao');
    const filtrosDivExclusao = document.getElementById('filtrosExclusao');
    const estadoAtualExclusao = filtrosDivExclusao.style.display;
    const expandido = estadoAtualExclusao === 'none' || estadoAtualExclusao === '';

    filtrosDivExclusao.style.display = expandido ? 'grid' : 'none';
    btnFiltroExclusao?.setAttribute('aria-expanded', String(expandido));

    const label = btnFiltroExclusao?.querySelector('.toggle-label');
    if (label) {
        label.textContent = expandido ? 'Ocultar exclusão por intervalo' : 'Mostrar exclusão por intervalo';
    }
});


// Evento DOMContentLoaded para inicializar aplicações e listeners
document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades(); // Carrega as unidades ao carregar a página

    const unidadeSelect = document.getElementById('unidadeSelect');
    unidadeSelect.addEventListener('change', async () => {
        const codigoUnidade = unidadeSelect.value;
        if (codigoUnidade) {
            paginaAtual = 1;
            await Promise.all([
                carregarAgendamentosPorUnidade(codigoUnidade),
                carregarDadosTrocaDiretaCoordenador(codigoUnidade)
            ]);
        } else {
            document.getElementById('agendamentosList').innerHTML = ''; // Limpa a lista
            carregarDadosTrocaDiretaCoordenador('');
        }
    });

    const professorOrigemEl = document.getElementById('trocaCoordProfessorOrigem');
    const agendamentosOrigemEl = document.getElementById('trocaCoordAgendamentosOrigem');
    const btnSimularTrocaEl = document.getElementById('btnSimularTrocaCoordenador');
    const btnExecutarTrocaEl = document.getElementById('btnExecutarTrocaCoordenador');

    professorOrigemEl?.addEventListener('change', () => {
        popularAgendamentosOrigemTroca();
        atualizarResumoTrocaCoordenador('Nenhuma simulação realizada.');
    });

    agendamentosOrigemEl?.addEventListener('change', () => {
        const total = agendamentosOrigemEl.selectedOptions.length;
        atualizarFeedbackTrocaCoordenador(`Você selecionou ${total} origem(ns). Clique em Simular pares de troca.`);
    });

    btnSimularTrocaEl?.addEventListener('click', simularTrocaDiretaCoordenador);
    btnExecutarTrocaEl?.addEventListener('click', executarTrocaDiretaCoordenador);

    const btnFiltro = document.getElementById('btnFiltro');
    const filtrosDiv = document.getElementById('filtros');

    // Verifica se o botão de filtro existe e adiciona evento de clique
    if (btnFiltro) {
        btnFiltro.addEventListener('click', () => {
            // Alterna a visibilidade do painel de filtros
            const estadoAtual = filtrosDiv.style.display;
            const expandido = estadoAtual === 'none' || estadoAtual === '';
            filtrosDiv.style.display = expandido ? 'grid' : 'none';
            btnFiltro.setAttribute('aria-expanded', String(expandido));

            const label = btnFiltro.querySelector('.toggle-label');
            if (label) {
                label.textContent = expandido ? 'Ocultar filtros' : 'Mostrar filtros';
            }
        });
    }

    const btnAplicarFiltro = document.getElementById('btnAplicarFiltro');
    if (btnAplicarFiltro) {
        btnAplicarFiltro.addEventListener('click', aplicarFiltros); // Chama a função de aplicação de filtros
    } else {
        console.error('Botão de aplicar filtro não encontrado no DOM.');
    }
});

let paginaAtual = 1; // Página atual
const totalPorPagina = 50; // Total de agendamentos por página


// Função para carregar agendamentos por unidade e paginação
async function carregarAgendamentosPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-agendamento/${codigoUnidade}`);
        if (!response.ok) throw new Error('Erro ao carregar agendamentos');

        const agendamentos = await response.json();
        const agendamentosList = document.getElementById('agendamentosList');
        agendamentosList.innerHTML = ''; // Limpa a tabela antes de preencher

        const totalAgendamentos = agendamentos.length; // Total de agendamentos
        const totalPaginas = Math.ceil(totalAgendamentos / totalPorPagina); // Total de páginas

        // Paginação
        const agendamentosPagados = agendamentos.slice((paginaAtual - 1) * totalPorPagina, paginaAtual * totalPorPagina);

        if (agendamentosPagados.length === 0) {
            agendamentosList.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum agendamento encontrado para esta unidade no momento.</td></tr>';
        } else {
            // Loop para adicionar agendamentos paginados
            agendamentosPagados.forEach(agendamento => {
                const row = document.createElement('tr');
                // Criando o checkbox para seleção
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox'; // Definindo o tipo como checkbox
                checkbox.value = agendamento.id_agendamento; // O valor é o ID do agendamento
                checkbox.classList.add('agendamento-checkbox'); // Adiciona uma classe para seleção

                // Adiciona evento de alteração no checkbox
                checkbox.addEventListener('change', () => {
                    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
                    const anyChecked = Array.from(checkboxes).some(item => item.checked);
                    document.getElementById('btnEditarSelecionados').style.display = anyChecked ? 'inline-block' : 'none';
                });

                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell); // Adiciona a célula do checkbox à linha

                const salaCell = document.createElement('td');
                salaCell.textContent = agendamento.nome_sala || 'N/D';
                row.appendChild(salaCell);


                const professorCell = document.createElement('td');
                professorCell.textContent = agendamento.nome || 'N/D';
                row.appendChild(professorCell);

                const dataInicioCell = document.createElement('td');
                dataInicioCell.textContent = formatarData(agendamento.data_reservas) || 'N/D';
                row.appendChild(dataInicioCell);

                const horaInicioCell = document.createElement('td');
                horaInicioCell.textContent = formatarHora(agendamento.hora_inicio) || 'N/D';
                row.appendChild(horaInicioCell);

                const dataFimCell = document.createElement('td');
                dataFimCell.textContent = formatarData(agendamento.data_reservas) || 'N/D';
                row.appendChild(dataFimCell);

                const horaFimCell = document.createElement('td');
                horaFimCell.textContent = formatarHora(agendamento.hora_fim) || 'N/D';
                row.appendChild(horaFimCell);

                const tipoAtividadeCell = document.createElement('td');
                tipoAtividadeCell.textContent = agendamento.tipo_aula || 'N/D';
                row.appendChild(tipoAtividadeCell);

                const motivoCell = document.createElement('td');
                motivoCell.textContent = agendamento.motivo || 'N/D';
                row.appendChild(motivoCell);

                // Botão de excluir
                const excluirButton = document.createElement('button');
                excluirButton.textContent = 'Excluir';
                excluirButton.addEventListener('click', async () => {
                    const confirmacao = confirm('Deseja excluir este agendamento?');
                    if (confirmacao) {
                        await excluirAgendamento(agendamento.id_agendamento);
                        carregarAgendamentosPorUnidade(codigoUnidade); // Recarregar a lista após exclusão
                    }
                });


                const acoesCell = document.createElement('td');
                // acoesCell.appendChild(editarButton);
                acoesCell.appendChild(excluirButton);
                row.appendChild(acoesCell);

                agendamentosList.appendChild(row);
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

    // Controle de página anterior
    const botaoAnterior = document.createElement('button');
    botaoAnterior.textContent = 'Anterior';
    botaoAnterior.disabled = paginaAtual === 1; // Desabilita se estiver na primeira página
    botaoAnterior.addEventListener('click', () => {
        paginaAtual--;
        carregarAgendamentosPorUnidade(document.getElementById('unidadeSelect').value);
    });
    paginacao.appendChild(botaoAnterior);

    // Botões de página
    for (let i = 1; i <= totalPaginas; i++) {
        const botaoPagina = document.createElement('button');
        botaoPagina.textContent = i;
        botaoPagina.disabled = (i === paginaAtual); // Destacar a página atual

        // Adiciona a classe para botão da página ativa
        if (i === paginaAtual) {
            botaoPagina.classList.add('pagina-ativa');
        }

        botaoPagina.addEventListener('click', () => {
            paginaAtual = i;
            carregarAgendamentosPorUnidade(document.getElementById('unidadeSelect').value);
        });
        paginacao.appendChild(botaoPagina);
    }

    // Controle de próxima página
    const botaoProximo = document.createElement('button');
    botaoProximo.textContent = 'Próximo';
    botaoProximo.disabled = paginaAtual === totalPaginas; // Desabilita se estiver na última página
    botaoProximo.addEventListener('click', () => {
        paginaAtual++;
        carregarAgendamentosPorUnidade(document.getElementById('unidadeSelect').value);
    });
    paginacao.appendChild(botaoProximo);
}

// Função para excluir um agendamento
async function excluirAgendamento(idAgendamento) {
    try {
        const response = await fetch(`/excluir-agendamento/${idAgendamento}`, {
            method: 'DELETE' // Usando o método DELETE para a exclusão
        });

        if (!response.ok) throw new Error('Erro ao excluir agendamento.');

        alert('Agendamento excluído com sucesso!');
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
        alert('Erro ao excluir agendamento.');
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

document.getElementById('btnExcluirIntervalo').addEventListener('click', async () => {
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;

    const unidadeSelect = document.getElementById('unidadeSelect');
    const codigoUnidade = unidadeSelect.value; // Captura a unidade selecionada

    if (!dataInicio || !dataFim) {
        alert('Por favor, selecione ambas as datas.');
        return;
    }

    if (!codigoUnidade) {
        alert('Por favor, selecione uma unidade antes de excluir agendamentos.');
        return;
    }

    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        alert('Intervalo de datas inválido.');
        return;
    }

    if (inicio > fim) {
        alert('A data de início não pode ser maior que a data de fim.');
        return;
    }

    const anoAtual = new Date().getFullYear();
    const intervaloContemAnoAtual = inicio.getFullYear() <= anoAtual && fim.getFullYear() >= anoAtual;
    if (intervaloContemAnoAtual) {
        alert('Não é permitido excluir agendamentos do ano vigente pela exclusão em intervalo.');
        return;
    }

    // 1ª confirmação — explica o que será apagado
    const primeiraConfirmacao = confirm(
        `⚠️ ATENÇÃO — EXCLUSÃO EM MASSA\n\n` +
        `Você está prestes a excluir TODOS os agendamentos da unidade "${codigoUnidade}" ` +
        `no período de ${dataInicio} até ${dataFim}.\n\n` +
        `Isso inclui todas as aulas, reservas e atividades cadastradas nesse intervalo. ` +
        `Nenhum registro será mantido após a exclusão.\n\n` +
        `Deseja continuar?`
    );

    if (!primeiraConfirmacao) return;

    // 2ª confirmação — exige confirmação consciente da irreversibilidade
    const segundaConfirmacao = confirm(
        `🚨 CONFIRMAÇÃO FINAL — NÃO É POSSÍVEL DESFAZER\n\n` +
        `Você confirmou a exclusão de todos os agendamentos da unidade "${codigoUnidade}" ` +
        `entre ${dataInicio} e ${dataFim}.\n\n` +
        `Esta é a sua ÚLTIMA chance de cancelar. ` +
        `Após confirmar, os dados serão apagados permanentemente do sistema.\n\n` +
        `Clique em OK apenas se tiver certeza absoluta.`
    );

    if (segundaConfirmacao) {
        await excluirAgendamentosNoIntervalo(codigoUnidade, dataInicio, dataFim);
    }
});

// Função para excluir agendamentos em um intervalo de datas para uma unidade específica
async function excluirAgendamentosNoIntervalo(codigoUnidade, dataInicio, dataFim) {
    try {
        const response = await fetch(`/excluir-agendamentos-intervalo`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ codigoUnidade, dataInicio, dataFim }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || 'Erro ao excluir agendamentos.');
        }

        alert('Agendamentos excluídos com sucesso!');
        // Opcionalmente, recarregar a lista de agendamentos
        carregarAgendamentosPorUnidade(codigoUnidade);
    } catch (error) {
        console.error('Erro ao excluir agendamentos:', error);
        alert('Erro ao excluir agendamentos.');
    }
}

