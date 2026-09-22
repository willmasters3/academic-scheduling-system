/*
  Demo schema for the public portfolio copy.
  Create a new local database first, then run this file against that empty demo database.
  Do not run it against any existing institutional or production database.
*/

IF OBJECT_ID('dbo.AgendamentoAuditoria', 'U') IS NOT NULL DROP TABLE dbo.AgendamentoAuditoria;
IF OBJECT_ID('dbo.solicitacoes_troca_sala_lote_item', 'U') IS NOT NULL DROP TABLE dbo.solicitacoes_troca_sala_lote_item;
IF OBJECT_ID('dbo.solicitacoes_troca_sala_lote', 'U') IS NOT NULL DROP TABLE dbo.solicitacoes_troca_sala_lote;
IF OBJECT_ID('dbo.solicitacoes_troca_sala', 'U') IS NOT NULL DROP TABLE dbo.solicitacoes_troca_sala;
IF OBJECT_ID('dbo.agendamentos', 'U') IS NOT NULL DROP TABLE dbo.agendamentos;
IF OBJECT_ID('dbo.ProfessorSenhaTemporariaControle', 'U') IS NOT NULL DROP TABLE dbo.ProfessorSenhaTemporariaControle;
IF OBJECT_ID('dbo.SalaComputadorAcademica', 'U') IS NOT NULL DROP TABLE dbo.SalaComputadorAcademica;
IF OBJECT_ID('dbo.MonitorSala', 'U') IS NOT NULL DROP TABLE dbo.MonitorSala;
IF OBJECT_ID('dbo.EquipamentoHistorico', 'U') IS NOT NULL DROP TABLE dbo.EquipamentoHistorico;
IF OBJECT_ID('dbo.monitores', 'U') IS NOT NULL DROP TABLE dbo.monitores;
IF OBJECT_ID('dbo.computadores', 'U') IS NOT NULL DROP TABLE dbo.computadores;
IF OBJECT_ID('dbo.alocacoes_docentes', 'U') IS NOT NULL DROP TABLE dbo.alocacoes_docentes;
IF OBJECT_ID('dbo.planejamento_turma_uc', 'U') IS NOT NULL DROP TABLE dbo.planejamento_turma_uc;
IF OBJECT_ID('dbo.unidade_tipo_aula_associacao', 'U') IS NOT NULL DROP TABLE dbo.unidade_tipo_aula_associacao;
IF OBJECT_ID('dbo.UnidadesCurriculares', 'U') IS NOT NULL DROP TABLE dbo.UnidadesCurriculares;
IF OBJECT_ID('dbo.tipos_aula', 'U') IS NOT NULL DROP TABLE dbo.tipos_aula;
IF OBJECT_ID('dbo.programas', 'U') IS NOT NULL DROP TABLE dbo.programas;
IF OBJECT_ID('dbo.SalasAdministrativas', 'U') IS NOT NULL DROP TABLE dbo.SalasAdministrativas;
IF OBJECT_ID('dbo.Salas', 'U') IS NOT NULL DROP TABLE dbo.Salas;
IF OBJECT_ID('dbo.professores', 'U') IS NOT NULL DROP TABLE dbo.professores;
IF OBJECT_ID('dbo.Unidades', 'U') IS NOT NULL DROP TABLE dbo.Unidades;

CREATE TABLE dbo.Unidades (
    codigo_unidade NVARCHAR(10) NOT NULL PRIMARY KEY,
    nome_unidade NVARCHAR(120) NOT NULL
);

CREATE TABLE dbo.professores (
    id_professor INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(160) NOT NULL,
    matricula NVARCHAR(40) NULL,
    login NVARCHAR(80) NOT NULL UNIQUE,
    senha NVARCHAR(255) NOT NULL,
    permissao NVARCHAR(30) NOT NULL DEFAULT 'user',
    unidades NVARCHAR(MAX) NULL,
    email NVARCHAR(160) NULL,
    senhaTemporaria BIT NOT NULL DEFAULT 0,
    foto_url NVARCHAR(255) NULL,
    turno_principal NVARCHAR(30) NULL,
    carga_horaria_semanal DECIMAL(5,2) NULL,
    qualificacao NVARCHAR(200) NULL,
    classificacao_docente NVARCHAR(40) NULL
);

