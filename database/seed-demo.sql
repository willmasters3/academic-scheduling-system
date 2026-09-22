/*
  Demo seed data for the public portfolio copy.
  All names, units, rooms, computers, patrimoni and addresses are fictitious.
*/

INSERT INTO dbo.Unidades (codigo_unidade, nome_unidade) VALUES
('UC001', 'Unidade Centro'),
('UC002', 'Unidade Norte');

INSERT INTO dbo.professores
(nome, matricula, login, senha, permissao, unidades, email, senhaTemporaria, turno_principal, carga_horaria_semanal, qualificacao, classificacao_docente)
VALUES
('Admin Demo', 'MAT-DEMO-001', 'admin_demo', '$2b$10$demo.hash.placeholder.admin', 'admin', '["UC001","UC002"]', 'admin.demo@example.com', 0, 'integral', 40, 'Coordenacao Demo', 'ADEQUADO'),
('Coordenador Demo', 'MAT-DEMO-002', 'coordenador_demo', '$2b$10$demo.hash.placeholder.coord', 'coordenador', '["UC001"]', 'coordenador.demo@example.com', 0, 'manha', 36, 'Coordenacao Pedagogica Demo', 'ADEQUADO'),
('Professor Demo', 'MAT-DEMO-003', 'professor_demo', '$2b$10$demo.hash.placeholder.prof', 'user', '["UC001"]', 'professor.demo@example.com', 0, 'tarde', 32, 'Instrutor Demo', 'ATENCAO'),
('Professor Exemplo', 'MAT-DEMO-004', 'professor_exemplo', '$2b$10$demo.hash.placeholder.exemplo', 'user', '["UC001","UC002"]', 'professor.exemplo@example.com', 0, 'noite', 28, 'Docente Demo', 'ADEQUADO');

INSERT INTO dbo.Salas (nome_sala, codigo_unidade, capacidade, projetor, computadores, observacoes, imagem_url) VALUES
('Sala 101', 'UC001', 32, 1, 16, 'Sala demo para aulas teoricas.', '/imagens/placeholder-room.svg'),
('Laboratorio Demo 201', 'UC001', 24, 1, 24, 'Laboratorio ficticio com computadores demo.', '/imagens/placeholder-room.svg'),
('Sala Norte 301', 'UC002', 28, 0, 12, 'Sala ficticia da segunda unidade.', '/imagens/placeholder-room.svg');

INSERT INTO dbo.SalasAdministrativas (nome_sala, codigo_unidade, capacidade, observacoes) VALUES
('Reuniao Demo A', 'UC001', 12, 'Ambiente administrativo ficticio.');

INSERT INTO dbo.programas (nome_programa, versao, observacoes) VALUES
('Editor Demo', '1.0', 'Software ficticio para demonstracao.'),
('Simulador Demo', '2026.1', 'Programa ficticio associado ao laboratorio.');

INSERT INTO dbo.tipos_aula (descricao) VALUES
('Aula teorica'),
('Aula pratica'),
('Avaliacao'),
('Planejamento docente');

INSERT INTO dbo.UnidadesCurriculares (ano, semestre, turma, turno, modulo, tipo_curso, nome_uc, carga_horaria) VALUES
(2026, 1, 'TURMA-DEMO-01', 'Tarde', 'Modulo 1', 'Tecnico Demo', 'Logica de Programacao Demo', 80),
(2026, 1, 'TURMA-DEMO-02', 'Noite', 'Modulo 2', 'Tecnico Demo', 'Banco de Dados Demo', 60);

INSERT INTO dbo.unidade_tipo_aula_associacao (id_unidade_curricular, id_tipo_aula) VALUES
(1, 1),
(1, 2),
(2, 2),
(2, 3);

INSERT INTO dbo.agendamentos (id_sala, id_professor, data_reservas, hora_inicio, hora_fim, motivo, tipo_aula, recorrencia_id) VALUES
(1, 3, '2026-10-05', '13:15', '15:15', 'Aula demo de introducao', 'Aula teorica', NULL),
(2, 3, '2026-10-05', '15:30', '17:15', 'Pratica em laboratorio demo', 'Aula pratica', '00000000-0000-0000-0000-000000000101'),
(2, 4, '2026-10-06', '13:15', '17:15', 'Agendamento recorrente demo', 'Aula pratica', '00000000-0000-0000-0000-000000000101');

INSERT INTO dbo.solicitacoes_troca_sala
(id_professor_origem, id_professor_destino, id_agendamento_origem, id_agendamento_destino, mensagem, status)
VALUES
(3, 4, 1, 3, 'Solicitacao demo de troca de sala.', 'PENDENTE');

INSERT INTO dbo.AgendamentoAuditoria (id_agendamento, acao, usuario, payload) VALUES
(1, 'CRIACAO_DEMO', 'admin_demo', '{"origem":"seed-demo"}'),
(2, 'RECORRENCIA_DEMO', 'coordenador_demo', '{"recorrencia":"semanal"}');

INSERT INTO dbo.computadores
(nome_computador, serialNumber, patrimonio, endereco_ip, endereco_mac, cpu_info, memoria_ram, disco_info, cadastro_manual)
VALUES
('PC-LAB-001', 'SER-DEMO-001', 'PAT-DEMO-001', '192.0.2.10', '00:11:22:33:44:55', 'CPU Demo 4C', '16 GB', 'SSD Demo 256 GB', 1),
('PC-LAB-002', 'SER-DEMO-002', 'PAT-DEMO-002', '192.0.2.11', '00:11:22:33:44:56', 'CPU Demo 4C', '16 GB', 'SSD Demo 256 GB', 1);

INSERT INTO dbo.monitores (modelo, polegadas, numero_serie, patrimonio) VALUES
('Monitor Demo 24', 24, 'MON-DEMO-001', 'PAT-DEMO-MON-001'),
('Monitor Demo 27', 27, 'MON-DEMO-002', 'PAT-DEMO-MON-002');

INSERT INTO dbo.SalaComputadorAcademica (id_sala, id_computador) VALUES
(2, 1),
(2, 2);

INSERT INTO dbo.MonitorSala (id_sala, id_monitor) VALUES
(2, 1),
(2, 2);

INSERT INTO dbo.EquipamentoHistorico (tipo_equipamento, identificador, acao, detalhes) VALUES
('computador', 'PC-LAB-001', 'CADASTRO_DEMO', 'Equipamento ficticio criado pelo seed demo.'),
('monitor', 'MON-DEMO-001', 'VINCULO_DEMO', 'Monitor ficticio vinculado a sala demo.');

INSERT INTO dbo.planejamento_turma_uc
(turma, id_unidade_curricular, periodo_inicio, periodo_fim, situacao, carga_horaria_prevista)
VALUES
('TURMA-DEMO-01', 1, '2026-10-01', '2026-12-20', 'ATIVO', 80),
('TURMA-DEMO-02', 2, '2026-10-01', '2026-12-20', 'ATIVO', 60);

INSERT INTO dbo.alocacoes_docentes
(id_professor, id_planejamento_turma_uc, dia_semana, hora_inicio, hora_fim, tipo, observacao)
VALUES
(3, 1, 2, '13:15', '17:15', 'PRESENCIAL', 'Alocacao docente ficticia.'),
(4, 2, 4, '18:30', '22:00', 'PRESENCIAL', 'Alocacao docente ficticia.');
