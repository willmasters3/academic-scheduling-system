(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.AgendamentosVoiceCore = api;
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    const CONFIG = Object.freeze({
        utteranceSilenceMs: 1800,
        conversationIdleMs: 9000,
        maxSpeechAlternatives: 5,
        wakeWord: 'jason',
        wakeWordThreshold: 0.72,
        nameFuzzyThreshold: 0.86,
        shortNameFuzzyThreshold: 0.93,
        ambiguityMargin: 0.06,
        debugEnabled: false
    });

    const STATES = Object.freeze({
        STANDBY: 'STANDBY', LISTENING: 'LISTENING', PROCESSING: 'PROCESSING',
        RESPONDING: 'RESPONDING', CONVERSATION: 'CONVERSATION', DISABLED: 'DISABLED'
    });

    const RESULT_STATES = Object.freeze({
        EXACT_MATCH: 'EXACT_MATCH', STRONG_MATCH: 'STRONG_MATCH', AMBIGUOUS: 'AMBIGUOUS',
        NOT_FOUND: 'NOT_FOUND', ENTITY_MISSING: 'ENTITY_MISSING', INTENT_NOT_RECOGNIZED: 'INTENT_NOT_RECOGNIZED',
        FILTERED_BY_SHIFT: 'FILTERED_BY_SHIFT', NO_DATASET: 'NO_DATASET', DATASET_LOADING: 'DATASET_LOADING',
        SEMANTIC_SERVICE_UNAVAILABLE: 'SEMANTIC_SERVICE_UNAVAILABLE'
    });

    const SHIFT_RANGES = Object.freeze({ manha: ['06:00', '12:00'], tarde: ['12:01', '17:15'], noite: ['17:15', '23:59'] });
    const INTENTS = Object.freeze({
        FIND_PERSON: 'find_person', QUERY_ROOM: 'query_room', ROOM_PERSON: 'room_person',
        ROOM_CLASS: 'room_class', FIND_CLASS: 'find_class', FIND_CURRICULUM: 'find_curriculum',
        QUERY_TIME: 'query_time', CLARIFY_ENTITY: 'clarify_entity', UNKNOWN: 'unknown'
    });

    function normalizeText(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .replace(/[-–—]+/g, ' ').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function compact(value) { return normalizeText(value).replace(/[^a-z0-9]/g, ''); }

    function levenshtein(a, b) {
        const left = compact(a); const right = compact(b);
        if (!left) return right.length; if (!right) return left.length;
        const row = Array.from({ length: right.length + 1 }, (_, index) => index);
        for (let i = 1; i <= left.length; i += 1) {
            let previous = row[0]; row[0] = i;
            for (let j = 1; j <= right.length; j += 1) {
                const saved = row[j];
                row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
                previous = saved;
            }
        }
        return row[right.length];
    }

    function similarity(a, b) {
        const left = compact(a); const right = compact(b);
        const size = Math.max(left.length, right.length);
        return size ? 1 - (levenshtein(left, right) / size) : 1;
    }

    function uniqueBy(items, keySelector) {
        const seen = new Set();
        return items.filter((item) => { const key = keySelector(item); if (!key || seen.has(key)) return false; seen.add(key); return true; });
    }

    function extractClassCodes(value) {
        const text = normalizeText(value); const matches = [];
        let match;
        const implicit = /\b(\d{2}[\s-]?\d{2}[\s-]?[a-z])\b/g;
        while ((match = implicit.exec(text))) matches.push(compact(match[1]));
        if (/^\d{2,20}$/.test(text)) matches.push(text);
        return Array.from(new Set(matches.filter(Boolean)));
    }

    function extractCatalogClassCodes(value) {
        const text = normalizeText(value);
        const codes = extractClassCodes(text);
        const identifier = text.replace(/^turma\s+/, '');
        if (/^[0-9][0-9a-z ]{1,20}$/.test(identifier)) codes.push(compact(identifier));
        return Array.from(new Set(codes.filter(Boolean)));
    }

    function buildCatalog(appointments) {
        const records = Array.isArray(appointments) ? appointments : [];
        const people = uniqueBy(records.map((item) => ({
            id: item.id_professor ?? item.professor_id ?? null, name: String(item.nome || '').trim(), normalized: normalizeText(item.nome)
        })), (item) => item.id != null ? `id:${item.id}` : `name:${item.normalized}`);
        const rooms = uniqueBy(records.map((item) => ({
            id: item.id_sala ?? item.sala_id ?? null,
            name: String(item.nome_sala || '').trim(),
            normalized: normalizeText(item.nome_sala),
            compact: compact(item.nome_sala),
            aliases: Array.from(new Set([
                normalizeText(item.nome_sala),
                normalizeText(item.nome_sala).replace(/^sala\s+/, ''),
                ...(normalizeText(item.nome_sala).match(/\b\d{2,6}\b/g) || [])
            ].filter(Boolean)))
        })), (item) => item.id != null ? `id:${item.id}` : `name:${item.normalized}`);
        const classes = uniqueBy(records.flatMap((item) => extractCatalogClassCodes(item.motivo).map((code) => ({ code, display: code.toUpperCase(), raw: String(item.motivo || '').trim() }))), (item) => item.code);
        const curricula = uniqueBy(records.map((item) => ({ name: String(item.tipo_aula || '').trim(), normalized: normalizeText(item.tipo_aula) })), (item) => item.normalized);
        return { people: people.filter((item) => item.normalized), rooms: rooms.filter((item) => item.normalized), classes, curricula: curricula.filter((item) => item.normalized) };
    }

    function phraseInText(text, phrase) {
        const escaped = normalizeText(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return Boolean(escaped && new RegExp(`(?:^| )${escaped}(?: |$)`).test(normalizeText(text)));
    }

    function resolveWakeWord(transcript, config = CONFIG) {
        const text = normalizeText(transcript); const first = text.split(' ')[0] || '';
        if (!first) return { matched: false, command: '', score: 0 };
        const score = similarity(first, config.wakeWord);
        const conservativeShape = first.length >= 5 && first.length <= 7 && first[0] === config.wakeWord[0];
        const matched = first === config.wakeWord || (conservativeShape && score >= config.wakeWordThreshold);
        return { matched, command: matched ? text.slice(first.length).trim() : text, score };
    }

    function personQueryCandidates(text) {
        const stop = new Set(['onde','esta','fica','cade','aonde','qual','sala','em','que','do','da','de','o','a','os','as','um','uma','professor','professora','prof','solicitante','quero','queria','saber','ver','consegue','conseguir','procura','procure','encontrar','posso','pode','pra','para','mim','me','mostra','mostre','e','tambem','agora','manha','tarde','noite']);
        return normalizeText(text).split(' ').filter((token) => token.length >= 2 && !stop.has(token));
    }

    function scorePerson(query, person) {
        const normalizedQuery = normalizeText(query); const name = person.normalized;
        if (!normalizedQuery) return 0;
        if (normalizedQuery === name) return 1;
        const nameTokens = name.split(' '); const queryTokens = normalizedQuery.split(' ');
        if (queryTokens.every((token) => nameTokens.includes(token))) return queryTokens.length > 1 ? 0.98 : 0.96;
        const tokenScores = queryTokens.map((token) => Math.max(...nameTokens.map((nameToken) => similarity(token, nameToken))));
        return tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
    }

    function resolvePerson(query, catalog, config = CONFIG) {
        const normalized = normalizeText(query); const people = catalog?.people || [];
        if (!normalized) return { state: RESULT_STATES.ENTITY_MISSING, candidates: [] };
        const ranked = people.map((person) => ({ person, score: scorePerson(normalized, person) })).sort((a, b) => b.score - a.score);
        const exact = ranked.filter((item) => item.score >= 0.96);
        if (exact.length > 1) return { state: RESULT_STATES.AMBIGUOUS, candidates: exact.map((item) => item.person), score: exact[0].score };
        if (exact.length === 1) return { state: RESULT_STATES.EXACT_MATCH, value: exact[0].person, candidates: [exact[0].person], score: exact[0].score };
        const best = ranked[0]; const second = ranked[1];
        const threshold = compact(normalized).length <= 3 ? config.shortNameFuzzyThreshold : config.nameFuzzyThreshold;
        if (best && best.score >= threshold && (!second || best.score - second.score >= config.ambiguityMargin)) {
            return { state: RESULT_STATES.STRONG_MATCH, value: best.person, candidates: [best.person], score: best.score };
        }
        if (best && best.score >= threshold && second && best.score - second.score < config.ambiguityMargin) {
            return { state: RESULT_STATES.AMBIGUOUS, candidates: ranked.filter((item) => best.score - item.score < config.ambiguityMargin).map((item) => item.person), score: best.score };
        }
        return { state: RESULT_STATES.NOT_FOUND, candidates: [], score: best?.score || 0 };
    }

    function resolvePersonFromAlternatives(queries, catalog, config = CONFIG) {
        const attempts = (queries || []).map((item, index) => {
            const resolution = resolvePerson(item.text ?? item, catalog, config);
            const confidence = Number.isFinite(item.confidence) ? item.confidence : Math.max(0.5, 1 - index * 0.08);
            return { ...resolution, transcript: item.text ?? item, combinedScore: (resolution.score || 0) * 0.85 + confidence * 0.15 };
        }).sort((a, b) => b.combinedScore - a.combinedScore);
        return attempts.find((item) => item.state === RESULT_STATES.EXACT_MATCH) || attempts[0] || { state: RESULT_STATES.NOT_FOUND, candidates: [] };
    }

    function resolveRoom(query, catalog) {
        const normalized = normalizeText(query); const compacted = compact(query); const rooms = catalog?.rooms || [];
        if (!normalized) return { state: RESULT_STATES.ENTITY_MISSING, candidates: [] };
        const exact = rooms.filter((room) => room.normalized === normalized || room.compact === compacted
            || room.aliases.some((alias) => normalizeText(alias) === normalized || compact(alias) === compacted));
        if (exact.length === 1) return { state: RESULT_STATES.EXACT_MATCH, value: exact[0], candidates: exact, score: 1 };
        if (exact.length > 1) return { state: RESULT_STATES.AMBIGUOUS, candidates: exact, score: 1 };
        return { state: RESULT_STATES.NOT_FOUND, candidates: [], score: 0 };
    }

    function findRoomMentions(text, catalog) {
        const normalized = normalizeText(text);
        return (catalog?.rooms || []).filter((room) => room.aliases.some((alias) => phraseInText(normalized, alias)));
    }

    function inferShift(text) {
        const value = normalizeText(text);
        if (/\bmanha\b/.test(value)) return 'manha'; if (/\btarde\b/.test(value)) return 'tarde'; if (/\bnoite\b/.test(value)) return 'noite'; return null;
    }

    function interpretDeterministic(text, catalog, context = {}, config = CONFIG, singleClause = false) {
        const normalized = normalizeText(text); const intents = []; const temporal = { shift: inferShift(normalized) };
        if (!singleClause) {
            const clauses = normalized.split(/\s+e\s+(?=(?:depois\s+)?(?:tambem\s+)?(?:onde|aonde|cade|qual|quem|o que|quero)\b)/).filter(Boolean);
            if (clauses.length > 1) return clauses.flatMap((clause) => interpretDeterministic(clause, catalog, context, config, true));
        }
        if (context.pending?.intent === INTENTS.CLARIFY_ENTITY && context.pending?.value) {
            const value = compact(context.pending.value);
            if (/\b(turma|classe)\b/.test(normalized)) return [{ intent: INTENTS.FIND_CLASS, entities: { class: value }, resolution: { state: RESULT_STATES.EXACT_MATCH, candidates: [] }, confidence: 1, source: 'conversation', temporal, ambiguities: [] }];
            if (/\b(sala|ambiente)\b/.test(normalized)) {
                const roomResolution = resolveRoom(value, catalog);
                return [{ intent: INTENTS.QUERY_ROOM, entities: { room: roomResolution.value?.name || value }, resolved: roomResolution.value ? { room: roomResolution.value } : null, resolution: roomResolution, confidence: 1, source: 'conversation', temporal, ambiguities: [] }];
            }
        }
        const rooms = findRoomMentions(normalized, catalog);
        const textWithoutTimes = normalized.replace(/\b\d{1,2}:\d{2}\b/g, ' ');
        const structuralClassCodes = extractClassCodes(normalized);
        const catalogClassCodes = (catalog?.classes || []).filter((item) => {
            const rawAlias = normalizeText(item.raw).replace(/^turma\s+/, '');
            const compactPattern = new RegExp(`(?:^| )${item.code}(?: |$)`);
            return structuralClassCodes.includes(item.code) || phraseInText(textWithoutTimes, rawAlias) || compactPattern.test(textWithoutTimes);
        }).map((item) => item.code);
        const classCodes = Array.from(new Set([...structuralClassCodes, ...catalogClassCodes]));
        const explicitClass = /\b(turma|classe)\b/.test(normalized);
        const explicitRoom = /\b(sala|ambiente|laboratorio|auditorio)\b/.test(normalized);
        const roomAliases = new Set(rooms.flatMap((room) => room.aliases.map(compact)));
        const sharedCodes = classCodes.filter((code) => roomAliases.has(code));
        const roomBoundCodes = new Set(sharedCodes.filter((code) => new RegExp(`\\bsala\\s+(?:numero\\s+)?${code}\\b`).test(normalized)));
        const classBoundCodes = new Set(sharedCodes.filter((code) => new RegExp(`\\b(?:turma|classe)\\s+${code}\\b`).test(normalized)));
        const contextualClass = context.lastIntent === INTENTS.FIND_CLASS || context.pending?.intent === INTENTS.FIND_CLASS;
        const contextualRoom = [INTENTS.QUERY_ROOM, INTENTS.ROOM_PERSON, INTENTS.ROOM_CLASS].includes(context.lastIntent);
        if (sharedCodes.length && !explicitClass && !explicitRoom && !contextualClass && !contextualRoom) {
            return [{ intent: INTENTS.CLARIFY_ENTITY, entities: { value: sharedCodes[0], alternatives: ['class', 'room'] }, confidence: 1, source: 'catalog_ambiguity', temporal, ambiguities: ['class', 'room'] }];
        }
        const selectedClassCodes = classCodes.filter((code) => !roomBoundCodes.has(code) || classBoundCodes.has(code))
            .filter((code) => !(sharedCodes.includes(code) && (explicitRoom || contextualRoom) && !explicitClass));
        selectedClassCodes.forEach((code) => intents.push({ intent: INTENTS.FIND_CLASS, entities: { class: code }, resolution: { state: (catalog?.classes || []).some((item) => item.code === code) ? RESULT_STATES.EXACT_MATCH : RESULT_STATES.NOT_FOUND, candidates: [] }, confidence: 1, source: catalogClassCodes.includes(code) ? 'catalog_match' : 'deterministic', temporal, ambiguities: [] }));

        if (rooms.length) {
            const selectedRooms = rooms.filter((room) => !room.aliases.some((alias) => classBoundCodes.has(compact(alias)) && !roomBoundCodes.has(compact(alias))))
                .filter((room) => !(sharedCodes.length && (explicitClass || contextualClass) && !explicitRoom && room.aliases.some((alias) => sharedCodes.includes(compact(alias)))));
            let roomIntent = [INTENTS.QUERY_ROOM, INTENTS.ROOM_PERSON, INTENTS.ROOM_CLASS].includes(context.lastIntent) ? context.lastIntent : INTENTS.QUERY_ROOM;
            if (/\b(quem|pessoa|professor|professora|solicitante)\b/.test(normalized)) roomIntent = INTENTS.ROOM_PERSON;
            else if (/\b(turma|classe)\b/.test(normalized) && !classCodes.length) roomIntent = INTENTS.ROOM_CLASS;
            selectedRooms.forEach((room) => intents.push({ intent: roomIntent, entities: { room: room.name }, resolved: { room }, resolution: { state: RESULT_STATES.EXACT_MATCH, value: room, candidates: [room] }, confidence: 0.98, source: 'catalog_match', temporal, ambiguities: [] }));
        }

        const personSignal = /\b(onde|cade|aonde|encontr|procura|professor|professora|solicitante|quem)\b/.test(normalized)
            || context.lastIntent === INTENTS.FIND_PERSON || context.pending?.intent === INTENTS.FIND_PERSON;
        if (personSignal && !rooms.length && !classCodes.length) {
            const tokens = personQueryCandidates(normalized); const query = tokens.join(' ');
            const resolution = resolvePerson(query, catalog, config);
            intents.push({ intent: INTENTS.FIND_PERSON, entities: { person: query || null }, resolution, confidence: resolution.score || (query ? 0.45 : 0.8), source: 'deterministic', temporal, ambiguities: resolution.candidates || [] });
        }

        if (!intents.length && context.lastIntent === INTENTS.QUERY_ROOM) {
            const followRooms = findRoomMentions(normalized, catalog);
            followRooms.forEach((room) => intents.push({ intent: context.lastIntent, entities: { room: room.name }, resolved: { room }, confidence: 0.9, source: 'conversation', temporal, ambiguities: [] }));
        }
        if (!intents.length) {
            const query = personQueryCandidates(normalized).join(' ');
            const resolution = resolvePerson(query, catalog, config);
            if ([RESULT_STATES.EXACT_MATCH, RESULT_STATES.STRONG_MATCH, RESULT_STATES.AMBIGUOUS].includes(resolution.state)) {
                intents.push({ intent: INTENTS.FIND_PERSON, entities: { person: query }, resolution, confidence: resolution.score || 0.8, source: 'entity', temporal, ambiguities: resolution.candidates || [] });
            }
        }
        if (!intents.length && temporal.shift && context.lastIntent) {
            if (context.lastIntent === INTENTS.FIND_CLASS && context.lastEntities?.class) {
                intents.push({ intent: INTENTS.FIND_CLASS, entities: { class: context.lastEntities.class }, resolution: { state: RESULT_STATES.EXACT_MATCH, candidates: [] }, confidence: 0.9, source: 'conversation', temporal, ambiguities: [] });
            } else if (context.lastIntent === INTENTS.FIND_PERSON && context.lastResolved?.name) {
                intents.push({ intent: INTENTS.FIND_PERSON, entities: { person: context.lastResolved.name }, resolution: { state: RESULT_STATES.EXACT_MATCH, value: context.lastResolved, candidates: [context.lastResolved] }, confidence: 0.9, source: 'conversation', temporal, ambiguities: [] });
            } else if ([INTENTS.QUERY_ROOM, INTENTS.ROOM_PERSON, INTENTS.ROOM_CLASS].includes(context.lastIntent) && context.lastResolved?.name) {
                intents.push({ intent: context.lastIntent, entities: { room: context.lastResolved.name }, resolved: { room: context.lastResolved }, resolution: { state: RESULT_STATES.EXACT_MATCH, value: context.lastResolved, candidates: [context.lastResolved] }, confidence: 0.9, source: 'conversation', temporal, ambiguities: [] });
            }
        }
        return intents;
    }

    function normalizeTime(value) { const match = String(value || '').match(/^(\d{1,2}):([0-5]\d)/); return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null; }
    function overlaps(item, start, end) { const a = normalizeTime(item.hora_inicio); const b = normalizeTime(item.hora_fim); return Boolean(a && b && a < end && b > start); }

    function searchAppointments(appointments, parsed, options = {}) {
        const records = Array.isArray(appointments) ? appointments : [];
        let candidates = records.filter((item) => !options.date || String(item.data_reservas || '').slice(0, 10) === options.date);
        const shift = parsed.temporal?.shift || options.currentShift;
        if (shift && SHIFT_RANGES[shift]) candidates = candidates.filter((item) => overlaps(item, ...SHIFT_RANGES[shift]));
        if (parsed.intent === INTENTS.FIND_PERSON && parsed.resolution?.value) {
            const target = parsed.resolution.value;
            return candidates.filter((item) => target.id != null && (item.id_professor ?? item.professor_id) != null
                ? String(item.id_professor ?? item.professor_id) === String(target.id) : normalizeText(item.nome) === target.normalized);
        }
        if (parsed.intent === INTENTS.FIND_CLASS) return candidates.filter((item) => extractCatalogClassCodes(item.motivo).includes(compact(parsed.entities.class)));
        if ([INTENTS.QUERY_ROOM, INTENTS.ROOM_PERSON, INTENTS.ROOM_CLASS].includes(parsed.intent)) {
            const room = parsed.resolved?.room || resolveRoom(parsed.entities.room, buildCatalog(records)).value;
            return room ? candidates.filter((item) => room.id != null && (item.id_sala ?? item.sala_id) != null
                ? String(item.id_sala ?? item.sala_id) === String(room.id) : normalizeText(item.nome_sala) === room.normalized) : [];
        }
        return [];
    }

    function searchAppointmentsDetailed(appointments, parsed, options = {}) {
        const results = searchAppointments(appointments, parsed, options);
        if (results.length) return { state: parsed.resolution?.state || RESULT_STATES.EXACT_MATCH, results };
        const appliedShift = parsed.temporal?.shift || options.currentShift;
        if (appliedShift) {
            const withoutShift = searchAppointments(appointments, { ...parsed, temporal: { ...(parsed.temporal || {}), shift: null } }, { ...options, currentShift: null });
            if (withoutShift.length) return { state: RESULT_STATES.FILTERED_BY_SHIFT, results: [] };
        }
        return { state: RESULT_STATES.NOT_FOUND, results: [] };
    }

    function createConversationContext() { return { lastIntent: null, lastEntities: {}, lastResolved: {}, pending: null, expiresAt: 0 }; }

    return { CONFIG, STATES, RESULT_STATES, INTENTS, SHIFT_RANGES, normalizeText, compact, levenshtein, similarity,
        extractClassCodes, extractCatalogClassCodes, buildCatalog, resolveWakeWord, resolvePerson, resolvePersonFromAlternatives, resolveRoom,
        interpretDeterministic, searchAppointments, searchAppointmentsDetailed, createConversationContext };
}));