CREATE TABLE dbo.Salas (
    id_sala INT IDENTITY(1,1) PRIMARY KEY,
    nome_sala NVARCHAR(120) NOT NULL,
    codigo_unidade NVARCHAR(10) NOT NULL,
    capacidade INT NULL,
    projetor BIT NOT NULL DEFAULT 0,
    computadores INT NULL,
    observacoes NVARCHAR(500) NULL,
    imagem_url NVARCHAR(255) NULL,
    CONSTRAINT FK_Salas_Unidades FOREIGN KEY (codigo_unidade) REFERENCES dbo.Unidades(codigo_unidade)
);

CREATE TABLE dbo.SalasAdministrativas (
    id_sala INT IDENTITY(1,1) PRIMARY KEY,
    nome_sala NVARCHAR(120) NOT NULL,
    codigo_unidade NVARCHAR(10) NOT NULL,
    capacidade INT NULL,
    observacoes NVARCHAR(500) NULL,
    CONSTRAINT FK_SalasAdm_Unidades FOREIGN KEY (codigo_unidade) REFERENCES dbo.Unidades(codigo_unidade)
);

CREATE TABLE dbo.programas (
    id_programa INT IDENTITY(1,1) PRIMARY KEY,
    nome_programa NVARCHAR(160) NOT NULL,
    versao NVARCHAR(40) NULL,
    observacoes NVARCHAR(500) NULL
);

CREATE TABLE dbo.tipos_aula (
    id_tipo_aula INT IDENTITY(1,1) PRIMARY KEY,
    descricao NVARCHAR(120) NOT NULL
);

CREATE TABLE dbo.UnidadesCurriculares (
    id_unidade_curricular INT IDENTITY(1,1) PRIMARY KEY,
    ano INT NOT NULL,
    semestre INT NOT NULL,
    turma NVARCHAR(60) NOT NULL,
    turno NVARCHAR(30) NOT NULL,
    modulo NVARCHAR(60) NULL,
    tipo_curso NVARCHAR(80) NULL,
    nome_uc NVARCHAR(180) NULL,
    carga_horaria INT NULL
);

CREATE TABLE dbo.unidade_tipo_aula_associacao (
    id_unidade_curricular INT NOT NULL,
    id_tipo_aula INT NOT NULL,
    PRIMARY KEY (id_unidade_curricular, id_tipo_aula),
    FOREIGN KEY (id_unidade_curricular) REFERENCES dbo.UnidadesCurriculares(id_unidade_curricular),
    FOREIGN KEY (id_tipo_aula) REFERENCES dbo.tipos_aula(id_tipo_aula)
);

CREATE TABLE dbo.agendamentos (
    id_agendamento INT IDENTITY(1,1) PRIMARY KEY,
    id_sala INT NOT NULL,
    id_professor INT NOT NULL,
    data_reservas DATE NOT NULL,
    hora_inicio TIME(0) NOT NULL,
    hora_fim TIME(0) NOT NULL,
    motivo NVARCHAR(300) NULL,
    tipo_aula NVARCHAR(80) NULL,
    recorrencia_id UNIQUEIDENTIFIER NULL,
    criado_em DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    FOREIGN KEY (id_sala) REFERENCES dbo.Salas(id_sala),
    FOREIGN KEY (id_professor) REFERENCES dbo.professores(id_professor)
);

CREATE INDEX IX_agendamentos_sala_data_hora
ON dbo.agendamentos (id_sala, data_reservas, hora_inicio, hora_fim);

CREATE TABLE dbo.solicitacoes_troca_sala (
    id_solicitacao INT IDENTITY(1,1) PRIMARY KEY,
    id_professor_origem INT NOT NULL,
    id_professor_destino INT NOT NULL,
    id_agendamento_origem INT NOT NULL,
    id_agendamento_destino INT NOT NULL,
    mensagem NVARCHAR(500) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    responded_at DATETIME2 NULL
);

CREATE TABLE dbo.solicitacoes_troca_sala_lote (
    id_lote INT IDENTITY(1,1) PRIMARY KEY,
    id_professor_origem INT NOT NULL,
    id_professor_destino INT NOT NULL,
    mensagem NVARCHAR(500) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    responded_at DATETIME2 NULL
);

