let usuarioLogado = null;
let unidadesEstrutura = [];

function getSalaLabel(tipoSala) {
  return tipoSala === 'administrativa' ? 'sala administrativa' : 'sala academica';
}

function getSalaCollectionName(tipoSala) {
  return tipoSala === 'administrativa' ? 'salasAdministrativas' : 'salasAcademicas';
}

function getSalaContainer(tipoSala) {
  return document.getElementById(tipoSala === 'administrativa' ? 'salasAdministrativasContainer' : 'salasAcademicasContainer');
}

function getSalaInput(tipoSala) {
  return document.getElementById(tipoSala === 'administrativa' ? 'novaSalaAdministrativaInput' : 'novaSalaAcademicaInput');
}

async function enviarDadosFormulario(dados, url, mensagemSucesso) {
  try {
    const resposta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dados)
    });

    if (!resposta.ok) {
      const mensagemErro = await resposta.text();
      throw new Error(mensagemErro || 'Erro ao enviar os dados para o servidor.');
    }

    alert(mensagemSucesso);
    location.reload();
  } catch (erro) {
    console.error('Erro ao enviar os dados:', erro);
    alert(erro.message);
  }
}

async function carregarUsuarioLogado() {
  const resposta = await fetch('/user-info');
  if (!resposta.ok) {
    throw new Error('Não foi possível carregar o usuário logado.');
  }

  usuarioLogado = await resposta.json();
}

function isCoordenador() {
  return usuarioLogado?.permissao === 'coordenador';
}

function aplicarPermissoesNaTela() {
  if (!isCoordenador()) {
    return;
  }

  const tituloPagina = document.querySelector('header h1');
  if (tituloPagina) {
    tituloPagina.textContent = 'GERENCIAR SALAS DA SUA UNIDADE';
  }

  ['form-criar-unidade', 'form-renomear-unidade', 'form-remover-unidade'].forEach((id) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.style.display = 'none';
    }
  });
}

function atualizarResumoDashboard() {
  const totalUnidades = unidadesEstrutura.length;
  const totalAcademicas = unidadesEstrutura.reduce((acc, unidade) => acc + (unidade.salasAcademicas || []).length, 0);
  const totalAdministrativas = unidadesEstrutura.reduce((acc, unidade) => acc + (unidade.salasAdministrativas || []).length, 0);

  document.getElementById('statTotalUnidades').textContent = String(totalUnidades);
  document.getElementById('statSalasAcademicas').textContent = String(totalAcademicas);
  document.getElementById('statSalasAdministrativas').textContent = String(totalAdministrativas);
}

