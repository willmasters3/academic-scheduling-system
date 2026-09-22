document.addEventListener('DOMContentLoaded', async function () {
    const unidadeSelect = document.getElementById('unidade');
    const tipoSalaSelect = document.getElementById('tipoSala');
    const salasSelect = document.getElementById('salas');
    const programasDiv = document.getElementById('programas');
    const associarBtn = document.getElementById('associarBtn');
    const desassociarBtn = document.getElementById('excluirBtn');
    const programasAssociadosDiv = document.getElementById('programasAssociados');
    const formPrograma = document.getElementById('formPrograma');
    const programasAdicionados = document.getElementById('programasAdicionados');
    const excluirProgramasBtn = document.getElementById('excluirProgramas');
    const selectAllCheckbox = document.getElementById('selectAll');
    const btnRecarregarProgramas = document.getElementById('btnRecarregarProgramas');
    const roomContext = document.getElementById('roomContext');
    const kpiTotalProgramas = document.getElementById('kpiTotalProgramas');
    const kpiAssociadosSala = document.getElementById('kpiAssociadosSala');
    let unidadesPermitidas = [];

    // Função para carregar informações do usuário
    async function carregarInfoUsuario() {
        try {
            const response = await fetch('/user-info');
            if (!response.ok) throw new Error('Erro ao carregar informações do usuário.');

            const userInfo = await response.json();
            return userInfo;
        } catch (error) {
            console.error('Erro ao carregar informações do usuário:', error);
            return null;
        }
    }

    function atualizarContextoSala() {
        const unidadeNome = unidadeSelect?.selectedOptions?.[0]?.textContent || 'Nenhuma unidade selecionada';
        const tipoSala = tipoSalaSelect.value;
        const tipoNome = tipoSala === 'administrativa' ? 'Sala administrativa' : tipoSala === 'academico' ? 'Sala academica' : 'Tipo de sala nao selecionado';
        const salaNome = salasSelect?.selectedOptions?.[0]?.textContent || 'Nenhuma sala selecionada';
        roomContext.textContent = `${unidadeNome} • ${tipoNome} • ${salaNome}`;
    }

    async function carregarUnidadesUsuario(unidadesUsuario) {
        try {
            const response = await fetch('/unidades');
            if (!response.ok) {
                throw new Error('Erro ao carregar as unidades');
            }

            const unidades = await response.json();
            unidadesPermitidas = Array.isArray(unidadesUsuario) ? unidadesUsuario.map((u) => String(u).trim().toUpperCase()) : [];
            const unidadesFiltradas = unidades.filter((unidade) => unidadesPermitidas.includes(String(unidade.codigo_unidade).trim().toUpperCase()));

            unidadeSelect.innerHTML = '<option value="">Selecione a unidade</option>';
            unidadesFiltradas.forEach((unidade) => {
                const option = document.createElement('option');
                option.value = unidade.codigo_unidade;
                option.textContent = `${unidade.codigo_unidade} - ${unidade.nome_unidade}`;
                unidadeSelect.appendChild(option);
            });

            atualizarContextoSala();
        } catch (error) {
            console.error('Erro ao carregar unidades do usuario:', error);
            alert('Erro ao carregar as unidades do usuário.');
        }
    }

    async function carregarSalasPorUnidadeETipo() {
        try {
            const codigoUnidade = String(unidadeSelect.value || '').trim();
            const tipoSala = String(tipoSalaSelect.value || '').trim();

            if (!codigoUnidade || !tipoSala) {
                salasSelect.innerHTML = '<option value="">Selecione unidade e tipo</option>';
                programasAssociadosDiv.innerHTML = '';
                kpiAssociadosSala.textContent = '0';
                atualizarContextoSala();
                return;
            }

            const rota = tipoSala === 'administrativa' ? `/SalasAdministrativas/${codigoUnidade}` : `/salas/${codigoUnidade}`;
            const response = await fetch(rota);
            if (!response.ok) {
                throw new Error('Erro ao carregar as salas');
            }

            const salas = await response.json();
            salas.sort((a, b) => String(a.nome_sala || '').localeCompare(String(b.nome_sala || ''), 'pt-BR'));

            salasSelect.innerHTML = '<option value="">Selecione a sala</option>';
            salas.forEach((sala) => {
                const option = document.createElement('option');
                option.value = sala.id_sala;
                option.textContent = sala.nome_sala;
                salasSelect.appendChild(option);
            });

            atualizarContextoSala();
        } catch (error) {
            console.error('Erro ao carregar as salas:', error);
            alert('Erro ao carregar as salas. Por favor, tente novamente.');
        }
    }
    

    async function carregarProgramas() {
        try {
            const response = await fetch('/listaProgramas');
            if (!response.ok) {
                throw new Error('Erro ao carregar os programas');
            }
            const programas = await response.json();
            programas.sort((a, b) => a.nome_programa.localeCompare(b.nome_programa));
            kpiTotalProgramas.textContent = String(programas.length);
    
            programasDiv.innerHTML = ''; 
            programas.forEach(programa => {
                const wrapper = document.createElement('div');
                wrapper.className = 'program-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = programa.id_programa;
                checkbox.id = `programa-${programa.id_programa}`;

                const label = document.createElement('label');
                label.htmlFor = `programa-${programa.id_programa}`;
                label.textContent = `${programa.nome_programa} - Versão ${programa.versao}`;

                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);
                programasDiv.appendChild(wrapper);
            });

            selectAllCheckbox.onchange = function () {
                const isChecked = selectAllCheckbox.checked;
                programasDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
            };
        } catch (error) {
            console.error('Erro ao carregar os programas:', error);
            alert('Erro ao carregar os programas. Por favor, tente novamente.');
        }
    }

    async function carregarProgramasAssociados(idSala) {
        try {
            const response = await fetch(`/programas-sala/${idSala}`);
            if (!response.ok) {
                throw new Error('Erro ao carregar os programas associados');
            }
            const programasAssociados = await response.json();

            programasAssociados.sort((a, b) => a.nome_programa.localeCompare(b.nome_programa));

            programasAssociadosDiv.innerHTML = '';
            programasAssociados.forEach(programa => {
                const div = document.createElement('div');
                div.className = 'program-item';
                div.textContent = `${programa.nome_programa} - Versão ${programa.versao}`;
                programasAssociadosDiv.appendChild(div);
            });

            kpiAssociadosSala.textContent = String(programasAssociados.length);
        } catch (error) {
            console.error('Erro ao carregar os programas associados:', error);
            alert('Erro ao carregar os programas associados. Por favor, tente novamente.');
        }
    }

    unidadeSelect.addEventListener('change', async function () {
        await carregarSalasPorUnidadeETipo();
    });

    tipoSalaSelect.addEventListener('change', async function () {
        await carregarSalasPorUnidadeETipo();
    });

    salasSelect.addEventListener('change', function () {
        const idSala = salasSelect.value;
        atualizarContextoSala();
        if (idSala) {
            carregarProgramasAssociados(idSala);
        } else {
            programasAssociadosDiv.innerHTML = '';
            kpiAssociadosSala.textContent = '0';
        }
    });

    associarBtn.addEventListener('click', async function (event) {
        event.preventDefault();
        const idSala = salasSelect.value;
        if (!idSala) {
            alert('Por favor, selecione uma sala antes de associar programas.');
            return;
        }
        const programasSelecionados = Array.from(programasDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10));

        if (!programasSelecionados.length) {
            alert('Selecione ao menos um programa para associar.');
            return;
        }

        if (!Array.isArray(programasSelecionados) || !programasSelecionados.every(Number.isInteger)) {
            alert('Os IDs dos programas devem ser números inteiros.');
            return;
        }

        try {
            const response = await fetch('/associar-sala-programa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sala: idSala, programas: programasSelecionados })
            });
            if (response.ok) {
                alert('Associação realizada com sucesso');
                carregarProgramasAssociados(idSala);
            } else {
                throw new Error('Erro ao associar sala e programa');
            }
        } catch (error) {
            console.error('Erro ao associar sala e programa:', error);
            alert('Erro ao associar sala e programa. Por favor, tente novamente.');
        }
    });

    desassociarBtn.addEventListener('click', async function (event) {
        event.preventDefault();
        const idSala = salasSelect.value;
        if (!idSala) {
            alert('Por favor, selecione uma sala antes de desassociar programas.');
            return;
        }
        const programasSelecionados = Array.from(programasDiv.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value, 10));

        if (!programasSelecionados.length) {
            alert('Selecione ao menos um programa para desassociar.');
            return;
        }

        if (!Array.isArray(programasSelecionados) || !programasSelecionados.every(Number.isInteger)) {
            alert('Os IDs dos programas devem ser números inteiros.');
            return;
        }

        try {
            const response = await fetch('/desassociar-sala-programa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sala: idSala, programas: programasSelecionados })
            });
            if (response.ok) {
                alert('Desassociação realizada com sucesso');
                carregarProgramasAssociados(idSala);
            } else {
                throw new Error('Erro ao desassociar sala e programa');
            }
        } catch (error) {
            console.error('Erro ao desassociar sala e programa:', error);
            alert('Erro ao desassociar sala e programa. Por favor, tente novamente.');
        }
    });

    formPrograma.addEventListener('submit', function (event) {
        event.preventDefault();
        const nomePrograma = document.getElementById('nomePrograma').value;
        const versaoPrograma = document.getElementById('versaoPrograma').value;

        const novoPrograma = {
            nomePrograma: nomePrograma,
            versao: versaoPrograma
        };

        fetch('/adicionarPrograma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoPrograma)
        })
        .then(response => {
            if (response.ok) {
                alert('Programa adicionado');
                formPrograma.reset();
                carregarProgramasAdicionados();
                carregarProgramas();
            } else {
                alert('Erro ao adicionar programa.');
            }
        });
    });

    excluirProgramasBtn.addEventListener('click', function (event) {
        event.preventDefault();
        const checkboxes = programasAdicionados.querySelectorAll('input[type="checkbox"]:checked');
        const idsParaExcluir = Array.from(checkboxes).map(cb => cb.value);

        if (!idsParaExcluir.length) {
            alert('Selecione ao menos um programa para excluir.');
            return;
        }

        fetch('/excluirProgramas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ programas: idsParaExcluir })
        })
        .then(response => {
            if (response.ok) {
                alert('Programas excluídos');
                carregarProgramasAdicionados();
                carregarProgramas();
            } else {
                alert('Erro ao excluir programas.');
            }
        });
    });

    async function carregarProgramasAdicionados() {
        try {
            const response = await fetch('/programasAdicionados');
            if (!response.ok) {
                throw new Error('Erro ao carregar os programas adicionados');
            }
            const programas = await response.json();

            programas.sort((a, b) => a.nome_programa.localeCompare(b.nome_programa));

            programasAdicionados.innerHTML = '';
            programas.forEach(programa => {
                const wrapper = document.createElement('div');
                wrapper.className = 'program-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = programa.id_programa;
                checkbox.id = `adicionado-${programa.id_programa}`;
                const label = document.createElement('label');
                label.htmlFor = `adicionado-${programa.id_programa}`;
                label.textContent = `${programa.nome_programa} - Versão ${programa.versao}`;
                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);
                programasAdicionados.appendChild(wrapper);
            });
        } catch (error) {
            console.error('Erro ao carregar os programas adicionados:', error);
            alert('Erro ao carregar os programas adicionados. Por favor, tente novamente.');
        }
    }

    // Carregar dados ao carregar a página
    const userInfo = await carregarInfoUsuario();
    if (userInfo) {
        await carregarUnidadesUsuario(userInfo.unidades);
    } else {
        alert('Não foi possível carregar as informações do usuário.');
    }

    btnRecarregarProgramas?.addEventListener('click', async () => {
        await carregarProgramas();
        await carregarProgramasAdicionados();

        if (salasSelect.value) {
            await carregarProgramasAssociados(salasSelect.value);
        }
    });
    
    carregarProgramas();
    carregarProgramasAdicionados();
    atualizarContextoSala();
});