CREATE TABLE dbo.solicitacoes_troca_sala_lote_item (
    id_item INT IDENTITY(1,1) PRIMARY KEY,
    id_lote INT NOT NULL,
    id_agendamento_origem INT NOT NULL,
    id_agendamento_destino INT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    FOREIGN KEY (id_lote) REFERENCES dbo.solicitacoes_troca_sala_lote(id_lote)
);

CREATE TABLE dbo.AgendamentoAuditoria (
    id_auditoria INT IDENTITY(1,1) PRIMARY KEY,
    id_agendamento INT NULL,
    acao NVARCHAR(60) NOT NULL,
    usuario NVARCHAR(120) NULL,
    payload NVARCHAR(MAX) NULL,
    criado_em DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE dbo.computadores (
    id_computador INT IDENTITY(1,1) PRIMARY KEY,
    nome_computador NVARCHAR(80) NOT NULL,
    serialNumber NVARCHAR(80) NOT NULL UNIQUE,
    patrimonio NVARCHAR(80) NULL,
    endereco_ip NVARCHAR(45) NULL,
    endereco_mac NVARCHAR(40) NULL,
    cpu_info NVARCHAR(160) NULL,
    memoria_ram NVARCHAR(80) NULL,
    disco_info NVARCHAR(160) NULL,
    cadastro_manual BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.monitores (
    id_monitor INT IDENTITY(1,1) PRIMARY KEY,
    modelo NVARCHAR(120) NOT NULL,
    polegadas INT NULL,
    numero_serie NVARCHAR(80) NOT NULL UNIQUE,
    patrimonio NVARCHAR(80) NULL
);

CREATE TABLE dbo.SalaComputadorAcademica (
    id_sala INT NOT NULL,
    id_computador INT NOT NULL,
    PRIMARY KEY (id_sala, id_computador),
    FOREIGN KEY (id_sala) REFERENCES dbo.Salas(id_sala),
    FOREIGN KEY (id_computador) REFERENCES dbo.computadores(id_computador)
);

CREATE TABLE dbo.MonitorSala (
    id_sala INT NOT NULL,
    id_monitor INT NOT NULL,
    PRIMARY KEY (id_sala, id_monitor),
    FOREIGN KEY (id_sala) REFERENCES dbo.Salas(id_sala),
    FOREIGN KEY (id_monitor) REFERENCES dbo.monitores(id_monitor)
);

CREATE TABLE dbo.EquipamentoHistorico (
    id_historico INT IDENTITY(1,1) PRIMARY KEY,
    tipo_equipamento NVARCHAR(40) NOT NULL,
    identificador NVARCHAR(120) NOT NULL,
    acao NVARCHAR(80) NOT NULL,
    detalhes NVARCHAR(MAX) NULL,
    criado_em DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE dbo.planejamento_turma_uc (
    id_planejamento_turma_uc INT IDENTITY(1,1) PRIMARY KEY,
    turma NVARCHAR(60) NOT NULL,
    id_unidade_curricular INT NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    situacao NVARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    carga_horaria_prevista INT NOT NULL,
    FOREIGN KEY (id_unidade_curricular) REFERENCES dbo.UnidadesCurriculares(id_unidade_curricular)
);

CREATE TABLE dbo.alocacoes_docentes (
    id_alocacao INT IDENTITY(1,1) PRIMARY KEY,
    id_professor INT NOT NULL,
    id_planejamento_turma_uc INT NOT NULL,
    dia_semana INT NOT NULL,
    hora_inicio TIME(0) NOT NULL,
    hora_fim TIME(0) NOT NULL,
    tipo NVARCHAR(40) NOT NULL,
    observacao NVARCHAR(500) NULL,
    FOREIGN KEY (id_professor) REFERENCES dbo.professores(id_professor),
    FOREIGN KEY (id_planejamento_turma_uc) REFERENCES dbo.planejamento_turma_uc(id_planejamento_turma_uc)
);

CREATE TABLE dbo.ProfessorSenhaTemporariaControle (
    id_professor INT NOT NULL PRIMARY KEY,
    expires_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    FOREIGN KEY (id_professor) REFERENCES dbo.professores(id_professor)
);
