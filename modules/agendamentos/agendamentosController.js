const svc = require('./agendamentosService');
const trocaSalaNotifier = require('./trocaSalaNotifier');

function atualizarTokenAvisoProfessorSessao(req, resultado) {
    if (!req.session) return;

    const token = typeof resultado?.avisoProfessorToken === 'string' ? resultado.avisoProfessorToken : '';
    if (token) {
        req.session.avisoProfessorAgendamentoToken = token;
    } else {
        delete req.session.avisoProfessorAgendamentoToken;
    }
}

function montarAssinaturaAgendamento(payload) {
    const datas = Array.isArray(payload?.data_reservas)
        ? payload.data_reservas.map(String).filter(Boolean).sort()
        : [];

    return {
        id_sala: String(payload?.id_sala || ''),
        id_professor: String(payload?.id_professor || ''),
        hora_inicio: String(payload?.hora_inicio || ''),
        hora_fim: String(payload?.hora_fim || ''),
        motivo: String(payload?.motivo || ''),
        tipo_aula: String(payload?.tipo_aula || ''),
        datas
    };
}

function resumirDisponibilidadeParaSessao(payload, resultado) {
    return {
        assinatura: montarAssinaturaAgendamento(payload),
        resultado: {
            totalSolicitadas: resultado?.totalSolicitadas || 0,
            datasSolicitadas: Array.isArray(payload?.data_reservas) ? payload.data_reservas.filter(Boolean) : [],
            datasDisponiveis: Array.isArray(resultado?.datasDisponiveis) ? resultado.datasDisponiveis : [],
            conflitosSala: Array.isArray(resultado?.conflitosSala) ? resultado.conflitosSala : [],
            conflitos: Array.isArray(resultado?.conflitos) ? resultado.conflitos : [],
            avisosProfessor: Array.isArray(resultado?.avisosProfessor) ? resultado.avisosProfessor : [],
            professorAgendamento: resultado?.professorAgendamento || null
        }
    };
}

function atualizarResumoPreVerificacaoSessao(req, payload, resultado) {
    if (!req.session) return;
    req.session.ultimoResumoAgendamento = resumirDisponibilidadeParaSessao(payload, resultado);
}

function obterResumoPreVerificacaoSessao(req, payload) {
    const salvo = req.session?.ultimoResumoAgendamento;
    if (!salvo) return null;

    const assinaturaAtual = JSON.stringify(montarAssinaturaAgendamento(payload));
    const assinaturaSalva = JSON.stringify(salvo.assinatura || {});
    return assinaturaAtual === assinaturaSalva ? salvo.resultado : null;
}

// ──────────────────────────────────────────────────────────────
// Agendamentos — CRUD
// ──────────────────────────────────────────────────────────────

async function agendarSala(req, res) {
    const { id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula } = req.body;
    const idProfessorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;
    const podeAgendarEmNomeDeTerceiros = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
    const confirmarAgendamento = req.body?.confirmarAgendamento === true;
    const usarSomenteDisponiveis = req.body?.usarSomenteDisponiveis === true;
    const aceitarAvisosProfessor = req.body?.aceitarAvisosProfessor === true;
    const avisoProfessorToken = String(req.body?.avisoProfessorToken || '');
    const avisoProfessorTokenSessao = String(req.session?.avisoProfessorAgendamentoToken || '');
    const payloadAgendamento = { id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula };

    if (!id_sala || !id_professor || !Array.isArray(data_reservas) || !hora_inicio || !hora_fim || !motivo || !tipo_aula) {
        return res.status(400).json({ message: 'Dados incompletos ou inválidos' });
    }
    if (!Number.isInteger(idProfessorSessao)) {
        return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    if (!podeAgendarEmNomeDeTerceiros && Number(id_professor) !== idProfessorSessao) {
        return res.status(403).json({ message: 'Não é permitido agendar em nome de outro professor.' });
    }

    const unidadesSessao = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];

    try {
        const resultado = await svc.agendarSala({
            idSala: id_sala, idProfessor: id_professor, dataReservas: data_reservas,
            horaInicio: hora_inicio, horaFim: hora_fim, motivo, tipoAula: tipo_aula,
            idProfessorSessao, podeAgendarEmNomeDeTerceiros, unidadesSessao,
            confirmarAgendamento,
            usarSomenteDisponiveis,
            aceitarAvisosProfessor,
            avisoProfessorToken,
            avisoProfessorTokenSessao,
            usuarioResponsavel: req.session?.user,
            resumoPreVerificacao: obterResumoPreVerificacaoSessao(req, payloadAgendamento)
        });
        atualizarTokenAvisoProfessorSessao(req, resultado);
        if (req.session) {
            delete req.session.ultimoResumoAgendamento;
        }
        return res.status(200).json({ message: 'Agendamentos criados com sucesso!', ...resultado });
    } catch (error) {
        if (error.status) {
            if (error.details) {
                atualizarTokenAvisoProfessorSessao(req, error.details);
                return res.status(error.status).json({ message: error.message, ...error.details });
            }
            return res.status(error.status).json({ message: error.message });
        }
        if (error.message === 'Data inválida.') return res.status(400).json({ message: 'Data inválida.' });
        console.error('Erro ao criar agendamentos:', error);
        return res.status(500).json({ message: 'Erro ao criar agendamentos.' });
    }
}

