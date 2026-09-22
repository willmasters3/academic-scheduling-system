/*
    2026-08-02_criar_agendamento_auditoria.sql

    Finalidade
    ==========
    Cria a tabela unica dbo.AgendamentoAuditoria para centralizar eventos de
    criacao, edicao, exclusao, conflitos bloqueados e erros relevantes do fluxo
    de agendamentos.

    Execucao
    ========
    1. Execute primeiro no banco de testes.
    2. Revise os SELECTs de verificacao no final.
    3. Depois de validar a aplicacao, execute no banco de producao.

    Observacoes importantes
    =======================
    - Este script e idempotente: pode ser reexecutado sem recriar a tabela ou
      indices ja existentes.
    - A tabela nao possui chaves estrangeiras de proposito. O historico precisa
      sobreviver a exclusoes futuras de agendamentos, professores, salas ou
      usuarios.
    - Campos JSON armazenam informacoes variaveis de recorrencia e detalhes de
      edicao/exclusao sem criar tabelas adicionais.
    - Nao grave senhas, cookies, dados de sessao, tokens ou segredos nos campos
      JSON.
*/

IF OBJECT_ID('dbo.AgendamentoAuditoria', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AgendamentoAuditoria (
        -- Identificador unico do evento de auditoria.
        id_auditoria INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AgendamentoAuditoria PRIMARY KEY,

        -- Data/hora do evento em UTC, gravada pelo SQL Server.
        data_evento DATETIME2(0) NOT NULL CONSTRAINT DF_AgendamentoAuditoria_data_evento DEFAULT SYSUTCDATETIME(),

        -- Tipo de evento: CRIACAO, EDICAO, EXCLUSAO, CONFLITO ou ERRO.
        acao NVARCHAR(20) NOT NULL,

        -- Resultado do evento: SUCESSO, PARCIAL, BLOQUEADO ou ERRO.
        resultado NVARCHAR(20) NOT NULL,

        -- Usuario responsavel obtido da sessao autenticada no backend.
        usuario_responsavel_id INT NULL,
        usuario_responsavel_nome NVARCHAR(255) NULL,
        usuario_responsavel_login NVARCHAR(255) NULL,
        usuario_responsavel_permissao NVARCHAR(50) NULL,

        -- Agendamento afetado. Em recorrencias pode ficar NULL e os IDs criados
        -- ficam no JSON de detalhes, junto do id_correlacao.
        id_agendamento INT NULL,

        -- Identificador unico para correlacionar uma solicitacao recorrente.
        -- Todos os dados variaveis do lote ficam em detalhes_json.
        id_correlacao UNIQUEIDENTIFIER NULL,

        -- Campos de filtro e leitura rapida.
        codigo_unidade NVARCHAR(50) NULL,
        nome_unidade NVARCHAR(150) NULL,
        id_sala INT NULL,
        nome_sala NVARCHAR(255) NULL,
        id_professor INT NULL,
        nome_professor NVARCHAR(255) NULL,
        data_reserva NVARCHAR(20) NULL,
        hora_inicio NVARCHAR(20) NULL,
        hora_fim NVARCHAR(20) NULL,
        motivo NVARCHAR(720) NULL,
        tipo_aula NVARCHAR(720) NULL,
        resumo NVARCHAR(500) NOT NULL,

        -- JSONs legiveis pela aplicacao.
        -- detalhes_json: datas solicitadas/criadas/recusadas, conflitos, IDs etc.
        -- dados_anteriores_json: estado anterior em edicoes/exclusoes.
        -- dados_posteriores_json: estado posterior em edicoes.
        detalhes_json NVARCHAR(MAX) NULL,
        dados_anteriores_json NVARCHAR(MAX) NULL,
        dados_posteriores_json NVARCHAR(MAX) NULL,

        -- Mensagem tecnica resumida de erro quando existir.
        erro_mensagem NVARCHAR(MAX) NULL,

        CONSTRAINT CK_AgendamentoAuditoria_Acao
            CHECK (acao IN ('CRIACAO', 'EDICAO', 'EXCLUSAO', 'CONFLITO', 'ERRO')),

        CONSTRAINT CK_AgendamentoAuditoria_Resultado
            CHECK (resultado IN ('SUCESSO', 'PARCIAL', 'BLOQUEADO', 'ERRO')),

        CONSTRAINT CK_AgendamentoAuditoria_DetalhesJson
            CHECK (detalhes_json IS NULL OR ISJSON(detalhes_json) = 1),

        CONSTRAINT CK_AgendamentoAuditoria_DadosAnterioresJson
            CHECK (dados_anteriores_json IS NULL OR ISJSON(dados_anteriores_json) = 1),

        CONSTRAINT CK_AgendamentoAuditoria_DadosPosterioresJson
            CHECK (dados_posteriores_json IS NULL OR ISJSON(dados_posteriores_json) = 1)
    );
END;
GO

/*
    Indices
    =======
    Os indices abaixo apoiam os filtros da tela de auditoria:
    - data do evento: ordenacao e periodo;
    - usuario: historico por responsavel;
    - acao/resultado: resumo e filtros de tipo;
    - unidade/sala/professor/agendamento: rastreio operacional;
    - id_correlacao: recorrencias.
*/

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_DataEvento'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_DataEvento
        ON dbo.AgendamentoAuditoria (data_evento DESC, id_auditoria DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_Usuario'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_Usuario
        ON dbo.AgendamentoAuditoria (usuario_responsavel_id, data_evento DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_AcaoResultado'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_AcaoResultado
        ON dbo.AgendamentoAuditoria (acao, resultado, data_evento DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_Unidade'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_Unidade
        ON dbo.AgendamentoAuditoria (codigo_unidade, data_evento DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_Sala'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_Sala
        ON dbo.AgendamentoAuditoria (id_sala, data_evento DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_Professor'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_Professor
        ON dbo.AgendamentoAuditoria (id_professor, data_evento DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_Agendamento'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_Agendamento
        ON dbo.AgendamentoAuditoria (id_agendamento, data_evento DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
      AND name = 'IX_AgendamentoAuditoria_Correlacao'
)
BEGIN
    CREATE INDEX IX_AgendamentoAuditoria_Correlacao
        ON dbo.AgendamentoAuditoria (id_correlacao);
END;
GO

/*
    Verificacao pos-execucao
    ========================
    Estes SELECTs confirmam a existencia da tabela, colunas principais, indices
    e constraints. Execute apos o script e confira os resultados.
*/

SELECT
    t.name AS tabela,
    s.name AS schema_name,
    t.create_date,
    t.modify_date
FROM sys.tables t
INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = 'dbo'
  AND t.name = 'AgendamentoAuditoria';

SELECT
    c.column_id,
    c.name AS coluna,
    ty.name AS tipo,
    c.max_length,
    c.is_nullable
FROM sys.columns c
INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
ORDER BY c.column_id;

SELECT
    i.name AS indice,
    i.type_desc
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
ORDER BY i.name;

SELECT
    cc.name AS constraint_name,
    cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.AgendamentoAuditoria')
ORDER BY cc.name;

/*
    Reversao
    ========
    ATENCAO: a reversao apaga historico de auditoria. Use somente em banco de
    testes, com autorizacao explicita, e apos backup.

    -- DROP TABLE dbo.AgendamentoAuditoria;
*/
