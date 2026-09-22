# Sistema de Agendamentos Acadêmicos - Case Study

![Status](https://img.shields.io/badge/status-em%20evolu%C3%A7%C3%A3o-blue)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green)
![Express](https://img.shields.io/badge/Express.js-API-lightgrey)
![SQL Server](https://img.shields.io/badge/SQL%20Server-Database-red)
![WebSocket](https://img.shields.io/badge/WebSocket-Tempo%20Real-purple)
![PM2](https://img.shields.io/badge/PM2-Produ%C3%A7%C3%A3o-orange)

Estudo de caso de um sistema web desenvolvido para gerenciamento de **agendamentos de salas, aulas, professores, infraestrutura e inventário de computadores** em ambiente acadêmico.

> Este repositório apresenta apenas a documentação pública do projeto. O código-fonte original permanece privado por conter regras internas, dados sensíveis, integrações específicas e informações do ambiente real.

---

## 📌 Visão geral

O projeto começou como um sistema simples de consulta e agendamento de salas e evoluiu para uma aplicação web mais completa, com autenticação, permissões, múltiplas unidades, inventário de equipamentos, dashboards administrativos e comunicação em tempo real.

A solução foi pensada para centralizar informações de salas, professores, programas instalados, equipamentos e agendamentos, reduzindo controles manuais e facilitando a organização dos ambientes acadêmicos.

---

## 🎯 Objetivo do projeto

Criar uma plataforma interna para apoiar a gestão de ambientes acadêmicos, permitindo que professores, coordenadores e administradores possam consultar, cadastrar, alterar e acompanhar informações relacionadas a salas, aulas, infraestrutura e disponibilidade.

O sistema busca resolver problemas como:

- controle manual de reservas de salas;
- dificuldade para consultar disponibilidade de ambientes;
- falta de visão centralizada de professores, salas e equipamentos;
- necessidade de organizar dados por unidade;
- acompanhamento de infraestrutura e computadores;
- evolução gradual sem interromper o uso em produção.

---

## 👥 Perfis de usuário

### Professor

- Login com controle de sessão;
- Dashboard com visão semanal;
- Agendamento de aulas por sala, data e turno;
- Consulta de salas disponíveis;
- Visualização dos próprios agendamentos;
- Relatório de aulas ministradas;
- Agenda pessoal para bloqueio de disponibilidade.

### Coordenação e administração

- Dashboard administrativo;
- Cadastro e gerenciamento de professores;
- Cadastro e edição de salas;
- Gerenciamento de unidades curriculares;
- Gerenciamento de tipos de aula;
- Controle de programas disponíveis por sala;
- Verificação de disponibilidade de professores;
- Gestão de infraestrutura e equipamentos;
- Controle de múltiplas unidades;
- Acompanhamento de dados operacionais.

---

## 🧩 Principais funcionalidades

### Agendamentos

- Criação de reservas por sala, data e horário;
- Consulta de disponibilidade;
- Visualização por semana;
- Relatórios por professor;
- Tratamento de regras reais de negócio;
- Organização por unidade.

### Salas e infraestrutura

- Cadastro de salas;
- Registro de recursos disponíveis;
- Associação de programas e equipamentos;
- Consulta de informações detalhadas por ambiente.

### Professores

- Cadastro e manutenção de professores;
- Controle de permissões;
- Associação com unidades;
- Informações de perfil e disponibilidade;
- Agenda pessoal para bloqueios e compromissos.

### Inventário

- Cadastro e acompanhamento de computadores;
- Associação de computadores e monitores às salas;
- Registro de informações técnicas dos equipamentos;
- Histórico de alterações;
- Organização dos equipamentos por unidade e ambiente.

### Administração

- Controle de usuários e permissões;
- Dashboards administrativos;
- Organização por múltiplas unidades;
- Rotinas auxiliares para manutenção do sistema;
- Apoio à tomada de decisão sobre salas e infraestrutura.

---

## 🛠️ Tecnologias utilizadas

### Backend

- Node.js;
- Express.js;
- JavaScript;
- SQL Server;
- WebSocket;
- PM2;
- node-cron;
- bcrypt;
- express-session;
- Luxon.

### Frontend

- HTML5;
- CSS3;
- JavaScript puro;
- Manipulação direta do DOM;
- Telas específicas por módulo.

### Banco de dados

- SQL Server;
- Queries parametrizadas;
- Scripts SQL de migração;
- Estrutura relacional;
- Organização por entidades de negócio.

### Operação

- Execução em servidor Node.js;
- Gerenciamento de processo com PM2;
- Configuração por variáveis de ambiente;
- Separação entre ambiente de desenvolvimento e produção.

---

## 🏗️ Arquitetura geral

A aplicação foi organizada de forma modular, separando responsabilidades por domínio.

Estrutura conceitual:

```text
Frontend HTML/CSS/JS
        |
        v
Backend Node.js + Express
        |
        +--> Módulo de autenticação
        +--> Módulo de professores
        +--> Módulo de salas
        +--> Módulo de agendamentos
        +--> Módulo de unidades curriculares
        +--> Módulo de inventário
        +--> Módulo de relatórios
        +--> WebSocket para comunicação em tempo real
        |
        v
SQL Server
```

A estrutura do backend segue uma divisão por módulos, normalmente separando:

- rotas;
- controllers;
- services;
- regras de negócio;
- acesso ao banco de dados.

---

## 🔐 Segurança e boas práticas

Algumas práticas aplicadas ou previstas no projeto:

- senhas armazenadas com hash;
- cookies de sessão com `httpOnly`;
- configuração de `SESSION_SECRET` por variável de ambiente;
- validação de configuração em ambiente de produção;
- rate limit em rotas de autenticação;
- headers básicos de segurança;
- queries parametrizadas para reduzir risco de SQL Injection;
- separação de permissões por perfil;
- controle de acesso a áreas administrativas;
- documentação de hardening e testes de configuração.

---

## 🗄️ Banco de dados

O banco foi modelado para atender entidades como:

- usuários;
- professores;
- salas;
- unidades;
- agendamentos;
- tipos de aula;
- unidades curriculares;
- programas;
- computadores;
- monitores;
- histórico de equipamentos;
- solicitações de troca de sala;
- controle de acesso e auditoria.

Os scripts de migração foram organizados por data e preparados para execução controlada em ambiente SQL Server.

Exemplo de convenção usada para migrações:

```text
YYYY-MM-DD_descricao_da_migracao.sql
```

---

## 📈 Evolução do projeto

O sistema foi desenvolvido de forma incremental, passando por fases como:

1. consulta e cadastro inicial de salas;
2. criação de agendamentos;
3. autenticação e controle de sessão;
4. separação de perfis de usuário;
5. dashboards administrativos;
6. gerenciamento de professores;
7. suporte a múltiplas unidades;
8. inventário de computadores e monitores;
9. melhorias de segurança;
10. documentação técnica e scripts de migração.

---

## 👨‍💻 Minha participação

Atuei no desenvolvimento e evolução do sistema, incluindo:

- estruturação do backend em Node.js;
- criação de rotas e regras de negócio;
- integração com SQL Server;
- organização modular do projeto;
- implementação de autenticação e permissões;
- criação de dashboards e telas administrativas;
- desenvolvimento de funcionalidades de agendamento;
- implementação de recursos de inventário;
- ajustes de segurança;
- execução em produção com PM2;
- criação e organização de scripts SQL;
- documentação técnica do projeto;
- evolução incremental do sistema em ambiente real.

---

## 🚧 Desafios técnicos

Durante o desenvolvimento, alguns dos principais desafios foram:

- organizar regras reais de agendamento;
- controlar permissões por perfil de usuário;
- preparar o sistema para múltiplas unidades;
- manter compatibilidade com dados existentes;
- evoluir o sistema sem interromper o uso;
- criar migrações SQL seguras;
- separar informações sensíveis da documentação pública;
- melhorar segurança sem quebrar funcionalidades já utilizadas;
- lidar com manutenção e evolução contínua em ambiente real.

---

## 📚 Aprendizados

Este projeto contribuiu para o desenvolvimento de conhecimentos práticos em:

- backend com Node.js e Express;
- modelagem e manutenção de banco SQL Server;
- autenticação e sessões;
- controle de permissões;
- organização de projetos por módulos;
- deploy e operação com PM2;
- documentação técnica;
- migrações SQL;
- comunicação em tempo real com WebSocket;
- evolução de sistema em produção.

---

## 🧪 Observação sobre código-fonte

O código-fonte completo não está disponível publicamente por motivos de segurança e confidencialidade.

Este repositório tem o objetivo de demonstrar:

- contexto do problema;
- arquitetura geral;
- tecnologias utilizadas;
- responsabilidades assumidas;
- decisões técnicas;
- evolução do projeto;
- boas práticas aplicadas.

---

## 🗺️ Roadmap público

Melhorias planejadas ou estudadas:

- criação de testes automatizados;
- expansão da documentação de rotas;
- melhoria na documentação de arquitetura;
- criação de diagramas visuais;
- melhoria de hardening em produção;
- padronização de logs;
- melhoria de experiência do usuário;
- criação de ambiente demonstrativo com dados fictícios.

---

## 📷 Prints e diagramas

> Os prints reais do sistema foram omitidos ou deverão ser anonimizados antes de publicação para evitar exposição de dados internos.

Sugestões de imagens para adicionar futuramente:

```text
assets/dashboard.png
assets/agendamentos.png
assets/inventario.png
assets/arquitetura.png
assets/modelo-banco-resumido.png
```

---

## 📌 Status

Projeto funcional, em evolução contínua e utilizado como base para melhorias em gestão acadêmica, infraestrutura e inventário.

---

## ✍️ Autor

**William Pereira do Nascimento**  
Desenvolvedor com foco em Node.js, C#, SQL Server, APIs, automação e sistemas web.
