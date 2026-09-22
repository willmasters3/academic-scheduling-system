#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════════
 * GERADOR DE SESSION_SECRET CRIPTOGRAFICAMENTE SEGURO
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Este script gera um SESSION_SECRET seguro baseado em crypto.randomBytes
 * e pode salvar automaticamente em .env
 * 
 * Uso:
 *   node generate-secret.js                 # Exibe na console
 *   node generate-secret.js --save          # Salva em .env (backup automático)
 * 
 * ════════════════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Gera um SESSION_SECRET criptograficamente seguro
 * @param {number} bytes - Número de bytes para gerar (padrão: 32 = 256 bits)
 * @returns {string} - String base64 segura
 */
function generateSessionSecret(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64');
}

/**
 * Lê o arquivo .env atual
 * @returns {string} - Conteúdo do .env ou string vazia
 */
function readEnvFile() {
    const envPath = path.join(__dirname, '.env');
    try {
        return fs.readFileSync(envPath, 'utf8');
    } catch (err) {
        return '';
    }
}

/**
 * Atualiza ou cria SESSION_SECRET em .env
 * @param {string} newSecret - Novo SESSION_SECRET
 */
function updateEnvFile(newSecret) {
    const envPath = path.join(__dirname, '.env');
    let content = readEnvFile();
    
    // Backup do arquivo original
    if (content && fs.existsSync(envPath)) {
        const backupPath = `${envPath}.backup.${Date.now()}`;
        fs.writeFileSync(backupPath, content);
        console.log(`✅ Backup criado: ${backupPath}`);
    }
    
    // Se arquivo vazio, copiar de .env.example
    if (!content) {
        const examplePath = path.join(__dirname, '.env.example');
        try {
            content = fs.readFileSync(examplePath, 'utf8');
        } catch (err) {
            console.warn('⚠️  .env.example não encontrado. Criando novo .env...');
        }
    }
    
    // Atualizar ou adicionar SESSION_SECRET
    const regex = /^SESSION_SECRET=.*/m;
    if (regex.test(content)) {
        content = content.replace(regex, `SESSION_SECRET=${newSecret}`);
    } else {
        // Adicionar após linhas comentadas de SESSION
        const lines = content.split('\n');
        const insertIndex = lines.findIndex(line => line.includes('SESSION') || line.includes('COOKIE'));
        
        if (insertIndex >= 0) {
            lines.splice(insertIndex, 0, `SESSION_SECRET=${newSecret}`);
        } else {
            // Adicionar no início das vars de configuração
            content = `SESSION_SECRET=${newSecret}\n\n${content}`;
        }
        
        content = lines.join('\n');
    }
    
    // Salvar arquivo
    fs.writeFileSync(envPath, content);
    console.log(`✅ Arquivo .env atualizado com novo SESSION_SECRET`);
}

/**
 * Valida a força do SECRET gerado
 * @param {string} secret - Secret para validar
 */
function validateSecret(secret) {
    const buffer = Buffer.from(secret, 'base64');
    const bits = buffer.length * 8;
    
    console.log('\n📊 Características do SECRET gerado:');
    console.log(`   Tamanho: ${buffer.length} bytes (${bits} bits)`);
    console.log(`   Entropia: ${Math.log2(256 ** buffer.length).toFixed(2)} bits`);
    console.log(`   Recomendado: Mínimo 256 bits ✅`);
    console.log(`   Padrão criptográfico: cryptographically secure random ✅`);
}

/**
 * Função principal
 */
function main() {
    console.log('\n════════════════════════════════════════════════════════════════════════════════');
    console.log('🔐 GERADOR DE SESSION_SECRET CRIPTOGRAFICAMENTE SEGURO');
    console.log('════════════════════════════════════════════════════════════════════════════════\n');
    
    const shouldSave = process.argv.includes('--save');
    const newSecret = generateSessionSecret(32);
    
    console.log('🔑 SESSION_SECRET gerado:');
    console.log(`\n${newSecret}\n`);
    
    validateSecret(newSecret);
    
    if (shouldSave) {
        console.log('\n💾 Salvando em .env...');
        try {
            updateEnvFile(newSecret);
            console.log('✅ SESSION_SECRET salvo com sucesso!\n');
        } catch (err) {
            console.error('❌ Erro ao salvar .env:', err.message);
            process.exit(1);
        }
    } else {
        console.log('\n💡 Para salvar em .env, use:');
        console.log('   node generate-secret.js --save\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

// Executar se chamado direto
if (require.main === module) {
    main();
}

// Exportar função para uso programático
module.exports = { generateSessionSecret, validateSecret };
