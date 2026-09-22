document.getElementById('id_professor').addEventListener('change', (event) => {
    console.log('Professor selecionado:', event.target.value);
});

let usuarioLogado = null;
let ultimaRequisicaoProfessores = 0;
let ultimoResumoVerificacao = null;
let ultimoPayloadConfirmacao = null;
let instanciaFlatpickrDatas = null;
let datasSelecionadasEmMemoria = [];

function formatarDatasSelecionadasParaTexto(selectedDates) {
    if (!Array.isArray(selectedDates)) {
        return '';
    }

    return selectedDates.map((date) => {
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }).join(', ');
}

function converterTextoDatasParaArray(texto) {
    if (!texto) {
        return [];
    }

    return texto.split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((data) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
                return data;
            }
            return AgendamentoUtils.converterDataBrParaIso(data);
        })
        .filter(Boolean);
}

function converterTextoDatasParaDefaultDate(texto) {
    return converterTextoDatasParaArray(texto)
        .map((dataIso) => {
            const dataObj = new Date(`${dataIso}T12:00:00`);
            return Number.isNaN(dataObj.getTime()) ? null : dataObj;
        })
        .filter(Boolean);
}

function atualizarEstadoDatasSelecionadas(texto) {
    const inputDatas = document.getElementById('data_selecionada');
    if (!inputDatas) {
        return [];
    }

    const datasIso = converterTextoDatasParaArray(texto);
    datasSelecionadasEmMemoria = datasIso;
    inputDatas.value = datasIso.map((data) => AgendamentoUtils.formatarDataIsoParaBr(data)).join(', ');
    return datasIso;
}

function inicializarFlatpickrDatas() {
    const inputDatas = document.getElementById('data_selecionada');
    if (!inputDatas) {
        return;
    }

    if (instanciaFlatpickrDatas) {
        instanciaFlatpickrDatas.destroy();
        instanciaFlatpickrDatas = null;
    }

    const editando = inputDatas.dataset.editando === 'true';
    const textoAtual = inputDatas.value || datasSelecionadasEmMemoria.map((data) => AgendamentoUtils.formatarDataIsoParaBr(data)).join(', ');
    const datasAtuais = converterTextoDatasParaDefaultDate(textoAtual);

    inputDatas.readOnly = !editando;
    inputDatas.style.backgroundColor = editando ? '#fff' : '#f0f0f0';
    inputDatas.style.color = editando ? '#000' : '#666';
    inputDatas.style.cursor = editando ? 'pointer' : 'not-allowed';

    instanciaFlatpickrDatas = flatpickr(inputDatas, {
        mode: 'multiple',
        dateFormat: 'Y-m-d',
        locale: 'pt',
        defaultDate: datasAtuais,
        allowInput: false,
        clickOpens: editando,
        onOpen: function() {
            if (!editando) {
                this.close();
            }
        },
        onChange: function(selectedDates) {
            const texto = formatarDatasSelecionadasParaTexto(selectedDates);
            if (texto) {
                atualizarEstadoDatasSelecionadas(texto);
            }
        },
        onClose: function(selectedDates) {
            const texto = formatarDatasSelecionadasParaTexto(selectedDates);
            if (texto) {
                atualizarEstadoDatasSelecionadas(texto);
            } else if (datasSelecionadasEmMemoria.length) {
                atualizarEstadoDatasSelecionadas(datasSelecionadasEmMemoria.map((data) => AgendamentoUtils.formatarDataIsoParaBr(data)).join(', '));
            } else {
                atualizarEstadoDatasSelecionadas('');
            }
        }
    });

    if (editando && datasAtuais.length) {
        instanciaFlatpickrDatas.setDate(datasAtuais, true);
    }
}

window.inicializarFlatpickrDatas = inicializarFlatpickrDatas;

function nomeProfessorParaExibicao(professor) {
    return String(
        professor?.nome
        || professor?.nome_exibicao
        || professor?.login
        || 'Professor'
    ).trim();
}

function preencherSelectProfessorComUsuarioLogado() {
    const professorSelect = document.getElementById('id_professor');
    professorSelect.innerHTML = '';

    if (!usuarioLogado) {
        return;
    }

    const option = document.createElement('option');
    option.value = usuarioLogado.id_professor;
    option.textContent = nomeProfessorParaExibicao(usuarioLogado);
    option.selected = true;
    professorSelect.appendChild(option);
}

async function carregarProfessoresPorUnidade(codigoUnidade) {
    if (!usuarioLogado || !codigoUnidade) {
        return;
    }

    const professorSelect = document.getElementById('id_professor');
    professorSelect.innerHTML = '';
    const requisicaoAtual = ++ultimaRequisicaoProfessores;

    try {
        const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar professores da unidade');
        }

        const professores = await response.json();
        if (requisicaoAtual !== ultimaRequisicaoProfessores) {
            return;
        }

        if (!Array.isArray(professores) || professores.length === 0) {
            preencherSelectProfessorComUsuarioLogado();
            return;
        }

        const professoresOrdenados = [...professores].sort((a, b) => {
            if (a.id_professor === usuarioLogado.id_professor) return -1;
            if (b.id_professor === usuarioLogado.id_professor) return 1;
            return nomeProfessorParaExibicao(a).localeCompare(nomeProfessorParaExibicao(b));
        });

        const ids = new Set();
        professoresOrdenados.forEach((professor) => {
            if (ids.has(professor.id_professor)) {
                return;
            }

            ids.add(professor.id_professor);
            const option = document.createElement('option');
            option.value = professor.id_professor;
            option.textContent = nomeProfessorParaExibicao(professor);
            if (professor.id_professor === usuarioLogado.id_professor) {
                option.selected = true;
            }
            professorSelect.appendChild(option);
        });

        if (!ids.has(usuarioLogado.id_professor)) {
            const optionUsuario = document.createElement('option');
            optionUsuario.value = usuarioLogado.id_professor;
            optionUsuario.textContent = nomeProfessorParaExibicao(usuarioLogado);
            optionUsuario.selected = true;
            professorSelect.insertBefore(optionUsuario, professorSelect.firstChild);
        }
    } catch (error) {
        console.error('Erro ao carregar professores por unidade:', error);
        if (requisicaoAtual !== ultimaRequisicaoProfessores) {
            return;
        }
        preencherSelectProfessorComUsuarioLogado();
    }
}

// Funções de carregamento das unidades e salas
document.addEventListener('DOMContentLoaded', () => {
    // Carregar apenas a unidade do professor logado

    // Adicione o evento de clique para o botão de excluir selecionados
    document.getElementById('botaoExcluirSelecionados').addEventListener('click', excluirSelecionados);

    carregarUnidadesDoProfessor(); 
    //carregarProfessoresPorUnidade();
    

    inicializarFlatpickrDatas();
    
});
// --- LÓGICA DE PREENCHIMENTO AUTOMÁTICO DE TURNO (Adicionado para dar flexibilidade) ---
document.addEventListener('DOMContentLoaded', () => {
    const selectTurno = document.getElementById('select_turno');
    const inputHoraInicio = document.getElementById('hora_inicio');
    const inputHoraFim = document.getElementById('hora_fim');

    if (selectTurno) {
        selectTurno.addEventListener('change', function() {
            const turno = this.value;

            // Define os horários fixos
            if (turno === 'manha') {
                inputHoraInicio.value = '07:45';
                inputHoraFim.value = '11:45';
            } else if (turno === 'tarde') {
                inputHoraInicio.value = '13:15';
                inputHoraFim.value = '17:15';
            } else if (turno === 'noite') {
                inputHoraInicio.value = '19:00';
                inputHoraFim.value = '22:40';
            }
            
            // Limpa os campos se for selecionada a opção padrão
            else {
                inputHoraInicio.value = '';
                inputHoraFim.value = '';
            }

            // Opcional: Aciona o evento 'input' para que qualquer outra validação na tela
            // (como a verificação de conflito ao digitar) seja executada.
            inputHoraInicio.dispatchEvent(new Event('input'));
            inputHoraFim.dispatchEvent(new Event('input'));
        });

        // Opcional: Se o usuário editar as horas manualmente, ele reseta o seletor de turno.
        const resetarSelect = () => { selectTurno.value = ""; };
        inputHoraInicio.addEventListener('input', resetarSelect);
        inputHoraFim.addEventListener('input', resetarSelect);
    }
});
// ---------------------------------------------------------------------------------------
// Função para verificar se o usuário está autenticado
async function verificarSessao() {
    const response = await fetch('/user-info'); // Endpoint que retorna informações do usuário logado
    if (response.status === 401) { // Se o usuário não estiver autenticado
        alert('Sua sessão expirou. Você será redirecionado para o login.');
        window.location.href = '/login'; // Redireciona para a página de login
    } else if (!response.ok) {
        console.error('Erro ao verificar a sessão:', response.statusText);
    }
}

// Chame esta função a cada X milissegundos para verificar a sessão
setInterval(verificarSessao, 60000); // Checa a cada 60 segundos

