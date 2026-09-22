# 🔐 GUIA DE SEGURANÇA - ETAPA 6: SESSION & CONFIG HARDENING

## Instruções de Setup Pós-ETAPA 6

### 1️⃣ **Configurar Variáveis de Ambiente**

#### Criar arquivo `.env` a partir do template:
```bash
cp .env.example .env
```

#### Editar `.env` com valores seguros:
```env
# Sessão
SESSION_SECRET=seu-segredo-aleatorio-de-32-caracteres-aqui

# Cookies (em desenvolvimento: false | em produção: true)
COOKIE_SECURE=false
COOKIE_SAME_SITE=Lax

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=5
```

### ⚠️ **NUNCA:**
- ❌ Commitar `.env` em git
- ❌ Usar secrets padrão em produção
- ❌ Compartilhar `.env` publicamente
- ❌ Desabilitar httpOnly em cookies
- ❌ Usar secure=true sem HTTPS

### ✅ **SEMPRE EM PRODUÇÃO:**
1. Gerar novo `SESSION_SECRET`:
   ```bash
   # Opção 1: OpenSSL
   openssl rand -base64 32
   
   # Opção 2: Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Ativar `COOKIE_SECURE=true` com HTTPS

3. Aumentar `RATE_LIMIT_MAX_REQUESTS` se necessário

---

## 🛡️ Hardening Implementado

### Session Hardening
✅ SESSION_SECRET via variável de ambiente  
✅ Validação em startup (erro se não configurado em produção)  
✅ httpOnly: true (protege contra XSS)  
✅ sameSite: Lax (proteção CSRF com compatibilidade)  
✅ secure: condicional (apenas HTTPS quando ativado)  

### Cookies Seguros
✅ httpOnly=true → não acessível via JavaScript  
✅ sameSite=Lax → proteção contra CSRF  
✅ secure=condicional → apenas HTTPS em produção  
✅ maxAge=3600000 → 1 hora (não persiste)  

### Headers de Segurança
✅ X-Frame-Options: SAMEORIGIN → protege contra clickjacking  
✅ X-Content-Type-Options: nosniff → protege contra MIME sniffing  
✅ X-XSS-Protection: 1; mode=block → XSS protection  
✅ Referrer-Policy: strict-origin-when-cross-origin → privacidade  
✅ X-Powered-By: removido → não expõe stack  

### Rate Limiting
✅ Aplicado apenas em: /auth/login, /auth/register  
✅ 5 requisições por 15 minutos (configurável)  
✅ Bloqueio temporal automático  
✅ Protege contra força bruta  
✅ NÃO impacta outras rotas  

### Error Handling
✅ Em desenvolvimento: mostra stack trace  
✅ Em produção: mensagens genéricas  
✅ Previne information disclosure  
✅ Logs internos mantidos  

---

## 📊 Compatibilidade Garantida

| Feature | Status | Impacto |
|---------|--------|--------|
| Frontend | ✅ Intacto | Zero visual |
| Chatbot | ✅ Funcional | Sem bloqueio |
| APIs | ✅ Acessíveis | Sem CORS restritivo |
| Sessões | ✅ Seguras | Compatível |
| Cookies | ✅ Seguras | Compatível |
| Agendamentos | ✅ Funcional | Zero impacto |
| Rate Limit | ✅ Flexível | Apenas login |

---

## 🔧 Configuração de Produção

### Checklist de Deploy:

```bash
# 1. Gerar SESSION_SECRET
export SESSION_SECRET=$(openssl rand -base64 32)

# 2. Configurar .env em produção
echo "SESSION_SECRET=$SESSION_SECRET" > .env
echo "COOKIE_SECURE=true" >> .env
echo "NODE_ENV=production" >> .env

# 3. Validar configuração
node -e "require('dotenv').config(); console.log(process.env.SESSION_SECRET ? '✅ SESSION_SECRET configurado' : '❌ FALHA')"

# 4. Iniciar servidor
NODE_ENV=production node server.js
```

---

## 🧪 Testes de Segurança

### Rate Limiting (5 requisições em 15 min):
```bash
# Deve funcionar (1-5)
for i in {1..5}; do curl -X POST http://localhost:3000/auth/login; done

# Deve bloquear (6+)
curl -X POST http://localhost:3000/auth/login
# Resposta: 429 Too Many Requests
```

### Headers de Segurança:
```bash
curl -I http://localhost:3000

# Verificar presença de:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
```

### Sessões Seguras:
```bash
# Verificar cookie httpOnly
curl -I http://localhost:3000 | grep Set-Cookie
# Deve conter: HttpOnly; Secure; SameSite=Lax
```

---

## 📋 Melhorias Futuras (Fora do Escopo da ETAPA 6)

Futuras melhorias opcionais:

1. **HTTPS Obrigatório**
   - Certificados SSL/TLS
   - Redirecionamento HTTP → HTTPS

2. **Helmet.js Avançado**
   - CSP (Content Security Policy)
   - HSTS (HTTP Strict Transport Security)

3. **API Rate Limiting**
   - Por rota/endpoint
   - Diferenciação de usuários

4. **Auditoria e Logging**
   - Winston ou Pino
   - Rastreamento de ações críticas

5. **WAF (Web Application Firewall)**
   - ModSecurity
   - Proteção contra OWASP Top 10

---

## ❓ Dúvidas Comuns

**P: Posso usar o sistema sem .env?**  
R: Em desenvolvimento, sim. O `SESSION_SECRET` pode ser auto-gerado em runtime. Em produção, `SESSION_SECRET` deve estar configurado em variável de ambiente.

**P: O que fazer se esquecer o SESSION_SECRET?**  
R: Todos os usuários serão desconectados. Gere um novo em .env.

**P: Rate limiting quebra APIs?**  
R: Não, está aplicado APENAS em /auth/login e /auth/register.

**P: Preciso mudar COOKIE_SECURE para true agora?**  
R: Não em desenvolvimento. Ative apenas com HTTPS configurado.

---

## 📚 Referências

- [OWASP Session Management](https://owasp.org/www-community/attacks/Session_fixation)
- [HTTP Cookies Security](https://owasp.org/www-community/controls/Cookie_Security)
- [Rate Limiting Best Practices](https://owasp.org/www-community/attacks/Brute_force_attack)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
