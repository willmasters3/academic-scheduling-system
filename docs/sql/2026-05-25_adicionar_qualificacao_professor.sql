/*
MIGRACAO - QUALIFICACAO PROFISSIONAL DO PROFESSOR
Banco alvo: AgendamentosDemo

Objetivo:
- Adicionar a coluna qualificacao em dbo.professores.
- Permitir armazenar o titulo/qualificacao profissional do instrutor.
- Manter o script idempotente para reexecucao segura.
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

------------------------------------------------------------
-- 1) Adicao de coluna (somente se faltar)
------------------------------------------------------------
IF COL_LENGTH('dbo.professores', 'qualificacao') IS NULL
    ALTER TABLE dbo.professores ADD qualificacao NVARCHAR(200) NULL;
GO

------------------------------------------------------------
-- 2) Validacao rapida
------------------------------------------------------------
SELECT
    c.name AS coluna,
    ty.name AS tipo,
    c.max_length,
    c.is_nullable
FROM sys.columns c
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.professores')
  AND c.name = 'qualificacao';
GO

SELECT TOP (20)
    id_professor,
    nome,
    login,
    matricula,
    qualificacao
FROM dbo.professores
ORDER BY id_professor DESC;
GO
