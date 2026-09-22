'use strict';

const HELP_CONTEXT_TTL_MS = 5 * 60 * 1000;

const TOPICS = Object.freeze({
    overview: {
        roles: ['public', 'user', 'coordenador', 'admin'],
        patterns: [/(como funciona|me explica|usar o sistema|ajuda.*sistema|o que da pra fazer aqui|me ajuda)/],
        replies: {
            public: 'O Sistema de Agendamentos permite consultar a agenda pública, localizar ambientes e verificar informações públicas das salas. Também posso orientar sobre essas consultas. Você quer conhecer a agenda pública, as salas ou o que o JSON pode consultar?',
            authenticated: 'O Sistema de Agendamentos permite consultar salas e disponibilidade, criar e acompanhar agendamentos, visualizar sua agenda, solicitar trocas de sala e consultar informações dos ambientes conforme seu acesso. Sobre qual função você quer ajuda?'
        }
    },
    booking: {
        roles: ['public', 'user', 'coordenador', 'admin'],
        patterns: [/(como|onde).*(agend|reserv|marc).*(sala)?/, /quero (agendar|reservar|marcar).*sala/, /como funciona.*agendamento/],
        replies: {
            public: 'A criação de agendamentos exige login. Depois de entrar, abra o Dashboard do Professor e use “Agendar Sala”. Sem login, você ainda pode consultar a agenda pública e informações públicas das salas.',
            authenticated: 'Para agendar, entre no Dashboard do Professor e abra “Agendar Sala”. Selecione unidade, colaborador, sala, datas ou dias da semana, horários, unidade curricular e motivo/turma. Você pode verificar conflitos e salas disponíveis antes de confirmar em “Agendar Sala”.'
        }
    },
    public_schedule: {
        roles: ['public', 'user', 'coordenador', 'admin'],
        patterns: [/(onde|como).*(ver|consult).*(agenda publica|agendamentos gerais|todos os agendamentos)/, /agenda publica/],
        reply: 'A página pública “Agendamentos” permite escolher a unidade e filtrar por sala, professor, período, turno e dia da semana. A tela “Encontre sua Sala” também mostra os agendamentos atuais por unidade.'
    },
    my_schedule: {
        roles: ['user', 'coordenador', 'admin'],
        patterns: [/(como|onde).*(vejo|ver|consult).*(meus agendamentos|minha agenda|minhas reservas)/, /(meus agendamentos|minha agenda).*(onde|como)/],
        reply: 'No Dashboard do Professor, use “Minha Agenda” para a visualização em calendário. Na área “Agendar Sala”, o botão “Ver meus Agendamentos” e os filtros por sala, período, turno e dia da semana ajudam a localizar seus registros.'
    },
    full_schedule: {
        roles: ['user', 'coordenador', 'admin'],
        patterns: [/(como|onde).*(agenda completa)/, /agenda completa/],
        reply: 'No Dashboard do Professor, abra “Agenda Completa”. A tela permite filtrar os agendamentos por unidade, sala, professor, datas, turno e dia da semana.'
    },
    rooms: {
        roles: ['public', 'user', 'coordenador', 'admin'],
        patterns: [/(onde|como).*(vejo|ver|consult).*(salas|equipamentos|informacoes da sala|detalhes da sala)/, /mapa de salas/],
        replies: {
            public: 'Você pode consultar as salas e suas informações públicas pelo JSON. Para consultar agendamentos, use também as páginas públicas “Encontre sua Sala” e “Agendamentos”.',
            authenticated: 'No Dashboard do Professor, abra “Mapa de Salas”, escolha a unidade e depois a sala. O visualizador apresenta os detalhes e equipamentos cadastrados para o ambiente. Você também pode perguntar ao JSON sobre uma sala específica.'
        }
    },
    swap: {
        roles: ['user', 'coordenador', 'admin'],
        patterns: [/(como funciona|como faco|onde).*(troca de sala|trocar sala)/, /troca de sala/],
        reply: 'No Dashboard do Professor, abra “Troca de Sala”. Na troca simples, escolha um agendamento seu e um agendamento de destino e envie a solicitação; a outra pessoa pode aceitar ou recusar. A mesma área possui troca múltipla. Coordenadores também possuem uma opção de troca direta na tela de gerenciamento da agenda.'
    },
    reports: {
        roles: ['user', 'coordenador', 'admin'],
        patterns: [/(como|onde).*(relatorios|relatorio)/, /meus relatorios/],
        reply: 'No Dashboard do Professor, a área “Relatórios” apresenta horas por unidade curricular, uso de salas e agendamentos por período. Coordenadores e administradores também possuem relatório de equipamentos por unidade e sala.'
    },
    profile: {
        roles: ['user', 'coordenador', 'admin'],
        patterns: [/(como|onde).*(perfil|alterar senha|configuracoes)/],
        reply: 'No Dashboard do Professor, abra “Configurações”. Ali você pode consultar e editar os dados permitidos do seu perfil e alterar sua senha.'
    },
    administration: {
        roles: ['coordenador', 'admin'],
        patterns: [/(o que|quais|como|onde).*(administr|coordenador|gerenciar sistema)/, /funcoes administrativas/],
        reply: 'Conforme seu perfil, o painel administrativo oferece gerenciamento de agenda, auditoria de agendamentos, usuários, salas, unidades curriculares, unidades, disponibilidade de professores, equipamentos e relatórios de equipamentos. Cada operação continua limitada às unidades e permissões da sua sessão.'
    },
    programs: {
        roles: ['coordenador', 'admin'],
        patterns: [/(como|onde).*(programas|gerenciar programas)/],
        reply: 'A área “Gerenciar Programas” permite administrar programas e seus vínculos com salas. As operações exigem perfil de coordenador ou administrador autenticado.'
    }
});

