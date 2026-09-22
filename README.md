# Agenda Demo Portfolio

Versao publica e sanitizada de um sistema de agendamentos academicos criado por William Pereira do Nascimento. Esta copia foi preparada para portfolio e usa apenas nomes, unidades, salas e configuracoes ficticias.

## Escopo Preservado

- Autenticacao, sessoes, autorizacao e perfis de usuario.
- Cadastro e gestao de professores, salas, unidades, programas e unidades curriculares.
- Agendamentos individuais e recorrentes.
- Regras de conflito de sala, avisos de sobreposicao e disponibilidade parcial.
- Fluxos de troca de sala, auditoria de agendamentos, dashboards e relatorios.
- Alocacao docente, gestao docente e inventario sanitizado.
- Testes automatizados para regras de negocio e interpretacao de linguagem.

## Escopo Removido da Versao Publica

Os componentes de acesso direto a maquinas, agentes de estacao, administracao de usuarios Windows e envio de arquivos para estacoes foram removidos desta primeira versao publica. O inventario foi preservado como modulo funcional, mas desacoplado de agentes corporativos e dados reais.

## Configuracao

Copie `.env.example` para `.env` e preencha variaveis locais de desenvolvimento. O arquivo `.env` nao deve ser versionado.

Principais variaveis:

- `SESSION_SECRET`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_ENCRYPT`
- `DB_TRUST_SERVER_CERTIFICATE`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`

## Banco Demo

Os arquivos `database/schema-demo.sql` e `database/seed-demo.sql` descrevem uma base ficticia para demonstracao. Eles nao reutilizam dump, backup ou dados de producao.

## Desenvolvimento

```bash
npm install
npm test
node server.js
```

Nao execute scripts SQL contra bancos existentes ao preparar a demo. Use apenas uma base local criada especificamente para dados ficticios.

## Autor

William Pereira do Nascimento
