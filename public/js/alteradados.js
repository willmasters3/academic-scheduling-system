document.addEventListener('DOMContentLoaded', function() {
    const formSala = document.getElementById('form-alterar-sala');
    const cadeirasInput = document.getElementById('cadeiras');
    const computadoresInput = document.getElementById('computadores');
    const quadroBrancoInput = document.getElementById('quadroBranco');
    const telaProjetorInput = document.getElementById('telaProjetor');
    const tvInput = document.getElementById('tv');
    const areaInput = document.getElementById('area');
    const projetorInput = document.getElementById('projetor');
    const maquinarioInput = document.getElementById('maquinario');
    const salasSelect = document.getElementById('salas');
    const filtroSalasInput = document.getElementById('filtroSalas');
    const imageInput = document.getElementById('salaImage');
    const feedback = document.getElementById('formFeedback');
    const btnRecarregarSalas = document.getElementById('btnRecarregarSalas');
    const btnLimparFormulario = document.getElementById('btnLimparFormulario');
    const kpiSalaSelecionada = document.getElementById('kpiSalaSelecionada');
    const kpiCadeiras = document.getElementById('kpiCadeiras');
    const kpiComputadores = document.getElementById('kpiComputadores');
    let salasCache = [];

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function renderSalasAgrupadas(salas, termoBusca = '') {
        salasSelect.innerHTML = '<option value="" disabled selected>Selecione uma sala</option>';

        if (!Array.isArray(salas) || salas.length === 0) {
            return;
        }

        const salasOrdenadas = [...salas].sort((a, b) => {
            const unidadeA = `${a.codigo_unidade || ''} ${a.nome_unidade || ''}`.toUpperCase();
            const unidadeB = `${b.codigo_unidade || ''} ${b.nome_unidade || ''}`.toUpperCase();
            if (unidadeA !== unidadeB) {
                return unidadeA.localeCompare(unidadeB, 'pt-BR');
            }

            const salaA = String(a.nome_sala || '').toUpperCase();
            const salaB = String(b.nome_sala || '').toUpperCase();
            return salaA.localeCompare(salaB, 'pt-BR');
        });

        const grupos = new Map();
        salasOrdenadas.forEach((sala) => {
            const codigo = String(sala.codigo_unidade || '').trim();
            const nomeUnidade = String(sala.nome_unidade || '').trim();
            const chave = `${codigo}||${nomeUnidade}`;

            if (!grupos.has(chave)) {
                grupos.set(chave, []);
            }

            grupos.get(chave).push(sala);
        });

        grupos.forEach((listaSalas, chave) => {
            const [codigo, nomeUnidade] = chave.split('||');
            const grupo = document.createElement('optgroup');
            grupo.label = codigo && nomeUnidade
                ? `${codigo} - ${nomeUnidade}`
                : (nomeUnidade || codigo || 'Unidade');

            listaSalas.forEach((sala) => {
                const option = document.createElement('option');
                option.value = sala.id_sala;
                option.textContent = sala.nome_sala || `Sala ${sala.id_sala}`;
                grupo.appendChild(option);
            });

            if (grupo.children.length > 0) {
                salasSelect.appendChild(grupo);
            }
        });

        salasSelect.selectedIndex = 0;

        if (termoBusca && salasSelect.options.length <= 1) {
            showFeedback('Nenhuma sala encontrada para o filtro informado.', true);
        }
    }

    function showFeedback(message, isError = false) {
        if (!feedback) {
            return;
        }

        feedback.textContent = message;
        feedback.style.color = isError ? '#c0392b' : '#1454a8';
    }

    function limparCamposFormulario() {
        cadeirasInput.value = '';
        computadoresInput.value = '';
        quadroBrancoInput.value = '';
        telaProjetorInput.value = '';
        tvInput.value = '';
        areaInput.value = '';
        projetorInput.value = '';
        maquinarioInput.value = '';
        imageInput.value = '';
    }

    function atualizarKpis() {
        const nomeSala = salasSelect?.selectedOptions?.[0]?.textContent || '-';
        kpiSalaSelecionada.textContent = salasSelect.value ? nomeSala.split(' - ').pop() : '-';
        kpiCadeiras.textContent = cadeirasInput.value || '0';
        kpiComputadores.textContent = computadoresInput.value || '0';
    }

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

    // Função para carregar as salas filtradas pela unidade do usuário
    async function carregarSalas() {
        try {
            const response = await fetch(`/salas`);
            const salas = await response.json();
            salasCache = Array.isArray(salas) ? salas : [];
    
            if (salasCache.length === 0) {
                alert('Nenhuma sala encontrada para suas unidades.');
            }

            renderSalasAgrupadas(salasCache);
            atualizarKpis();
            showFeedback('Salas carregadas com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar as salas:', error);
            showFeedback('Erro ao carregar as salas. Por favor, tente novamente.', true);
        }
    }
    

    // Função para carregar os detalhes da sala selecionada
    async function carregarDetalhesSala(idSala) {
        try {
            const response = await fetch(`/sala/${idSala}`);
            const salaDetalhes = await response.json();
            if (salaDetalhes) {
                cadeirasInput.value = salaDetalhes.cadeiras;
                computadoresInput.value = salaDetalhes.computadores;
                quadroBrancoInput.value = salaDetalhes.quadro_branco;
                telaProjetorInput.value = salaDetalhes.tela_projetor;
                tvInput.value = salaDetalhes.tv;
                areaInput.value = salaDetalhes.area;
                projetorInput.value = salaDetalhes.projetor;
                maquinarioInput.value = salaDetalhes.maquinario;
                atualizarKpis();
                showFeedback('Dados da sala carregados.');
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes da sala:', error);
            showFeedback('Erro ao carregar os detalhes da sala. Por favor, tente novamente.', true);
        }
    }

    // Função para salvar alterações
    async function salvarAlteracoes() {
        const idSala = salasSelect.value;
        const cadeiras = cadeirasInput.value;
        const computadores = computadoresInput.value;
        const quadroBranco = quadroBrancoInput.value;
        const telaProjetor = telaProjetorInput.value;
        const tv = tvInput.value;
        const area = areaInput.value;
        const projetor = projetorInput.value;
        const maquinario = maquinarioInput.value;

        const formData = new FormData();
        formData.append('idSala', idSala);
        formData.append('cadeiras', cadeiras);
        formData.append('computadores', computadores);
        formData.append('quadroBranco', quadroBranco);
        formData.append('telaProjetor', telaProjetor);
        formData.append('tv', tv);
        formData.append('area', area);
        formData.append('projetor', projetor);
        formData.append('maquinario', maquinario);

        const imageFile = imageInput.files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }
    
        try {
            const response = await fetch('/alterarSala', {
                method: 'POST',
                body: formData,
            });
    
            const responseText = await response.text();
            if (response.ok) {
                showFeedback('Dados da sala alterados com sucesso.');
                formSala.reset();
                await carregarSalas();
                atualizarKpis();
            } else {
                showFeedback(`Erro ao alterar os dados da sala: ${responseText}`, true);
            }
        } catch (error) {
            console.error('Erro ao enviar os dados:', error);
            showFeedback('Erro ao enviar os dados. Por favor, tente novamente.', true);
        }
    }

    // Evento para o envio do formulário
    formSala.addEventListener('submit', function(event) {
        event.preventDefault(); // Impede o envio do formulário

        // Validação dos campos
        if (salasSelect.value === "") {
            showFeedback('Por favor, selecione uma sala.', true);
            return; 
        }

        // Verifica se os campos obrigatórios estão preenchidos
        if (!cadeirasInput.value || 
            !computadoresInput.value || !quadroBrancoInput.value || 
            !projetorInput.value || !telaProjetorInput.value || 
            !tvInput.value || !areaInput.value || 
            !maquinarioInput.value) {
            showFeedback('Por favor, preencha todos os campos obrigatórios.', true);
            return; 
        }

        // Se todas as validações passarem, salvar as alterações
        salvarAlteracoes();
    });

    // Evento para selecionar a sala e carregar os detalhes
    salasSelect.addEventListener('change', function() {
        const idSalaSelecionada = salasSelect.value;
        if (idSalaSelecionada) {
            carregarDetalhesSala(idSalaSelecionada);
        } else {
            // Limpa os campos se nenhuma sala estiver selecionada
            limparCamposFormulario();
            atualizarKpis();
        }
    });

    [cadeirasInput, computadoresInput].forEach((input) => {
        input.addEventListener('input', atualizarKpis);
    });

    if (btnRecarregarSalas) {
        btnRecarregarSalas.addEventListener('click', async () => {
            await carregarSalas();
            showFeedback('Lista de salas recarregada.');
        });
    }

    if (btnLimparFormulario) {
        btnLimparFormulario.addEventListener('click', () => {
            formSala.reset();
            limparCamposFormulario();
            showFeedback('Formulario limpo.');
            atualizarKpis();
        });
    }

    if (filtroSalasInput) {
        filtroSalasInput.addEventListener('input', () => {
            const termo = normalizeText(filtroSalasInput.value);
            if (!termo) {
                renderSalasAgrupadas(salasCache);
                showFeedback('Filtro de salas limpo.');
                return;
            }

            const filtradas = salasCache.filter((sala) => {
                const textoBusca = normalizeText([
                    sala.nome_sala,
                    sala.codigo_unidade,
                    sala.nome_unidade
                ].join(' '));
                return textoBusca.includes(termo);
            });

            renderSalasAgrupadas(filtradas, termo);
            if (filtradas.length > 0) {
                showFeedback(`${filtradas.length} sala(s) encontrada(s) para o filtro aplicado.`);
            }
            atualizarKpis();
        });
    }

    carregarSalas();  // Carregar as salas quando a página é carregada
    atualizarKpis();
});
