const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const config = require('./config');
const authRoutes = require('./modules/auth/authRoutes');
const { webPagesRoutes } = require('./modules/web/webPagesRoutes');
const appRoutes = require('./modules/app/appRoutes');
const { jsonTimeReplacer } = require('./utils/jsonTimeNormalizer');

// ────────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO AMBIENTE
// ────────────────────────────────────────────────────────────────────────────────
// Inicializar configurações de segurança com auto-geração de SESSION_SECRET
// - Carrega .env
// - Auto-gera SESSION_SECRET em desenvolvimento (crypto.randomBytes)
// - Valida SESSION_SECRET em produção (fail-fast)
const {
    SESSION_SECRET,
    NODE_ENV,
    isDevelopment,
    isProduction,
    PORT,
    COOKIE_SECURE,
    COOKIE_SAME_SITE,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    HELMET_CSP_ENABLED,
} = config.initializeSecurityConfig();

// ────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE DE SEGURANÇA
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Rate limiter simples em memória para proteção contra força bruta
 * Apenas para endpoints críticos (login, registro, etc)
 */
class RateLimiter {
    constructor(windowMs = 900000, maxRequests = 5) {
        this.requests = new Map();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
    }

    check(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];
        
        // Remover requisições fora da janela de tempo
        const recentRequests = userRequests.filter(time => now - time < this.windowMs);
        
        if (recentRequests.length >= this.maxRequests) {
            return false; // Bloqueado
        }
        
        recentRequests.push(now);
        this.requests.set(identifier, recentRequests);
        return true; // Permitido
    }
}

const loginRateLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);

/**
 * Middleware de rate limiting para login
 */
function rateLimitLogin(req, res, next) {
    const identifier = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!loginRateLimiter.check(identifier)) {
        return res.status(429).json({ 
            error: 'Muitas tentativas de login. Tente novamente após 15 minutos.' 
        });
    }
    
    next();
}

/**
 * Headers de segurança básicos (sem CSP agressiva)
 */
function securityHeaders(req, res, next) {
    // Previne clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Previne MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Habilita XSS protection no navegador
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Esconda header X-Powered-By
    res.removeHeader('X-Powered-By');
    
    next();
}

/**
* Error handler melhorado (não expõe stack traces em produção)
*/
function errorHandler(err, req, res, next) {
    console.error(`[${new Date().toISOString()}] Erro:`, err.message);
    
    if (isProduction) {
        // Em produção: não expor detalhes técnicos
        return res.status(500).json({ 
            error: 'Erro interno do servidor. Contate o administrador.' 
        });
    }
    
    // Em desenvolvimento: mostrar stack trace
    res.status(err.status || 500).json({
        error: err.message,
        stack: err.stack
    });
}

// ────────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO EXPRESS
// ────────────────────────────────────────────────────────────────────────────────

const app = express();

// Horários de agendamento são armazenados e exibidos como HH:mm. Algumas
// consultas mantêm HH:mm:ss para cálculos internos; a resposta JSON é o ponto
// comum onde o formato visual é normalizado.
app.set('json replacer', jsonTimeReplacer);

// Desabilitar header Server
app.disable('x-powered-by');

// Middleware de segurança (ordem importa)
app.use(securityHeaders);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração de sessão com segurança
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,           // Protege contra XSS roubando cookies
        secure: COOKIE_SECURE,    // Apenas HTTPS (condicional)
        sameSite: COOKIE_SAME_SITE, // Proteção CSRF
        maxAge: 3600000           // 1 hora
    }
}));

// Aplicar rate limiting ao login ANTES de definir as rotas
app.use('/auth/login', rateLimitLogin);
app.use('/auth/register', rateLimitLogin);

app.use(authRoutes);
app.use(webPagesRoutes);
app.use(appRoutes);

app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

const server = http.createServer(app);
const activeHttpSockets = new Set();

server.on('connection', (socket) => {
    activeHttpSockets.add(socket);
    socket.on('close', () => activeHttpSockets.delete(socket));
});

server.listen(PORT, () => {
    console.log(`[INFO] Servidor HTTP (Express) iniciado na porta ${PORT}`);
    console.log(`[INFO] Ambiente: ${NODE_ENV}`);
    console.log(`[INFO] Sessão: httpOnly=${true}, secure=${COOKIE_SECURE}, sameSite=${COOKIE_SAME_SITE}`);
    console.log(`[INFO] Rate limiting: ${RATE_LIMIT_MAX_REQUESTS} requisições por ${RATE_LIMIT_WINDOW_MS / 1000 / 60} minutos`);
});

let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`[INFO] Recebido ${signal}. Encerrando HTTP...`);

    const forceExitTimer = setTimeout(() => {
        console.warn('[WARN] Shutdown excedeu 10s. Forcando encerramento.');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    activeHttpSockets.forEach((socket) => {
        socket.end();
        setTimeout(() => {
            if (!socket.destroyed) {
                socket.destroy();
            }
        }, 3000).unref();
    });

    server.close((httpError) => {
        clearTimeout(forceExitTimer);
        if (httpError) {
            console.error('[ERROR] Falha ao fechar servidor HTTP:', httpError);
            process.exit(1);
            return;
        }

        console.log('[INFO] Servidor encerrado com sucesso.');
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
