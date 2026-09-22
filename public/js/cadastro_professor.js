// Função para carregar informações do usuário
const professoresPorId = new Map();
let matriculaEmUso = false;
let verificadorMatriculaTimer = null;
let currentUserInfo = null;

function setMatriculaStatus(texto, tipo = '') {
    const statusEl = document.getElementById('matriculaStatus');
    if (!statusEl) return;
    statusEl.textContent = texto;
    statusEl.classList.remove('ok', 'erro');
    if (tipo) statusEl.classList.add(tipo);
}

async function carregarInfoUsuario() {
    try {
        const response = await fetch('/user-info');
        if (!response.ok) throw new Error('Erro ao carregar informações do usuário.');

        const userInfo = await response.json();
        currentUserInfo = userInfo;
        return userInfo;
    } catch (error) {
        console.error('Erro ao carregar informações do usuário:', error);
        return null;
    }
}

// Função para carregar unidades, com a lógica para admin e usuários comuns
async function carregarUnidades() {
    const userInfo = await carregarInfoUsuario();
    
    if (!userInfo) {
        document.getElementById('resultadoAdicionar').innerHTML = 'Erro ao carregar unidades. Por favor, faça login novamente.';
        return;
    }

    // Aqui adicionamos a lógica para mostrar/ocultar a opção de administrador
    const adminOption = document.getElementById('permissao').querySelector('option[value="admin"]');
    if (userInfo.permissao === 'admin') {
        adminOption.style.display = 'block'; // Mostrar a opção Administrador para admin
    } else {
        adminOption.style.display = 'none'; // Ocultar a opção Administrador para coordenadores e usuários comuns
    }

    // Continuação do código original para carregar unidades...
    try {
        const response = await fetch('/listar-unidades');
        if (!response.ok) throw new Error('Erro ao carregar unidades.');

        const unidades = await response.json();
        const unidadeSelect = document.getElementById('codigo_unidade');

        unidadeSelect.innerHTML = '<option value="" disabled selected>Marque uma ou várias unidades</option>';

        // Se o usuário for admin, carrega todas as unidades
        if (userInfo.permissao === 'admin') {
            unidades.forEach(unidade => {
                const option = document.createElement('option');
                option.value = unidade.codigo; // Adiciona o código da unidade
                option.textContent = unidade.nome; // Adiciona o nome da unidade
                unidadeSelect.appendChild(option);
            });
        } else {
            const unidadeDoUsuario = unidades.filter(unidade => userInfo.unidades.includes(unidade.codigo));
            
            if (unidadeDoUsuario.length > 0) {
                unidadeDoUsuario.forEach(unidade => {
                    const option = document.createElement('option');
                    option.value = unidade.codigo; // Adiciona o código da unidade
                    option.textContent = unidade.nome; // Adiciona o nome da unidade
                    unidadeSelect.appendChild(option);
                });
            } else {
                unidadeSelect.innerHTML = `<option disabled selected>Não há unidades associadas para este coordenador.</option>`;
                console.warn('Nenhuma unidade encontrada para o usuário:', userInfo.codigo_unidade);
            }
        }

    } catch (error) {
        console.error('Erro ao carregar unidades:', error);
        alert('Erro ao carregar unidades.');
    }
}



