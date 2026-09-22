// --- FUNÇÕES AUXILIARES E DE MENSAGENS ---

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

// Função para mostrar mensagem de resultado (simplificada)
function mostrarMensagem(idElemento, mensagem) {
    document.getElementById(idElemento).innerHTML = mensagem;
}

// dessassociar (Função mantida para ser chamada pela exclusão)
async function dessassociarTipoAula(idTipoAula) {
    try {
        const response = await fetch(`/dessassociar-tipo-aula/${idTipoAula}`, {
            method: 'DELETE', 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao dessassociar tipo de aula: ${errorText}`);
        }
        return true; 
    } catch (error) {
        console.error('Erro ao dessassociar tipo de aula:', error);
        return false; 
    }
}


// --- FUNÇÕES DE CARREGAMENTO DE DADOS PRINCIPAIS ---

/**
 * Carrega Unidades Demo (Filtrada ou Total).
 */
async function carregarUnidades(selectId, filterByUser = false) {
    const selectElement = document.getElementById(selectId);
    let userInfo = null;

    if (filterByUser) {
        userInfo = await carregarInfoUsuario();
        if (!userInfo) return;
    }

    try {
        const response = await fetch(`/listar-unidades`); 
        const unidades = await response.json();

        selectElement.innerHTML = '<option value="">Selecione uma unidade</option>';

        unidades.forEach(unidade => {
            const shouldAdd = !filterByUser || userInfo.unidades.includes(unidade.codigo);
            
            if (shouldAdd) {
                const option = document.createElement('option');
                option.value = unidade.codigo;
                option.textContent = unidade.nome;
                selectElement.appendChild(option);
            }
        });

    } catch (error) {
        console.error(`Erro ao carregar unidades para ${selectId}:`, error);
        mostrarMensagem('resultadoAdicionar', 'Erro ao carregar unidades.');
    }
}

/**
 * Carrega Tipos de Aula por Unidade Demo (Usado em Edição/Bloco 3).
 */
async function carregarTiposAulaPorUnidade(codigoUnidade, selectId) {
    const selectTiposAula = document.getElementById(selectId);
    
    if (!selectTiposAula) return;
    
    selectTiposAula.innerHTML = '<option value="">Carregando tipos de aula...</option>';
    
    if (!codigoUnidade) {
        selectTiposAula.innerHTML = '<option value="">Selecione uma unidade primeiro</option>';
        if(document.getElementById('descricao_editar')) {
             document.getElementById('descricao_editar').value = '';
        }
        return;
    }

    try {
        const response = await fetch(`/listar-tipos-aula-por-unidade/${codigoUnidade}`);
        
        if (!response.ok && response.status !== 404 && response.status !== 204) {
            throw new Error(`Erro ${response.status} ao buscar tipos de aula.`);
        }
        
        const tiposAula = await response.json();

        tiposAula.sort((a, b) => a.descricao.localeCompare(b.descricao));

        selectTiposAula.innerHTML = '<option value="">Selecione um tipo de aula</option>';

        tiposAula.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id_tipo_aula;
            option.textContent = tipo.descricao;
            option.dataset.descricaoOriginal = tipo.descricao; 
            selectTiposAula.appendChild(option);
        });
        
    } catch (error) {
        console.error('Erro ao carregar tipos de aula:', error);
        selectTiposAula.innerHTML = '<option value="">Erro ao carregar tipos de aula</option>';
    }
}

/**
 * Carrega Tipos de Aula FILTRADOS POR UNIDADE (Bloco 4/Associação).
 */
async function carregarTiposDeAulaParaAssociacao(codigoUnidade) {
    const selectElement = document.getElementById('tipoAula');
    if (!selectElement) return;
    
    if (!codigoUnidade) {
        selectElement.innerHTML = '<option value="">Selecione a Unidade Demo no filtro</option>';
        selectElement.disabled = true;
        return;
    }

    selectElement.innerHTML = '<option value="">Carregando Tipos de Aula...</option>';
    selectElement.disabled = false;
    
    try {
        const response = await fetch(`/listar-tipos-aula-por-unidade/${codigoUnidade}`); 
        
        if (!response.ok && response.status !== 404 && response.status !== 204) {
            throw new Error(`Erro ${response.status} ao buscar tipos de aula.`);
        }
        
        const tipos = await response.json();

        tipos.sort((a, b) => a.descricao.localeCompare(b.descricao));

        selectElement.innerHTML = '<option value="">Selecione o Tipo de Aula</option>';

        tipos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id_tipo_aula; 
            option.textContent = tipo.descricao;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar Tipos de Aula para Associação:', error);
        selectElement.innerHTML = '<option value="">Erro ao carregar Tipos de Aula</option>';
    }
}

/**
 * Carrega Unidades Curriculares FILTRADAS POR UNIDADE (Blocos 3, 4 e 5).
 */
async function carregarUCsFiltradas(codigoUnidade, selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    if (!codigoUnidade) {
        selectElement.innerHTML = '<option value="">Selecione a Unidade Demo no filtro</option>';
        selectElement.disabled = true;
        return;
    }

    selectElement.innerHTML = '<option value="">Carregando Unidades Curriculares...</option>';
    selectElement.disabled = false;

    try {
        const response = await fetch(`/listar-ucs-por-unidade/${codigoUnidade}`); 
        
        if (!response.ok && response.status !== 404 && response.status !== 204) {
             throw new Error(`Erro ${response.status} ao buscar UCs filtradas.`);
        }
        
        const ucs = await response.json();
        selectElement.innerHTML = '<option value="">Selecione a Turma (UC)</option>';

        ucs.forEach(uc => {
            const option = document.createElement('option');
            option.value = uc.id_unidade_curricular; 
            
            const ano = uc.ano || '??';
            const semestre = uc.semestre || '?';
            const turma = uc.turma || '?';
            const modulo = uc.modulo || '?';
            const tipoCurso = uc.tipo_curso || '??';
            
            option.textContent = `${ano}/${semestre}/${turma} - Módulo ${modulo} / Curso ${tipoCurso}`; 
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error(`Erro ao carregar UCs filtradas:`, error);
        selectElement.innerHTML = '<option value="">Erro ao carregar UCs</option>';
    }
}

/**
 * Carrega e exibe os Tipos de Aula (checkboxes) já associados à UC selecionada (Bloco 5).
 */
async function carregarTiposAssociados() {
    const unidadeId = document.getElementById('unidadeDessociar').value;
    const listaTipoAulasDiv = document.getElementById('listaTipoAulas');
    
    listaTipoAulasDiv.innerHTML = 'Carregando associações...';
    
    if (!unidadeId) {
        listaTipoAulasDiv.innerHTML = 'Selecione uma Turma/UC.';
        document.getElementById('tiposAssociados').style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/listar-associacoes/${unidadeId}`); 
        
        if (!response.ok && response.status !== 404 && response.status !== 204) {
            throw new Error('Erro ao buscar associações.');
        }
        
        const associacoes = await response.json();
        listaTipoAulasDiv.innerHTML = ''; 
        
        if (associacoes.length === 0) {
            listaTipoAulasDiv.innerHTML = 'Nenhum Tipo de Aula associado para remoção.';
            document.getElementById('tiposAssociados').style.display = 'none';
        } else {
            associacoes.forEach(associacao => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = associacao.id_tipo_aula;
                checkbox.id = 'tipo_dessoc_' + associacao.id_tipo_aula;

                const label = document.createElement('label');
                label.htmlFor = 'tipo_dessoc_' + associacao.id_tipo_aula;
                label.textContent = associacao.descricao; 

                const container = document.createElement('div');
                container.appendChild(checkbox);
                container.appendChild(label);

                listaTipoAulasDiv.appendChild(container);
            });
            document.getElementById('tiposAssociados').style.display = 'block';
        }

    } catch (error) {
        console.error('Erro ao carregar tipos de aula associados:', error);
        listaTipoAulasDiv.innerHTML = 'Erro ao carregar lista de associações.';
    }
}


