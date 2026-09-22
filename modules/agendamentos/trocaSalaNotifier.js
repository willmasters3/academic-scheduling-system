const clientsByProfessor = new Map();

function ensureSet(idProfessor) {
    const key = String(idProfessor);
    let sockets = clientsByProfessor.get(key);
    if (!sockets) {
        sockets = new Set();
        clientsByProfessor.set(key, sockets);
    }

    return { key, sockets };
}

function sendSseEvent(res, eventName, payload) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function registrarCliente(idProfessor, res) {
    const { key, sockets } = ensureSet(idProfessor);

    sockets.add(res);
    sendSseEvent(res, 'connected', { ok: true });

    const cleanup = () => {
        sockets.delete(res);
        if (sockets.size === 0) {
            clientsByProfessor.delete(key);
        }
    };

    res.on('close', cleanup);
    res.on('finish', cleanup);
    return cleanup;
}

function notificarProfessores(idsProfessores, eventName, payload) {
    const destinos = [...new Set((idsProfessores || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0))];

    destinos.forEach((idProfessor) => {
        const sockets = clientsByProfessor.get(String(idProfessor));
        if (!sockets || sockets.size === 0) return;

        for (const res of [...sockets]) {
            try {
                if (res.writableEnded || res.destroyed) {
                    sockets.delete(res);
                    continue;
                }

                sendSseEvent(res, eventName, payload);
            } catch (_) {
                sockets.delete(res);
            }
        }

        if (sockets.size === 0) {
            clientsByProfessor.delete(String(idProfessor));
        }
    });
}

module.exports = {
    registrarCliente,
    notificarProfessores,
};