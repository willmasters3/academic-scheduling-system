/*
MIGRACAO FASE 1 - PRODUCAO (COLUNAS NOVAS EM dbo.professores)
Banco alvo: AgendamentosDemo

Objetivo:
- Nao criar tabelas novas.
- Nao copiar dados entre tabelas.
- Apenas adicionar colunas novas em dbo.professores, de forma idempotente.
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
-- 1) Adicao de colunas (somente se faltarem)
------------------------------------------------------------
IF COL_LENGTH('dbo.professores', 'turno_principal') IS NULL
    ALTER TABLE dbo.professores ADD turno_principal NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.professores', 'foto_url') IS NULL
    ALTER TABLE dbo.professores ADD foto_url NVARCHAR(500) NULL;

IF COL_LENGTH('dbo.professores', 'foto_mime_type') IS NULL
    ALTER TABLE dbo.professores ADD foto_mime_type NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.professores', 'foto_atualizada_em') IS NULL
    ALTER TABLE dbo.professores ADD foto_atualizada_em DATETIME2(0) NULL;

IF COL_LENGTH('dbo.professores', 'carga_horaria_semanal') IS NULL
    ALTER TABLE dbo.professores ADD carga_horaria_semanal DECIMAL(5,2) NULL;

IF COL_LENGTH('dbo.professores', 'perfil_atualizado_em') IS NULL
    ALTER TABLE dbo.professores ADD perfil_atualizado_em DATETIME2(0) NULL;
GO

------------------------------------------------------------
-- 2) Constraint de carga horaria (somente se nao existir)
------------------------------------------------------------
IF COL_LENGTH('dbo.professores', 'carga_horaria_semanal') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_professores_carga_horaria_semanal'
      AND parent_object_id = OBJECT_ID('dbo.professores')
)
BEGIN
    ALTER TABLE dbo.professores
    ADD CONSTRAINT CK_professores_carga_horaria_semanal
    CHECK (
        carga_horaria_semanal IS NULL
        OR (carga_horaria_semanal >= 0 AND carga_horaria_semanal <= 80)
    );
END
GO

------------------------------------------------------------
-- Validacao rapida
------------------------------------------------------------
SELECT
    c.name AS coluna,
    ty.name AS tipo,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable
FROM sys.columns c
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.professores')
  AND c.name IN (
      'turno_principal',
      'foto_url',
      'foto_mime_type',
      'foto_atualizada_em',
      'carga_horaria_semanal',
      'perfil_atualizado_em'
  )
ORDER BY c.column_id;
GO

SELECT TOP (20)
    id_professor,
    nome,
    login,
    email,
    turno_principal,
    carga_horaria_semanal,
    foto_url,
    foto_mime_type,
    foto_atualizada_em,
    perfil_atualizado_em
FROM dbo.professores
ORDER BY id_professor DESC;
GO