async function verificarDisponibilidadeAgendamentos(req, res) {
    const { id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula } = req.body;
    const idProfessorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;
    const podeAgendarEmNomeDeTerceiros = permissaoSessao === 'admin' || permissaoSessao === 'coordenador';
    const payloadAgendamento = { id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula };

    if (!id_sala || !id_professor || !Array.isArray(data_reservas) || !hora_inicio || !hora_fim || !motivo || !tipo_aula) {
        return res.status(400).json({ message: 'Dados incompletos ou inválidos' });
    }
    if (!Number.isInteger(idProfessorSessao)) {
        return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    if (!podeAgendarEmNomeDeTerceiros && Number(id_professor) !== idProfessorSessao) {
        return res.status(403).json({ message: 'Não é permitido agendar em nome de outro professor.' });
    }

    const unidadesSessao = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];

    try {
        const resultado = await svc.verificarDisponibilidadeAgendamentos({
            idSala: id_sala,
            idProfessor: id_professor,
            dataReservas: data_reservas,
            horaInicio: hora_inicio,
            horaFim: hora_fim,
            motivo,
            tipoAula: tipo_aula,
            idProfessorSessao,
            podeAgendarEmNomeDeTerceiros,
            unidadesSessao
        });
        atualizarTokenAvisoProfessorSessao(req, resultado);
        atualizarResumoPreVerificacaoSessao(req, payloadAgendamento, resultado);
        return res.status(200).json(resultado);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ message: error.message });
        console.error('Erro ao verificar disponibilidade:', error);
        return res.status(500).json({ message: 'Erro ao verificar disponibilidade.' });
    }
}

async function editarAgendamento(req, res) {
    const { id } = req.params;
    const { professor, tipoAtividade, motivo } = req.body;
    const idProfessorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;

    try {
        await svc.editarAgendamento({ id, professor, tipoAtividade, motivo, idProfessorSessao, permissaoSessao, usuarioResponsavel: req.session?.user });
        return res.status(200).send('Agendamento atualizado com sucesso.');
    } catch (error) {
        if (error.status) return res.status(error.status).send(error.message);
        console.error('Erro ao editar agendamento:', error);
        return res.status(500).send('Erro ao editar agendamento.');
    }
}

async function editarProfessorAgendamento(req, res) {
    const { id } = req.params;
    const { professor } = req.body;
    const idProfessorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;

    try {
        await svc.editarProfessorAgendamento({ id, professor, idProfessorSessao, permissaoSessao, usuarioResponsavel: req.session?.user });
        return res.status(200).send('Professor do agendamento atualizado com sucesso.');
    } catch (error) {
        if (error.status) return res.status(error.status).send(error.message);
        console.error('Erro ao editar professor do agendamento:', error);
        return res.status(500).send('Erro ao editar professor do agendamento.');
    }
}

async function verificarAgendamento(req, res) {
    const { id_sala, data, hora_inicio, hora_fim } = req.params;
    try {
        const resultado = await svc.verificarAgendamento({ idSala: id_sala, data, horaInicio: hora_inicio, horaFim: hora_fim });
        return res.json(resultado);
    } catch (error) {
        console.error('Erro ao verificar agendamentos:', error);
        return res.status(500).send('Erro ao verificar agendamentos.');
    }
}