document.addEventListener('DOMContentLoaded', () => {
    carregarUnidades(); // Carregar unidades ao iniciar a página

    const professorForm = document.getElementById('professorForm');
    const matriculaInput = document.getElementById('matricula');

    const editarProfessorForm = document.getElementById('editarProfessorForm');
    const cancelarEdicaoProfessorBtn = document.getElementById('cancelarEdicaoProfessor');
    const editarProfessorModal = document.getElementById('editarProfessorModal');

    editarProfessorForm.addEventListener('submit', salvarEdicaoProfessor);
    cancelarEdicaoProfessorBtn.addEventListener('click', fecharModalEdicaoProfessor);
    editarProfessorModal.addEventListener('click', (event) => {
        if (event.target?.dataset?.closeEditModal === 'true') {
            fecharModalEdicaoProfessor();
        }
    });

// Função para tratar o registro do professor
professorForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (matriculaEmUso) {
        alert('Esta matricula ja esta cadastrada. Use outra matricula para criar um novo funcionario.');
        return;
    }

    const formData = new FormData(professorForm);
    const permissao = String(formData.get('permissao') || '').trim();

    // Se o usuário for coordenador, não permitir que escolha administrador
    if (permissao === 'coordenador') {
        formData.set('permissao', 'coordenador');
    }

    const endpoint = permissao === 'coordenador' ? '/register-coordenador' : '/register';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        const mensagem = await response.text();

        if (response.ok) {
            alert(mensagem || 'Funcionario/Coordenador adicionado com sucesso!');
            e.target.reset(); 
            matriculaEmUso = false;
            setMatriculaStatus('Digite a matricula para verificar se ja existe.');
            listarProfessores(); 
        } else if (response.status === 409) {
            matriculaEmUso = true;
            setMatriculaStatus('Matricula ja cadastrada.', 'erro');
            alert(mensagem || 'Matricula ja cadastrada.');
        } else {
            alert(mensagem || 'Erro ao adicionar professor/coordenador.');
        }
    } catch (error) {
        console.error('Erro ao adicionar professor/coordenador:', error);
        alert('Erro ao adicionar professor/coordenador.');
    }
});

    

    // Quando unidade for selecionada, listar professores
    document.getElementById('codigo_unidade').addEventListener('change', listarProfessores);

    if (matriculaInput) {
        matriculaInput.addEventListener('input', () => {
            const matricula = String(matriculaInput.value || '').trim();

            clearTimeout(verificadorMatriculaTimer);

            if (matricula.length < 3) {
                matriculaEmUso = false;
                setMatriculaStatus('Digite ao menos 3 caracteres para validar a matricula.');
                return;
            }

            setMatriculaStatus('Verificando matricula...');
            verificadorMatriculaTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`/verificar-matricula/${encodeURIComponent(matricula)}`);
                    if (!response.ok) {
                        throw new Error('Falha ao verificar matricula.');
                    }

                    const dados = await response.json();
                    if (dados && dados.id_professor) {
                        matriculaEmUso = true;
                        setMatriculaStatus(`Matricula ja cadastrada para ${dados.nome || 'outro usuario'}.`, 'erro');
                    } else {
                        matriculaEmUso = false;
                        setMatriculaStatus('Matricula disponivel para novo cadastro.', 'ok');
                    }
                } catch (error) {
                    matriculaEmUso = false;
                    console.error('Erro ao validar matricula:', error);
                    setMatriculaStatus('Nao foi possivel verificar a matricula agora.', 'erro');
                }
            }, 300);
        });
    }
});

// Listar professores da unidade selecionada
async function listarProfessores() {
    const codigoUnidade = document.getElementById('codigo_unidade').value;
    console.log('Código da Unidade Selecionada:', codigoUnidade); // Log do código da unidade
    const tabelatBody = document.getElementById('professoresTabela').getElementsByTagName('tbody')[0];
    tabelatBody.innerHTML = ''; // Limpar a tabela
    professoresPorId.clear();

    if (codigoUnidade) {
        try {
            const response = await fetch(`/listar-professores-por-unidade/${codigoUnidade}`);
            const professores = await response.json();
            console.log('Professores Recebidos:', professores); // Log
        
        professores.sort((a, b) =>{
            return a.nome.localeCompare(b.nome, 'pt-br');
            
        });

            // Carregar informações do usuário para verificar permissões
            const userInfo = await carregarInfoUsuario();

            // Verifica se há professores
            if (professores.length === 0) {
                const row = tabelatBody.insertRow();
                const cell = row.insertCell(0);
                cell.colSpan = 4; 
                cell.textContent = 'Nenhum professor encontrado para esta unidade.';
            } else {
                professores.forEach(professor => {
                    professoresPorId.set(Number(professor.id_professor), professor);
                    const row = tabelatBody.insertRow();
                    row.innerHTML = `
                        <td>${professor.nome || 'Nome não disponível'}</td>
                        <td>${professor.login || 'Login não disponível'}</td>
                        <td>${professor.matricula || 'Nenhuma matrícula disponível'}</td>
                        <td>
                            <button class="edit-button" onclick="editarProfessor(${professor.id_professor})">Editar dados</button>
                            <button onclick="desassociarProfessor(${professor.id_professor}, '${codigoUnidade}')">Desassociar</button>
                            ${userInfo.permissao !== 'coordenador' ? `<button onclick="excluirProfessor(${professor.id_professor})" style="background-color:red">Excluir</button>` : ''}
                            <button onclick="alterarSenha(${professor.id_professor})">Alterar Senha</button>
                        </td>
                    `;
                });
            }
            
            // Mostrar a tabela de professores
            const container = document.getElementById('professoresContainer');
            if (container) {
                container.style.display = 'block'; // Mostrar
            }
        } catch (error) {
            console.error('Erro ao listar professores:', error);
        }
    } else {
        // Esconde a tabela
        const container = document.getElementById('professoresContainer');
        if (container) {
            container.style.display = 'none';
        }
    }
}
async function desassociarProfessor(idProfessor, codigoUnidade) {
    if (confirm('Tem certeza que deseja desassociar este professor desta unidade?')) {
        try {
            const response = await fetch(`/desassociar-professor/${idProfessor}/${codigoUnidade}`, { method: 'DELETE' });
            if (response.ok) {
                alert('Professor desassociado com sucesso!');
                listarProfessores(); // Atualiza a lista de professores
            } else {
                alert('Erro ao desassociar professor.');
            }
        } catch (error) {
            console.error('Erro ao desassociar professor:', error);
            alert('Erro ao desassociar professor.');
        }
    }
}