// Carregar tipos de aula por unidade
async function carregarTiposAulaPorUnidade(codigoUnidade) {
    try {
        const response = await fetch(`/listar-tipos-aula-por-unidade/${codigoUnidade}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar tipos de aula');
        }
        const tiposAula = await response.json();
        tiposAula.sort((a, b) => a.descricao.localeCompare(b.descricao)); // Ordena os tipos de aula
        
        const tipoAulaSelect = document.getElementById('id_tipo_aula');
        tipoAulaSelect.innerHTML = ''; // Limpa opções existentes

        // Adiciona a opção padrão "Selecionar Unidade Curricular"
        const defaultOption = document.createElement('option');
        defaultOption.value = ''; // Valor vazio
        defaultOption.textContent = 'Selecionar Unidade Curricular'; // Texto da opção
        defaultOption.disabled = true; // Sem opção de seleção
        defaultOption.selected = true; // Selecionado por padrão
        tipoAulaSelect.appendChild(defaultOption); 
        
        if (tiposAula.length === 0) {
            console.log('Nenhum tipo de aula encontrado');
            return; // Se não houver tipos de aula, retornar
        }

        tiposAula.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id_tipo_aula; // ID do tipo de aula
            option.textContent = tipo.descricao; // A descrição do tipo de aula
            tipoAulaSelect.appendChild(option); // Adiciona a opção ao select
        });
    } catch (error) {
        console.error('Erro ao carregar tipos de aula:', error);
    }
}

// Atualizar o evento para carregar salas e tipos de aula quando a unidade for mudada
document.getElementById('codigo_unidade').addEventListener('change', async (event) => {
    const codigoUnidade = event.target.value;
    console.log("Unidade selecionada:", codigoUnidade); // Verifica se a unidade é capturada corretamente
    if (codigoUnidade) {
        await carregarTiposAulaPorUnidade(codigoUnidade); // Carrega os tipos de aula da nova unidade
        await carregarSalasProfessoresPorUnidade(codigoUnidade); // Carrega as salas e professores da nova unidade
        await carregarProfessoresPorUnidade(codigoUnidade);
    }
});



// Carregar salas e professores por unidade
async function carregarSalasProfessoresPorUnidade(codigoUnidade) {
    try {
        const responseSalas = await fetch(`/listar-salas/${codigoUnidade}`); // Busca salas apenas para a unidade atual
        if (!responseSalas.ok) {
            throw new Error('Erro ao carregar salas'); // Lança erro se a requisição falhar
        }
        
        // Limpa o select de salas antes de preencher
        const salaSelect = document.getElementById('id_sala');
        salaSelect.innerHTML = ''; 

        // Adiciona a opção padrão "Selecionar Sala"
        const defaultOption = document.createElement('option');
        defaultOption.value = ''; // Valor vazio
        defaultOption.textContent = 'Selecionar Sala'; // Texto da opção
        defaultOption.disabled = true; // Sem opção de seleção
        defaultOption.selected = true; // Selecionado por padrão
        salaSelect.appendChild(defaultOption);    

        const salas = await responseSalas.json(); // Processa a resposta JSON
        
        // Ordenando as salas por nome
        salas.sort((a, b) => a.nome_sala.localeCompare(b.nome_sala)); // Ordena alfabética

        salas.forEach(sala => {
            const option = document.createElement('option');
            option.value = sala.id_sala; // Define o ID da sala como valor da opção
            option.textContent = sala.nome_sala; // Define o nome da sala como texto da opção
            salaSelect.appendChild(option); // Adiciona a opção ao select
        });

        // Carregar professores para a nova unidade
       // await carregarProfessoresPorUnidade(codigoUnidade); // Chama a função para carregar professores da unidade
    } catch (error) {
        console.error('Erro ao carregar salas e professores:', error); // Loga erro se houver
    }
}

// Carregar apenas a unidade do professor logado
async function carregarUnidadesDoProfessor() {
    try {
        const response = await fetch('/user-info'); // Pega as informações do usuário logado
        if (!response.ok) {
            throw new Error('Erro ao carregar unidade do professor');
        }
        const userInfo = await response.json();
        usuarioLogado = userInfo;

        let unidadesPorCodigo = {};
        try {
            const unidadesResponse = await fetch('/listar-unidades-publicas');
            if (unidadesResponse.ok) {
                const unidades = await unidadesResponse.json();
                unidadesPorCodigo = unidades.reduce((acc, unidade) => {
                    acc[unidade.codigo] = unidade.nome;
                    return acc;
                }, {});
            }
        } catch (erroUnidades) {
            console.warn('Não foi possível carregar nomes das unidades para exibição:', erroUnidades);
        }

        const unidadeSelect = document.getElementById('codigo_unidade');
        unidadeSelect.innerHTML = ''; // Limpa o select antes de preencher

        // Adicionando opções somente para as unidades associadas ao usuário logado
        if (userInfo.unidades && userInfo.unidades.length > 0) {
            userInfo.unidades.forEach(codigoUnidade => {
                const option = document.createElement('option');
                option.value = codigoUnidade;
                const nomeUnidade = unidadesPorCodigo[codigoUnidade];
                option.textContent = nomeUnidade ? `${codigoUnidade} - ${nomeUnidade}` : codigoUnidade;
                unidadeSelect.appendChild(option); 
            });
        } else {
            unidadeSelect.innerHTML = `<option disabled selected>Não há unidades associadas</option>`;
        }

        preencherSelectProfessorComUsuarioLogado();

        // Se houver pelo menos uma unidade, carrega os tipos de aula e salas
        if (userInfo.unidades.length > 0) {
            await carregarTiposAulaPorUnidade(userInfo.unidades[0]); // Carregando para a primeira unidade
            await carregarSalasProfessoresPorUnidade(userInfo.unidades[0]);
            await carregarProfessoresPorUnidade(userInfo.unidades[0]);
        }
    } catch (error) {
        console.error('Erro ao carregar unidade:', error);
    }
}
/*
// Carregar apenas a unidade do professor logado
async function carregarUnidadesDoProfessor() {
    try {
        const response = await fetch('/user-info'); // Pega as informações do usuário logado
        if (!response.ok) {
            throw new Error('Erro ao carregar unidade do professor');
        }
        const userInfo = await response.json();

        const unidadeSelect = document.getElementById('codigo_unidade');
        unidadeSelect.innerHTML = ''; // Limpa o select antes de preencher

        // Adiciona opções para cada unidade associada
        if (userInfo.unidades && userInfo.unidades.length > 0) {
            userInfo.unidades.forEach(codigoUnidade => {
                const option = document.createElement('option');
                option.value = codigoUnidade;
                option.textContent = codigoUnidade; // Ou algum texto descritivo da unidade
                unidadeSelect.appendChild(option); 
            });
        } else {
            unidadeSelect.innerHTML = `<option disabled selected>Não há unidades associadas</option>`;
        }

        // Se houver pelo menos uma unidade, carrega os tipos de aula
        if (userInfo.unidades.length > 0) {
            await carregarTiposAulaPorUnidade(userInfo.unidades[0]); // Carregando para a primeira unidade
            await carregarSalasProfessoresPorUnidade(userInfo.unidades[0]); // Chama também para carregar as salas
        }
    } catch (error) {
        console.error('Erro ao carregar unidade:', error);
    }
}

*/
/*
async function agendarSala(event) {
    event.preventDefault(); // Previne o envio do formulário

    const idSala = document.getElementById('id_sala').value; // Obtém o ID da sala selecionada
    const idProfessor = document.getElementById('id_professor').value; // Obtém o ID do professor selecionado
    const tipoAulaSelect = document.getElementById('id_tipo_aula'); // Obter a descrição do tipo de aula
    const tipoAulaDescricao = tipoAulaSelect.options[tipoAulaSelect.selectedIndex].textContent; 

    // Log para verificar os valores
    console.log('ID do professor selecionado:', idProfessor);
    
    // Validar se o idProfessor é válido
    if (!idProfessor || isNaN(idProfessor)) {
        alert('ID do professor é inválido.');
        return;
    }

    const datasSelecionadas = document.getElementById('data_selecionada').value.split(',').map(date => date.trim());
    const horaInicio = document.getElementById('hora_inicio').value; // Obtém a hora de início
    const horaFim = document.getElementById('hora_fim').value; // Obtém a hora de fim
    const motivo = document.getElementById('motivo').value; // Obtém o motivo

    const agora = new Date(); // Obtém a data atual
    const [horaInicioH, horaInicioM] = horaInicio.split(':').map(Number); // Divide a hora de início
    const [horaFimH, horaFimM] = horaFim.split(':').map(Number); // Divide a hora de fim

    // Verificações de data e hora
    for (const data of datasSelecionadas) {
        const [ano, mes, dia] = data.split('-').map(Number);
        const dataSelecionada = new Date(ano, mes - 1, dia, horaInicioH, horaInicioM); // Cria um novo objeto Date com a data e a hora

        if (dataSelecionada < agora) {
            alert(`A data ${data} e horário já passaram. Não é possível agendar.`);
            return; // Se a data já passou, não permite agendamento
        }

        // Validação do horário
        if (horaInicioH > horaFimH || (horaInicioH === horaFimH && horaInicioM >= horaFimM)) {
            alert('A hora de início deve ser anterior à hora de fim.');
            return; // Garantir que o horário início é anterior ao de fim
        }
    }

    const agendamentoData = {
        id_sala: idSala,
        id_professor: idProfessor,
        tipo_aula: tipoAulaDescricao, 
        data_reservas: datasSelecionadas, 
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        motivo // Armazena o motivo da reserva
    };

    console.log('Dados do agendamento:', agendamentoData); // Registra os dados do agendamento.

    // Requisição POST para agendar a sala
    try {
        const response = await fetch('/agendar-sala', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agendamentoData) // Envia os dados do agendamento
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro ao agendar sala:', errorText);
            alert(`${errorText}`);
            return; // Se houver erro, exiba uma mensagem
        }

        alert('Sala agendada com sucesso!'); // Confirmação de agendamento
        document.getElementById('agendamentoForm').reset(); // Reseta o formulário após o agendamento
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao agendar sala. Por favor, tente novamente.'); // Mensagem de erro genérica
    }
}
*/
async function agendarSala(event) {
    event.preventDefault(); // Previne o envio do formulário

    const idSala = document.getElementById('id_sala').value; // Obtém o ID da sala selecionada
    const idProfessor = document.getElementById('id_professor').value; // Obtém o ID do professor selecionado
    const tipoAulaSelect = document.getElementById('id_tipo_aula'); // Obter a descrição do tipo de aula
    const tipoAulaDescricao = tipoAulaSelect.options[tipoAulaSelect.selectedIndex].textContent; 

    // Valida se uma unidade curricular (tipo de aula) foi selecionada
    if (!tipoAulaSelect.value) {
        alert('Por favor, selecione uma unidade curricular antes de agendar.');
        return; // Interrompe o agendamento se a unidade não for selecionada
    }

    // Valida se uma sala foi selecionada
    if (!idSala) {
        alert('Por favor, selecione uma sala antes de agendar.');
        return; // Interrompe o agendamento se a sala não for selecionada
    }

    // Log para verificar os valores
    console.log('ID do professor selecionado:', idProfessor);
    
    // Validar se o idProfessor é válido
    if (!idProfessor || isNaN(idProfessor)) {
        alert('ID do professor é inválido.');
        return;
    }

    // Obtendo as datas selecionadas do campo atualizado
    const datasSelecionadas = document.getElementById('data_selecionada').value.split(',').map(date => date.trim());
    const horaInicio = document.getElementById('hora_inicio').value; // Obtém a hora de início
    const horaFim = document.getElementById('hora_fim').value; // Obtém a hora de fim
    const motivo = document.getElementById('motivo').value; // Obtém o motivo

    const agora = new Date(); // Obtém a data atual
    const [horaInicioH, horaInicioM] = horaInicio.split(':').map(Number); // Divide a hora de início
    const [horaFimH, horaFimM] = horaFim.split(':').map(Number); // Divide a hora de fim

    // Verificações de data e hora
    for (const data of datasSelecionadas) {
        // Converte a data no formato DD/MM/YYYY para ano/mês/dia
        const [dia, mes, ano] = data.split('/').map(Number); 
        const dataSelecionada = new Date(ano, mes - 1, dia, horaInicioH, horaInicioM); // Cria um novo objeto Date

        if (dataSelecionada < agora) {
            alert(`A data ${data} e horário já passaram. Não é possível agendar.`);
            return; // Se a data já passou, não permite agendamento
        }

        // Validação do horário
        if (horaInicioH > horaFimH || (horaInicioH === horaFimH && horaInicioM >= horaFimM)) {
            alert('A hora de início deve ser anterior à hora de fim.');
            return; // Garantir que o horário de início é anterior ao de fim
        }
    }

    // Converte datas para o formato YYYY-MM-DD para o banco de dados
    const datasParaBanco = datasSelecionadas.map(data => {
        const [dia, mes, ano] = data.split('/').map(Number); // Assume formato DD/MM/YYYY
        return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; // Formatação correta
    });

    const agendamentoData = {
        id_sala: idSala,
        id_professor: idProfessor,
        tipo_aula: tipoAulaDescricao, 
        data_reservas: datasParaBanco, // Passa as datas no formato correto para o banco
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        motivo // Armazena o motivo da reserva
    };

    console.log('Dados do agendamento:', agendamentoData); // Registra os dados do agendamento.

    // Requisição POST para agendar a sala
    try {
        const response = await fetch('/agendar-sala', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agendamentoData) // Envia os dados do agendamento
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro ao agendar sala:', errorText);
            alert(`${errorText}`);
            return; // Se houver erro, exiba uma mensagem
        }

        alert('Sala agendada com sucesso!'); // Confirmação de agendamento
        
        
       

        // Limpar os selects de sala e unidade curricular
        document.getElementById('id_sala').value = ''; // Limpa a sala selecionada
        document.getElementById('id_tipo_aula').value = ''; // ou tipoAulaSelect.value = '';
        document.getElementById('data_selecionada').value = ''; // Limpa as datas selecionadas
        
        // 1. Reseta o formulário geral
        document.getElementById('agendamentoForm').reset(); 

        // 2. FORÇA BRUTA: Garante que os selects voltem para a opção "Selecione..." (índice 0)
        // Isso impede que ele pule para "Biblioteca"
        const selectSala = document.getElementById('id_sala');
        const selectUc = document.getElementById('id_tipo_aula');
        const inputDatas = document.getElementById('data_selecionada');
        const contador = document.getElementById('contadorDias');

        if (selectSala) selectSala.selectedIndex = 0; 
        if (selectUc) selectUc.selectedIndex = 0;
        
        // 3. Limpa visualmente o campo de datas e remove o estilo de erro/sucesso se houver
        if (inputDatas) {
            inputDatas.value = "";
            inputDatas.placeholder = "Selecione as datas";
        }

        // 4. Se tiver o contador de dias na tela, limpa ele também
        if (contador) contador.innerHTML = "";

        // 5. Se estiver usando o layout novo (Dashboard), chama a função para esconder o formulário
        // (Verifique se a função existe antes de chamar para não dar erro)
        if (typeof esconderSessoesInterativas === "function") {
            esconderSessoesInterativas();
        }

    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao agendar sala. Por favor, tente novamente.'); 
    }
}



// Adicionar os eventos de mudança aos campos de data
document.getElementById('data_inicio').addEventListener('change', atualizarDatasSelecionadas);
document.getElementById('data_fim').addEventListener('change', atualizarDatasSelecionadas);
document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', atualizarDatasSelecionadas);
});

//novo codigo 25/08/2025 abaixo
// função que edita a data selecionada
/*
document.getElementById('editarDatasSelecionadas').addEventListener('click', () => {
    const inputDatas = document.getElementById('data_selecionada');
    inputDatas.disabled = false;
    inputDatas.style.backgroundColor = '#fff';
    inputDatas.style.color = '#000';
    inputDatas.style.cursor = 'pointer';

    
    const datasAtuais = inputDatas.value.split(',').map(data => {
        const [dia, mes, ano] = data.trim().split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    });

    flatpickr("#data_selecionada", {
        mode: "multiple",
        dateFormat: "Y-m-d",
        locale: "pt",
        defaultDate: datasAtuais,
        onClose: function(selectedDates) {
            const formataData = selectedDates.map(date => {
                const partes = date.toISOString().split('T')[0].split('-');
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            }).join(', ');
            inputDatas.value = formataData;
        }
    });
});
*/

// função que edita a data selecionada com verificação de campos obrigatórios
document.getElementById('editarDatasSelecionadas').addEventListener('click', () => {
    const inputDatas = document.getElementById('data_selecionada');
    const dataInicio = document.getElementById('data_inicio').value;
    const dataFim = document.getElementById('data_fim').value;
    const horaInicio = document.getElementById('hora_inicio').value;
    const horaFim = document.getElementById('hora_fim').value;

    // Verifica se os campos obrigatórios estão preenchidos
    if (!dataInicio || !dataFim || !horaInicio || !horaFim) {
        alert("Por favor, selecione a data de início, data de fim e os horários antes de editar as datas selecionadas.");
        return;
    }

    inputDatas.dataset.editando = 'true';
    inicializarFlatpickrDatas();

    if (instanciaFlatpickrDatas) {
        instanciaFlatpickrDatas.open();
    }
});


//finaliza edicao das datas selecionadas
document.getElementById('finalizarEdicaoDatas').addEventListener('click', () => {
    const inputDatas = document.getElementById('data_selecionada');
    inputDatas.dataset.editando = 'false';
    atualizarEstadoDatasSelecionadas(inputDatas.value);
    inicializarFlatpickrDatas();
});

//novo codigo 25/08/2025 acima

/*




// Função para atualizar o campo de "Datas Selecionadas"
function atualizarDatasSelecionadas() {
    const dataInicio = document.getElementById('data_inicio').value; // Obtém a data de início
    const dataFim = document.getElementById('data_fim').value; // Obtém a data de fim
    const diasSelecionados = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => parseInt(checkbox.value)); // Coleta os dias da semana selecionados

    // Verifica se as datas de início e fim estão preenchidas
    if (dataInicio && dataFim) {
        const datasReservas = obterDatasPorDiasDaSemana(dataInicio, dataFim, diasSelecionados); // Obtém as datas correspondentes
        
        // Formata as datas para 'DD/MM/YYYY'
        const datasFormatadas = datasReservas.map(data => {
            const partes = data.split('-');
            return `${partes[2]}/${partes[1]}/${partes[0]}`; // Formato DD/MM/YYYY
        });

        // Atualiza o campo de texto com as datas formatadas
        document.getElementById('data_selecionada').value = datasFormatadas.join(', '); // Preenche as datas selecionadas na entrada
    } else {
        document.getElementById('data_selecionada').value = ''; // Limpa se as datas não estiverem preenchidas
    }
}
*/
// Função para atualizar o campo de "Datas Selecionadas"

function atualizarDatasSelecionadas() {
    const dataInicio = document.getElementById('data_inicio').value;
    const dataFim = document.getElementById('data_fim').value;
    const diasSelecionados = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map((checkbox) => Number(checkbox.value));

    if (dataInicio && dataFim) {
        const datasReservas = AgendamentoUtils.gerarDatasRecorrentes({
            dataInicio,
            dataFim,
            diasSelecionados
        });

        const datasFormatadas = datasReservas.map((data) => AgendamentoUtils.formatarDataIsoParaBr(data));
        atualizarEstadoDatasSelecionadas(datasFormatadas.join(', '));
    } else {
        atualizarEstadoDatasSelecionadas('');
    }
}

function atualizarContagemDias(datasReservas, diasSelecionados) {
    const contadorDias = {};

    // Inicializa o contador para cada dia da semana selecionada.
    for (const dia of diasSelecionados) {
        contadorDias[dia] = 0; // Cria uma entrada para cada dia da semana que vai contar
    }

    console.log('Datas Reservadas:', datasReservas);
    console.log('Dias Selecionados:', diasSelecionados);

    // Contagem das datas geradas
    datasReservas.forEach(data => {
        const date = new Date(data); // Converte para um objeto Date
        const diaDaSemana = date.getDay(); // 0 = Domingo, 1 = Segunda, ...

        // Aplicar o novo mapeamento dos dias:
        const diaMapeado = (diaDaSemana + 1); // Aqui o mapeamento correto de 0 a 6 vai para 1 a 7

        console.log(`Data: ${data}, Dia da Semana Calculado: ${diaMapeado}`);

        // Verifica se o dia mapeado está entre os dias selecionados
        if (diasSelecionados.includes(diaMapeado)) {
            contadorDias[diaMapeado]++; // Incrementa o contador para aquele dia
            console.log(`Contador Atual para ${diaMapeado}: ${contadorDias[diaMapeado]}`);
        }
    });

    // Preparar a string para resultado
    let resultado = [];
    for (let dia in contadorDias) {
        if (contadorDias[dia] > 0) {
            const nomeDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dia - 1]; // Ajustar índice
            resultado.push(`${contadorDias[dia]} ${nomeDia}${contadorDias[dia] > 1 ? 's' : ''}`); // Singular ou plural
        }
    }

    // Atualiza a contagem no parágrafo
    document.getElementById('contadorDias').innerHTML = resultado.join(', ') || 'Nenhum dia da semana selecionado.';
}




function obterDiasMapeados(dia) {
    return dia === 0 ? 1 : dia + 1; // Se for Domingo (0), retorna 1, caso contrário, soma 1
}
const { DateTime } = luxon; // Certifique-se de que luxon está carregado

function obterDatasPorDiasDaSemana(dataInicio, dataFim, diasSelecionados) {
    return AgendamentoUtils.gerarDatasRecorrentes({
        dataInicio,
        dataFim,
        diasSelecionados
    });
}



/*
// Função para obter datas com base em dias da semana e intervalo
function obterDatasPorDiasDaSemana(dataInicio, dataFim, diasSelecionados) {
    const datasReservas = [];
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    
    // Zera as horas, minutos, segundos e milissegundos
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    // Começar a partir da data de início
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        const diaDaSemana = d.getDay(); // Obtém o dia da semana da data atual
        // Se o dia da semana está incluído e a data atual é igual ou superior à data de início
        if (diasSelecionados.includes(diaDaSemana)) {
            datasReservas.push(d.toISOString().split('T')[0]); // Adiciona a data ao array
        }
    }

    return datasReservas; // Retorna todas as datas que correspondem
}
//codigo antigo */
/*  // ESTE CODIGO ABAIXO FUNCIONA
function obterDatasPorDiasDaSemana(dataInicio, dataFim, diasSelecionados) {
    const datasReservas = [];
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    
    // Zerando horas, minutos, segundos e milissegundos
    inicio.setHours(0, 0, 0, 0);
    fim.setHours(0, 0, 0, 0);

    // Iniciando a partir da data de início
    for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
        const diaDaSemana = d.getDay(); // Obtém o dia da semana

        // Verifica se o dia da semana está selecionado e se a data é igual ou maior que data de início
        if (diasSelecionados.includes(diaDaSemana)) {
            // Se a data está dentro do intervalo e maior ou igual à data de início
            if (d >= inicio) {
                datasReservas.push(d.toISOString().split('T')[0]); // Adiciona a data ao array
            }
        }
    }

    // Remove as datas que são anteriores a data de início
    return datasReservas.filter(data => new Date(data) >= inicio);
}
*/

function obterDatasParaPayload() {
    const dadosTexto = document.getElementById('data_selecionada').value;
    const datasSelecionadas = converterTextoDatasParaArray(dadosTexto);
    if (datasSelecionadas.length) {
        return datasSelecionadas;
    }

    const dataInicio = document.getElementById('data_inicio').value;
    const dataFim = document.getElementById('data_fim').value;
    const diasSelecionados = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map((checkbox) => Number(checkbox.value))
        .filter((valor) => Number.isInteger(valor));

    if (dataInicio && dataFim) {
        return AgendamentoUtils.gerarDatasRecorrentes({
            dataInicio,
            dataFim,
            diasSelecionados
        });
    }

    return [];
}

function montarPayloadAgendamento() {
    const idSala = document.getElementById('id_sala').value;
    const idProfessor = document.getElementById('id_professor').value;
    const tipoAulaSelect = document.getElementById('id_tipo_aula');
    const tipoAulaDescricao = tipoAulaSelect?.options[tipoAulaSelect.selectedIndex]?.textContent?.trim() || 'Não informado';

    const datasParaBanco = obterDatasParaPayload();
    const horaInicio = formatarHora(document.getElementById('hora_inicio').value);
    const horaFim = formatarHora(document.getElementById('hora_fim').value);
    const motivo = document.getElementById('motivo').value.trim() || 'Não informado';

    return {
        id_sala: idSala,
        id_professor: idProfessor,
        tipo_aula: tipoAulaDescricao,
        data_reservas: datasParaBanco.filter(Boolean),
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        motivo
    };
}

function validarCamposParaVerificarConflitos() {
    const payload = montarPayloadAgendamento();
    const erros = [];

    if (!payload.id_sala) {
        erros.push('Selecione a sala.');
    }
    if (!payload.data_reservas.length) {
        erros.push('Selecione ao menos uma data.');
    }
    if (!document.getElementById('hora_inicio').value || !document.getElementById('hora_fim').value) {
        erros.push('Informe o horário de início e fim.');
    }

    if (payload.hora_inicio && payload.hora_fim && payload.hora_inicio >= payload.hora_fim) {
        erros.push('A hora de início deve ser anterior à hora de fim.');
    }

    return { valido: erros.length === 0, erros };
}

function validarCamposObrigatorios() {
    const payload = montarPayloadAgendamento();
    const validacaoConflitos = validarCamposParaVerificarConflitos();
    const erros = [...validacaoConflitos.erros];

    if (!document.getElementById('codigo_unidade').value) {
        erros.push('Selecione a unidade.');
    }
    if (!payload.id_professor) {
        erros.push('Selecione o professor.');
    }
    if (!document.getElementById('id_tipo_aula').value) {
        erros.push('Selecione a unidade curricular.');
    }
    if (!payload.motivo || payload.motivo === 'Não informado') {
        erros.push('Informe o motivo/turma.');
    }

    if (payload.data_reservas.length && payload.hora_inicio) {
        const partesAgora = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(new Date()).reduce((partes, parte) => {
            partes[parte.type] = parte.value;
            return partes;
        }, {});
        const dataHoje = `${partesAgora.year}-${partesAgora.month}-${partesAgora.day}`;
        const horarioAgora = `${partesAgora.hour}:${partesAgora.minute}:${partesAgora.second}`;
        const possuiHorarioPassado = payload.data_reservas.some((data) => (
            data < dataHoje || (data === dataHoje && payload.hora_inicio <= horarioAgora)
        ));

        if (possuiHorarioPassado) {
            erros.push('Não é permitido agendar em datas ou horários que já passaram.');
        }
    }

    return { valido: erros.length === 0, erros };
}

function limparFormularioAgendamento() {
    const form = document.getElementById('agendamentoForm');
    if (form) {
        form.reset();
    }

    const inputDatas = document.getElementById('data_selecionada');
    if (inputDatas) {
        inputDatas.value = '';
        inputDatas.dataset.editando = 'false';
        inputDatas.readOnly = true;
        inputDatas.style.backgroundColor = '#f0f0f0';
        inputDatas.style.color = '#666';
        inputDatas.style.cursor = 'not-allowed';
    }

    const contador = document.getElementById('contadorDias');
    if (contador) {
        contador.innerHTML = '';
    }

    const resultadoVerificacao = document.getElementById('resultadoVerificacao');
    if (resultadoVerificacao) {
        resultadoVerificacao.innerHTML = '';
    }

    const resultadoSalasDisponiveis = document.getElementById('resultadoSalasDisponiveis');
    if (resultadoSalasDisponiveis) {
        resultadoSalasDisponiveis.innerHTML = '';
    }

    const selectTurno = document.getElementById('select_turno');
    if (selectTurno) {
        selectTurno.value = '';
    }

    const selectSala = document.getElementById('id_sala');
    if (selectSala) {
        selectSala.value = '';
        const optionPlaceholder = Array.from(selectSala.options).find((option) => option.value === '');
        if (optionPlaceholder) {
            optionPlaceholder.selected = true;
        }
    }

    const selectTipoAula = document.getElementById('id_tipo_aula');
    if (selectTipoAula) {
        selectTipoAula.value = '';
        const optionPlaceholder = Array.from(selectTipoAula.options).find((option) => option.value === '');
        if (optionPlaceholder) {
            optionPlaceholder.selected = true;
        }
    }

    document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
    });

    datasSelecionadasEmMemoria = [];

    if (instanciaFlatpickrDatas) {
        instanciaFlatpickrDatas.destroy();
        instanciaFlatpickrDatas = null;
    }

    if (inputDatas) {
        inicializarFlatpickrDatas();
    }
}

function limparHorarioExibicao(valor) {
    return String(valor || '').slice(0, 5);
}

function resultadoPossuiResumo(resultado) {
    return Array.isArray(resultado?.datasDisponiveis)
        || Array.isArray(resultado?.conflitosSala)
        || Array.isArray(resultado?.conflitos)
        || Array.isArray(resultado?.avisosProfessor);
}

function formatarQuantidadeAgendamentos(quantidade) {
    return quantidade === 1
        ? '1 agendamento'
        : `os ${quantidade} agendamentos`;
}

function abrirModalConfirmacaoProfessor() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '18px';
        overlay.style.background = 'rgba(15, 23, 42, 0.55)';

        const modal = document.createElement('div');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.style.width = 'min(480px, 100%)';
        modal.style.background = '#ffffff';
        modal.style.borderRadius = '14px';
        modal.style.boxShadow = '0 24px 60px rgba(15, 23, 42, 0.28)';
        modal.style.padding = '24px';
        modal.style.color = '#1f2937';
        modal.style.border = '1px solid rgba(148, 163, 184, 0.35)';

        const titulo = document.createElement('h4');
        titulo.textContent = 'Professor com sala no mesmo horário';
        titulo.style.margin = '0 0 10px';
        titulo.style.fontSize = '20px';
        titulo.style.fontWeight = '700';
        modal.appendChild(titulo);

        const mensagem = document.createElement('p');
        mensagem.textContent = 'Este professor já possui sala agendada em uma ou mais datas selecionadas. Deseja confirmar mesmo assim?';
        mensagem.style.margin = '0';
        mensagem.style.lineHeight = '1.5';
        mensagem.style.fontSize = '15px';
        modal.appendChild(mensagem);

        const botoes = document.createElement('div');
        botoes.style.display = 'flex';
        botoes.style.justifyContent = 'flex-end';
        botoes.style.gap = '10px';
        botoes.style.marginTop = '22px';

        const botaoCancelar = document.createElement('button');
        botaoCancelar.type = 'button';
        botaoCancelar.className = 'btn btn-secondary';
        botaoCancelar.textContent = 'Voltar e revisar';

        const botaoConfirmar = document.createElement('button');
        botaoConfirmar.type = 'button';
        botaoConfirmar.className = 'btn btn-primary';
        botaoConfirmar.textContent = 'Sim, confirmar';

        function fechar(confirmado) {
            document.removeEventListener('keydown', aoPressionarTecla);
            overlay.remove();
            resolve(confirmado);
        }

        function aoPressionarTecla(event) {
            if (event.key === 'Escape') {
                fechar(false);
            }
        }

        botaoCancelar.addEventListener('click', () => fechar(false));
        botaoConfirmar.addEventListener('click', () => fechar(true));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                fechar(false);
            }
        });
        document.addEventListener('keydown', aoPressionarTecla);

        botoes.appendChild(botaoCancelar);
        botoes.appendChild(botaoConfirmar);
        modal.appendChild(botoes);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        botaoConfirmar.focus();
    });
}

function exibirResumoVerificacao(resultado) {
    const resultadoDiv = document.getElementById('resultadoVerificacao');
    if (!resultadoDiv) return;

    resultadoDiv.innerHTML = '';
    const total = resultado?.totalSolicitadas || 0;
    const disponiveis = resultado?.datasDisponiveis || [];
    const conflitos = resultado?.conflitosSala || resultado?.conflitos || [];
    const avisosProfessor = resultado?.avisosProfessor || [];

    const card = document.createElement('div');
    card.style.border = '1px solid #d7d7d7';
    card.style.borderRadius = '8px';
    card.style.padding = '14px';
    card.style.backgroundColor = '#f9f9f9';
    card.style.marginTop = '8px';

    const titulo = document.createElement('h4');
    titulo.style.marginBottom = '8px';
    titulo.textContent = conflitos.length > 0
        ? 'Conflitos encontrados'
        : avisosProfessor.length > 0
            ? 'Atenção ao professor'
            : 'Tudo OK para agendar';
    card.appendChild(titulo);

    const mensagem = document.createElement('p');
    mensagem.style.margin = '4px 0';
    if (conflitos.length > 0 && avisosProfessor.length > 0) {
        mensagem.innerHTML = '<strong>Há conflitos para parte das datas e avisos sobre o professor.</strong> As datas bloqueadas pela sala não serão agendadas; confira os avisos antes de continuar.';
    } else if (conflitos.length > 0) {
        mensagem.innerHTML = '<strong>Há conflitos para parte das datas.</strong> Você pode agendar somente as datas disponíveis.';
    } else if (avisosProfessor.length > 0) {
        mensagem.innerHTML = '<strong>Atenção:</strong> este professor já possui uma ou mais salas reservadas em algumas das datas selecionadas. Confira a lista antes de continuar.';
    } else {
        mensagem.textContent = 'Não foram encontrados conflitos para as datas selecionadas.';
    }
    card.appendChild(mensagem);

    const resumo = document.createElement('div');
    resumo.innerHTML = `
        <p style="margin:4px 0"><strong>${total}</strong> datas solicitadas</p>
        <p style="margin:4px 0"><strong>${disponiveis.length}</strong> datas disponíveis</p>
        <p style="margin:4px 0"><strong>${conflitos.length}</strong> datas ocupadas</p>
        ${avisosProfessor.length ? `<p style="margin:4px 0"><strong>${avisosProfessor.length}</strong> datas com aviso de professor</p>` : ''}
    `;
    card.appendChild(resumo);

    if (conflitos.length > 0) {
        const conflitosTitulo = document.createElement('h5');
        conflitosTitulo.style.marginTop = '10px';
        conflitosTitulo.textContent = 'Datas bloqueadas porque a sala já está ocupada';
        card.appendChild(conflitosTitulo);

        const lista = document.createElement('ul');
        lista.style.marginTop = '6px';
        lista.style.paddingLeft = '18px';

        const selectSala = document.getElementById('id_sala');
        const nomeSalaSelecionada = selectSala && selectSala.value
            ? (selectSala.options[selectSala.selectedIndex]?.textContent || '').trim()
            : '';

        conflitos.forEach((item) => {
            const dataFormatada = AgendamentoUtils.formatarDataIsoParaBr(item.data);
            const detalhes = item?.detalhes || {};
            const nomeSala = detalhes.nomeSala || nomeSalaSelecionada;
            const salaLabel = nomeSala ? ` — sala ${nomeSala}` : '';
            const professor = detalhes.nomeProfessor ? ` — ocupada por ${detalhes.nomeProfessor}` : '';
            const horario = detalhes.horaInicio && detalhes.horaFim ? ` (${detalhes.horaInicio} às ${detalhes.horaFim})` : '';
            const itemEl = document.createElement('li');
            itemEl.textContent = `${dataFormatada}${salaLabel}${professor}${horario} — ${item.motivo}`;
            lista.appendChild(itemEl);
        });
        card.appendChild(lista);
    }

    if (avisosProfessor.length > 0) {
        const avisoSection = document.createElement('div');
        avisoSection.style.marginTop = '10px';

        const avisoTitulo = document.createElement('h5');
        avisoTitulo.textContent = 'Salas que este professor já tem reservadas';
        avisoSection.appendChild(avisoTitulo);

        const avisoLista = document.createElement('ul');
        avisoLista.style.marginTop = '6px';
        avisoLista.style.paddingLeft = '18px';

        avisosProfessor.forEach((item) => {
            const dataFormatada = AgendamentoUtils.formatarDataIsoParaBr(item.data);

            const itemEl = document.createElement('li');
            const dataEl = document.createElement('strong');
            dataEl.textContent = dataFormatada;
            itemEl.appendChild(dataEl);

            const novaSalaEl = document.createElement('div');
            novaSalaEl.textContent = `Nova solicitação: ${item.novaSala || 'Sala selecionada'}`;
            itemEl.appendChild(novaSalaEl);

            const reservasTitulo = document.createElement('div');
            reservasTitulo.textContent = 'O professor já possui nesta data:';
            reservasTitulo.style.marginTop = '4px';
            reservasTitulo.style.fontWeight = '600';
            itemEl.appendChild(reservasTitulo);

            const reservasLista = document.createElement('ul');
            reservasLista.style.marginTop = '4px';
            reservasLista.style.paddingLeft = '18px';

            (item.reservasExistentes || []).forEach((reserva) => {
                const reservaEl = document.createElement('li');
                const nomeSala = reserva.nome_sala || 'Sala reservada';
                const inicio = limparHorarioExibicao(reserva.hora_inicio);
                const fim = limparHorarioExibicao(reserva.hora_fim);
                reservaEl.textContent = inicio && fim
                    ? `Sala já reservada: ${nomeSala} - ${inicio} às ${fim}`
                    : `Sala já reservada: ${nomeSala}`;
                reservasLista.appendChild(reservaEl);
            });

            itemEl.appendChild(reservasLista);
            avisoLista.appendChild(itemEl);
        });

        avisoSection.appendChild(avisoLista);
        card.appendChild(avisoSection);
    }

    const botoes = document.createElement('div');
    botoes.style.marginTop = '12px';

    if (disponiveis.length > 0) {
        const botaoConfirmar = document.createElement('button');
        botaoConfirmar.type = 'button';
        botaoConfirmar.className = 'btn btn-success';
        botaoConfirmar.textContent = avisosProfessor.length > 0
            ? `Sim, estou ciente e desejo agendar ${formatarQuantidadeAgendamentos(disponiveis.length)}`
            : conflitos.length > 0
                ? `Agendar somente as ${disponiveis.length} datas disponíveis`
                : `Confirmar ${formatarQuantidadeAgendamentos(total)}`;

        botaoConfirmar.addEventListener('click', async () => {
            if (!ultimoPayloadConfirmacao) {
                return;
            }

            const validacao = validarCamposObrigatorios();
            if (!validacao.valido) {
                alert(validacao.erros.join('\n'));
                return;
            }

            const payload = {
                ...montarPayloadAgendamento(),
                data_reservas: disponiveis,
                confirmarAgendamento: true,
                usarSomenteDisponiveis: true
            };

            if (avisosProfessor.length > 0) {
                const confirmouAvisoProfessor = await abrirModalConfirmacaoProfessor();
                if (!confirmouAvisoProfessor) {
                    return;
                }

                payload.aceitarAvisosProfessor = true;
                payload.avisoProfessorToken = resultado?.avisoProfessorToken || '';
            }

            await confirmarAgendamentos(payload);
        });
        botoes.appendChild(botaoConfirmar);
    }

    const botaoVoltar = document.createElement('button');
    botaoVoltar.type = 'button';
    botaoVoltar.className = 'btn btn-secondary';
    botaoVoltar.style.marginLeft = '8px';
    botaoVoltar.textContent = 'Não, voltar e revisar';
    botaoVoltar.addEventListener('click', () => {
        resultadoDiv.innerHTML = '';
        ultimoResumoVerificacao = null;
        ultimoPayloadConfirmacao = null;
    });
    botoes.appendChild(botaoVoltar);

    card.appendChild(botoes);
    resultadoDiv.appendChild(card);
    resultadoDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function verificarDisponibilidadeAgendamentos(payload) {
    const resultadoDiv = document.getElementById('resultadoVerificacao');
    if (!resultadoDiv) return;

    try {
        const response = await fetch('/agendar-sala/verificar-disponibilidade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await response.json();
        if (!response.ok) {
            throw new Error(resultado?.message || 'Erro na verificação de disponibilidade.');
        }

        ultimoResumoVerificacao = resultado;
        ultimoPayloadConfirmacao = payload;
        exibirResumoVerificacao(resultado);
    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        if (resultadoDiv) {
            resultadoDiv.innerHTML = `<p>${error.message}</p>`;
        }
    }
}

async function confirmarAgendamentos(payload) {
    try {
        const response = await fetch('/agendar-sala', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resultado = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (resultadoPossuiResumo(resultado)) {
                ultimoResumoVerificacao = resultado;
                ultimoPayloadConfirmacao = payload;
                exibirResumoVerificacao(resultado);
                return;
            }
            throw new Error(resultado?.message || 'Erro ao criar agendamentos.');
        }

        alert(resultado?.message || 'Agendamentos criados com sucesso!');
        limparFormularioAgendamento();
        ultimoResumoVerificacao = null;
        ultimoPayloadConfirmacao = null;
    } catch (error) {
        console.error('Erro ao confirmar agendamentos:', error);
        const resultadoDiv = document.getElementById('resultadoVerificacao');
        if (resultadoDiv) {
            resultadoDiv.innerHTML = `<p>${error.message}</p>`;
        }
    }
}

// Função para verificar agendamentos existentes
async function verificarAgendamentosExistentes(agendamentoData) {
    return verificarDisponibilidadeAgendamentos(agendamentoData);
}

// Adiciona o evento de submit ao formulário
document.getElementById('agendamentoForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const validacao = validarCamposObrigatorios();
    if (!validacao.valido) {
        alert(validacao.erros.join('\n'));
        return;
    }

    const payload = montarPayloadAgendamento();
    await verificarDisponibilidadeAgendamentos(payload);
});

// Inicializa o carregamento das unidades
carregarUnidadesDoProfessor(); // Chama a função para carregar apenas a unidade do professor logado

// Verificar conflitos ao clicar
document.getElementById('verificarAgendamentos').addEventListener('click', async () => {
    const validacao = validarCamposParaVerificarConflitos();
    if (!validacao.valido) {
        alert(validacao.erros.join('\n'));
        return;
    }

    const payload = montarPayloadAgendamento();
    await verificarDisponibilidadeAgendamentos(payload);
});
// Verificar salas disponíveis
document.getElementById('verificarSalas').addEventListener('click', async () => {
    // Coleta as datas do campo "Datas Selecionadas"
    const datasSelecionadas = document.getElementById('data_selecionada').value.split(',').map(date => date.trim());
    const horaInicio = document.getElementById('hora_inicio').value;
    const horaFim = document.getElementById('hora_fim').value;
    const codigoUnidade = document.getElementById('codigo_unidade').value; 

    // Validar entradas antes da requisição
    if (!datasSelecionadas.length || !horaInicio || !horaFim || !codigoUnidade) {
        alert('Por favor, preencha as datas, horas e selecione a unidade.');
        return;
    }

    // Converte as datas para o formato YYYY-MM-DD
    const datasParaBanco = datasSelecionadas.map(data => {
        const [dia, mes, ano] = data.split('/').map(Number); // Divide o formato DD/MM/YYYY
        return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; // Formato YYYY-MM-DD
    });

    // Fazer requisição para verificar salas disponíveis
    const resposta = await fetch(`/salas-disponiveis?data=${datasParaBanco.join(',')}&hora_inicio=${horaInicio}&hora_fim=${horaFim}&codigo_unidade=${codigoUnidade}`);

    if (!resposta.ok) {
        const errorText = await resposta.text();
        console.error(`Erro ao buscar salas: ${errorText}`);
        alert(`Erro: ${resposta.status} - ${errorText}`);
        return;
    }

    const resultado = await resposta.json();

    // Limpando os resultados anteriores
    const resultadoDiv = document.getElementById('resultadoSalasDisponiveis');
    resultadoDiv.innerHTML = '';

    // Exibir salas disponíveis
    if (resultado.salasDisponiveis && resultado.salasDisponiveis.length > 0) {
        resultadoDiv.innerHTML = `<h3>Salas Disponíveis:</h3><br><h4>Ao clicar em alguma sala disponível, os dados acima serão substituídos</h4><ul>`;
        resultado.salasDisponiveis.forEach(sala => {
            // Aqui vamos garantir que as datas foram corretamente formatadas
            const datasFormatadas = sala.datas_disponiveis.map(data => formatarData(data)); // Formata as datas para exibição

            // Adiciona a opção de sala com dados para o clique
            resultadoDiv.innerHTML += `<li class="sala-item" data-id="${sala.id_sala}" data-datas="${datasFormatadas.join(', ')}">
                ${sala.nome_sala} - disponível nas datas:
                <span class="datas">${datasFormatadas.join(', ')}</span>
            </li>`;
        });
        resultadoDiv.innerHTML += `</ul>`;
    } else {
        resultadoDiv.innerHTML = '<p>Não há salas disponíveis para as datas e horários selecionados.</p>';
    }

    // Adicionar evento de clique para as salas disponíveis
    const salaItems = document.querySelectorAll('.sala-item');

    salaItems.forEach(item => {
        item.addEventListener('click', () => {
            const idSala = item.getAttribute('data-id'); // Obtém o ID da sala clicada
            const datas = item.getAttribute('data-datas'); // Obtém as datas disponíveis

            document.getElementById('id_sala').value = idSala; // Preenche o campo da sala
            document.getElementById('data_selecionada').value = datas; // Preenche o campo das datas selecionadas
        });
    });
});

// Função para formatar a data de YYYY-MM-DD para DD/MM/YYYY
function formatarData(data) {
    const partes = data.split('-'); // Divide a string em partes
    return `${partes[2]}/${partes[1]}/${partes[0]}`; // Retorna o formato DD/MM/YYYY
}


// Função para formatar a data de YYYY-MM-DD para DD/MM/YYYY
function formatarData(data) {
    const partes = data.split('-'); // Divide a string em partes
    return `${partes[2]}/${partes[1]}/${partes[0]}`; // Retorna o formato DD/MM/YYYY
}



// Função para formatar a data de YYYY-MM-DD para DD-MM-YYYY
function formatarData(data) {
    const partes = data.split('-'); // Divide a string em partes
    return `${partes[2]}/${partes[1]}/${partes[0]}`; // Retorna o formato DD-MM-YYYY
}


// Função para ordenar datas
function ordenarDatas(datas) {
    return datas.sort((a, b) => new Date(a) - new Date(b));
}
function formatarHora(hora) {
    if (!hora) {
        return '';
    }

    const [h = '00', m = '00'] = String(hora).split(':');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function podeExcluirAgendamento(dataReservas) {
    const data = new Date(`${dataReservas}T00:00:00`);
    if (Number.isNaN(data.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return data >= hoje;
}



// Função para validar se a hora está no formato correto
function isValidTime(time) {
    const timePattern = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/; 
    return timePattern.test(time);
}




// Função para excluir um agendamento
async function excluirAgendamento(id, elemento) {
    console.log('ID do Agendamento:', id);
    console.log('Elemento:', elemento); // Verifica qual elemento está sendo passado

    // Confirmação antes da exclusão
    const confirmar = confirm('Tem certeza que deseja excluir este agendamento?');
    if (!confirmar) {
        return; // Se o usuário negar, apenas retorna
    }

    try {
        const response = await fetch(`/excluir-agendamento/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Agendamento excluído com sucesso!'); // Alerta de confirmação
            await carregarAgendamentos();
        } else {
            const errorText = await response.text();
            alert(errorText || 'Erro ao excluir agendamento.');
        }
    } catch (error) {
        console.error('Erro ao excluir agendamento:', error);
        alert('Erro ao excluir agendamento. Tente novamente.'); // Mensagem de erro
    }
}