async function listarAgendamentosSala(req, res) {
    const { id_Sala } = req.params;
    try {
        const agendamentos = await svc.listarAgendamentosSala(id_Sala);
        if (!agendamentos.length) return res.status(204).send('Não há agendamentos para esta sala hoje.');
        return res.json(agendamentos);
    } catch (error) {
        console.error('Erro ao listar agendamentos:', error);
        return res.status(500).send('Erro ao listar agendamentos.');
    }
}

async function listarAgendamentosProfessor(req, res) {
    const { id_professor } = req.params;
    const idProfessorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;

    try {
        const agendamentos = await svc.listarAgendamentosProfessor(id_professor, idProfessorSessao, permissaoSessao);
        return res.json(agendamentos || []);
    } catch (error) {
        if (error.status) return res.status(error.status).send(error.message);
        console.error('Erro ao listar agendamentos:', error);
        return res.status(500).send('Erro ao listar agendamentos.');
    }
}

async function listarAgendamentosProfessorLogado(req, res) {
    const id_professor = req.session.user?.id_professor;
    if (!id_professor) return res.status(401).send('Usuário não autenticado.');

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const agendamentos = await svc.listarAgendamentosProfessorLogado(id_professor);
        return res.json(agendamentos);
    } catch (error) {
        console.error('Erro ao listar agendamentos do professor:', error);
        return res.status(500).send('Erro ao listar agendamentos do professor.');
    }
}

async function streamTrocasSala(req, res) {
    const idProfessor = Number(req.session?.user?.id_professor);
    if (!Number.isInteger(idProfessor) || idProfessor <= 0) {
        return res.status(401).send('Usuário não autenticado.');
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
            res.write(': ping\n\n');
        }
    }, 25000);

    const cleanup = trocaSalaNotifier.registrarCliente(idProfessor, res);

    req.on('close', () => {
        clearInterval(heartbeat);
        cleanup();
    });
}

async function excluirAgendamento(req, res) {
    const { id } = req.params;
    const idProfessorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        await svc.excluirAgendamentoById(id, idProfessorSessao, permissaoSessao, req.session?.user);
        return res.status(200).send('Agendamento excluído com sucesso.');
    } catch (error) {
        if (error.status) return res.status(error.status).send(error.message);
        if (Number(error?.number) === 547) {
            return res.status(409).send('Este agendamento possui vínculos de troca e não pode ser excluído automaticamente.');
        }
        console.error('Erro ao excluir agendamento:', error);
        return res.status(500).send('Erro ao excluir agendamento.');
    }
}

async function excluirAgendamentosIntervalo(req, res) {
    const { codigoUnidade, dataInicio, dataFim } = req.body;
    const permissaoSessao = req.session?.user?.permissao;

    try {
        await svc.excluirAgendamentosIntervalo({ codigoUnidade, dataInicio, dataFim, permissaoSessao, usuarioResponsavel: req.session?.user });
        return res.status(200).send('Agendamentos excluídos com sucesso.');
    } catch (error) {
        if (error.status) return res.status(error.status).send(error.message);
        if (Number(error?.number) === 547) {
            return res.status(409).send('Há agendamentos no intervalo com vínculos que impedem a exclusão.');
        }
        console.error('Erro ao excluir agendamentos no intervalo:', error);
        return res.status(500).send('Erro ao excluir agendamentos.');
    }
}

async function listarAgendamentosUnidade(req, res) {
    const { unidadeCodigo } = req.params;
    const permissaoSessao = req.session?.user?.permissao;
    const unidadesSessao = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];

    try {
        const agendamentos = await svc.listarAgendamentosUnidade(unidadeCodigo, permissaoSessao, unidadesSessao);
        return res.json(agendamentos);
    } catch (error) {
        if (error.status) return res.status(error.status).send(error.message);
        console.error('Erro ao listar agendamentos:', error);
        return res.status(500).send('Erro ao listar agendamentos.');
    }
}

async function listarAgendamentosFiltrados(req, res) {
    const { unidadeCodigo, professor, dataInicio, dataFim, sala } = req.query;
    try {
        const agendamentos = await svc.listarAgendamentosFiltrados({ unidadeCodigo, professor, dataInicio, dataFim, sala });
        return res.json(agendamentos);
    } catch (error) {
        console.error('Erro ao listar agendamentos filtrados:', error);
        return res.status(500).send('Erro ao listar agendamentos filtrados.');
    }
}