function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getRole(req) {
    if (!req.session?.user) return 'public';
    const role = normalize(req.session.user.permissao);
    return ['admin', 'coordenador'].includes(role) ? role : 'user';
}

function isAllowed(topic, role) {
    return Boolean(topic?.roles.includes(role));
}

function findTopic(message, req) {
    const text = normalize(message);
    const role = getRole(req);
    const priority = ['my_schedule', 'public_schedule', 'full_schedule', 'swap', 'rooms', 'reports', 'profile', 'programs', 'administration', 'booking', 'overview'];
    return priority.find((name) => isAllowed(TOPICS[name], role) && TOPICS[name].patterns.some((pattern) => pattern.test(text))) || null;
}

function isHelpLike(message) {
    const text = normalize(message);
    return /\b(como|onde|ajuda|ajudar|explica|funciona|usar|fazer|ver|consultar|reservar|agendar|marcar)\b/.test(text);
}

function getContext(req) {
    const context = req.session?.jeysonHelpContext;
    if (!context || Date.now() - Number(context.updatedAt || 0) > HELP_CONTEXT_TTL_MS) return null;
    if (context.role !== getRole(req)) return null;
    return context;
}

function resolveHelp(req, message) {
    const role = getRole(req);
    const topicName = findTopic(message, req);
    if (!topicName) return null;
    const topic = TOPICS[topicName];
    const reply = topic.replies?.[role === 'public' ? 'public' : 'authenticated'] || topic.reply;
    return { topic: topicName, reply };
}

function resolveHelpFollowUp(req, message) {
    const context = getContext(req);
    if (!context || !isHelpLike(message)) return null;
    if (/^(?:e\s+)?(?:como|onde)?\s*(?:funciona|faco|uso|vejo|isso)?\s*[?!.]?$/i.test(normalize(message))) {
        const topic = TOPICS[context.topic];
        if (!isAllowed(topic, getRole(req))) return null;
        const reply = topic.replies?.[getRole(req) === 'public' ? 'public' : 'authenticated'] || topic.reply;
        return reply ? { topic: context.topic, reply } : null;
    }
    return resolveHelp(req, message);
}

function buildCapabilitiesReply(req, operationalCapabilities) {
    const role = getRole(req);
    const operational = Array.isArray(operationalCapabilities) ? operationalCapabilities.slice(0, 4) : [];
    const guidance = role === 'public'
        ? 'Também explico como usar as consultas públicas e encontrar informações das salas.'
        : 'Também explico como agendar, consultar sua agenda, usar a troca de sala e navegar pelas funções permitidas ao seu perfil.';
    return `Posso ajudar com ${operational.join(', ')}. ${guidance} O que você quer fazer?`;
}

function storeContext(req, topic) {
    if (!req.session) return;
    req.session.jeysonHelpContext = { topic, role: getRole(req), updatedAt: Date.now() };
}

function clearContext(req) {
    if (req.session) delete req.session.jeysonHelpContext;
}

module.exports = { resolveHelp, resolveHelpFollowUp, buildCapabilitiesReply, storeContext, clearContext, getRole, __test: { findTopic, getContext, isAllowed } };
