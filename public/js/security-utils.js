/**
 * Utilitários de segurança para prevenir XSS
 * Aplicado apenas em pontos críticos com conteúdo dinâmico
 */

/**
 * Escapa caracteres HTML perigosos para neutralizar conteúdo malicioso
 * Preserva a renderização visual completamente
 * @param {string} text - Texto a ser escapado
 * @returns {string} - Texto escapado
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Sanitiza atributos de dados para evitar ataque via data-* attributes
 * @param {string} value - Valor do atributo
 * @returns {string} - Valor sanitizado
 */
function sanitizeAttribute(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }

    // Remove caracteres de controle e scripts
    return value.replace(/[<>"'`]/g, '');
}