async function listarAgendamentosDashboardFiltrados(req, res) {
    const { unidadeCodigo, professor, dataInicio, dataFim, sala, turno, diaSemana } = req.query;
    const permissaoSessao = req.session?.user?.permissao;
    const unidadesSessao = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];

    try {
        const agendamentos = await svc.listarAgendamentosDashboardFiltrados({
            unidadeCodigo,
            professor,
            dataInicio,
            dataFim,
            sala,
            turno,
            diaSemana,
            permissaoSessao,
            unidadesSessao
        });
        return res.json(agendamentos);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao listar agendamentos do dashboard:', error);
        return res.status(500).json({ error: 'Erro ao listar agendamentos do dashboard.' });
    }
}

async function listarAgendamentosTrocaCoordenador(req, res) {
    const { unidadeCodigo } = req.params;
    const professorId = Number.parseInt(req.query?.professorId, 10);
    const permissaoSessao = req.session?.user?.permissao;
    const unidadesSessao = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];

    try {
        const agendamentos = await svc.listarAgendamentosParaTrocaCoordenador({
            unidadeCodigo,
            professorId: Number.isInteger(professorId) ? professorId : null,
            permissaoSessao,
            unidadesSessao
        });
        return res.json(agendamentos);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao listar agendamentos para troca do coordenador:', error);
        return res.status(500).json({ error: 'Erro ao listar agendamentos para troca.' });
    }
}

async function executarTrocaDiretaCoordenador(req, res) {
    const idCoordenadorSessao = Number(req.session?.user?.id_professor);
    const permissaoSessao = req.session?.user?.permissao;
    const unidadesSessao = Array.isArray(req.session?.user?.unidades) ? req.session.user.unidades : [];
    const idAgendamentoOrigem = Number(req.body?.id_agendamento_origem);
    const idAgendamentoDestino = Number(req.body?.id_agendamento_destino);

    try {
        const resultado = await svc.coordenadorTrocaDiretaSala({
            idAgendamentoOrigem,
            idAgendamentoDestino,
            idCoordenadorSessao,
            permissaoSessao,
            unidadesSessao
        });

        trocaSalaNotifier.notificarProfessores(
            [resultado.id_professor_origem, resultado.id_professor_destino],
            'troca-sala',
            {
                evento: 'coordenador-troca-direta',
                id_professor_origem: resultado.id_professor_origem,
                id_professor_destino: resultado.id_professor_destino,
                professor_origem_nome: resultado.professor_origem_nome,
                professor_destino_nome: resultado.professor_destino_nome,
                sala_origem_anterior: resultado.sala_origem_anterior,
                sala_destino_anterior: resultado.sala_destino_anterior,
                data_reservas: resultado.data_reservas,
                hora_inicio: resultado.hora_inicio,
                hora_fim: resultado.hora_fim,
                codigo_unidade: resultado.codigo_unidade
            }
        );

        return res.json({ message: 'Troca direta realizada com sucesso pelo coordenador.' });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao executar troca direta do coordenador:', error);
        return res.status(500).json({ error: 'Erro ao executar troca direta.' });
    }
}

// ──────────────────────────────────────────────────────────────
// Troca de sala — simples
// ──────────────────────────────────────────────────────────────

async function listarPossiveisTrocas(req, res) {
    const idProfessorLogado = req.session.user.id_professor;
    const idAgendamentoOrigem = Number(req.params.idAgendamentoOrigem);
    if (!Number.isInteger(idAgendamentoOrigem)) return res.status(400).json({ error: 'Agendamento de origem inválido.' });
    try {
        const resultado = await svc.listarPossiveisTrocas(idProfessorLogado, idAgendamentoOrigem);
        return res.json(resultado);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao listar agendamentos possíveis para troca:', error);
        return res.status(500).json({ error: 'Erro ao buscar opções de troca.' });
    }
}