function renderizarUnidadesSalas(unidadesSalas) {
  const container = document.getElementById('unidades-salas');

  if (!Array.isArray(unidadesSalas) || !unidadesSalas.length) {
    container.innerHTML = '<div class="unit-card unit-card-empty">Nenhuma unidade visível para o usuário logado.</div>';
    atualizarResumoDashboard();
    return;
  }

  const unidadesSalasHTML = unidadesSalas.map((unidade) => {
    const salasAcademicas = Array.isArray(unidade.salasAcademicas) ? unidade.salasAcademicas.filter(Boolean) : [];
    const salasAdministrativas = Array.isArray(unidade.salasAdministrativas) ? unidade.salasAdministrativas.filter(Boolean) : [];

    const listaAcademica = salasAcademicas.length
      ? salasAcademicas.map((sala) => `<li>${sala}</li>`).join('')
      : '<li class="unit-room-empty">Nenhuma sala acadêmica.</li>';

    const listaAdministrativa = salasAdministrativas.length
      ? salasAdministrativas.map((sala) => `<li>${sala}</li>`).join('')
      : '<li class="unit-room-empty">Nenhuma sala administrativa.</li>';

    return `
      <article class="unit-card">
        <div class="unit-card-header">
          <div>
            <h2>${unidade.nome}</h2>
            <p>Código: ${unidade.codigo}</p>
          </div>
          <div class="unit-badges">
            <span class="unit-badge">${salasAcademicas.length} acadêmica(s)</span>
            <span class="unit-badge unit-badge-admin">${salasAdministrativas.length} administrativa(s)</span>
          </div>
        </div>

        <div class="unit-room-columns">
          <section>
            <h3>Acadêmicas</h3>
            <ul>${listaAcademica}</ul>
          </section>

          <section>
            <h3>Administrativas</h3>
            <ul>${listaAdministrativa}</ul>
          </section>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = unidadesSalasHTML;
  atualizarResumoDashboard();
}

async function atualizarSelectsUnidades() {
  try {
    const resposta = await fetch('/listar-unidades');
    if (!resposta.ok) {
      throw new Error('Erro ao listar unidades.');
    }

    const unidades = await resposta.json();
    const selectRenomear = document.getElementById('codigoUnidadeRenomear');
    const selectRemover = document.getElementById('codigoUnidadeRemover');

    if (selectRenomear) {
      selectRenomear.innerHTML = '';
    }

    if (selectRemover) {
      selectRemover.innerHTML = '';
    }

    unidades.forEach((unidade) => {
      if (selectRenomear) {
        const optionRenomear = document.createElement('option');
        optionRenomear.value = unidade.codigo;
        optionRenomear.textContent = unidade.nome;
        selectRenomear.appendChild(optionRenomear);
      }

      if (selectRemover) {
        const optionRemover = document.createElement('option');
        optionRemover.value = unidade.codigo;
        optionRemover.textContent = unidade.nome;
        selectRemover.appendChild(optionRemover);
      }
    });
  } catch (error) {
    console.error('Erro ao listar unidades:', error);
    alert('Erro ao listar unidades.');
  }
}

async function carregarUnidades() {
  const response = await fetch('/listar-unidades');
  if (!response.ok) {
    throw new Error('Erro ao carregar unidades.');
  }

  const unidades = await response.json();
  const unidadeSelect = document.getElementById('unidadeSelect');
  unidadeSelect.innerHTML = '<option value="">-- Selecione --</option>';

  unidades.forEach((unidade) => {
    const option = document.createElement('option');
    option.value = unidade.codigo;
    option.textContent = unidade.nome;
    unidadeSelect.appendChild(option);
  });
}

function renderizarListaSalas(tipoSala, salas) {
  const salasContainer = getSalaContainer(tipoSala);
  const label = getSalaLabel(tipoSala);

  if (!salasContainer) {
    return;
  }

  salasContainer.innerHTML = '';

  if (!Array.isArray(salas) || !salas.length) {
    salasContainer.classList.add('empty-state');
    salasContainer.textContent = `Nenhuma ${label} cadastrada para esta unidade.`;
    return;
  }

  salasContainer.classList.remove('empty-state');

  salas.forEach((sala) => {
    const salaDiv = document.createElement('div');
    salaDiv.innerHTML = `
      <span>${sala.nome_sala}</span>
      <div class="room-actions">
        <button type="button" onclick="editarSala(${sala.id_sala}, '${tipoSala}')">Editar</button>
        <button type="button" onclick="excluirSala(${sala.id_sala}, '${tipoSala}')">Excluir</button>
      </div>
    `;
    salasContainer.appendChild(salaDiv);
  });
}

async function carregarSalasPorTipo(tipoSala) {
  const codigoUnidade = document.getElementById('unidadeSelect').value;
  const salasContainer = getSalaContainer(tipoSala);
  const label = getSalaLabel(tipoSala);

  if (!codigoUnidade) {
    salasContainer.classList.add('empty-state');
    salasContainer.textContent = `Selecione uma unidade para visualizar as ${label}s.`;
    return;
  }

  const response = await fetch(`/listar-salas/${codigoUnidade}?tipoSala=${encodeURIComponent(tipoSala)}`);
  if (!response.ok) {
    const mensagem = await response.text();
    throw new Error(mensagem || `Erro ao carregar ${label}s.`);
  }

  const salas = await response.json();
  renderizarListaSalas(tipoSala, salas);
}

async function carregarSalas() {
  await Promise.all([
    carregarSalasPorTipo('academico'),
    carregarSalasPorTipo('administrativa')
  ]);
}

async function editarSala(idSala, tipoSala = 'academico') {
  const label = getSalaLabel(tipoSala);
  const novoNomeSala = prompt(`Digite o novo nome da ${label}:`);

  if (!novoNomeSala) {
    alert(`O novo nome da ${label} é obrigatório.`);
    return;
  }

  try {
    const response = await fetch('/renomear-sala', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ idSala, novoNomeSala, tipoSala })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Erro ao editar a ${label}.`);
    }

    await carregarSalasPorTipo(tipoSala);
    await carregarEstruturaUnidades();
  } catch (error) {
    console.error('Erro ao editar sala:', error);
    alert(error.message);
  }
}

