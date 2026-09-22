/**
 * ════════════════════════════════════════════════════════════════════════════════
 * MÓDULO DE CONFIGURAÇÃO COM AUTO-GERAÇÃO DE SESSION_SECRET
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Carregar variáveis de ambiente via dotenv
 * - Auto-gerar SESSION_SECRET seguro em desenvolvimento (crypto.randomBytes)
 * - Validar configuração de produção (fail-fast)
 * - Fornecer interface limpa para configurações de segurança
 * - Logar informações sobre auto-geração
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const dotenv = require('dotenv');

/**
 * Gera uma SESSION_SECRET criptograficamente segura usando crypto.randomBytes
 * @param {number} bytes - Número de bytes para gerar (padrão: 32 = 256 bits)
 * @returns {string} - String base64 segura
 */
function generateSecureSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64');
}

/**
 * Inicializa configurações de segurança
 * - Carrega .env
 * - Auto-gera SESSION_SECRET em desenvolvimento se não configurado
 * - Valida SESSION_SECRET em produção
 * @returns {Object} - Objeto com configurações validadas
 */
function initializeSecurityConfig() {
    // Carregar arquivo .env
    const result = dotenv.config();

    const NODE_ENV = process.env.NODE_ENV || 'development';
    const isDevelopment = NODE_ENV === 'development';
    const isProduction = NODE_ENV === 'production';

    let SESSION_SECRET = process.env.SESSION_SECRET;
    let secretSource = 'environment variable';

    // ═══════════════════════════════════════════════════════════════════════════
    // LÓGICA DE SESSION_SECRET
    // ═══════════════════════════════════════════════════════════════════════════

    if (!SESSION_SECRET) {
        if (isDevelopment) {
            // 🔐 Em desenvolvimento: gerar automaticamente usando crypto.randomBytes
            SESSION_SECRET = generateSecureSecret(32);
            secretSource = 'auto-generated (crypto.randomBytes)';
            
            console.warn('\n');
            console.warn('⚠️  ════════════════════════════════════════════════════════════════');
            console.warn('⚠️  SESSION_SECRET AUTO-GERADO EM DESENVOLVIMENTO');
            console.warn('⚠️  ════════════════════════════════════════════════════════════════');
            console.warn('⚠️');
            console.warn('⚠️  Um SESSION_SECRET criptograficamente seguro foi gerado automaticamente');
            console.warn('⚠️  via crypto.randomBytes(32).toString("base64")');
            console.warn('⚠️');
            console.warn('⚠️  Para persistir em .env para uso futuro:');
            console.warn('⚠️  $ node generate-secret.js --save');
            console.warn('⚠️');
            console.warn('⚠️  Características:');
            console.warn('⚠️  - Tamanho: 32 bytes (256 bits)');
            console.warn('⚠️  - Entropia: Cryptographically secure');
            console.warn('⚠️  - Formato: Base64');
            console.warn('⚠️  ════════════════════════════════════════════════════════════════');
            console.warn('\n');
        } else if (isProduction) {
            // 🚨 Em produção: FALHAR RÁPIDO
            console.error('\n');
            console.error('🚨 ════════════════════════════════════════════════════════════════');
            console.error('🚨 ERRO CRÍTICO DE CONFIGURAÇÃO');
            console.error('🚨 ════════════════════════════════════════════════════════════════');
            console.error('🚨');
            console.error('🚨 SESSION_SECRET não foi configurado em produção!');
            console.error('🚨');
            console.error('🚨 Para corrigir:');
            console.error('🚨');
            console.error('🚨 1. Gerar um SECRET seguro:');
            console.error('🚨    $ node generate-secret.js');
            console.error('🚨');
            console.error('🚨 2. Adicionar ao arquivo .env em produção:');
            console.error('🚨    SESSION_SECRET=<seu-secret-gerado-aqui>');
            console.error('🚨');
            console.error('🚨 3. Garantir que .env está em seu servidor de produção');
            console.error('🚨    (via variáveis de ambiente ou arquivo .env seguro)');
            console.error('🚨');
            console.error('🚨 ════════════════════════════════════════════════════════════════');
            console.error('\n');
            
            process.exit(1);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE COOKIES
    // ═══════════════════════════════════════════════════════════════════════════

    const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || isProduction;
    const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'Lax';

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE RATE LIMITING
    // ═══════════════════════════════════════════════════════════════════════════

    const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
    const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE SEGURANÇA
    // ═══════════════════════════════════════════════════════════════════════════

    const PORT = parseInt(process.env.PORT || '3000', 10);
    const HELMET_CSP_ENABLED = process.env.HELMET_CSP_ENABLED !== 'false';

    // ═══════════════════════════════════════════════════════════════════════════
    // LOG DE CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('✅ Configurações de Segurança Carregadas:');
    console.log(`   NODE_ENV: ${NODE_ENV}`);
    console.log(`   SESSION_SECRET: ${secretSource}`);
    console.log(`   COOKIE_SECURE: ${COOKIE_SECURE}`);
    console.log(`   COOKIE_SAME_SITE: ${COOKIE_SAME_SITE}`);
    console.log(`   RATE_LIMIT: ${RATE_LIMIT_MAX_REQUESTS} requisições a cada ${RATE_LIMIT_WINDOW_MS / 1000 / 60} minutos`);
    console.log(`   PORT: ${PORT}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // RETORNAR OBJETO DE CONFIGURAÇÃO
    // ═══════════════════════════════════════════════════════════════════════════

    return {
        // Session
        SESSION_SECRET,
        
        // Environment
        NODE_ENV,
        isDevelopment,
        isProduction,
        PORT,
        
        // Cookies
        COOKIE_SECURE,
        COOKIE_SAME_SITE,
        
        // Rate Limiting
        RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX_REQUESTS,
        
        // Security Features
        HELMET_CSP_ENABLED,
        
        // Helper methods
        /**
         * Valida que a configuração está correta
         * @returns {boolean} - true se válido, false senão
         */
        isValid() {
            if (!this.SESSION_SECRET) {
                console.error('❌ SESSION_SECRET não configurado');
                return false;
            }
            if (this.isProduction && !process.env.SESSION_SECRET) {
                console.error('❌ SESSION_SECRET deve ser configurado explicitamente em produção');
                return false;
            }
            return true;
        },
        
        /**
         * Log informacional de segurança
         */
        logSecurityInfo() {
            console.log('\n📋 Resumo de Configuração de Segurança:');
            console.log(`   Ambiente: ${this.NODE_ENV}`);
            console.log(`   Modo desenvolvimento: ${this.isDevelopment ? 'SIM' : 'NÃO'}`);
            console.log(`   SESSION_SECRET: ${this.SESSION_SECRET.substring(0, 10)}...${this.SESSION_SECRET.substring(this.SESSION_SECRET.length - 5)}`);
            console.log(`   HTTPS Cookies: ${this.COOKIE_SECURE ? 'SIM' : 'NÃO'}`);
            console.log(`   SameSite: ${this.COOKIE_SAME_SITE}`);
        }
    };
}

/**
 * Exportar
 */
module.exports = {
    generateSecureSecret,
    initializeSecurityConfig,
};