async function solicitarTroca(req, res) {
    const idProfessorOrigem = req.session.user.id_professor;
    const idAgendamentoOrigem = Number(req.body.id_agendamento_origem);
    const idAgendamentoDestino = Number(req.body.id_agendamento_destino);
    const mensagem = String(req.body.mensagem || '').trim().slice(0, 500);

    if (!Number.isInteger(idAgendamentoOrigem) || !Number.isInteger(idAgendamentoDestino)) return res.status(400).json({ error: 'Agendamentos de origem e destino são obrigatórios.' });
    if (idAgendamentoOrigem === idAgendamentoDestino) return res.status(400).json({ error: 'Os agendamentos de origem e destino não podem ser iguais.' });

    try {
        const idSolicitacao = await svc.solicitarTroca({ idProfessorOrigem, idAgendamentoOrigem, idAgendamentoDestino, mensagem });
        const resultado = await svc.obterResumoTrocaPorSolicitacao(idSolicitacao);
        trocaSalaNotifier.notificarProfessores(
            [resultado.id_professor_origem, resultado.id_professor_destino],
            'troca-sala',
            {
                evento: 'solicitacao-criada',
                id_solicitacao: idSolicitacao,
                id_professor_origem: resultado.id_professor_origem,
                id_professor_destino: resultado.id_professor_destino,
            }
        );
        return res.status(201).json({ message: 'Solicitação enviada com sucesso.', id_solicitacao: idSolicitacao });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao criar solicitação de troca:', error);
        return res.status(500).json({ error: 'Erro ao criar solicitação de troca.' });
    }
}

async function listarTrocasRecebidas(req, res) {
    const idProfessorLogado = req.session.user.id_professor;
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const pageSize = Math.min(8, Math.max(1, Number.parseInt(req.query?.pageSize, 10) || 8));

    try {
        const resultado = await svc.listarTrocasRecebidas(idProfessorLogado, { page, pageSize });
        return res.json(resultado);
    } catch (error) {
        console.error('Erro ao listar solicitações recebidas:', error);
        return res.status(500).json({ error: 'Erro ao listar solicitações recebidas.' });
    }
}

async function listarTrocasEnviadas(req, res) {
    const idProfessorLogado = req.session.user.id_professor;
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const pageSize = Math.min(8, Math.max(1, Number.parseInt(req.query?.pageSize, 10) || 8));

    try {
        const resultado = await svc.listarTrocasEnviadas(idProfessorLogado, { page, pageSize });
        return res.json(resultado);
    } catch (error) {
        console.error('Erro ao listar solicitações enviadas:', error);
        return res.status(500).json({ error: 'Erro ao listar solicitações enviadas.' });
    }
}

async function decidirTroca(req, res) {
    const idProfessorDestino = req.session.user.id_professor;
    const idSolicitacao = Number(req.params.idSolicitacao);
    const acao = String(req.body.acao || '').toLowerCase();
    if (!Number.isInteger(idSolicitacao)) return res.status(400).json({ error: 'Solicitação inválida.' });
    if (!['aceitar', 'recusar'].includes(acao)) return res.status(400).json({ error: 'Ação inválida. Use aceitar ou recusar.' });
    try {
        const resultado = await svc.decidirTroca({ idSolicitacao, idProfessorDestino, acao });
        const resumo = await svc.obterResumoTrocaPorSolicitacao(idSolicitacao);
        trocaSalaNotifier.notificarProfessores(
            [resumo.id_professor_origem, resumo.id_professor_destino],
            'troca-sala',
            {
                evento: 'solicitacao-atualizada',
                id_solicitacao: idSolicitacao,
                status: acao === 'aceitar' ? 'ACEITA' : 'RECUSADA',
                id_professor_origem: resumo.id_professor_origem,
                id_professor_destino: resumo.id_professor_destino,
            }
        );
        return res.json(resultado);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao decidir solicitação de troca:', error);
        return res.status(500).json({ error: 'Erro ao processar a decisão da solicitação.' });
    }
}

// ──────────────────────────────────────────────────────────────
// Troca de sala — lote
// ──────────────────────────────────────────────────────────────