// --- EVENT LISTENERS E LÓGICA PRINCIPAL ---

document.addEventListener('DOMContentLoaded', function() {
    
    // INICIALIZAÇÃO DOS CARREGAMENTOS
    carregarUnidades('id_unidade', true);
    carregarUnidades('id_unidade_editar', true);
    carregarUnidades('unidade_uc', true);

    // Linha adicionada para corrigir o Bloco 3.1
    carregarUnidades('unidade_uc_editar_filtro', true);

    carregarUnidades('unidade_associacao_filtro', true); // FILTRO BLOCO 4
    carregarUnidades('unidade_dessociar_filtro', true); // FILTRO BLOCO 5 (NOVO)
    
    // --- LÓGICA DE FILTROS CASCATA ---
    
    // Nível 1 (FILTRO 3.1 & 3.2): Unidade Demo -> Carrega UCs (Edição) e Tipos de Aula (Edição)
    document.getElementById('unidade_uc_editar_filtro').addEventListener('change', function() {
        const codigoUnidade = this.value;
        const selectUcEditar = document.getElementById('uc_para_editar');
        const camposEdicaoDiv = document.getElementById('camposEdicaoUC');

        selectUcEditar.innerHTML = '<option value="">Carregando Turmas...</option>';
        selectUcEditar.disabled = true;
        camposEdicaoDiv.style.display = 'none';
        
        if (codigoUnidade) {
            carregarUCsFiltradas(codigoUnidade, 'uc_para_editar');
            selectUcEditar.disabled = false;
        } else {
            selectUcEditar.innerHTML = '<option value="">Selecione uma Unidade Demo</option>';
        }
        // Limpa mensagens
        mostrarMensagem('resultadoAdicionar', '');
    });

    // Nível 2 (FILTRO 3.1): Turma (UC) -> Carrega Detalhes para Edição
    document.getElementById('uc_para_editar').addEventListener('change', async function() {
        const idUc = this.value;
        const camposEdicaoDiv = document.getElementById('camposEdicaoUC');

        if (!idUc) {
            camposEdicaoDiv.style.display = 'none';
            return;
        }

        try {
            // Rota para buscar detalhes de UMA UC
            const response = await fetch(`/unidade-curricular/${idUc}`);
            if (!response.ok) throw new Error('Falha ao buscar detalhes da UC.');
            
            const ucDetails = await response.json();

            // Preenche os campos de edição
            document.getElementById('ano_editar').value = ucDetails.ano;
            document.getElementById('semestre_editar').value = ucDetails.semestre;
            document.getElementById('turma_editar').value = ucDetails.turma;
            document.getElementById('turno_editar').value = ucDetails.turno;
            document.getElementById('modulo_editar').value = ucDetails.modulo;
            document.getElementById('curso_editar').value = ucDetails.tipo_curso;
            
            camposEdicaoDiv.style.display = 'block';
            mostrarMensagem('resultadoAdicionar', ''); 
        } catch (error) {
            console.error('Erro ao carregar detalhes da UC:', error);
            mostrarMensagem('resultadoAdicionar', 'Erro ao carregar detalhes da Unidade Curricular.');
            camposEdicaoDiv.style.display = 'none';
        }
    });

    // Nível 1 (FILTRO 5): Unidade Demo -> Carrega Turmas (UCs)
    document.getElementById('unidade_dessociar_filtro').addEventListener('change', function() {
        const codigoUnidade = this.value;
        const selectUC = document.getElementById('unidadeDessociar');
        
        selectUC.innerHTML = '<option value="">Carregando Turmas...</option>';
        selectUC.disabled = true;
        document.getElementById('tiposAssociados').style.display = 'none';

        if (codigoUnidade) {
            carregarUCsFiltradas(codigoUnidade, 'unidadeDessociar');
            selectUC.disabled = false;
        } else {
            selectUC.innerHTML = '<option value="">Selecione uma Unidade Demo</option>';
        }
        document.getElementById('listaTipoAulas').innerHTML = '';
    });

    // Nível 2 (FILTRO 5): Turma (UC) Dessassociação -> Carrega Checkboxes Associados
    document.getElementById('unidadeDessociar').addEventListener('change', carregarTiposAssociados);
    
    // Filtro Mestre de Associação (Bloco 4): Carrega Tipo de Aula e UC por Unidade Demo
    document.getElementById('unidade_associacao_filtro').addEventListener('change', function() {
        const codigoUnidade = this.value;
        carregarTiposDeAulaParaAssociacao(codigoUnidade);
        carregarUCsFiltradas(codigoUnidade, 'unidadeCurricular');
    });
    
    // 3. FILTRO DE UNIDADES (ADIÇÃO)
    document.getElementById('id_unidade').addEventListener('change', function() {
        carregarTiposAulaPorUnidade(this.value, 'tipo_aula_id');
    });
    
    // 4. FILTRO DE UNIDADES (EDIÇÃO)
    document.getElementById('id_unidade_editar').addEventListener('change', function() {
        carregarTiposAulaPorUnidade(this.value, 'tipo_aula_id');
        document.getElementById('tipo_aula_id').disabled = !this.value;
        document.getElementById('descricao_editar').disabled = true;
        document.getElementById('descricao_editar').value = '';
    });

    // 5. PREENCHER DESCRIÇÃO AO SELECIONAR TIPO DE AULA
    document.getElementById('tipo_aula_id').addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const descricaoOriginal = selectedOption.dataset.descricaoOriginal || '';
        document.getElementById('descricao_editar').value = descricaoOriginal;
        
        document.getElementById('descricao_editar').disabled = !this.value;
    });
    
    // --- SUBMISSÕES (ADICIONAR/EDITAR/EXCLUIR) ---

    // 1. ADIÇÃO DE NOVO TIPO DE AULA
    document.getElementById('tipoAulaForm').addEventListener('submit', async function(event) {
        event.preventDefault();

        const descricao = document.getElementById('descricao').value;
        const id_unidade = document.getElementById('id_unidade').value;

        try {
            const response = await fetch('/adicionar-unidade-tipo-aula', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descricao, id_unidade })
            });

            if (response.ok) {
                mostrarMensagem('resultadoAdicionar', 'Tipo de aula adicionado e associado à unidade com sucesso!');
                document.getElementById('tipoAulaForm').reset();
                
                const codigoUnidadeEdicao = document.getElementById('id_unidade_editar').value;
                if (codigoUnidadeEdicao) {
                    carregarTiposAulaPorUnidade(codigoUnidadeEdicao, 'tipo_aula_id'); 
                }
                
                document.getElementById('descricao_editar').value = '';
                carregarTiposDeAulaParaAssociacao(document.getElementById('unidade_associacao_filtro').value); 
            } else {
                const errorText = await response.text();
                mostrarMensagem('resultadoAdicionar', `Erro: ${errorText}`);
            }
        } catch (error) {
            console.error('Erro ao adicionar tipo de aula:', error);
            mostrarMensagem('resultadoAdicionar', 'Erro ao adicionar tipo de aula. Tente novamente.');
        }
    });

    // 2. ADIÇÃO DE NOVA UNIDADE CURRICULAR (FORM ID: tipoAulaForm1)
    document.getElementById('tipoAulaForm1').addEventListener('submit', async function(event) {
        event.preventDefault(); 

        const ano = document.getElementById('ano').value;
        const semestre = parseInt(document.getElementById('semestre').value);
        const turma = document.getElementById('turma').value;
        const turno = parseInt(document.getElementById('turno').value);
        const modulo = document.getElementById('modulo').value;
        const tipoCurso = document.getElementById('curso').value;
        const codigoUnidade = document.getElementById('unidade_uc').value; 

        try {
            const response = await fetch('/adicionar-unidade-curricular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ano, semestre, turma, turno, modulo, tipoCurso, codigoUnidade })
            });

            if (response.ok) {
                mostrarMensagem('resultadoAdicionar', 'Unidade curricular adicionada com sucesso!');
                document.getElementById('tipoAulaForm1').reset();
                
                carregarUCsFiltradas(document.getElementById('unidade_associacao_filtro').value, 'unidadeCurricular');
                
                if (document.getElementById('unidade_dessociar_filtro').value) {
                    carregarUCsFiltradas(document.getElementById('unidade_dessociar_filtro').value, 'unidadeDessociar');
                }
            } else {
                const errorText = await response.text();
                mostrarMensagem('resultadoAdicionar', `Erro: ${errorText}`);
            }
        } catch (error) {
            console.error('Erro ao adicionar unidade curricular:', error);
            mostrarMensagem('resultadoAdicionar', 'Erro ao adicionar unidade curricular. Tente novamente.');
        }
    });
    
    // 3.1 SALVAR EDIÇÃO DA UC (PUT)
    document.getElementById('editarUCForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const idUc = document.getElementById('uc_para_editar').value;
        const codigoUnidade = document.getElementById('unidade_uc_editar_filtro').value; // Usamos o filtro como base
        
        const data = {
            ano: document.getElementById('ano_editar').value,
            semestre: document.getElementById('semestre_editar').value,
            turma: document.getElementById('turma_editar').value,
            turno: document.getElementById('turno_editar').value,
            modulo: document.getElementById('modulo_editar').value,
            tipoCurso: document.getElementById('curso_editar').value,
            codigoUnidade: codigoUnidade 
        };

        try {
            const response = await fetch(`/unidade-curricular/${idUc}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                mostrarMensagem('resultadoAdicionar', '✅ Turma/UC atualizada com sucesso!');
                document.getElementById('camposEdicaoUC').style.display = 'none';
                
                // Recarrega as listas após a edição (para refletir a mudança nos selects)
                carregarUCsFiltradas(codigoUnidade, 'uc_para_editar'); // Recarrega o próprio select
                carregarUCsFiltradas(document.getElementById('unidade_associacao_filtro').value, 'unidadeCurricular'); // Recarrega Associação
                carregarUCsFiltradas(document.getElementById('unidade_dessociar_filtro').value, 'unidadeDessociar'); // Recarrega Dessassociação

            } else {
                const errorText = await response.text();
                mostrarMensagem('resultadoAdicionar', `Erro ao atualizar a Turma/UC: ${errorText}`);
            }
        } catch (error) {
            console.error('Erro ao salvar edição da UC:', error);
            mostrarMensagem('resultadoAdicionar', 'Erro ao salvar alterações da Turma/UC.');
        }
    });


    // 6. AÇÃO DE EDITAR TIPO DE AULA (PUT)
    document.getElementById('editarTipoAulaForm').addEventListener('submit', async function(event) {
        event.preventDefault();

        const idTipoAula = document.getElementById('tipo_aula_id').value;
        const novaDescricao = document.getElementById('descricao_editar').value;

        if (!idTipoAula || !novaDescricao) {
            mostrarMensagem('resultadoExcluir', 'Selecione um tipo de aula e preencha a nova descrição.');
            return;
        }

        try {
            const response = await fetch(`/editar-tipo-aula/${idTipoAula}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descricao: novaDescricao }) 
            });

            if (response.ok) {
                mostrarMensagem('resultadoExcluir', 'Descrição do Tipo de Aula atualizada com sucesso!');
                const codigoUnidade = document.getElementById('id_unidade_editar').value;
                carregarTiposAulaPorUnidade(codigoUnidade, 'tipo_aula_id');
                document.getElementById('descricao_editar').value = '';
                carregarTiposDeAulaParaAssociacao(document.getElementById('unidade_associacao_filtro').value); 
            } else {
                const errorText = await response.text();
                mostrarMensagem('resultadoExcluir', `Erro ao editar: ${errorText}`);
            }
        } catch (error) {
            console.error('Erro ao editar tipo de aula:', error);
            mostrarMensagem('resultadoExcluir', 'Erro ao editar tipo de aula. Tente novamente.');
        }
    });
    
    // 7. AÇÃO DE EXCLUIR TIPO DE AULA (DELETE)
    document.getElementById('btnExcluir').addEventListener('click', async function() {
        const idTipoAula = document.getElementById('tipo_aula_id').value;

        if (!idTipoAula) {
            mostrarMensagem('resultadoExcluir', 'Selecione um tipo de aula para excluir.');
            return;
        }

        if (confirm('Tem certeza que deseja excluir este tipo de aula? Ele será dessassociado de todas as unidades antes da exclusão.')) {
            
            const dessassociado = await dessassociarTipoAula(idTipoAula);
            
            if (dessassociado) {
                try {
                    const response = await fetch(`/excluir-tipo-aula/${idTipoAula}`, {
                        method: 'DELETE',
                    });

                    if (response.ok) {
                        mostrarMensagem('resultadoExcluir', 'Tipo de aula excluído com sucesso!');
                        document.getElementById('editarTipoAulaForm').reset();
                        
                        const codigoUnidade = document.getElementById('id_unidade_editar').value;
                        carregarTiposAulaPorUnidade(codigoUnidade, 'tipo_aula_id'); 
                        carregarTiposDeAulaParaAssociacao(document.getElementById('unidade_associacao_filtro').value);
                    } else {
                        const errorText = await response.text();
                        mostrarMensagem('resultadoExcluir', `Erro ao excluir: ${errorText}`);
                    }
                } catch (error) {
                    console.error('Erro ao excluir tipo de aula:', error);
                    mostrarMensagem('resultadoExcluir', 'Erro ao excluir tipo de aula. Tente novamente.');
                }
            } else {
                mostrarMensagem('resultadoExcluir', 'Erro ao dessassociar tipo de aula. Não foi possível excluir.');
            }
        }
    });

    // 8. AÇÃO DE ASSOCIAÇÃO (POST)
    document.getElementById('associarForm').addEventListener('submit', async function (event) {
        event.preventDefault();

        const tipoAula = document.getElementById('tipoAula').value;
        const unidadeCurricular = document.getElementById('unidadeCurricular').value;

        if (!tipoAula || !unidadeCurricular) {
            mostrarMensagem('resultadoAssociacao', 'Selecione tanto o Tipo de Aula quanto a Unidade Curricular.');
            return;
        }

        try {
            const response = await fetch('/associar-unidade-tipo-aula', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id_unidade_curricular: unidadeCurricular, 
                    id_tipo_aula: tipoAula 
                })
            });

            if (response.ok) {
                mostrarMensagem('resultadoAssociacao', 'Associação criada com sucesso!');
                document.getElementById('associarForm').reset();
            } else {
                const errorText = await response.text();
                
                if (response.status === 409) {
                    mostrarMensagem('resultadoAssociacao', `❌ Associação Duplicada: ${errorText}`);
                } else {
                    mostrarMensagem('resultadoAssociacao', `Erro: ${errorText}`);
                }
            }
        } catch (error) {
            console.error('Erro ao associar:', error);
            mostrarMensagem('resultadoAssociacao', 'Erro ao associar. Tente novamente.');
        }
    });

    // 9. AÇÃO DE DESSASSOCIAÇÃO (POST/DELETE) - CORRIGIDO
    document.getElementById('dessociarForm').addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const unidadeId = document.getElementById('unidadeDessociar').value;
        const checkboxes = document.querySelectorAll('#listaTipoAulas input[type="checkbox"]:checked');
        const tiposAulaIds = Array.from(checkboxes).map(checkbox => checkbox.value);

        if (!unidadeId) {
            mostrarMensagem('resultadoDessociacao', 'Selecione a Unidade Curricular primeiro.');
            return;
        }
        if (!tiposAulaIds.length) {
            mostrarMensagem('resultadoDessociacao', 'Selecione ao menos um Tipo de Aula para dessassociar.');
            return;
        }
        
        if (!confirm(`Tem certeza que deseja remover ${tiposAulaIds.length} tipo(s) de aula da Turma (UC)?`)) {
            return;
        }

        try {
            const response = await fetch('/dessassociar-unidade-tipo-aula', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id_unidade_curricular: unidadeId, id_tipos_aula: tiposAulaIds })
            });

            if (response.ok) {
                mostrarMensagem('resultadoDessociacao', 'Dessassociação realizada com sucesso!');
                carregarTiposAssociados(); // Atualiza a lista de checkboxes
            } else {
                const errorText = await response.text();
                mostrarMensagem('resultadoDessociacao', `Erro: ${errorText}`);
            }
        } catch (error) {
            console.error('Erro ao dessassociar:', error);
            mostrarMensagem('resultadoDessociacao', 'Erro ao dessassociar. Tente novamente.');
        }
    });
});