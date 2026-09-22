require('dotenv').config();

function parseBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }

    return String(value).trim().toLowerCase() === 'true';
}

module.exports = {
    user: process.env.DB_USER || 'demo_user',
    password: process.env.DB_PASSWORD || 'demo_password',
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME || 'agendamentos_demo',
    encrypt: parseBoolean(process.env.DB_ENCRYPT, true),
    trustServerCertificate: parseBoolean(process.env.DB_TRUST_SERVER_CERTIFICATE, true)
};