async function solicitarTrocaLote(req, res) {
    const idProfessorOrigem = req.session.user.id_professor;
    const mensagem = String(req.body.mensagem || '').trim().slice(0, 500);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length < 2) return res.status(400).json({ error: 'O pacote múltiplo precisa de pelo menos 2 trocas.' });
    try {
        const idLote = await svc.solicitarTrocaLote({ idProfessorOrigem, mensagem, items });
        return res.status(201).json({ message: 'Pacote de troca enviado com sucesso.', id_lote: idLote });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao criar pacote múltiplo de troca:', error);
        return res.status(500).json({ error: 'Erro ao criar pacote múltiplo de troca.' });
    }
}

async function listarLotesRecebidos(req, res) {
    const idProfessorLogado = req.session.user.id_professor;
    try {
        const resultado = await svc.listarLotesRecebidos(idProfessorLogado);
        return res.json(resultado);
    } catch (error) {
        console.error('Erro ao listar lotes recebidos:', error);
        return res.status(500).json({ error: 'Erro ao listar lotes recebidos.' });
    }
}

async function listarLotesEnviados(req, res) {
    const idProfessorLogado = req.session.user.id_professor;
    try {
        const resultado = await svc.listarLotesEnviados(idProfessorLogado);
        return res.json(resultado);
    } catch (error) {
        console.error('Erro ao listar lotes enviados:', error);
        return res.status(500).json({ error: 'Erro ao listar lotes enviados.' });
    }
}

async function buscarDetalhesLote(req, res) {
    const idProfessorLogado = req.session.user.id_professor;
    const idLote = Number(req.params.idLote);
    if (!Number.isInteger(idLote)) return res.status(400).json({ error: 'Lote inválido.' });
    try {
        const resultado = await svc.buscarDetalhesLote(idLote, idProfessorLogado);
        return res.json(resultado);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao listar detalhes do lote:', error);
        return res.status(500).json({ error: 'Erro ao listar detalhes do lote.' });
    }
}

async function decidirTrocaLote(req, res) {
    const idProfessorDestino = req.session.user.id_professor;
    const idLote = Number(req.params.idLote);
    const acao = String(req.body.acao || '').toLowerCase();
    if (!Number.isInteger(idLote)) return res.status(400).json({ error: 'Lote inválido.' });
    if (!['aceitar', 'recusar'].includes(acao)) return res.status(400).json({ error: 'Ação inválida. Use aceitar ou recusar.' });
    try {
        const resultado = await svc.decidirTrocaLote({ idLote, idProfessorDestino, acao });
        const resumo = await svc.obterResumoTrocaLote(idLote);
        trocaSalaNotifier.notificarProfessores(
            [resumo.id_professor_origem, resumo.id_professor_destino],
            'troca-sala',
            {
                evento: 'lote-atualizado',
                id_lote: idLote,
                status: acao === 'aceitar' ? 'ACEITA' : 'RECUSADA',
                id_professor_origem: resumo.id_professor_origem,
                id_professor_destino: resumo.id_professor_destino,
            }
        );
        return res.json(resultado);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Erro ao decidir lote de troca:', error);
        return res.status(500).json({ error: 'Erro ao processar o lote de troca.' });
    }
}

// ──────────────────────────────────────────────────────────────
// Legado
// ──────────────────────────────────────────────────────────────

async function verificarEExcluirAgendamentosExpirados(req, res) {
    try {
        await svc.verificarEExcluirAgendamentosExpirados();
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao verificar agendamentos expirados:', error);
        return res.status(500).json({ error: 'Erro ao verificar agendamentos expirados.' });
    }
}

module.exports = {
    agendarSala,
    verificarDisponibilidadeAgendamentos,
    editarAgendamento,
    editarProfessorAgendamento,
    verificarAgendamento,
    listarAgendamentosSala,
    listarAgendamentosProfessor,
    listarAgendamentosProfessorLogado,
    streamTrocasSala,
    excluirAgendamento,
    excluirAgendamentosIntervalo,
    listarAgendamentosUnidade,
    listarAgendamentosFiltrados,
    listarAgendamentosDashboardFiltrados,
    listarAgendamentosTrocaCoordenador,
    executarTrocaDiretaCoordenador,
    listarPossiveisTrocas,
    solicitarTroca,
    listarTrocasRecebidas,
    listarTrocasEnviadas,
    decidirTroca,
    solicitarTrocaLote,
    listarLotesRecebidos,
    listarLotesEnviados,
    buscarDetalhesLote,
    decidirTrocaLote,
    verificarEExcluirAgendamentosExpirados,
};