function obterAgendamentosFiltrados(agendamentos) {
    const salaFiltro = document.getElementById('filtroSala').value.toLowerCase();
    const dataInicioFiltro = document.getElementById('filtroDataInicio').value;
    const dataFimFiltro = document.getElementById('filtroDataFim').value;
    const turnoFiltro = document.getElementById('filtroTurno').value;
    const diaSemanaFiltro = document.getElementById('filtroDiaSemana').value;

    return agendamentos.filter(agendamento => {
        const salaAgendamento = agendamento.nome_sala.toLowerCase();
        const dataAgendamento = new Date(`${agendamento.data_reservas}T00:00:00Z`);
        const diaDaSemanaAgendamento = dataAgendamento.getUTCDay();
        const dataInicioUTC = dataInicioFiltro ? new Date(`${dataInicioFiltro}T00:00:00Z`) : null;
        const dataFimUTC = dataFimFiltro ? new Date(`${dataFimFiltro}T00:00:00Z`) : null;

        const correspondeSala = salaFiltro ? salaAgendamento.includes(salaFiltro) : true;
        const correspondeDataInicio = dataInicioUTC ? dataAgendamento >= dataInicioUTC : true;
        const correspondeDataFim = dataFimUTC ? dataAgendamento <= dataFimUTC : true;

        let correspondeTurno = true;
        if (turnoFiltro) {
            switch (turnoFiltro) {
                case 'manha':
                    correspondeTurno = agendamento.hora_inicio >= '06:00' && agendamento.hora_fim <= '12:59';
                    break;
                case 'tarde':
                    correspondeTurno = agendamento.hora_inicio >= '13:00' && agendamento.hora_fim <= '17:59';
                    break;
                case 'noite':
                    correspondeTurno = agendamento.hora_inicio >= '18:00';
                    break;
            }
        }

        const correspondeDiaSemana = diaSemanaFiltro ? diaDaSemanaAgendamento.toString() === diaSemanaFiltro : true;

        return correspondeSala && correspondeDataInicio && correspondeDataFim && correspondeTurno && correspondeDiaSemana;
    });
}

