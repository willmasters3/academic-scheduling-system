# SQL Scripts de Migracao

Este diretorio concentra scripts SQL para aplicacao manual no banco de dados.

## Convencao de nomes

- Formato: `YYYY-MM-DD_descricao.sql`
- Todos os scripts devem ser idempotentes.

## Scripts disponiveis

- `2026-05-23_migracao_fase1_perfil_professor_disponibilidade.sql`
  - Adiciona colunas de perfil em `dbo.professores` (turno, foto, carga horaria etc.).

- `2026-05-24_migracao_senha_temporaria_controle.sql`
  - Garante coluna `senhaTemporaria` em `dbo.professores`.
  - Cria `dbo.ProfessorSenhaTemporariaControle` para persistencia de tentativas/falhas de redefinicao.
  - Necessario para manter bloqueio persistente (5 tentativas) no fluxo de senha temporaria.

- `2026-05-24_correcao_agenda_pessoal_pos_execucao.sql`
  - Script final e unico da agenda pessoal do professor.
  - Cria `dbo.ProfessorAgendaPessoal` se nao existir e corrige estrutura se ja existir.
  - Os compromissos aparecem no calendario da dashboard e bloqueiam disponibilidade no relatorio de disponibilidade.

- `2026-05-25_adicionar_qualificacao_professor.sql`
  - Adiciona coluna `qualificacao` em `dbo.professores`.
  - Armazena titulo/qualificacao profissional do instrutor (ex: "INSTRUTOR DE EDUCAÇÃO PROFISSIONAL TECNICA I (MECÂNICA)").
  - Campo nullable; preparado para uso futuro em funcionalidades de coordenação.

- `2026-05-26_adicionar_historico_equipamentos.sql`
  - Cria `dbo.EquipamentoHistorico` para auditoria de alteracoes em computadores e monitores.

- `2026-06-05_adicionar_identidades_agentes.sql`
  - Cria `dbo.AgenteIdentidades` para persistir chave publica, fingerprint e status dos agentes Windows.

- `2026-08-02_criar_agendamento_auditoria.sql`
  - Cria `dbo.AgendamentoAuditoria` para auditoria centralizada de criacao, edicao, exclusao, conflitos e erros do fluxo de agendamentos.
## Como executar (SSMS)

1. Abrir o script desejado no SQL Server Management Studio.
2. Conferir o banco alvo no comando `USE [AgendamentosDemo]`.
3. Executar com permissao de ALTER/CREATE (idealmente usuario DBA).
4. Validar os `SELECT` finais do script.

## Ordem de execução recomendada

Para nova instalacao ou ambiente de producao, execute os scripts nesta ordem:

1. `2026-05-23_migracao_fase1_perfil_professor_disponibilidade.sql`
2. `2026-05-24_migracao_senha_temporaria_controle.sql`
3. `2026-05-24_correcao_agenda_pessoal_pos_execucao.sql`
4. `2026-05-25_adicionar_qualificacao_professor.sql`
5. `2026-05-26_adicionar_historico_equipamentos.sql`
6. `2026-06-05_adicionar_identidades_agentes.sql`
7. `2026-08-02_criar_agendamento_auditoria.sql`

Todos os scripts sao idempotentes e podem ser reexecutados sem risco de perda de dados.

## Observacoes

- A aplicacao nao deve criar tabela em runtime no login.
- Em ambiente sem a tabela de controle, o login funciona, mas sem persistencia de tentativas no banco.