function excluirSala(idSala, tipoSala = 'academico') {
  const label = getSalaLabel(tipoSala);
  if (!confirm(`Tem certeza que deseja excluir esta ${label}?`)) {
    return;
  }

  fetch(`/deletar-sala/${idSala}?tipoSala=${encodeURIComponent(tipoSala)}`, {
    method: 'DELETE'
  })
    .then(async (response) => {
      if (!response.ok) {
        const mensagem = await response.text();
        throw new Error(mensagem || `Erro ao excluir a ${label}.`);
      }

      alert(`${label.charAt(0).toUpperCase() + label.slice(1)} excluída com sucesso!`);
      await carregarSalasPorTipo(tipoSala);
      await carregarEstruturaUnidades();
    })
    .catch((error) => {
      console.error('Erro ao excluir sala:', error);
      alert(error.message);
    });
}

async function adicionarSala(tipoSala = 'academico') {
  const codigoUnidade = document.getElementById('unidadeSelect').value;
  const novaSalaInput = getSalaInput(tipoSala);
  const nomeSala = (novaSalaInput?.value || '').trim();
  const label = getSalaLabel(tipoSala);

  if (!codigoUnidade || !nomeSala) {
    alert(`Por favor, selecione uma unidade e informe o nome da nova ${label}.`);
    return;
  }

  try {
    const response = await fetch('/adicionar-sala', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ codigoUnidade, nomeSala, tipoSala })
    });

    if (!response.ok) {
      const mensagem = await response.text();
      throw new Error(mensagem || `Erro ao adicionar ${label}.`);
    }

    alert(`${label.charAt(0).toUpperCase() + label.slice(1)} adicionada com sucesso!`);
    novaSalaInput.value = '';
    await carregarSalasPorTipo(tipoSala);
    await carregarEstruturaUnidades();
  } catch (error) {
    console.error('Erro ao adicionar sala:', error);
    alert(error.message);
  }
}

async function carregarEstruturaUnidades() {
  const resposta = await fetch('/listar-unidades-salas');
  if (!resposta.ok) {
    throw new Error('Erro ao obter a lista de unidades e salas.');
  }

  unidadesEstrutura = await resposta.json();
  renderizarUnidadesSalas(unidadesEstrutura);
}

document.getElementById('form-criar-unidade').addEventListener('submit', async (event) => {
  event.preventDefault();

  const nomeUnidade = document.getElementById('nomeUnidade').value;
  const codigoUnidade = document.getElementById('codigoUnidade').value;
  const salas = document.querySelectorAll('input[name="sala[]"]');
  const nomesSalas = Array.from(salas).map((sala) => sala.value);

  await enviarDadosFormulario(
    { nomeUnidade, codigoUnidade, salas: nomesSalas },
    '/criar-unidade-salas',
    'Unidade e salas criadas com sucesso!'
  );
});

document.getElementById('form-renomear-unidade').addEventListener('submit', async (event) => {
  event.preventDefault();

  const codigoUnidade = document.getElementById('codigoUnidadeRenomear').value;
  const novoNomeUnidade = document.getElementById('novoNomeUnidade').value;

  await enviarDadosFormulario(
    { codigoUnidade, novoNomeUnidade },
    '/renomear-unidade',
    'Unidade renomeada com sucesso!'
  );
});

document.getElementById('form-remover-unidade').addEventListener('submit', async (event) => {
  event.preventDefault();

  const codigoUnidade = document.getElementById('codigoUnidadeRemover').value;

  await enviarDadosFormulario(
    { codigoUnidade },
    '/remover-unidade',
    'Unidade removida com sucesso!'
  );
});

document.getElementById('adicionarSalaAcademicaBtn').addEventListener('click', async (event) => {
  event.preventDefault();
  await adicionarSala('academico');
});

document.getElementById('adicionarSalaAdministrativaBtn').addEventListener('click', async (event) => {
  event.preventDefault();
  await adicionarSala('administrativa');
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await carregarUsuarioLogado();
    aplicarPermissoesNaTela();
    await carregarEstruturaUnidades();
    await atualizarSelectsUnidades();
    await carregarUnidades();
  } catch (error) {
    console.error('Erro ao inicializar a página:', error);
    alert(error.message || 'Erro ao carregar a página.');
  }
});

window.carregarSalas = carregarSalas;
window.editarSala = editarSala;
window.excluirSala = excluirSala;