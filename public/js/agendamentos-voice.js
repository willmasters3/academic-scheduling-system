(function (root, factory) {
    const core = root?.AgendamentosVoiceCore || (typeof require === 'function' ? require('./agendamentos-voice-core') : null);
    const api = factory(core);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.AgendamentosVoiceAssistant = api;
}(typeof window !== 'undefined' ? window : null, function (Core) {
    'use strict';
    if (!Core) throw new Error('AgendamentosVoiceCore não foi carregado.');

    const STATUS_TEXT = Object.freeze({
        STANDBY: '🎤 Aguardando “Jason”', LISTENING: '🎤 Ouvindo... pode continuar',
        PROCESSING: '🔎 Analisando...', RESPONDING: '🔊 Falando...',
        CONVERSATION: '🎤 Pode perguntar mais alguma coisa', DISABLED: '🎤 Ativar Jason'
    });

    function createUi() {
        const wrapper = document.createElement('div'); wrapper.className = 'voice-assistant';
        const status = document.createElement('button'); status.type = 'button'; status.className = 'voice-assistant__status';
        status.textContent = STATUS_TEXT.DISABLED; status.setAttribute('aria-label', 'Ativar assistente de voz Jason');
        const panel = document.createElement('div'); panel.className = 'voice-assistant__panel'; panel.hidden = true;
        wrapper.append(status, panel); document.body.appendChild(wrapper); return { wrapper, status, panel };
    }

    function diagnoseVoiceEnvironment(environment) {
        if (!environment.secureContext) return { supported: false, code: 'insecure-context', status: '🎤 Microfone bloqueado: use HTTPS' };
        if (environment.policyAllowed === false) return { supported: false, code: 'policy-blocked', status: '🎤 Microfone bloqueado pela política do navegador' };
        if (!environment.mediaDevices) return { supported: false, code: 'media-devices-unavailable', status: '🎤 Microfone indisponível' };
        if (typeof environment.getUserMedia !== 'function') return { supported: false, code: 'get-user-media-unavailable', status: '🎤 Acesso ao microfone indisponível' };
        if (!environment.Recognition) return { supported: false, code: 'speech-recognition-unavailable', status: '🎤 Reconhecimento de voz indisponível' };
        return { supported: true, code: 'ready', status: STATUS_TEXT.DISABLED };
    }

    function describeMicrophoneError(error) {
        const name = String(error?.name || ''); const message = String(error?.message || '');
        if (/NotFound|DevicesNotFound/.test(name)) return '🎤 Nenhum dispositivo de microfone encontrado';
        if (name === 'SecurityError' || /policy|blocked/i.test(message)) return '🎤 Microfone bloqueado pela política do navegador';
        if (/NotAllowed|PermissionDenied/.test(name)) return '🎤 Permissão do microfone negada';
        if (/NotReadable|TrackStart/.test(name)) return '🎤 Microfone indisponível ou em uso';
        return '🎤 Não foi possível acessar o microfone';
    }

    async function requestAudioPermission(mediaDevices) {
        const stream = await mediaDevices.getUserMedia({ audio: true });
        (typeof stream?.getTracks === 'function' ? stream.getTracks() : []).forEach((track) => track.stop()); return true;
    }

    function todayIso(now = new Date()) {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`;
    }

    function locationLabel(room) { return /^sala\b/i.test(room) ? room : /^\d+$/.test(String(room)) ? `sala ${room}` : room; }
    function buildResponse(parsed, results, context = {}) {
        if (!parsed) return 'Não consegui identificar a consulta. Você pode perguntar por uma pessoa, sala ou turma.';
        if (parsed.intent === Core.INTENTS.FIND_PERSON) {
            const resolution = parsed.resolution;
            if (!parsed.entities.person || resolution?.state === Core.RESULT_STATES.ENTITY_MISSING) return 'Qual professor você quer localizar?';
            if (resolution?.state === Core.RESULT_STATES.AMBIGUOUS) return `Encontrei mais de uma pessoa: ${resolution.candidates.slice(0, 4).map((item) => item.name).join(' ou ')}. Qual delas você procura?`;
            const label = resolution?.value?.name || parsed.entities.person;
            if (!results.length) return context.resultState === Core.RESULT_STATES.FILTERED_BY_SHIFT ? `Não encontrei ${label} neste turno.` : `Não encontrei ${label} agora.`;
            const rooms = Array.from(new Set(results.map((item) => item.nome_sala).filter(Boolean)));
            return rooms.length === 1 ? `Encontrei ${label} na ${locationLabel(rooms[0])}.` : `Encontrei ${label} em ${rooms.map(locationLabel).join(' e ')}.`;
        }
        if (parsed.intent === Core.INTENTS.FIND_CLASS) {
            const code = String(parsed.entities.class || '').toUpperCase();
            if (!code) return 'Qual turma você quer localizar?';
            if (!results.length) return context.resultState === Core.RESULT_STATES.FILTERED_BY_SHIFT ? `Não encontrei a turma ${code} neste turno.` : `Não encontrei a turma ${code}.`;
            return `A turma ${code} está em ${Array.from(new Set(results.map((item) => locationLabel(item.nome_sala)))).join(' e ')}.`;
        }
        if (parsed.intent === Core.INTENTS.CLARIFY_ENTITY) return `O código ${parsed.entities.value} existe como sala e como turma. Qual dos dois você quer consultar?`;
        if ([Core.INTENTS.QUERY_ROOM, Core.INTENTS.ROOM_PERSON, Core.INTENTS.ROOM_CLASS].includes(parsed.intent)) {
            const room = parsed.resolved?.room?.name || parsed.entities.room;
            if (!room) return 'Qual sala você quer consultar?';
            if (parsed.resolution?.state === Core.RESULT_STATES.NOT_FOUND) return `Não encontrei a sala ${room} nesta unidade.`;
            if (!results.length) return context.resultState === Core.RESULT_STATES.FILTERED_BY_SHIFT ? `Não encontrei agendamentos para ${room} neste turno.` : `Não encontrei agendamentos para ${room}.`;
            if (parsed.intent === Core.INTENTS.ROOM_PERSON) return `Em ${room}, encontrei ${Array.from(new Set(results.map((item) => item.nome))).join(' e ')}.`;
            if (parsed.intent === Core.INTENTS.ROOM_CLASS) {
                const classes = Array.from(new Set(results.map((item) => item.motivo).filter(Boolean)));
                return classes.length ? `Em ${room}, está ${classes.join(' e ')}.` : `Não encontrei uma turma informada para ${room}.`;
            }
            return `Em ${room}, encontrei ${results.slice(0, 3).map((item) => `${item.tipo_aula || item.motivo || 'um agendamento'}, com ${item.nome || 'solicitante não informado'}`).join('; ')}.`;
        }
        return 'Entendi parcialmente, mas preciso que você informe a pessoa, sala ou turma.';
    }

    function createDiagnostics(enabled) {
        return (stage, payload = {}) => { if (enabled && typeof console !== 'undefined') console.debug('[VOICE]', { stage, ...payload }); };
    }

    function createUtteranceBuffer(config, onComplete) {
        let hypotheses = []; let timer = null; let generation = 0;
        function clear() { clearTimeout(timer); timer = null; hypotheses = []; generation += 1; }
        function append(alternatives) {
            const currentGeneration = generation;
            const before = hypotheses.map((item) => ({ ...item }));
            alternatives.slice(0, config.maxSpeechAlternatives).forEach((alternative, index) => {
                hypotheses[index] = { text: `${hypotheses[index]?.text || ''} ${alternative.text}`.trim(), confidence: alternative.confidence };
            });
            clearTimeout(timer); timer = setTimeout(() => {
                if (currentGeneration !== generation) return;
                const completed = hypotheses.slice(); hypotheses = []; timer = null; generation += 1; onComplete(completed);
            }, config.utteranceSilenceMs);
            return { before, after: hypotheses.map((item) => ({ ...item })) };
        }
        return { append, clear, hasContent: () => hypotheses.length > 0, snapshot: () => hypotheses.slice() };
    }

    async function requestSemanticInterpretation(text, context) {
        const response = await fetch('/api/finder-voice/interpret', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: String(text || '').slice(0, 600), context: { lastIntent: context.lastIntent, pendingIntent: context.pending?.intent || null } })
        });
        if (!response.ok) throw new Error(`Semantic interpreter HTTP ${response.status}`);
        const data = await response.json(); return Array.isArray(data.intents) ? data.intents : [];
    }

    function validateSemanticIntent(candidate, catalog, config) {
        const type = String(candidate?.type || ''); const entities = candidate?.entities || {};
        if (type === Core.INTENTS.FIND_PERSON) {
            const resolution = Core.resolvePerson(entities.person, catalog, config);
            return { intent: type, entities: { person: entities.person || null }, resolution, confidence: Number(candidate.confidence) || 0.6, source: 'ollama', temporal: { shift: candidate.shift || null }, ambiguities: resolution.candidates || [] };
        }
        if ([Core.INTENTS.QUERY_ROOM, Core.INTENTS.ROOM_PERSON, Core.INTENTS.ROOM_CLASS].includes(type)) {
            const resolution = Core.resolveRoom(entities.room, catalog);
            return { intent: type, entities: { room: resolution.value?.name || entities.room || null }, resolved: resolution.value ? { room: resolution.value } : null, resolution, confidence: resolution.value ? 0.9 : 0.4, source: 'ollama', temporal: { shift: candidate.shift || null }, ambiguities: resolution.candidates || [] };
        }
        if (type === Core.INTENTS.FIND_CLASS) {
            const code = Core.compact(entities.class); const exists = catalog.classes.some((item) => item.code === code);
            return { intent: type, entities: { class: code || null }, resolution: { state: exists ? Core.RESULT_STATES.EXACT_MATCH : Core.RESULT_STATES.NOT_FOUND, candidates: [] }, confidence: exists ? 0.95 : 0.5, source: 'ollama', temporal: { shift: candidate.shift || null }, ambiguities: [] };
        }
        return null;
    }

    function evaluateConversationFollowUp(alternatives, catalog, conversation, config) {
        const attempts = (alternatives || []).map((alternative) => ({
            alternative,
            parsed: Core.interpretDeterministic(alternative.text, catalog, conversation, config)
        }));
        const pending = Boolean(conversation.pending?.intent);
        for (const attempt of attempts) {
            for (const parsed of attempt.parsed) {
                const confidence = Number.isFinite(attempt.alternative.confidence) ? attempt.alternative.confidence : null;
                const resolutionState = parsed.resolution?.state;
                const catalogEvidence = resolutionState === Core.RESULT_STATES.EXACT_MATCH || resolutionState === Core.RESULT_STATES.STRONG_MATCH
                    || resolutionState === Core.RESULT_STATES.AMBIGUOUS || parsed.source === 'catalog_match' || parsed.source === 'catalog_ambiguity';
                const answersEntityClarification = conversation.pending?.intent === Core.INTENTS.CLARIFY_ENTITY && [Core.INTENTS.FIND_CLASS, Core.INTENTS.QUERY_ROOM].includes(parsed.intent);
                const pendingEvidence = pending && (parsed.intent === conversation.pending.intent || answersEntityClarification) && resolutionState !== Core.RESULT_STATES.NOT_FOUND && resolutionState !== Core.RESULT_STATES.ENTITY_MISSING;
                const contextualEvidence = parsed.source === 'conversation' && parsed.confidence >= 0.8;
                const entityKey = JSON.stringify(parsed.entities || {});
                const corroboratedByAlternative = attempts.filter((other) => other.parsed.some((item) => item.intent === parsed.intent && JSON.stringify(item.entities || {}) === entityKey)).length >= 2;
                const confidenceAcceptable = pendingEvidence || confidence == null || confidence === 0 || confidence >= 0.35 || corroboratedByAlternative;
                if (confidenceAcceptable && (catalogEvidence || pendingEvidence || contextualEvidence)) {
                    return { accepted: true, reason: pendingEvidence ? 'PENDING_INTENT_MATCH' : catalogEvidence ? 'STRONG_CATALOG_OR_ENTITY_MATCH' : 'STRONG_CONTEXT_MATCH', parsed, confidence };
                }
            }
        }
        return { accepted: false, reason: pending ? 'NO_VALID_PENDING_ANSWER' : 'NO_STRONG_CONTEXT_OR_ENTITY', confidence: alternatives?.[0]?.confidence ?? null };
    }

    function init(options = {}) {
        if (typeof window === 'undefined' || typeof document === 'undefined') return null;
        const config = Object.freeze({ ...Core.CONFIG, ...(options.config || {}) }); const debug = createDiagnostics(config.debugEnabled || options.debugEnabled);
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; const ui = createUi();
        const policy = document.permissionsPolicy || document.featurePolicy;
        const environment = diagnoseVoiceEnvironment({ secureContext: window.isSecureContext, policyAllowed: policy?.allowsFeature?.('microphone'), mediaDevices: navigator.mediaDevices, getUserMedia: navigator.mediaDevices?.getUserMedia, Recognition });
        ui.status.textContent = environment.status;
        if (!environment.supported) { ui.status.disabled = true; return { supported: false, reason: environment.code, ui }; }

        let recognition = null; let recognitionSessionId = 0; let activeRecognitionSessionId = 0;
        let state = Core.STATES.DISABLED; let enabled = false; let running = false; let authorized = false; let utteranceActivated = false;
        let restartTimer = null; let conversationTimer = null; let responseTimer = null; let sessionGeneration = 0;
        let conversation = Core.createConversationContext();
        const setState = (next, detail) => { state = next; ui.status.textContent = detail || STATUS_TEXT[next] || next; debug('state', { state }); };
        const clearConversation = () => { clearTimeout(conversationTimer); conversation = Core.createConversationContext(); utteranceActivated = false; sessionGeneration += 1; if (enabled) { setState(Core.STATES.STANDBY); scheduleRestart(); } };
        const openConversation = () => { clearTimeout(conversationTimer); conversation.expiresAt = Date.now() + config.conversationIdleMs; setState(Core.STATES.CONVERSATION); conversationTimer = setTimeout(clearConversation, config.conversationIdleMs); scheduleRestart(); };
        const getSnapshot = () => typeof options.getDatasetSnapshot === 'function' ? options.getDatasetSnapshot() : { status: 'ready', appointments: options.getAppointments?.() || [], unitCode: options.getContext?.().unit || null };
        const highlight = (results) => { const indices = results.map((item) => item.voiceIndex).filter(Number.isFinite); if (indices.length) options.highlight?.(indices, 7000); };

        const speak = (text, after) => {
            buffer.clear();
            utteranceActivated = false;
            stopRecognitionSession('ENTER_RESPONDING');
            ui.panel.textContent = text; ui.panel.hidden = false; clearTimeout(responseTimer); responseTimer = setTimeout(() => { ui.panel.hidden = true; }, 12000); setState(Core.STATES.RESPONDING);
            if (!window.speechSynthesis) { after(); return; }
            window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'pt-BR'; let completed = false;
            const finish = () => { if (completed) return; completed = true; if (enabled && state === Core.STATES.RESPONDING) after(); else if (!enabled) setState(Core.STATES.DISABLED); };
            utterance.onend = finish; utterance.onerror = finish; window.speechSynthesis.speak(utterance);
        };

        const processHypotheses = async (hypotheses) => {
            const generation = sessionGeneration;
            buffer.clear();
            stopRecognitionSession('ENTER_PROCESSING');
            setState(Core.STATES.PROCESSING);
            const snapshot = getSnapshot();
            if (snapshot.status === 'loading') { speak('A unidade ainda está carregando. Tente novamente em instantes.', openConversation); return; }
            if (snapshot.status === 'error') { speak('Não consegui carregar os dados desta unidade. Tente selecionar a unidade novamente.', clearConversation); return; }
            if (snapshot.status !== 'ready' || !snapshot.unitCode) { speak('Selecione uma unidade antes de consultar.', clearConversation); return; }
            if (conversation.datasetUnit && conversation.datasetUnit !== snapshot.unitCode) conversation = Core.createConversationContext();
            conversation.datasetUnit = snapshot.unitCode;
            const catalog = Core.buildCatalog(snapshot.catalogRecords || snapshot.appointments); const context = options.getContext?.() || {};
            const commands = hypotheses.map((item) => { const wake = Core.resolveWakeWord(item.text, config); return { text: wake.matched ? wake.command : item.text, confidence: item.confidence, wake }; });
            let parsed = Core.interpretDeterministic(commands[0]?.text, catalog, conversation, config);
            if (parsed[0]?.intent === Core.INTENTS.FIND_PERSON) {
                const alternatives = commands.map((item) => ({ text: Core.interpretDeterministic(item.text, catalog, conversation, config)[0]?.entities?.person || '', confidence: item.confidence }));
                parsed[0].resolution = Core.resolvePersonFromAlternatives(alternatives, catalog, config); parsed[0].ambiguities = parsed[0].resolution.candidates || [];
            }
            const needsSemantic = !parsed.length || parsed.every((item) => item.confidence < 0.65 || item.resolution?.state === Core.RESULT_STATES.NOT_FOUND);
            if (needsSemantic) try {
                const semantic = await requestSemanticInterpretation(commands[0]?.text, conversation);
                const validated = semantic.map((item) => validateSemanticIntent(item, catalog, config)).filter(Boolean); if (validated.length) parsed = validated;
            } catch (error) { debug('semantic_unavailable', { message: error.message }); }
            const currentSnapshot = getSnapshot();
            if (generation !== sessionGeneration || currentSnapshot.requestVersion !== snapshot.requestVersion || currentSnapshot.unitCode !== snapshot.unitCode) { clearConversation(); return; }
            if (!parsed.length) { speak('Não consegui entender completamente. Você pode informar a pessoa, sala ou turma?', openConversation); return; }
            const responses = []; const allResults = [];
            parsed.forEach((item) => { const outcome = Core.searchAppointmentsDetailed(snapshot.appointments, item, { ...context, date: context.date || todayIso() }); allResults.push(...outcome.results); responses.push(buildResponse(item, outcome.results, { ...context, resultState: outcome.state })); });
            const first = parsed[0]; conversation.lastIntent = first.intent; conversation.lastEntities = first.entities; conversation.lastResolved = first.resolution?.value || first.resolved || {};
            conversation.pending = first.intent === Core.INTENTS.CLARIFY_ENTITY
                ? { intent: first.intent, value: first.entities.value, candidates: first.entities.alternatives || [] }
                : [Core.RESULT_STATES.AMBIGUOUS, Core.RESULT_STATES.ENTITY_MISSING].includes(first.resolution?.state) ? { intent: first.intent, candidates: first.resolution?.candidates || [] } : null;
            debug('pipeline', { raw: hypotheses, alternatives: commands, parsed, unit: snapshot.unitCode, shift: context.currentShift, resultCount: allResults.length });
            highlight(allResults); speak(responses.join(' '), openConversation);
        };

        const buffer = createUtteranceBuffer(config, processHypotheses);
        const isCurrentRecognitionSession = (sessionId) => sessionId === activeRecognitionSessionId && sessionId !== 0;
        const stopRecognitionSession = (reason) => {
            const stopped = recognition; const stoppedSessionId = activeRecognitionSessionId;
            activeRecognitionSessionId = 0; recognitionSessionId += 1; recognition = null; running = false;
            debug('recognition_session_invalidated', { recognitionSessionId: stoppedSessionId, reason });
            if (stopped) try { stopped.stop(); } catch (_) {}
        };
        const handleRecognitionResult = (event, sessionId) => {
            if (!isCurrentRecognitionSession(sessionId)) { debug('recognition_event_discarded', { eventSessionId: sessionId, currentSessionId: activeRecognitionSessionId, result: 'DISCARDED_STALE_SESSION' }); return; }
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                if (!isCurrentRecognitionSession(sessionId)) return;
                const result = event.results[index];
                if (!result.isFinal) {
                    const interimText = result[0]?.transcript || ''; const sessionOpen = conversation.expiresAt > Date.now();
                    if (interimText && (utteranceActivated || sessionOpen || Core.resolveWakeWord(interimText, config).matched)) setState(Core.STATES.LISTENING, `🎤 Ouvindo: ${interimText}`);
                    continue;
                }
                const alternatives = Array.from(result).slice(0, config.maxSpeechAlternatives).map((item) => ({ text: item.transcript, confidence: Number.isFinite(item.confidence) ? item.confidence : null }));
                const wakeDetected = alternatives.some((item) => Core.resolveWakeWord(item.text, config).matched); const sessionOpen = conversation.expiresAt > Date.now();
                if (state === Core.STATES.RESPONDING) continue;
                if (!sessionOpen && !utteranceActivated && !wakeDetected) continue;
                if (sessionOpen && !wakeDetected && !utteranceActivated) {
                    const snapshot = getSnapshot(); const catalog = Core.buildCatalog(snapshot.catalogRecords || snapshot.appointments || []);
                    const gate = evaluateConversationFollowUp(alternatives, catalog, conversation, config);
                    debug('follow_up_gate', { recognitionSessionId: sessionId, state, raw: alternatives[0]?.text || '', alternatives, wake: false, followUpCandidate: true, pendingIntent: Boolean(conversation.pending), followUpGate: gate.accepted ? 'ACCEPTED' : 'REJECTED', reason: gate.reason, confidence: gate.confidence });
                    if (!gate.accepted) continue;
                }
                if (wakeDetected) utteranceActivated = true;
                if (sessionOpen) clearTimeout(conversationTimer); setState(Core.STATES.LISTENING);
                const bufferChange = buffer.append(alternatives);
                debug('buffer_append', { recognitionSessionId: sessionId, bufferBefore: bufferChange.before, newSegment: alternatives, bufferAfter: bufferChange.after });
            }
        };
        const startRecognitionSession = () => {
            if (!enabled || document.hidden || state === Core.STATES.RESPONDING || running) return;
            const sessionId = ++recognitionSessionId; const instance = new Recognition();
            instance.lang = 'pt-BR'; instance.continuous = true; instance.interimResults = true; instance.maxAlternatives = config.maxSpeechAlternatives;
            recognition = instance; activeRecognitionSessionId = sessionId;
            instance.onstart = () => { if (!isCurrentRecognitionSession(sessionId)) return; running = true; debug('recognition_session_started', { recognitionSessionId: sessionId, state }); if (state === Core.STATES.DISABLED) setState(Core.STATES.STANDBY); };
            instance.onresult = (event) => handleRecognitionResult(event, sessionId);
            instance.onerror = (event) => { if (!isCurrentRecognitionSession(sessionId)) return; running = false; if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) { enabled = false; buffer.clear(); stopRecognitionSession(`ERROR_${event.error}`); setState(Core.STATES.DISABLED, event.error === 'audio-capture' ? '🎤 Microfone indisponível' : '🎤 Permissão negada'); } };
            instance.onend = () => { if (!isCurrentRecognitionSession(sessionId)) { debug('recognition_end_discarded', { eventSessionId: sessionId, currentSessionId: activeRecognitionSessionId }); return; } running = false; recognition = null; activeRecognitionSessionId = 0; scheduleRestart(); };
            try { running = true; instance.start(); } catch (error) { if (isCurrentRecognitionSession(sessionId)) { recognition = null; activeRecognitionSessionId = 0; running = false; debug('recognition_start_failed', { recognitionSessionId: sessionId, message: error.message }); } }
        };
        const scheduleRestart = () => { clearTimeout(restartTimer); if (!enabled || document.hidden || state === Core.STATES.RESPONDING) return; restartTimer = setTimeout(startRecognitionSession, 350); };
        ui.status.addEventListener('click', async () => {
            if (enabled) { enabled = false; buffer.clear(); clearTimeout(restartTimer); clearTimeout(conversationTimer); stopRecognitionSession('USER_DISABLED'); window.speechSynthesis?.cancel(); setState(Core.STATES.DISABLED); return; }
            if (!authorized) { setState(Core.STATES.LISTENING, '🎤 Solicitando permissão...'); try { await requestAudioPermission(navigator.mediaDevices); authorized = true; } catch (error) { setState(Core.STATES.DISABLED, describeMicrophoneError(error)); return; } }
            enabled = true; clearConversation(); scheduleRestart();
        });
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopRecognitionSession('DOCUMENT_HIDDEN'); else scheduleRestart(); });
        window.addEventListener('beforeunload', () => { enabled = false; buffer.clear(); clearTimeout(restartTimer); clearTimeout(conversationTimer); clearTimeout(responseTimer); stopRecognitionSession('BEFORE_UNLOAD'); window.speechSynthesis?.cancel(); });
        return { supported: true, get recognition() { return recognition; }, ui, getState: () => state, clearConversation };
    }

    return { ...Core, STATUS_TEXT, createUtteranceBuffer, evaluateConversationFollowUp, diagnoseVoiceEnvironment, describeMicrophoneError, requestAudioPermission, buildResponse, init };
}));