// Função para carregar e exibir agendamentos
async function carregarAgendamentos() {
    const response = await fetch('/listar-agendamentos-professor-logado', { cache: 'no-store' });
    
    // Verifique se a resposta é OK
    if (!response.ok) {
        const errorText = await response.text();
        alert('Erro ao carregar agendamentos: ' + errorText);
        return;
    }

    const agendamentos = await response.json();
    agendamentosAtual = obterAgendamentosFiltrados(agendamentos);

    // Ordena os agendamentos por data e hora.
    agendamentosAtual.sort((a, b) => {
        const dataA = new Date(a.data_reservas + 'T' + a.hora_inicio); // Combina data e hora
        const dataB = new Date(b.data_reservas + 'T' + b.hora_inicio);
        return dataA - dataB; // Ordena de forma crescente
    });

    paginaAtual = 0; // Reseta a página atual
    exibirAgendamentos(); // Chama a função para mostrar os agendamentos
}


// Altere o filtro para incluir ordenação

// Evento ao clicar no botão "Aplicar Filtros"
document.getElementById('aplicarFiltros').addEventListener('click', async () => {
    await carregarAgendamentos();
});

/*
// Evento ao clicar no botão "Aplicar Filtros"
document.getElementById('aplicarFiltros').addEventListener('click', async () => {
    const salaFiltro = document.getElementById('filtroSala').value.toLowerCase();
    const dataInicioFiltro = document.getElementById('filtroDataInicio').value; 
    const dataFimFiltro = document.getElementById('filtroDataFim').value; 
    const turnoFiltro = document.getElementById('filtroTurno').value; 
    const diaSemanaFiltro = document.getElementById('filtroDiaSemana').value;

    const response = await fetch('/listar-agendamentos-professor-logado', { cache: 'no-store' });
    if (!response.ok) {
        const errorText = await response.text();
        alert('Erro ao carregar agendamentos: ' + errorText);
        return;
    }

    const agendamentos = await response.json();
    const agendamentosList = document.getElementById('agendamentosExistentes');
    agendamentosList.innerHTML = ''; // Limpa a lista anterior

    const agendamentosFiltrados = agendamentos.filter(agendamento => {
        const salaAgendamento = agendamento.nome_sala.toLowerCase();
        const dataAgendamento = new Date(agendamento.data_reservas).toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const diaDaSemanaAgendamento = new Date(agendamento.data_reservas).getDay(); // 0=Domingo, 1=Segunda, ...

        const correspondeSala = salaFiltro ? salaAgendamento.includes(salaFiltro) : true;
        const correspondeDataInicio = dataInicioFiltro ? dataAgendamento >= dataInicioFiltro : true;
        const correspondeDataFim = dataFimFiltro ? dataAgendamento <= dataFimFiltro : true;

        // Lógica para verificar se o agendamento se encaixa no turno selecionado
        let correspondeTurno = true;
        if (turnoFiltro) {
            if (turnoFiltro === 'manha') {
                correspondeTurno = agendamento.hora_inicio >= '06:00' && agendamento.hora_fim <= '13:14';
            } else if (turnoFiltro === 'tarde') {
                correspondeTurno = agendamento.hora_inicio >= '13:15' && agendamento.hora_fim <= '17:15';
            } else if (turnoFiltro === 'noite') {
                correspondeTurno = agendamento.hora_inicio >= '17:15' && agendamento.hora_fim <= '23:59';
            }
        }

        // Verificação para o dia da semana
        const correspondeDiaSemana = diaSemanaFiltro ? diaDaSemanaAgendamento.toString() === diaSemanaFiltro : true;

        return correspondeSala && correspondeDataInicio && correspondeDataFim && correspondeTurno && correspondeDiaSemana;
    });

    // Exibir os agendamentos filtrados
    if (agendamentosFiltrados.length === 0) {
        agendamentosList.textContent = 'Nenhum agendamento encontrado com os filtros aplicados.';
    } else {
        agendamentosFiltrados.forEach(agendamento => {
            const agendamentoItem = document.createElement('div');
            agendamentoItem.className = 'agendamento-item'; // Adiciona uma classe para fácil seleção
            agendamentoItem.innerHTML = `
                <p><strong>Sala:</strong> ${agendamento.nome_sala}</p>
                <p><strong>Data:</strong> ${formatarData(agendamento.data_reservas)}</p>
                <p><strong>Início:</strong> ${formatarHora(agendamento.hora_inicio)}</p>
                <p><strong>Fim:</strong> ${formatarHora(agendamento.hora_fim)}</p>
                <p><strong>Motivo:</strong> ${agendamento.motivo || 'Nenhum motivo fornecido'}</p>
                <button onclick="excluirAgendamento(${agendamento.id_agendamento}, this.closest('.agendamento-item'))">Excluir</button>
                <hr>
            `;
            agendamentosList.appendChild(agendamentoItem);
        });
    }

    // Armazena os agendamentos filtrados
    agendamentosAtual = agendamentosFiltrados; 
    paginaAtual = 0; 
    exibirAgendamentos(); 
});

*/

