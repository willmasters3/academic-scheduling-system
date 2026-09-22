const chatService = require('./chatService');

async function legacyApiChat(req, res) {
    try {
        const response = await chatService.handleLegacyApiChat(req.body);
        return res.json(response);
    } catch (error) {
        console.error('Erro ao processar a requisicao:', error);
        return res.status(500).json({ message: 'Erro ao processar a requisicao' });
    }
}

async function chat(req, res) {
    try {
        const result = await chatService.handleChatMessage(req, req.body?.message);
        return res.status(result.statusCode).json(result.body);
    } catch (error) {
        console.error('[IA] Falha ao comunicar com o Ollama local:', error);
        return res.status(503).json({
            reply: 'O serviço de IA local está indisponível no momento. Tente novamente em instantes.'
        });
    }
}

async function interpretFinderVoice(req, res) {
    try {
        const result = await chatService.interpretFinderVoice(req.body);
        return res.json(result);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        console.error('[VOICE] Interpretador semântico local indisponível:', error);
        return res.status(503).json({ error: 'O interpretador semântico local está indisponível.' });
    }
}

module.exports = {
    legacyApiChat,
    chat,
    interpretFinderVoice
};