// Outras funções como alterarSenha, editarProfessor, atualizarProfessor e excluirProfessor permanecem inalteradas.

async function abrirModalEdicaoProfessor(professor) {
    const userInfo = currentUserInfo || await carregarInfoUsuario();
    const permissaoAtual = String(professor.permissao || 'user').trim().toLowerCase();
    const editarPermissao = document.getElementById('editarPermissao');
    const editarAdminOption = document.getElementById('editarAdminOption');

    document.getElementById('editarProfessorId').value = professor.id_professor;
    document.getElementById('editarNome').value = professor.nome || '';
    document.getElementById('editarMatricula').value = professor.matricula || '';
    document.getElementById('editarLogin').value = professor.login || '';
    document.getElementById('editarEmail').value = professor.email || '';
    document.getElementById('editarPermissao').value = permissaoAtual;
    document.getElementById('editarTurnoPrincipal').value = (professor.turno_principal || '').toLowerCase();
    document.getElementById('editarCargaHoraria').value = professor.carga_horaria_semanal ?? '';
    document.getElementById('editarQualificacao').value = professor.qualificacao || '';
    document.getElementById('editarClassificacaoDocente').value = professor.classificacao_docente == null ? '' : String(Number(professor.classificacao_docente));
    document.getElementById('editarSenhaTemporaria').checked = Number(professor.senhaTemporaria || 0) === 1;
    document.getElementById('editarNovaSenha').value = '';
    document.getElementById('editarConfirmarSenha').value = '';
    document.getElementById('editarFoto').value = '';

    if (userInfo?.permissao === 'admin') {
        editarAdminOption.style.display = 'block';
        editarPermissao.disabled = false;
    } else {
        editarAdminOption.style.display = permissaoAtual === 'admin' ? 'block' : 'none';
        editarPermissao.disabled = permissaoAtual === 'admin';
    }

    const modal = document.getElementById('editarProfessorModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function fecharModalEdicaoProfessor() {
    const modal = document.getElementById('editarProfessorModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('editarProfessorForm').reset();
    document.getElementById('editarPermissao').disabled = false;
}

function alterarSenha(id) {
    const professor = professoresPorId.get(Number(id));
    if (!professor) {
        alert('Não foi possível carregar os dados do usuário.');
        return;
    }

    document.getElementById('alterarSenhaId').value = id;
    document.getElementById('alterarSenhaNome').textContent = professor.nome || '—';
    document.getElementById('alterarSenhaMatricula').textContent = professor.matricula || '—';
    document.getElementById('novaSenhaInput').value = '';
    document.getElementById('confirmarSenhaInput').value = '';
    document.getElementById('alterarSenhaErro').classList.add('hidden');
    document.getElementById('alterarSenhaErro').textContent = '';
    atualizarRequisitos('');

    const modal = document.getElementById('alterarSenhaModal');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('novaSenhaInput').focus();
}


// Funções de editar e excluir o professor
function editarProfessor(id) {
    const professor = professoresPorId.get(Number(id));
    if (!professor) {
        alert('Não foi possível carregar os dados do usuário para edição.');
        return;
    }

    abrirModalEdicaoProfessor(professor);
}

// Função para atualizar o professor no backend
async function atualizarProfessor(formData, id) {
    try {
        const codigoUnidade = document.getElementById('codigo_unidade').value;
        formData.set('codigoUnidade', codigoUnidade);
        formData.set('senhaTemporaria', document.getElementById('editarSenhaTemporaria').checked ? '1' : '0');

        const response = await fetch(`/atualizar-professor/${id}`, {
            method: 'PUT',
            body: formData
        });

        if (response.ok) {
            alert('Professor atualizado com sucesso!');
            listarProfessores(); // Atualiza a lista de professores após a edição
            fecharModalEdicaoProfessor();
        } else if (response.status === 409) {
            const payload = await response.json().catch(() => ({}));
            alert(payload.error || 'Matrícula ou login já cadastrado para outro usuário.');
        } else {
            const payload = await response.json().catch(() => ({}));
            alert(payload.error || 'Erro ao atualizar professor.');
        }
    } catch (error) {
        console.error('Erro ao atualizar professor:', error);
        alert('Erro ao atualizar professor.');
    }
}

async function salvarEdicaoProfessor(event) {
    event.preventDefault();

    const form = document.getElementById('editarProfessorForm');
    const id = document.getElementById('editarProfessorId').value;
    const nome = document.getElementById('editarNome').value.trim();
    const matricula = document.getElementById('editarMatricula').value.trim();
    const login = document.getElementById('editarLogin').value.trim();
    const senha = document.getElementById('editarNovaSenha').value;
    const confirmarSenha = document.getElementById('editarConfirmarSenha').value;

    if (!id || !nome || !matricula || !login) {
        alert('Nome, matrícula e login são obrigatórios para edição.');
        return;
    }

    if ((senha || confirmarSenha) && senha !== confirmarSenha) {
        alert('A confirmação da nova senha não confere.');
        return;
    }

    const formData = new FormData(form);

    await atualizarProfessor(formData, id);
}

async function excluirProfessor(id) {
    if (confirm('Tem certeza que deseja excluir este professor?')) {
        try {
            await fetch(`/excluir-professor/${id}`, { method: 'DELETE' });
            alert('Professor excluído com sucesso!');
            listarProfessores(); // Atualizar a lista de professores
        } catch (error) {
            console.error('Erro ao excluir professor:', error);
            alert('Erro ao excluir professor.');
        }
    }
}

// ── Modal Alterar Senha ──────────────────────────────────────

function fecharModalAlterarSenha() {
    const modal = document.getElementById('alterarSenhaModal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('alterarSenhaForm').reset();
    document.getElementById('alterarSenhaErro').classList.add('hidden');
    atualizarRequisitos('');
}

function atualizarRequisitos(senha) {
    const toggle = (id, ok) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('req-ok', ok);
    };
    toggle('req-len',     senha.length >= 8);
    toggle('req-upper',   /[A-Z]/.test(senha));
    toggle('req-num',     /[0-9]/.test(senha));
    toggle('req-special', /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(senha));
}

document.getElementById('novaSenhaInput').addEventListener('input', function () {
    atualizarRequisitos(this.value);
});

document.getElementById('cancelarAlterarSenha').addEventListener('click', fecharModalAlterarSenha);
document.getElementById('alterarSenhaBackdrop').addEventListener('click', fecharModalAlterarSenha);

document.getElementById('alterarSenhaForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const id        = document.getElementById('alterarSenhaId').value;
    const novaSenha = document.getElementById('novaSenhaInput').value;
    const confirmar = document.getElementById('confirmarSenhaInput').value;
    const erroEl    = document.getElementById('alterarSenhaErro');

    erroEl.classList.add('hidden');
    erroEl.textContent = '';

    if (novaSenha !== confirmar) {
        erroEl.textContent = 'As senhas não coincidem.';
        erroEl.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`/alterar-senha/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novaSenha })
        });

        if (response.ok) {
            fecharModalAlterarSenha();
            alert('Senha alterada com sucesso!');
        } else {
            const msg = await response.text();
            erroEl.textContent = msg || 'Erro ao alterar a senha.';
            erroEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Erro ao alterar a senha:', error);
        erroEl.textContent = 'Erro de conexão. Tente novamente.';
        erroEl.classList.remove('hidden');
    }
});