flatpickr("#filtroData", {
    mode: "multiple", // Permite a seleção de várias datas
    dateFormat: "Y-m-d", // Formato de entrada
    locale: "pt", // Definindo o idioma
    onClose: function(selectedDates) {
        const formataData = selectedDates.map(date => date.toISOString().split('T')[0]).join(', ');
        document.getElementById('filtroData').value = formataData; // Atualiza o valor do input
    }
});


// Permitir que o usuário pressione "Enter" para aplicar os filtros
document.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('aplicarFiltros').click();
    }
});
// Variáveis globais para controlar a exibição de agendamentos
let agendamentosAtual = []; // Array para armazenar os agendamentos filtrados
let paginaAtual = 0; // Variável para controlar a página atual
const itensPorPagina = 50; // Número de itens que você deseja mostrar por página (8 para 2 linhas de 4)




// Função para exibir os agendamentos
function exibirAgendamentos() {
    const agendamentosList = document.getElementById('agendamentosExistentes');
    agendamentosList.innerHTML = '';

    const agendamentosAtivos = agendamentosAtual.filter((agendamento) => podeExcluirAgendamento(agendamento.data_reservas));
    const agendamentosPassados = agendamentosAtual.filter((agendamento) => !podeExcluirAgendamento(agendamento.data_reservas));
    const totalPaginasAtivos = Math.max(1, Math.ceil(agendamentosAtivos.length / itensPorPagina));

    if (paginaAtual >= totalPaginasAtivos) {
        paginaAtual = totalPaginasAtivos - 1;
    }

    const inicio = paginaAtual * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const agendamentosAtivosParaExibir = agendamentosAtivos.slice(inicio, fim);

    const linhasAtivos = agendamentosAtivosParaExibir.length
        ? agendamentosAtivosParaExibir.map((agendamento) => `
            <tr>
                <td><input type="checkbox" class="agendamento-checkbox" data-id="${agendamento.id_agendamento}"></td>
                <td>${agendamento.nome_sala}</td>
                <td>${formatarData(agendamento.data_reservas)}</td>
                <td>${formatarHora(agendamento.hora_inicio)}</td>
                <td>${formatarHora(agendamento.hora_fim)}</td>
                <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                <td>
                    <button class="btn btn-danger" onclick="excluirAgendamento(${agendamento.id_agendamento}, this.closest('tr'))">Excluir</button>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="7" class="text-center">Nenhum agendamento de hoje/futuro encontrado.</td></tr>';

    const linhasPassados = agendamentosPassados.length
        ? agendamentosPassados.map((agendamento) => `
            <tr>
                <td>${agendamento.nome_sala}</td>
                <td>${formatarData(agendamento.data_reservas)}</td>
                <td>${formatarHora(agendamento.hora_inicio)}</td>
                <td>${formatarHora(agendamento.hora_fim)}</td>
                <td>${agendamento.motivo || 'Nenhum motivo fornecido'}</td>
                <td><span class="agenda-tag-bloqueado">Não pode excluir</span></td>
            </tr>
        `).join('')
        : '<tr><td colspan="6" class="text-center">Sem histórico passado para os filtros atuais.</td></tr>';

    const tabelaAtivos = `
        <div class="agenda-secao">
            <div class="agenda-secao__header">
                <h4>Agendamentos ativos (hoje e futuro)</h4>
                <span class="agenda-tag-ativo">Exclusão permitida</span>
            </div>
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th scope="col">
                            <div style="position: relative;">
                                <input type="checkbox" id="selecionarTodos" class="seleciona-checkbox">
                                <span class="tooltip">Selecionar todos</span>
                            </div>
                        </th>
                        <th scope="col">Sala</th>
                        <th scope="col">Data</th>
                        <th scope="col">Início</th>
                        <th scope="col">Fim</th>
                        <th scope="col">Motivo</th>
                        <th scope="col">Ações</th>
                    </tr>
                </thead>
                <tbody>${linhasAtivos}</tbody>
            </table>
        </div>
    `;

    const tabelaHistorico = `
        <div class="agenda-secao agenda-secao--historico">
            <div class="agenda-secao__header">
                <h4>Histórico passado</h4>
                <span class="agenda-tag-historico">Somente consulta</span>
            </div>
            <p class="agenda-historico__aviso">Agendamentos de dias passados são bloqueados para exclusão por regra do sistema.</p>
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th scope="col">Sala</th>
                        <th scope="col">Data</th>
                        <th scope="col">Início</th>
                        <th scope="col">Fim</th>
                        <th scope="col">Motivo</th>
                        <th scope="col">Status</th>
                    </tr>
                </thead>
                <tbody>${linhasPassados}</tbody>
            </table>
        </div>
    `;

    agendamentosList.innerHTML = `
        <div class="agenda-regra-info">
            Você pode excluir agendamentos de hoje e do futuro. Agendamentos de dias passados aparecem no histórico e não podem ser excluídos.
        </div>
        ${tabelaAtivos}
        ${tabelaHistorico}
    `;

    document.querySelectorAll('.agendamento-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', atualizarBotaoExcluir);
    });

    const selecionarTodos = document.getElementById('selecionarTodos');
    if (selecionarTodos) {
        selecionarTodos.addEventListener('change', function () {
            const checkboxes = document.querySelectorAll('.agendamento-checkbox');
            checkboxes.forEach((checkbox) => {
                checkbox.checked = this.checked;
            });
            atualizarBotaoExcluir();
        });
    }

    document.getElementById('botaoAnterior').style.display = paginaAtual > 0 ? 'block' : 'none';
    document.getElementById('botaoProximo').style.display = (paginaAtual + 1) * itensPorPagina < agendamentosAtivos.length ? 'block' : 'none';
    atualizarBotaoExcluir();
}



// Evento ao clicar no botão "Ver meus Agendamentos"
document.getElementById('verMeusAgendamentos').addEventListener('click', async () => {
    const response = await fetch('/listar-agendamentos-professor-logado', { cache: 'no-store' });
    
    // Verifique se a resposta é OK
    if (!response.ok) {
        const errorText = await response.text();
        alert('Erro ao carregar agendamentos: ' + errorText);
        return;
    }

    const agendamentos = await response.json();
    
    // Armazenar os agendamentos na variável global
    agendamentosAtual = agendamentos; 

    // Ordena os agendamentos por data e hora
    agendamentosAtual.sort((a, b) => {
        const dataA = new Date(a.data_reservas + 'T' + a.hora_inicio);
        const dataB = new Date(b.data_reservas + 'T' + b.hora_inicio);
        return dataA - dataB;
    });

    // Resetar a página atual
    paginaAtual = 0; 

    // Exibir os agendamentos
    exibirAgendamentos(); 
});

// Funções de navegação
document.getElementById('botaoProximo').addEventListener('click', () => {
    paginaAtual++;
    exibirAgendamentos();
});

document.getElementById('botaoAnterior').addEventListener('click', () => {
    paginaAtual--;
    exibirAgendamentos();
});
async function excluirSelecionados() {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox:checked');
    const idsParaExcluir = Array.from(checkboxes).map(checkbox => checkbox.dataset.id);
    console.log('IDs a serem excluídos:', idsParaExcluir); // Verifica os IDs a serem excluídos
    if (idsParaExcluir.length === 0) {
        alert('Nenhum agendamento selecionado para excluir.'); // Mensagem se nenhum checkbox estiver marcado
        return;
    }

    const confirmar = confirm('Tem certeza que deseja excluir os agendamentos selecionados?');
    if (!confirmar) return;

    try {
        const responses = await Promise.all(idsParaExcluir.map(id => {
            return fetch(`/excluir-agendamento/${id}`, {
                method: 'DELETE'
            });
        }));

        const falhas = [];
        for (const response of responses) {
            if (!response.ok) {
                falhas.push(await response.text());
            }
        }

        if (falhas.length) {
            alert(falhas[0] || 'Erro ao excluir os agendamentos selecionados.');
            await carregarAgendamentos();
            return;
        }

        alert('Agendamentos excluídos com sucesso!'); // Mensagem de sucesso
        await carregarAgendamentos(); // Recarrega a lista de agendamentos após a exclusão
    } catch (error) {
        console.error('Erro ao excluir agendamentos:', error);
        alert('Erro ao excluir os agendamentos. Tente novamente.'); // Mensagem de erro
    }
}
// Adiciona eventos aos checkboxes
document.querySelectorAll('.agendamento-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', atualizarBotaoExcluir);
});

// Função para atualizar a visibilidade do botão de excluir selecionados
function atualizarBotaoExcluir() {
    const checkboxes = document.querySelectorAll('.agendamento-checkbox');
    const algumSelecionado = Array.from(checkboxes).some(checkbox => checkbox.checked);
    const excluirButton = document.getElementById('botaoExcluirSelecionados');
    excluirButton.style.display = algumSelecionado ? 'block' : 'none'; // Mostra ou oculta o botão
}

function migrarParaNovoDashboard() {
    localStorage.setItem('layoutPreferido', 'novo');
    window.location.href = '/dashboard-professor';
}
