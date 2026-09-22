/*
SCRIPT FINAL (UNICO) - AGENDA PESSOAL DO PROFESSOR
Banco alvo: AgendamentosDemo

Objetivo:
- Criar dbo.ProfessorAgendaPessoal caso ainda nao exista.
- Corrigir/normalizar estrutura caso tabela ja exista.
- Garantir compatibilidade para calendario da dashboard e disponibilidade.

Script idempotente e pronto para producao.
*/

USE [AgendamentosDemo];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.professores', 'U') IS NULL
BEGIN
  RAISERROR('Tabela dbo.professores nao encontrada no banco atual.', 16, 1);
  RETURN;
END
GO

/*
  0) Cria tabela se nao existir
*/
IF OBJECT_ID('dbo.ProfessorAgendaPessoal', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProfessorAgendaPessoal (
    id_compromisso INT IDENTITY(1,1) NOT NULL,
    id_professor INT NOT NULL,
    titulo NVARCHAR(150) NOT NULL,
    data_compromisso DATE NOT NULL,
    hora_inicio TIME(0) NOT NULL,
    hora_fim TIME(0) NOT NULL,
    descricao NVARCHAR(MAX) NULL,
    criado_em DATETIME2(0) NOT NULL CONSTRAINT DF_ProfessorAgendaPessoal_criado_em DEFAULT (SYSDATETIME()),
    atualizado_em DATETIME2(0) NOT NULL CONSTRAINT DF_ProfessorAgendaPessoal_atualizado_em DEFAULT (SYSDATETIME()),
    CONSTRAINT PK_ProfessorAgendaPessoal PRIMARY KEY (id_compromisso),
    CONSTRAINT FK_ProfessorAgendaPessoal_professor FOREIGN KEY (id_professor)
      REFERENCES dbo.professores(id_professor)
      ON DELETE CASCADE,
    CONSTRAINT CK_ProfessorAgendaPessoal_horario CHECK (hora_fim > hora_inicio)
  );
END
GO

/*
  1) Garante tipo TIME(0) nas colunas de hora
*/
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.ProfessorAgendaPessoal')
      AND name = 'hora_inicio'
      AND scale <> 0
)
BEGIN
    ALTER TABLE dbo.ProfessorAgendaPessoal ALTER COLUMN hora_inicio TIME(0) NOT NULL;
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.ProfessorAgendaPessoal')
      AND name = 'hora_fim'
      AND scale <> 0
)
BEGIN
    ALTER TABLE dbo.ProfessorAgendaPessoal ALTER COLUMN hora_fim TIME(0) NOT NULL;
END
GO

/*
  2) Garante constraint de horario valido
*/
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_ProfessorAgendaPessoal_horario'
      AND parent_object_id = OBJECT_ID('dbo.ProfessorAgendaPessoal')
)
BEGIN
    ALTER TABLE dbo.ProfessorAgendaPessoal
    ADD CONSTRAINT CK_ProfessorAgendaPessoal_horario
    CHECK (hora_fim > hora_inicio);
END
GO

/*
  3) Garante indice principal de consulta por professor/data
*/
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.ProfessorAgendaPessoal')
      AND name = 'IX_ProfessorAgendaPessoal_prof_data'
)
BEGIN
    CREATE INDEX IX_ProfessorAgendaPessoal_prof_data
    ON dbo.ProfessorAgendaPessoal (id_professor, data_compromisso, hora_inicio);
END
GO

/*
  Validacao final
*/
SELECT
    t.name AS tabela,
    c.name AS coluna,
    ty.name AS tipo,
    c.scale,
    c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.object_id = OBJECT_ID('dbo.ProfessorAgendaPessoal')
  AND c.name IN ('hora_inicio', 'hora_fim')
ORDER BY c.column_id;
GO

PRINT 'Correcao pos-execucao da agenda pessoal concluida com sucesso.';
GO
