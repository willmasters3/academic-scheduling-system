# Estrutura do banco de dados

Data do registro: 2026-05-26
Local: `docs/sql`

Este documento armazena o esquema do banco enviado pelo usuário para consulta futura.

## Tabelas e colunas

```
dbo	Acessos
dbo	AcessosUsuarios
dbo	agendamentos
dbo	computadores
dbo	ComputadorSala
dbo	EmailsEnviados
dbo	EmailsReceptores
dbo	Estoque
dbo	ImagensSalas
dbo	Itens
dbo	monitores
dbo	MonitorSala
dbo	Movimentacoes
dbo	Outbox
dbo	PesquisasUsuarios
dbo	ProfessorAgendaPessoal
dbo	professores
dbo	ProfessorSenhaTemporariaControle
dbo	ProfessorUnidade
dbo	Programas
dbo	SalaComputadorAcademica
dbo	SalaComputadorAdministrativa
dbo	SalaImagens
dbo	SalaPrograma
dbo	Salas
dbo	SalasAdministrativas
dbo	solicitacoes_troca_sala
dbo	solicitacoes_troca_sala_lote
dbo	solicitacoes_troca_sala_lote_item
dbo	tipos_aula
dbo	unidade_tipo_aula
dbo	unidade_tipo_aula_associacao
dbo	Unidades
dbo	UnidadesCurriculares
dbo	Usuarios
dbo	Acessos	id	int	NULL	NO
dbo	Acessos	usuario_id	int	NULL	YES
dbo	Acessos	nome_usuario	nvarchar	200	YES
dbo	Acessos	tipo_usuario	nvarchar	50	YES
dbo	Acessos	tipo_acesso	nvarchar	50	YES
dbo	Acessos	unidade_id	nvarchar	50	YES
dbo	Acessos	data_acesso	datetime	NULL	YES
dbo	AcessosUsuarios	id	int	NULL	NO
dbo	AcessosUsuarios	usuario_id	int	NULL	YES
dbo	AcessosUsuarios	nome_usuario	nvarchar	200	YES
dbo	AcessosUsuarios	tipo_usuario	nvarchar	50	YES
dbo	AcessosUsuarios	tipo_acesso	nvarchar	50	YES
dbo	AcessosUsuarios	data_acesso	datetime	NULL	YES
dbo	AcessosUsuarios	unidade_id	int	NULL	YES
dbo	agendamentos	id_agendamento	int	NULL	NO
dbo	agendamentos	id_sala	int	NULL	NO
dbo	agendamentos	id_professor	int	NULL	NO
dbo	agendamentos	hora_inicio	nvarchar	-1	YES
dbo	agendamentos	hora_fim	nvarchar	-1	YES
dbo	agendamentos	motivo	nvarchar	720	YES
dbo	agendamentos	data_reservas	nvarchar	-1	YES
dbo	agendamentos	tipo_aula	nvarchar	720	YES
dbo	computadores	id	int	NULL	NO
dbo	computadores	nome_computador	nvarchar	255	YES
dbo	computadores	endereco_mac	nvarchar	17	YES
dbo	computadores	patrimonio	nvarchar	50	YES
dbo	computadores	data_registro	datetime	NULL	YES
dbo	computadores	nomes_programas	varchar	-1	YES
dbo	computadores	cpu_info	nvarchar	-1	YES
dbo	computadores	disco_info	nvarchar	-1	YES
dbo	computadores	SerialNumber	nvarchar	100	YES
dbo	computadores	endereco_ip	varchar	39	YES
dbo	computadores	last_logged_user	nvarchar	100	YES
dbo	computadores	network_adapters_details	nvarchar	-1	YES
dbo	computadores	memoria_ram	nvarchar	120	YES
dbo	computadores	cadastro_manual	bit	NULL	NO
dbo	ComputadorSala	id	int	NULL	NO
dbo	ComputadorSala	computador_id	int	NULL	YES
dbo	ComputadorSala	sala_id	int	NULL	YES
dbo	EmailsEnviados	id	int	NULL	NO
dbo	EmailsEnviados	destinatario	nvarchar	255	YES
dbo	EmailsEnviados	assunto	nvarchar	255	YES
dbo	EmailsEnviados	corpo	nvarchar	-1	YES
dbo	EmailsEnviados	status	nvarchar	50	YES
dbo	EmailsEnviados	resposta	nvarchar	-1	YES
dbo	EmailsEnviados	data_envio	datetime	NULL	YES
dbo	EmailsReceptores	id	int	NULL	NO
dbo	EmailsReceptores	email	nvarchar	255	NO
dbo	Estoque	id	int	NULL	NO
dbo	Estoque	item_id	int	NULL	NO
dbo	Estoque	unidade_id	nvarchar	50	YES
dbo	Estoque	quantidade	int	NULL	NO
dbo	Estoque	quantidade_minima	int	NULL	NO
dbo	ImagensSalas	id	int	NULL	NO
dbo	ImagensSalas	id_sala	int	NULL	YES
dbo	ImagensSalas	caminho_imagem	nvarchar	255	YES
dbo	Itens	id	int	NULL	NO
dbo	Itens	codigo	nvarchar	50	NO
dbo	Itens	segmento	nvarchar	100	YES
dbo	Itens	nome	nvarchar	255	NO
dbo	Itens	complemento	nvarchar	-1	YES
dbo	Itens	unidade	nvarchar	50	YES
dbo	Itens	imagem	nvarchar	500	YES
dbo	monitores	id	int	NULL	NO
dbo	monitores	modelo	nvarchar	255	YES
dbo	monitores	polegadas	int	NULL	YES
dbo	monitores	numero_serie	nvarchar	100	YES
dbo	monitores	patrimonio	nvarchar	100	YES
dbo	monitores	data_registro	datetime	NULL	YES
dbo	MonitorSala	id	int	NULL	NO
dbo	MonitorSala	id_monitor	int	NULL	NO
dbo	MonitorSala	id_sala	int	NULL	NO
dbo	Movimentacoes	id	int	NULL	NO
dbo	Movimentacoes	tipo	nvarchar	50	NO
dbo	Movimentacoes	item_id	int	NULL	NO
dbo	Movimentacoes	codigo_item	nvarchar	50	YES
dbo	Movimentacoes	nome_item	nvarchar	255	YES
dbo	Movimentacoes	imagem_item	nvarchar	500	YES
dbo	Movimentacoes	quantidade	int	NULL	NO
dbo	Movimentacoes	usuario_id	int	NULL	YES
dbo	Movimentacoes	nome_usuario	nvarchar	255	YES
dbo	Movimentacoes	data_movimentacao	datetime	NULL	YES
dbo	Movimentacoes	observacao	nvarchar	500	YES
dbo	Movimentacoes	fornecedor	nvarchar	255	YES
dbo	Movimentacoes	nota_fiscal	nvarchar	100	YES
dbo	Movimentacoes	unidade_id	nvarchar	50	YES
dbo	Outbox	id	int	NULL	NO
dbo	Outbox	tipo	nvarchar	50	YES
dbo	Outbox	payload	nvarchar	-1	YES
dbo	Outbox	processed	bit	NULL	YES
dbo	Outbox	attempts	int	NULL	YES
dbo	Outbox	created_at	datetime	NULL	YES
dbo	Outbox	processed_at	datetime	NULL	YES
dbo	PesquisasUsuarios	id	int	NULL	NO
dbo	PesquisasUsuarios	usuarioId	int	NULL	YES
dbo	PesquisasUsuarios	nome_usuario	nvarchar	255	YES
dbo	PesquisasUsuarios	tipo_usuario	nvarchar	50	YES
dbo	PesquisasUsuarios	termo_pesquisado	nvarchar	500	YES
dbo	PesquisasUsuarios	data_pesquisa	datetime	NULL	YES
dbo	PesquisasUsuarios	unidade_id	nvarchar	100	YES
dbo	ProfessorAgendaPessoal	id_compromisso	int	NULL	NO
dbo	ProfessorAgendaPessoal	id_professor	int	NULL	NO
dbo	ProfessorAgendaPessoal	titulo	nvarchar	150	NO
dbo	ProfessorAgendaPessoal	data_compromisso	date	NULL	NO
dbo	ProfessorAgendaPessoal	hora_inicio	time	NULL	NO
dbo	ProfessorAgendaPessoal	hora_fim	time	NULL	NO
dbo	ProfessorAgendaPessoal	descricao	nvarchar	-1	YES
dbo	ProfessorAgendaPessoal	criado_em	datetime2	NULL	NO
dbo	ProfessorAgendaPessoal	atualizado_em	datetime2	NULL	NO
dbo	professores	id_professor	int	NULL	NO
dbo	professores	nome	varchar	100	NO
dbo	professores	matricula	varchar	20	NO
dbo	professores	codigo_unidade	varchar	10	YES
dbo	professores	senha	nvarchar	255	YES
dbo	professores	login	nvarchar	255	YES
dbo	professores	permissao	nvarchar	50	YES
dbo	professores	senhaTemporaria	bit	NULL	YES
dbo	professores	email	varchar	255	YES
dbo	professores	turno_principal	nvarchar	100	YES
dbo	professores	foto_url	nvarchar	500	YES
dbo	professores	foto_mime_type	nvarchar	100	YES
dbo	professores	foto_atualizada_em	datetime2	NULL	YES
dbo	professores	carga_horaria_semanal	decimal	NULL	YES
dbo	professores	perfil_atualizado_em	datetime2	NULL	YES
dbo	professores	qualificacao	nvarchar	200	YES
dbo	ProfessorSenhaTemporariaControle	id_professor	int	NULL	NO
dbo	ProfessorSenhaTemporariaControle	falhas	int	NULL	NO
dbo	ProfessorSenhaTemporariaControle	bloqueado	bit	NULL	NO
dbo	ProfessorSenhaTemporariaControle	atualizado_em	datetime2	NULL	NO
dbo	ProfessorUnidade	id	int	NULL	NO
dbo	ProfessorUnidade	id_professor	int	NULL	YES
dbo	ProfessorUnidade	codigo_unidade	varchar	10	YES
dbo	Programas	id_programa	int	NULL	NO
dbo	Programas	nome_programa	varchar	50	YES
dbo	Programas	versao	varchar	20	YES
dbo	SalaComputadorAcademica	id	int	NULL	NO
dbo	SalaComputadorAcademica	id_sala	int	NULL	YES
dbo	SalaComputadorAcademica	id_computador	int	NULL	YES
dbo	SalaComputadorAdministrativa	id	int	NULL	NO
dbo	SalaComputadorAdministrativa	id_sala	int	NULL	YES
dbo	SalaComputadorAdministrativa	id_computador	int	NULL	YES
dbo	SalaImagens	id	int	NULL	NO
dbo	SalaImagens	id_sala	int	NULL	YES
dbo	SalaImagens	imagem	nvarchar	255	YES
dbo	SalaPrograma	id_sala	int	NULL	NO
dbo	SalaPrograma	id_programa	int	NULL	NO
dbo	Salas	id_sala	int	NULL	NO
dbo	Salas	nome_sala	varchar	50	NO
dbo	Salas	codigo_unidade	varchar	10	NO
dbo	Salas	cadeiras	int	NULL	YES
dbo	Salas	quadro_branco	varchar	100	YES
dbo	Salas	tela_projetor	varchar	100	YES
dbo	Salas	tv	varchar	100	YES
dbo	Salas	area	varchar	50	YES
dbo	Salas	projetor	varchar	100	YES
dbo	Salas	maquinario	nvarchar	500	YES
dbo	Salas	computadores	int	NULL	YES
dbo	Salas	imagem	nvarchar	255	YES
dbo	SalasAdministrativas	id_sala	int	NULL	NO
dbo	SalasAdministrativas	nome_sala	nvarchar	100	YES
dbo	SalasAdministrativas	codigo_unidade	nvarchar	50	YES
dbo	SalasAdministrativas	area	nvarchar	100	YES
dbo	SalasAdministrativas	recursos	nvarchar	-1	YES
dbo	SalasAdministrativas	imagem	nvarchar	255	YES
dbo	solicitacoes_troca_sala	id_solicitacao	int	NULL	NO
dbo	solicitacoes_troca_sala	id_professor_origem	int	NULL	NO
dbo	solicitacoes_troca_sala	id_professor_destino	int	NULL	NO
dbo	solicitacoes_troca_sala	id_agendamento_origem	int	NULL	NO
dbo	solicitacoes_troca_sala	id_agendamento_destino	int	NULL	NO
dbo	solicitacoes_troca_sala	mensagem	nvarchar	500	YES
dbo	solicitacoes_troca_sala	status	nvarchar	20	NO
dbo	solicitacoes_troca_sala	created_at	datetime2	NULL	NO
dbo	solicitacoes_troca_sala	responded_at	datetime2	NULL	YES
dbo	solicitacoes_troca_sala_lote	id_lote	int	NULL	NO
dbo	solicitacoes_troca_sala_lote	id_professor_origem	int	NULL	NO
dbo	solicitacoes_troca_sala_lote	id_professor_destino	int	NULL	NO
dbo	solicitacoes_troca_sala_lote	mensagem	nvarchar	500	YES
dbo	solicitacoes_troca_sala_lote	status	nvarchar	20	NO
dbo	solicitacoes_troca_sala_lote	created_at	datetime2	NULL	NO
dbo	solicitacoes_troca_sala_lote	responded_at	datetime2	NULL	YES
dbo	solicitacoes_troca_sala_lote_item	id_item	int	NULL	NO
dbo	solicitacoes_troca_sala_lote_item	id_lote	int	NULL	NO
dbo	solicitacoes_troca_sala_lote_item	id_agendamento_origem	int	NULL	NO
dbo	solicitacoes_troca_sala_lote_item	id_agendamento_destino	int	NULL	NO
dbo	solicitacoes_troca_sala_lote_item	status	nvarchar	20	NO
dbo	tipos_aula	id_tipo_aula	int	NULL	NO
dbo	tipos_aula	descricao	nvarchar	720	YES
dbo	unidade_tipo_aula	id_unidade	varchar	10	NO
dbo	unidade_tipo_aula	id_tipo_aula	int	NULL	NO
dbo	unidade_tipo_aula_associacao	id_associacao	int	NULL	NO
dbo	unidade_tipo_aula_associacao	id_unidade_curricular	int	NULL	NO
dbo	unidade_tipo_aula_associacao	id_tipo_aula	int	NULL	NO
dbo	Unidades	codigo_unidade	varchar	10	NO
dbo	Unidades	nome_unidade	varchar	100	NO
dbo	UnidadesCurriculares	id_unidade_curricular	int	NULL	NO
dbo	UnidadesCurriculares	ano	int	NULL	YES
dbo	UnidadesCurriculares	semestre	nvarchar	10	YES
dbo	UnidadesCurriculares	turma	nvarchar	1	YES
dbo	UnidadesCurriculares	turno	int	NULL	YES
dbo	UnidadesCurriculares	modulo	int	NULL	YES
dbo	UnidadesCurriculares	tipo_curso	int	NULL	YES
dbo	UnidadesCurriculares	codigo_unidade	nvarchar	10	YES
dbo	Usuarios	id	int	NULL	NO
dbo	Usuarios	username	nvarchar	50	NO
dbo	Usuarios	password	nvarchar	255	NO
dbo	Usuarios	tipo	nvarchar	50	YES
dbo	Usuarios	status	nvarchar	50	YES
dbo	Usuarios	ultimo_acesso	datetime	NULL	YES
dbo	Usuarios	email	nvarchar	50	YES
```

## Observações

- Este documento foi criado para não ser necessário reenviar a estrutura do banco toda vez.
- Ele está em `docs/sql` conforme solicitado.
