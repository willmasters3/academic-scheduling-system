# Sistema de Agendamentos Academicos - Demo Publica Sanitizada

![Status](https://img.shields.io/badge/status-demo%20sanitizada-blue)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green)
![Express](https://img.shields.io/badge/Express.js-API-lightgrey)
![SQL Server](https://img.shields.io/badge/SQL%20Server-Database-red)
![Testes](https://img.shields.io/badge/testes-node%20--test-brightgreen)
![Portfolio](https://img.shields.io/badge/portfolio-William%20Pereira-8A2BE2)

Versao publica, demonstrativa e sanitizada de um sistema web para gestao de
**agendamentos academicos, salas, professores, unidades, disponibilidade,
relatorios e inventario de equipamentos**.

> Este repositorio contem codigo-fonte. Ele foi preparado para portfolio com
> dados, nomes, configuracoes e exemplos ficticios. O ambiente real, credenciais,
> dumps, uploads privados e referencias institucionais foram removidos ou
> substituidos por conteudo neutro.

---

## Sumario

- [Visao Geral](#visao-geral)
- [Escopo Da Versao Publica](#escopo-da-versao-publica)
- [Perfis De Usuario](#perfis-de-usuario)
- [Principais Funcionalidades](#principais-funcionalidades)
- [Regras De Negocio Preservadas](#regras-de-negocio-preservadas)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Arquitetura Geral](#arquitetura-geral)
- [Banco De Dados Demo](#banco-de-dados-demo)
- [Seguranca E Sanitizacao](#seguranca-e-sanitizacao)
- [Testes Automatizados](#testes-automatizados)
- [Como Executar Localmente](#como-executar-localmente)
- [Estrutura Do Repositorio](#estrutura-do-repositorio)
- [Prints E Diagramas](#prints-e-diagramas)
- [Roadmap Publico](#roadmap-publico)
- [Autor](#autor)

---

## Visao Geral

O projeto nasceu como uma solucao para organizar reservas de salas e evoluiu
para uma aplicacao modular com autenticacao, sessoes, controle de perfis,
cadastros academicos, agendamentos recorrentes, deteccao de conflitos,
disponibilidade parcial, troca de salas, auditoria, dashboards, relatorios,
gestao docente e inventario sanitizado.

A versao publica deste repositorio preserva a complexidade tecnica relevante
para demonstracao, mas sem depender de infraestrutura privada. As configuracoes
sensiveis foram migradas para variaveis de ambiente, e o banco demonstrativo
usa apenas schema e seed ficticios.

---

## Escopo Da Versao Publica

Esta versao existe para demonstrar arquitetura, regras de negocio e organizacao
de codigo em um projeto realista de gestao academica.

Ela inclui:

- codigo-fonte Node.js/Express;
- telas HTML/CSS/JavaScript publicas da demo;
- modulos de dominio separados por responsabilidade;
- `database/schema-demo.sql` com estrutura de banco demonstrativa;
- `database/seed-demo.sql` com dados ficticios;
- `.env.example` com placeholders seguros;
- testes automatizados em `tests/`;
- recursos neutros de interface para portfolio.

Ela nao inclui:

- banco, dump ou backup de ambiente real;
- credenciais reais, tokens, chaves ou segredos;
- uploads, logs ou imagens privadas;
- modulo de controle remoto;
- administracao de usuarios Windows;
- agentes remotos;
- transferencia remota de arquivos;
- historico Git antigo do projeto original.

---

## Perfis De Usuario

### Professor

- Login com sessao;
- dashboard proprio;
- consulta de agenda e agendamentos;
- criacao de reservas para si;
- consulta de salas e horarios;
- recebimento e decisao de solicitacoes de troca de sala;
- agenda pessoal e compromissos;
- edicao de dados do proprio perfil conforme regras do sistema.

### Coordenacao

- Dashboard de coordenacao;
- gestao de professores vinculados a unidades permitidas;
- gestao de salas, programas, unidades e unidades curriculares;
- agendamento em nome de professores;
- acompanhamento de disponibilidade docente;
- alocacao docente individual e coletiva;
- consulta de auditoria e relatorios;
- acesso ao inventario e relatorios de equipamentos.

### Administracao

- Acesso ampliado aos cadastros;
- manutencao de usuarios e permissoes;
- associacao de professores a unidades;
- gestao global de ambientes;
- visao consolidada de dashboards, auditoria e relatorios;
- acesso administrativo ao inventario sanitizado.

---

## Principais Funcionalidades

### Autenticacao, Sessoes E Permissoes

- Autenticacao de usuarios com senha hasheada usando `bcrypt`;
- sessoes com `express-session`;
- cookie de sessao `httpOnly`;
- redirecionamento por perfil (`admin`, `coordenador`, `user`);
- middlewares para sessao autenticada e rotas restritas;
- senha temporaria e fluxo de redefinicao quando a tabela de controle existe;
- rate limit simples em memoria para rotas de login e registro.

### Agendamentos

- Criacao de agendamentos por sala, professor, data e horario;
- agendamentos com multiplas datas;
- apoio a recorrencia no frontend por selecao de dias;
- verificacao previa de disponibilidade;
- bloqueio de conflito de sala;
- retorno de datas disponiveis e datas conflitantes;
- opcao de criar somente as datas livres quando ha disponibilidade parcial;
- aviso quando o professor possui sobreposicao em outro compromisso;
- confirmacao explicita para seguir diante de avisos de professor;
- edicao, exclusao e listagem por sala, professor ou unidade.

### Troca De Salas

- Solicitacao de troca entre professores;
- listagem de solicitacoes enviadas e recebidas;
- aceite ou recusa da solicitacao;
- simulacao de opcoes de troca;
- troca direta pela coordenacao;
- pacotes de troca com multiplos itens;
- notificacoes por Server-Sent Events (SSE) para eventos de troca.

### Auditoria

- Registro de eventos relevantes de agendamento;
- auditoria de criacao, alteracao, exclusao, conflitos e falhas;
- consulta por periodo, unidade, professor e acao;
- armazenamento de dados anteriores, novos dados e detalhes em JSON;
- telas especificas para leitura de auditoria.

### Gestao Docente E Alocacao

- Cadastro e manutencao de alocacoes docentes;
- alocacao individual e coletiva;
- validacao de sobreposicao de alocacoes;
- associacao de professores a unidades, cursos, turmas e UCs;
- planejamento de carga horaria por turma e unidade curricular;
- dashboard de cobertura entre horas previstas e horas agendadas;
- perfil docente com historico, planejamentos e indicadores.

### Cadastros Academicos

- Professores;
- unidades;
- salas;
- tipos de aula;
- programas;
- cursos;
- turmas;
- unidades curriculares;
- associacoes entre curso, turma e UC.

### Relatorios E Dashboards

- Horas agendadas por mes;
- agenda semanal por professor;
- agenda por periodo;
- uso de salas;
- horas por unidade curricular;
- percentual de ocupacao de salas;
- disponibilidade de professores;
- paineis administrativos por perfil.

### Inventario Sanitizado

- Cadastro manual de computadores e monitores;
- associacao de equipamentos a salas;
- movimentacao de equipamentos entre salas;
- filtros por nome, patrimonio, serial, IP ficticio e sala;
- deduplicacao de computadores por serial;
- historico de alteracoes;
- relatorios de equipamentos por sala;
- exportacao estruturada de relatorio de equipamentos.

### Chat E Interpretacao De Linguagem

- Modulo de chat para consultas operacionais;
- interpretador semantico para linguagem natural;
- integracao local via Ollama configuravel por `OLLAMA_BASE_URL` e
  `OLLAMA_MODEL`;
- testes cobrindo validacao de interpretacoes e filtros por perfil;
- comportamento restrito a consultas e operacoes previstas pelo sistema.

---

## Regras De Negocio Preservadas

O foco da demo nao e apenas CRUD. A versao publica mantem regras que demonstram
decisoes de dominio e tratamento de casos reais:

| Area | Regra preservada |
| --- | --- |
| Agendamentos | A sala nao pode receber duas reservas conflitantes no mesmo horario. |
| Recorrencia | O frontend gera multiplas datas a partir de intervalo e dias selecionados. |
| Disponibilidade parcial | Quando parte das datas esta livre, o sistema pode criar apenas as datas disponiveis. |
| Sobreposicao docente | O professor pode receber aviso quando ja possui evento no mesmo periodo. |
| Autorizacao | Professor agenda para si; coordenacao/admin podem agir em nome de outros. |
| Unidade | Coordenadores ficam limitados as unidades associadas a sua sessao. |
| Troca de salas | Trocas dependem de origem, destino, status e aceite/recusa. |
| Auditoria | Alteracoes relevantes registram responsavel, permissao, contexto e payload. |
| Alocacao docente | Periodos, turnos e dias sao validados para evitar sobreposicoes. |
| Inventario | Patrimonio e serial possuem validacoes e historico de movimentacao. |

---

## Tecnologias Utilizadas

### Backend

- Node.js;
- Express.js;
- JavaScript;
- `mssql` para SQL Server;
- `dotenv` para configuracao por ambiente;
- `express-session` para sessoes;
- `bcrypt` para hash de senha;
- `cors` e `body-parser`;
- `multer` para uploads controlados de imagens;
- `luxon` e `moment` para tratamento de datas e horarios;
- Server-Sent Events nativo para notificacoes de troca de sala.

### Frontend

- HTML5;
- CSS3;
- JavaScript puro;
- organizacao de scripts por tela/modulo;
- FullCalendar nas telas de agenda;
- Flatpickr para selecao de datas;
- Chart.js para graficos;
- Bootstrap e Font Awesome em telas que ainda utilizam essas bibliotecas via CDN.

### Banco De Dados

- SQL Server;
- schema relacional;
- queries parametrizadas;
- transacoes em operacoes criticas;
- scripts demonstrativos em `database/schema-demo.sql` e
  `database/seed-demo.sql`;
- dados inteiramente ficticios na seed publica.

### Testes

- `node:test`;
- `node:assert/strict`;
- testes focados em recorrencia, interpretador de chat, voz/finder e avisos de
  sobreposicao docente.

---

## Arquitetura Geral

A aplicacao segue uma divisao modular por dominio. O servidor principal monta
middlewares, sessao, headers de seguranca, rotas de autenticacao, rotas de
paginas e rotas de API.

```text
Frontend HTML/CSS/JS
        |
        v
Servidor Node.js + Express
        |
        +--> Auth e sessoes
        +--> Professores
        +--> Salas
        +--> Unidades
        +--> Programas
        +--> Tipos de aula
        +--> Unidades curriculares
        +--> Agendamentos
        +--> Troca de salas + SSE
        +--> Auditoria de agendamentos
        +--> Alocacao docente
        +--> Gestao docente
        +--> Inventario sanitizado
        +--> Relatorios academicos
        +--> Relatorios de equipamentos
        +--> Chat / interpretador local
        |
        v
SQL Server demo
```

Padrao geral dos modulos:

```text
modules/<dominio>/
        <dominio>Routes.js
        <dominio>Controller.js
        <dominio>Service.js
```

Nem todos os modulos precisam ter exatamente os tres arquivos, mas a separacao
entre rotas, controllers e services e a base da organizacao do backend.

---

## Banco De Dados Demo

A versao publica nao reutiliza dump real. O diretorio `database/` contem scripts
proprios da demo:

```text
database/
  schema-demo.sql
  seed-demo.sql
```

O `schema-demo.sql` define a estrutura necessaria para exercitar os modulos
publicos. O `seed-demo.sql` popula a base com dados ficticios, como:

- `Unidade Centro`;
- `Unidade Norte`;
- `Sala 101`;
- `Laboratorio Demo`;
- `Professor Demo`;
- `Coordenador Demo`;
- `Admin Demo`;
- `PC-LAB-001`;
- `PAT-DEMO-001`;
- IPs de documentacao e exemplos neutros.

Esses scripts devem ser executados apenas em uma base local vazia criada para
demonstracao, nunca sobre uma base existente.

---

## Seguranca E Sanitizacao

A preparacao publica removeu ou substituiu informacoes que nao devem ser
publicadas:

- credenciais reais;
- segredos de sessao;
- hosts, bancos e usuarios reais;
- IPs internos;
- URLs e caminhos internos;
- nomes institucionais;
- nomes reais de pessoas;
- computadores, patrimonios, MACs e seriais reais;
- imagens e uploads privados;
- logs e artefatos operacionais;
- backups e dumps de banco.

Na versao atual:

- `.env` deve permanecer local;
- `.env.example` contem apenas placeholders seguros;
- `dbConfig.js` le configuracoes via variaveis de ambiente;
- `SESSION_SECRET` vem de ambiente ou e gerado automaticamente em
  desenvolvimento;
- cookies de sessao usam `httpOnly`;
- rotas sensiveis aplicam controle de sessao e perfil;
- login/registro possuem rate limit simples em memoria;
- o codigo utiliza queries parametrizadas em operacoes SQL;
- o conteudo demo usa dados ficticios.

---

## Testes Automatizados

O repositorio ja possui testes automatizados.

Arquivos atuais:

```text
tests/
  agendamentoUtils.test.js
  agendamentosVoice.test.js
  chatLanguageInterpreter.test.js
  professorWarningHelper.test.js
```

Comando configurado em `package.json`:

```bash
npm test
```

Esse comando executa:

```bash
node --test tests/*.test.js
```

---

## Como Executar Localmente

Requisitos sugeridos:

- Node.js;
- SQL Server local ou instancia SQL Server acessivel para a demo;
- banco vazio dedicado a demonstracao;
- opcionalmente, Ollama local para usar o modulo de chat.

Passos:

```bash
npm install
```

Crie o arquivo local de ambiente a partir do exemplo:

```bash
copy .env.example .env
```

Configure no `.env` os dados da sua base demo:

```env
DB_USER=demo_user
DB_PASSWORD=demo_password
DB_HOST=localhost
DB_PORT=1433
DB_NAME=agendamentos_demo
SESSION_SECRET=troque-por-um-segredo-local
```

Em uma base local vazia e criada somente para a demo, aplique:

```text
database/schema-demo.sql
database/seed-demo.sql
```

Inicie o servidor:

```bash
node server.js
```

A porta padrao e `3000`, configuravel por `PORT`.

```text
http://localhost:3000
```

Para executar os testes:

```bash
npm test
```

---

## Estrutura Do Repositorio

Visao resumida:

```text
.
|-- config.js
|-- dbConfig.js
|-- server.js
|-- package.json
|-- .env.example
|-- database/
|   |-- schema-demo.sql
|   `-- seed-demo.sql
|-- middlewares/
|   |-- authMiddleware.js
|   `-- permissionMiddleware.js
|-- modules/
|   |-- agendamentoAuditoria/
|   |-- agendamentos/
|   |-- alocacoesDocentes/
|   |-- app/
|   |-- auth/
|   |-- chat/
|   |-- gestaoDocente/
|   |-- inventario/
|   |-- professores/
|   |-- programas/
|   |-- relatorios/
|   |-- relatoriosEquipamentos/
|   |-- salas/
|   |-- tiposAula/
|   |-- unidades/
|   |-- unidadesCurriculares/
|   `-- web/
|-- public/
|   |-- css/
|   |-- html/
|   `-- js/
|-- tests/
|   |-- agendamentoUtils.test.js
|   |-- agendamentosVoice.test.js
|   |-- chatLanguageInterpreter.test.js
|   `-- professorWarningHelper.test.js
`-- utils/
```

---

## Evolucao Do Projeto

A trajetoria tecnica preservada na demo inclui:

1. consulta e cadastro de salas;
2. autenticacao e controle de sessao;
3. separacao de perfis;
4. cadastros academicos;
5. agendamentos por sala e professor;
6. recorrencia e selecao multipla de datas;
7. verificacao de disponibilidade;
8. tratamento de conflitos e disponibilidade parcial;
9. troca de salas entre professores;
10. auditoria de agendamentos;
11. dashboards e relatorios;
12. gestao docente e alocacao;
13. inventario de equipamentos sanitizado;
14. banco demonstrativo com dados ficticios;
15. testes automatizados.

---

## Minha Participacao

Atuei na concepcao, desenvolvimento e evolucao do sistema, incluindo:

- modelagem do backend em Node.js e Express;
- criacao de rotas, controllers e services;
- integracao com SQL Server;
- estruturacao de regras de negocio de agendamento;
- implementacao de autenticacao, sessoes e permissoes;
- desenvolvimento de dashboards e telas administrativas;
- criacao de regras de conflito, disponibilidade e recorrencia;
- implementacao de troca de salas;
- implementacao de auditoria;
- desenvolvimento de gestao docente e alocacao;
- implementacao e sanitizacao do inventario;
- organizacao dos scripts SQL de demo;
- criacao e manutencao de testes automatizados;
- preparacao desta versao publica para portfolio.

---

## Desafios Tecnicos

Alguns desafios representados nesta versao:

- manter regras de agendamento consistentes entre frontend e backend;
- controlar conflito de sala sem bloquear indevidamente disponibilidade parcial;
- diferenciar conflito impeditivo de aviso de sobreposicao docente;
- preservar contexto de pre-verificacao na sessao;
- limitar acoes por perfil e unidade;
- registrar auditoria sem interromper o fluxo principal;
- calcular cobertura docente entre carga prevista e horas agendadas;
- manter inventario util sem depender de infraestrutura privada;
- separar dados reais de dados publicaveis;
- transformar um sistema interno em demo independente e segura.

---

## Aprendizados

Este projeto consolidou conhecimentos praticos em:

- backend modular com Node.js e Express;
- SQL Server e modelagem relacional;
- sessoes, cookies e controle de acesso;
- regras de negocio com muitos casos de borda;
- validacao de disponibilidade e conflitos;
- auditoria de eventos;
- dashboards e relatorios operacionais;
- organizacao de frontend sem framework;
- sanitizacao de projeto para publicacao;
- testes automatizados com `node:test`.

---

## Observacao Sobre Codigo-Fonte

Este repositorio contem uma versao demonstrativa e sanitizada do codigo-fonte.

O objetivo e permitir leitura tecnica, execucao local controlada e avaliacao de
arquitetura sem expor ambiente real. Os dados e configuracoes incluidos sao
ficticios ou placeholders seguros.

---

## Prints E Diagramas

Os prints reais foram substituidos por uma proposta de capturas futuras feitas
somente na versao demo, com dados ficticios.

Sugestoes de imagens para adicionar futuramente:

```text
assets/screenshots/login-demo.png
assets/screenshots/dashboard-demo.png
assets/screenshots/agendamento-demo.png
assets/screenshots/troca-sala-demo.png
assets/screenshots/auditoria-demo.png
assets/screenshots/gestao-docente-demo.png
assets/screenshots/inventario-demo.png
assets/diagrams/arquitetura-demo.png
assets/diagrams/modelo-banco-demo.png
```

---

## Roadmap Publico

Melhorias planejadas para a versao publica:

- adicionar screenshots reais da demo com dados ficticios;
- expandir a documentacao de rotas;
- criar diagramas visuais de arquitetura e banco;
- documentar fluxos principais por perfil;
- revisar dependencias herdadas e remover pacotes que nao forem necessarios;
- melhorar o guia de instalacao local;
- ampliar a cobertura de testes automatizados.

---

## Status

Projeto funcional em versao demonstrativa, sanitizada e preparada para portfolio.
Nao representa ambiente de producao e deve ser executado apenas com banco e
configuracoes proprias da demo.

---

## Autor

**William Pereira do Nascimento**  
Desenvolvedor com foco em Node.js, C#, SQL Server, APIs, automacao e sistemas web.
