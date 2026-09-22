document.addEventListener('DOMContentLoaded', () => {
    const q = id => document.getElementById(id);
    let cursos = [], associacoes = [], turmas = [], disciplinas = [];
    let associacoesProntas = false, salvandoUcs = false;
    const selecionadas = new Map();

    async function api(url, options = {}) {
        const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || payload.message || 'Não foi possível concluir a operação.');
        return payload;
    }
    function escape(value) { const el = document.createElement('div'); el.textContent = String(value ?? ''); return el.innerHTML; }
    function option(value, label) { return `<option value="${escape(value)}">${escape(label)}</option>`; }
    function feedback(message, error = false, target = q('acadFeedback')) { target.textContent = message; target.style.color = error ? '#a52222' : '#16703a'; }
    function unidadeSelecionada() { return q('acadCursoUnidade').value; }

    async function carregarUnidades() {
        const unidades = await api('/listar-unidades');
        const html = option('', 'Selecione uma unidade') + unidades.map(u => option(u.codigo, u.nome)).join('');
        q('acadCursoUnidade').innerHTML = html;
        q('acadTurmaUnidade').innerHTML = html;
    }
    async function carregarDisciplinas(unidade) {
        disciplinas = [];
        renderizarOpcoes();
        q('acadCursoUcTipo').innerHTML = option('', 'Selecione uma UC');
        if (!unidade) return;
        const rows = await api(`/listar-tipos-aula-por-unidade/${encodeURIComponent(unidade)}`);
        if (unidade !== unidadeSelecionada()) return;
        disciplinas = rows;
        rows.sort((a, b) => String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR', { sensitivity: 'base' }));
        q('acadCursoUcTipo').innerHTML += rows.map(row => option(row.id_tipo_aula, row.descricao)).join('');
        renderizarOpcoes();
    }
    async function carregarCursos() {
        const unidade = unidadeSelecionada();
        associacoesProntas = false; associacoes = []; limparAssociacao();
        cursos = unidade ? await api(`/cadastros-academicos/cursos?unidade=${encodeURIComponent(unidade)}`) : [];
        q('acadCursosLista').classList.toggle('empty-state', !cursos.length);
        q('acadCursosLista').innerHTML = cursos.length ? cursos.map(c => `<div class="admin-row ${c.ativo ? '' : 'admin-row--inactive'}"><div class="admin-row__head"><div><h3>${escape(c.nome_curso)}</h3><p>${escape(c.modalidade)}${c.codigo_curso ? ` · ${escape(c.codigo_curso)}` : ''}</p><p>${c.ativo ? 'Ativo' : 'Inativo'}</p></div><div class="admin-row__actions"><button class="btn btn-ghost" data-curso-editar="${c.id_curso}">Editar</button><button class="btn ${c.ativo ? 'btn-danger' : 'btn-primary'}" data-curso-status="${c.id_curso}" data-ativo="${c.ativo ? 0 : 1}">${c.ativo ? 'Inativar' : 'Reativar'}</button></div></div></div>`).join('') : 'Nenhum curso cadastrado nesta unidade.';
        const ativos = cursos.filter(c => c.ativo);
        const courseOptions = option('', 'Selecione um curso') + ativos.map(c => option(c.id_curso, c.nome_curso)).join('');
        q('acadCursoUcCurso').innerHTML = courseOptions;
        renderizarOpcoes();
        if (q('acadTurmaUnidade').value === unidade) q('acadTurmaCurso').innerHTML = courseOptions;
        q('acadCursoUcsLista').innerHTML = 'Selecione um curso.'; q('acadCursoUcsLista').classList.add('empty-state');
    }
    function limparCurso() { q('acadCursoId').value = ''; q('acadCursoCodigo').value = ''; q('acadCursoNome').value = ''; q('acadCursoModalidade').value = ''; }
    q('acadCursoUnidade').addEventListener('change', async () => { try { await Promise.all([carregarCursos(), carregarDisciplinas(unidadeSelecionada())]); } catch (e) { feedback(e.message, true); } });
    q('acadCursoForm').addEventListener('submit', async e => { e.preventDefault(); try { const id = q('acadCursoId').value; const body = { codigo_unidade: unidadeSelecionada(), codigo_curso: q('acadCursoCodigo').value, nome_curso: q('acadCursoNome').value, modalidade: q('acadCursoModalidade').value }; const result = await api(id ? `/cadastros-academicos/cursos/${id}` : '/cadastros-academicos/cursos', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); feedback(result.message); limparCurso(); await carregarCursos(); } catch (e) { feedback(e.message, true); } });
    q('acadCursoCancelar').addEventListener('click', limparCurso);
    q('acadCursosLista').addEventListener('click', async e => { const edit = e.target.closest('[data-curso-editar]'), status = e.target.closest('[data-curso-status]'); try { if (edit) { const c = cursos.find(x => String(x.id_curso) === edit.dataset.cursoEditar); q('acadCursoId').value = c.id_curso; q('acadCursoCodigo').value = c.codigo_curso || ''; q('acadCursoNome').value = c.nome_curso; q('acadCursoModalidade').value = c.modalidade; q('acadCursoNome').focus(); } if (status) { const ativo = Number(status.dataset.ativo); if (!ativo && !confirm('Inativar este curso? Os vínculos históricos serão preservados.')) return; const result = await api(`/cadastros-academicos/cursos/${status.dataset.cursoStatus}/status`, { method: 'PATCH', body: JSON.stringify({ ativo: Boolean(ativo) }) }); feedback(result.message); await carregarCursos(); } } catch (err) { feedback(err.message, true); } });

    async function carregarAssociacoes() {
        const curso = q('acadCursoUcCurso').value;
        associacoesProntas = false; renderizarOpcoes();
        const rows = curso ? await api(`/cadastros-academicos/cursos/${curso}/ucs`) : [];
        if (curso !== q('acadCursoUcCurso').value) return;
        associacoes = rows; associacoesProntas = Boolean(curso);
        renderizarOpcoes();
        q('acadCursoUcsLista').classList.toggle('empty-state', !associacoes.length);
        q('acadCursoUcsLista').innerHTML = associacoes.length ? associacoes.map(a => `<div class="admin-row ${a.ativo ? '' : 'admin-row--inactive'}"><div class="admin-row__head"><div><h3>${escape(a.descricao)}</h3><p>Carga: ${escape(a.carga_horaria_total)}h · Módulo: ${escape(a.modulo || '—')}</p><p>${a.ativo ? 'Ativa' : 'Inativa'}</p></div><div class="admin-row__actions"><button class="btn btn-ghost" data-uc-editar="${a.id_curso_uc}">Editar</button><button class="btn ${a.ativo ? 'btn-danger' : 'btn-primary'}" data-uc-status="${a.id_curso_uc}" data-ativo="${a.ativo ? 0 : 1}">${a.ativo ? 'Inativar' : 'Reativar'}</button></div></div></div>`).join('') : (curso ? 'Nenhuma UC relacionada.' : 'Selecione um curso.');
    }
    function modoAssociacao(editando) {
        q('acadCursoUcLote').hidden = editando;
        q('acadCursoUcEdicao').hidden = !editando;
        q('acadCursoUcEdicao').disabled = !editando;
        q('acadCursoUcTitulo').textContent = editando ? 'Editar UC' : 'Associar UCs';
        q('acadCursoUcSalvar').textContent = editando ? 'Salvar relação' : 'Salvar relações';
        q('acadCursoUcCancelar').textContent = editando ? 'Cancelar edição' : 'Limpar seleção';
    }
    function renderizarOpcoes() {
        const disponivel = q('acadCursoUcCurso').value && associacoesProntas;
        q('acadCursoUcOpcoes').innerHTML = disponivel ? (disciplinas.map(uc => {
            const vinculada = associacoes.find(a => String(a.id_tipo_aula) === String(uc.id_tipo_aula));
            return `<label class="uc-opcao"><input type="checkbox" data-uc-selecionar="${Number(uc.id_tipo_aula)}" ${vinculada ? 'disabled' : ''} ${selecionadas.has(String(uc.id_tipo_aula)) ? 'checked' : ''}><span>${escape(uc.descricao)}${vinculada ? (vinculada.ativo ? ' — Já vinculada' : ' — Já vinculada (inativa; use Reativar)') : ''}</span></label>`;
        }).join('') || 'Nenhuma UC disponível nesta unidade.') : 'Selecione um curso e aguarde o carregamento das UCs.';
    }
    function renderizarSelecionadas() {
        q('acadCursoUcSelecionadas').innerHTML = '';
        for (const [id, dados] of selecionadas) {
            const card = document.createElement('div'); card.className = 'admin-row';
            card.innerHTML = `<h3>${escape(dados.descricao)}</h3><div class="form-grid-2">
                <div class="form-group"><label for="ucCodigo${id}">Código (opcional)</label><input id="ucCodigo${id}" data-campo="codigo_uc" type="text" maxlength="50"></div>
                <div class="form-group"><label for="ucCarga${id}">Carga Horária Total</label><input id="ucCarga${id}" data-campo="carga_horaria_total" type="number" min="0.01" max="99999.99" step="0.01" required></div>
                <div class="form-group"><label for="ucModulo${id}">Módulo (opcional)</label><input id="ucModulo${id}" data-campo="modulo" type="number" min="1" max="2147483647" step="1"></div></div>`;
            card.querySelectorAll('[data-campo]').forEach(input => {
                input.value = dados[input.dataset.campo];
                input.addEventListener('input', () => { dados[input.dataset.campo] = input.value; });
            });
            q('acadCursoUcSelecionadas').appendChild(card);
        }
        if (!selecionadas.size) q('acadCursoUcSelecionadas').textContent = 'Nenhuma UC selecionada.';
    }
    function limparAssociacao() {
        q('acadCursoUcId').value = ''; q('acadCursoUcTipo').value = ''; q('acadCursoUcCodigo').value = ''; q('acadCursoUcCarga').value = ''; q('acadCursoUcModulo').value = '';
        selecionadas.clear(); modoAssociacao(false); renderizarOpcoes(); renderizarSelecionadas();
        feedback('', false, q('acadCursoUcFeedback'));
    }
    q('acadCursoUcOpcoes').addEventListener('change', e => {
        const id = e.target.dataset.ucSelecionar;
        if (!id) return;
        if (e.target.checked) {
            const uc = disciplinas.find(row => String(row.id_tipo_aula) === id);
            selecionadas.set(id, {id_tipo_aula: Number(id), descricao: uc.descricao, codigo_uc: '', carga_horaria_total: '', modulo: ''});
        } else selecionadas.delete(id);
        renderizarSelecionadas();
    });
    q('acadCursoUcCurso').addEventListener('change', () => {
        associacoesProntas = false; associacoes = []; limparAssociacao();
        carregarAssociacoes().catch(e => feedback(e.message, true, q('acadCursoUcFeedback')));
    });
    q('acadCursoUcForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (salvandoUcs) return;
        const assoc = q('acadCursoUcId').value, curso = q('acadCursoUcCurso').value;
        const controles = [...q('acadCursoUcForm').querySelectorAll('input, select, button'), q('acadCursoUnidade')];
        const anteriores = controles.map(el => el.disabled);
        try {
            if (!assoc && (!associacoesProntas || !selecionadas.size)) throw new Error('Selecione pelo menos uma UC após carregar o curso.');
            const body = assoc ? {id_tipo_aula: q('acadCursoUcTipo').value, codigo_uc: q('acadCursoUcCodigo').value, carga_horaria_total: q('acadCursoUcCarga').value, modulo: q('acadCursoUcModulo').value} : {relacoes: [...selecionadas.values()].map(d => ({id_tipo_aula: d.id_tipo_aula, codigo_uc: d.codigo_uc.trim() || null, carga_horaria_total: Number(d.carga_horaria_total), modulo: d.modulo === '' ? null : Number(d.modulo)}))};
            salvandoUcs = true; controles.forEach(el => { el.disabled = true; });
            const result = await api(assoc ? `/cadastros-academicos/curso-ucs/${assoc}` : `/cadastros-academicos/cursos/${curso}/ucs/lote`, {method: assoc ? 'PUT' : 'POST', body: JSON.stringify(body)});
            limparAssociacao();
            feedback(result.message, false, q('acadCursoUcFeedback'));
            try { await carregarAssociacoes(); } catch (error) { feedback(`${result.message} Não foi possível atualizar a lista: ${error.message}`, true, q('acadCursoUcFeedback')); }
        } catch (error) { feedback(error.message, true, q('acadCursoUcFeedback')); }
        finally { controles.forEach((el, index) => { el.disabled = anteriores[index]; }); salvandoUcs = false; }
    });
    q('acadCursoUcCancelar').addEventListener('click', limparAssociacao);
    q('acadCursoUcsLista').addEventListener('click', async e => { if (salvandoUcs) return; const edit = e.target.closest('[data-uc-editar]'), status = e.target.closest('[data-uc-status]'); try { if (edit) { const a = associacoes.find(x => String(x.id_curso_uc) === edit.dataset.ucEditar); limparAssociacao(); modoAssociacao(true); if (![...q('acadCursoUcTipo').options].some(o => o.value === String(a.id_tipo_aula))) q('acadCursoUcTipo').add(new Option(a.descricao, a.id_tipo_aula)); q('acadCursoUcId').value = a.id_curso_uc; q('acadCursoUcTipo').value = a.id_tipo_aula; q('acadCursoUcCodigo').value = a.codigo_uc || ''; q('acadCursoUcCarga').value = a.carga_horaria_total; q('acadCursoUcModulo').value = a.modulo || ''; } if (status) { const ativo = Number(status.dataset.ativo); if (!ativo && !confirm('Inativar esta relação Curso × UC? O histórico será preservado.')) return; const result = await api(`/cadastros-academicos/curso-ucs/${status.dataset.ucStatus}/status`, { method: 'PATCH', body: JSON.stringify({ ativo: Boolean(ativo) }) }); feedback(result.message); await carregarAssociacoes(); } } catch (err) { feedback(err.message, true); } });

    async function carregarCursosTurma() { const unidade = q('acadTurmaUnidade').value; q('acadTurmaCurso').innerHTML = option('', 'Selecione um curso'); if (!unidade) return; const rows = await api(`/cadastros-academicos/cursos?unidade=${encodeURIComponent(unidade)}`); q('acadTurmaCurso').innerHTML += rows.filter(c => c.ativo).map(c => option(c.id_curso, c.nome_curso)).join(''); }
    async function carregarTurmas() { const unidade = q('acadTurmaUnidade').value; turmas = unidade ? await api(`/cadastros-academicos/turmas?unidade=${encodeURIComponent(unidade)}`) : []; q('acadTurmasLista').classList.toggle('empty-state', !turmas.length); q('acadTurmasLista').innerHTML = turmas.length ? turmas.map(t => `<div class="admin-row ${t.ativo ? '' : 'admin-row--inactive'}"><div class="admin-row__head"><div><h3>${escape(t.codigo_reduzido)}</h3><p>${escape(t.nome_curso)} · ${escape(t.turno || 'Turno não definido')}</p><p>${t.ativo ? 'Ativa' : 'Inativa'}</p></div><div class="admin-row__actions"><button class="btn btn-ghost" data-turma-editar="${t.id_turma}">Editar</button><button class="btn ${t.ativo ? 'btn-danger' : 'btn-primary'}" data-turma-status="${t.id_turma}" data-ativo="${t.ativo ? 0 : 1}">${t.ativo ? 'Inativar' : 'Reativar'}</button></div></div></div>`).join('') : (unidade ? 'Nenhuma turma cadastrada.' : 'Selecione uma unidade.'); }
    function limparTurma() { q('acadTurmaId').value = ''; q('acadTurmaCodigo').value = ''; q('acadTurmaAno').value = ''; q('acadTurmaSemestre').value = ''; q('acadTurmaTurno').value = ''; }
    q('acadTurmaUnidade').addEventListener('change', async () => { try { await Promise.all([carregarCursosTurma(), carregarTurmas()]); } catch (e) { feedback(e.message, true); } });
    q('acadTurmaForm').addEventListener('submit', async e => { e.preventDefault(); try { const turmaId = q('acadTurmaId').value; const body = { codigo_unidade: q('acadTurmaUnidade').value, id_curso: q('acadTurmaCurso').value, codigo_reduzido: q('acadTurmaCodigo').value, ano: q('acadTurmaAno').value, semestre: q('acadTurmaSemestre').value, turno: q('acadTurmaTurno').value }; const result = await api(turmaId ? `/cadastros-academicos/turmas/${turmaId}` : '/cadastros-academicos/turmas', { method: turmaId ? 'PUT' : 'POST', body: JSON.stringify(body) }); feedback(result.message); limparTurma(); await carregarTurmas(); } catch (err) { feedback(err.message, true); } });
    q('acadTurmaCancelar').addEventListener('click', limparTurma);
    q('acadTurmasLista').addEventListener('click', async e => { const edit = e.target.closest('[data-turma-editar]'), status = e.target.closest('[data-turma-status]'); try { if (edit) { const t = turmas.find(x => String(x.id_turma) === edit.dataset.turmaEditar); q('acadTurmaId').value = t.id_turma; q('acadTurmaCurso').value = t.id_curso; q('acadTurmaCodigo').value = t.codigo_reduzido; q('acadTurmaAno').value = t.ano || ''; q('acadTurmaSemestre').value = t.semestre || ''; q('acadTurmaTurno').value = t.turno || ''; q('acadTurmaCodigo').focus(); } if (status) { const ativo = Number(status.dataset.ativo); if (!ativo && !confirm('Inativar esta turma? As alocações históricas serão preservadas.')) return; const result = await api(`/cadastros-academicos/turmas/${status.dataset.turmaStatus}/status`, { method: 'PATCH', body: JSON.stringify({ ativo: Boolean(ativo) }) }); feedback(result.message); await carregarTurmas(); } } catch (err) { feedback(err.message, true); } });

    carregarUnidades().catch(error => feedback(error.message, true));
});
