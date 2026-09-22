-- 2026-05-26_adicionar_historico_equipamentos.sql
-- Cria tabela para histórico de movimentação e alterações de patrimônio/nome
-- para computadores e monitores.
-- Esta tabela grava apenas metadados estáveis, não dados voláteis como IP, disco ou memória.

IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'dbo'
      AND t.name = 'EquipamentoHistorico'
)
BEGIN
    CREATE TABLE [dbo].[EquipamentoHistorico] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [tipo_equipamento] NVARCHAR(20) NOT NULL,
        [id_equipamento] INT NOT NULL,
        [serial_number] NVARCHAR(200) NULL,
        [acao] NVARCHAR(50) NOT NULL,
        [nome_antigo] NVARCHAR(255) NULL,
        [nome_novo] NVARCHAR(255) NULL,
        [patrimonio_antigo] NVARCHAR(100) NULL,
        [patrimonio_novo] NVARCHAR(100) NULL,
        [sala_origem_id] INT NULL,
        [sala_origem_tipo] NVARCHAR(20) NULL,
        [sala_origem_nome] NVARCHAR(255) NULL,
        [sala_destino_id] INT NULL,
        [sala_destino_tipo] NVARCHAR(20) NULL,
        [sala_destino_nome] NVARCHAR(255) NULL,
        [usuario_id] INT NULL,
        [usuario_nome] NVARCHAR(255) NULL,
        [data_evento] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [detalhes] NVARCHAR(500) NULL,
        [observacao] NVARCHAR(500) NULL
    );

    ALTER TABLE [dbo].[EquipamentoHistorico]
    ADD CONSTRAINT [CHK_EquipamentoHistorico_TipoEquipamento]
    CHECK ([tipo_equipamento] IN ('computador', 'monitor'));

    CREATE INDEX [IX_EquipamentoHistorico_TipoEquipamento_IdEquipamento]
        ON [dbo].[EquipamentoHistorico] ([tipo_equipamento], [id_equipamento]);

    CREATE INDEX [IX_EquipamentoHistorico_DataEvento]
        ON [dbo].[EquipamentoHistorico] ([data_evento]);

    CREATE INDEX [IX_EquipamentoHistorico_SalaDestinoId]
        ON [dbo].[EquipamentoHistorico] ([sala_destino_id]);
END
GO

-- Exemplo de uso:
--
-- INSERT INTO [dbo].[EquipamentoHistorico] (
--     tipo_equipamento,
--     id_equipamento,
--     serial_number,
--     acao,
--     nome_antigo,
--     nome_novo,
--     patrimonio_antigo,
--     patrimonio_novo,
--     sala_origem_id,
--     sala_origem_tipo,
--     sala_origem_nome,
--     sala_destino_id,
--     sala_destino_tipo,
--     sala_destino_nome,
--     usuario_id,
--     usuario_nome,
--     detalhes
-- ) VALUES (
--     'computador',
--     123,
--     'ABC123',
--     'rename',
--     'PC-01',
--     'PC-01-LOCAL',
--     'PATR123',
--     'PATR123',
--     45,
--     'academico',
--     'Sala 1',
--     46,
--     'academico',
--     'Sala 2',
--     7,
--     'João Silva',
--     'Troca de sala e ajuste de nome'
-- );
