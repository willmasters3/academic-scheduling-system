# Análise técnica — rastreabilidade de agendamentos individuais e recorrentes

**Data da análise:** 31/07/2026  
**Escopo:** fluxo atual de criação, recorrência, conflito, edição, exclusão e identificação do usuário  
**Natureza deste documento:** análise e proposta. Nenhuma alteração de código ou banco foi executada.

## 1. Objetivo

Documentar o funcionamento atual dos agendamentos e propor rastreabilidade suficiente para responder, no futuro, perguntas como:

> Um professor afirma que reservou uma sala para todas as segundas-feiras durante três meses, mas uma segunda-feira não possui reserva. Essa data nunca foi gerada, foi retirada manualmente, entrou em conflito, falhou, foi criada e depois alterada, cancelada ou excluída?

A solução precisa registrar:

- a operação completa de criação individual ou recorrente;
- usuário executor, data e hora;
- período, dias da semana, sala, professor e horários solicitados;
- todas as datas geradas;
- sucesso ou falha de cada data;
- motivo de cada falha e reserva conflitante;
- agrupamento por lote;
- criação, edição, cancelamento e exclusão;
- valores anteriores e posteriores;
- evidência durável de reservas posteriormente excluídas.

## 2. Resumo executivo

Hoje, recorrência não é uma entidade do backend. O navegador transforma período e dias da semana em um array de datas e envia esse array para a mesma rota usada para reservas individuais.

O backend abre uma única transação, verifica cada data, insere cada reserva e somente confirma tudo ao final. Na mesma chamada, a criação é essencialmente atômica: um conflito ou erro provoca rollback de todo o lote. Assim, uma segunda-feira isolada ausente não deveria decorrer de um insert parcialmente confirmado dentro de uma única requisição bem-sucedida.

Ainda assim, o sistema não registra a intenção original. Depois do fato, não é possível distinguir se uma data:

- nunca foi gerada pelo frontend;
- foi removida manualmente antes do envio;
- não foi enviada por erro do navegador;
- causou conflito e fez o lote inteiro ser revertido;
- foi criada e posteriormente editada, trocada, cancelada ou excluída;
- foi afetada por concorrência entre requisições.

Também não existe lote de criação, auditoria dos agendamentos ou cancelamento lógico. Exclusões são físicas.

## 3. Rotas atuais

As rotas estão em `modules/agendamentos/agendamentosRoutes.js` e são montadas sem prefixo adicional por `modules/app/appRoutes.js`.

| Método e rota | Finalidade atual |
|---|---|
| `POST /agendar-sala` | Criação individual ou de várias datas |
| `PUT /editar-agendamento/:id` | Altera professor, tipo de atividade e motivo |
| `PUT /editar-professor-agendamento/:id` | Altera apenas o professor |
| `GET /verificar-agendamento/:id_sala/:data/:hora_inicio/:hora_fim` | Consulta preventiva de conflitos |
| `GET /listar-agendamentos/:id_Sala` | Lista agenda diária da sala |
| `GET /listar-agendamentos-professor-logado` | Lista reservas do professor da sessão |
| `DELETE /excluir-agendamento/:id` | Exclusão física individual |
| `DELETE /excluir-agendamentos-intervalo` | Exclusão física por unidade e período |
| `POST /agendamentos/verificar-expirados` | Rotina interna/legada de exclusão de expirados |
| `POST /troca-sala/coordenador/trocar` | Troca direta de sala |
| `POST /troca-sala/:idSolicitacao/decidir` | Decisão de troca simples |
| `POST /troca-sala/lote/:idLote/decidir` | Decisão de lote de trocas |

Não há rota específica para criação recorrente, cancelamento, consulta de lote de criação ou histórico de auditoria.

## 4. Geração das datas recorrentes

A geração ocorre exclusivamente em `public/js/agendasala.js`.

Fluxo atual:

1. O usuário seleciona data inicial, data final e checkboxes de dias da semana.
2. `atualizarDatasSelecionadas()` lê os valores.
3. `obterDatasPorDiasDaSemana()` percorre o intervalo com Luxon.
4. As datas calculadas são colocadas em `data_selecionada`.
5. `agendarSala()` converte as datas para `YYYY-MM-DD`.
6. O frontend envia somente o array final em `data_reservas`.

O payload não contém período original, dias selecionados, indicação de recorrência ou diferenças entre datas calculadas e datas manualmente editadas.

### 4.1 Edição manual

O botão **Editar Datas Selecionadas** habilita o Flatpickr para modificar o conjunto calculado. Uma segunda-feira pode ser removida manualmente e o backend receberá apenas o array final, sem saber que ela fazia parte da geração original.

### 4.2 Mapeamento semanal

O HTML usa `0 = domingo`, `1 = segunda`, ..., `6 = sábado`. O frontend transforma esses números antes de comparar com `DateTime.weekday`, que usa `1 = segunda`, ..., `7 = domingo`.

Para segunda-feira o valor final coincide com Luxon. Para domingo, entretanto, o frontend produz `0`, enquanto Luxon produz `7`. Na implementação atual, selecionar domingo não gera domingos. Isso não explica diretamente uma segunda-feira isolada, mas demonstra fragilidade e falta de testes no cálculo.

## 5. Verificação de conflitos

A validação efetiva fica em `modules/agendamentos/agendamentosService.js`, dentro de `agendarSala()`.

O conflito considera mesma sala, mesma data e interseção de horário:

```sql
hora_inicio < @hora_fim
AND hora_fim > @hora_inicio
```

A regra permite horários adjacentes e detecta sobreposição de intervalo corretamente.

Não há validação de conflito do mesmo professor em salas diferentes.

### 5.1 Concorrência

A consulta de conflito e o insert estão em uma transação, mas não há evidência de `SERIALIZABLE`, `UPDLOCK/HOLDLOCK`, `sp_getapplock` ou outra garantia de exclusão da faixa sala/data.

Duas requisições concorrentes podem consultar zero conflitos e ambas inserir reservas sobrepostas. Restrição única comum não resolve sobreposição arbitrária de intervalos. Recomenda-se transação com bloqueio de aplicação por sala/data ou estratégia serializável equivalente.

## 6. Inserts atuais

`agendarSala()`:

- valida horário e acesso à sala;
- verifica vínculo do professor com a unidade;
- abre uma transação;
- percorre o array de datas;
- valida data futura;
- consulta conflito;
- executa um `INSERT` por ocorrência;
- confirma somente depois de terminar todas as datas.

No primeiro conflito, a transação é revertida e a resposta menciona somente essa data. Não são capturados os IDs inseridos com `OUTPUT INSERTED`, não existe identificador de lote e tentativas rejeitadas não são persistidas.

A estrutura documentada de `agendamentos` usa `nvarchar(max)` para datas e horas. Isso permite valores inválidos, dificulta índices, torna comparações dependentes da formatação e reduz a capacidade do banco de proteger as regras temporais.

## 7. Edição, exclusão, cancelamento e troca

### 7.1 Edição

A edição busca o proprietário e a data, valida autorização, impede alterações de datas passadas e executa `UPDATE`. Não registra executor, instante, estado anterior ou estado posterior.

A tela edita várias reservas por requisições independentes. Se a terceira falhar, as anteriores permanecem alteradas. A mensagem informa apenas que alguns agendamentos falharam, sem IDs, datas ou causas.

### 7.2 Exclusão individual

A exclusão individual abre uma transação, valida propriedade/papel e data, remove vínculos de troca e executa `DELETE FROM agendamentos`. A exclusão é física. Após o commit, não existe evidência durável de que a reserva existiu.

### 7.3 Exclusão por intervalo

A operação é reservada a administrador/coordenador, exclui vínculos de troca e depois remove fisicamente as reservas. O service não recebe o ID do executor e não registra quantidade, IDs ou snapshots.

### 7.4 Exclusão múltipla no frontend

Cada item selecionado gera uma requisição independente. A exclusão parcial é possível. O frontend informa somente a quantidade de erros e descarta os detalhes do corpo da resposta.

### 7.5 Cancelamento

Não existe cancelamento. Uma reserva apenas existe ou é fisicamente apagada. Recomenda-se separar:

- `ATIVO`: aparece na agenda e participa do conflito;
- `CANCELADO`: permanece no histórico, mas não bloqueia horário;
- `EXCLUIDO`: remoção lógica administrativa, igualmente preservada.

### 7.6 Trocas

As trocas atualizam `id_sala`, inclusive em transações, mas não produzem auditoria geral com snapshots das reservas antes e depois. As tabelas de solicitações registram o fluxo da solicitação, não substituem um histórico imutável da reserva.

## 8. Usuário autenticado

O login armazena em `req.session.user`:

- `id_professor`;
- `nome`;
- `login`;
- `email`;
- `permissao`;
- `unidades`.

As rotas de mutação usam `requireAuthenticatedSession`, portanto o executor pode ser obtido da sessão.

É necessário distinguir:

- `id_professor`: professor para quem a reserva foi criada;
- `ator_id`, `criado_por`, `alterado_por`: usuário que executou a ação.

Como coordenadores e administradores podem agir por terceiros, apenas o professor da reserva não identifica o responsável. A auditoria deve guardar também snapshots de nome, login e permissão para continuar compreensível se o cadastro mudar.

## 9. Logs reaproveitáveis

Não há log de agendamentos. Existem padrões em outros domínios, como `EquipamentoHistorico`, auditorias operacionais internas. Eles podem orientar convenções de data UTC, resultado e mensagem de erro, mas não devem receber eventos de agenda.

As tabelas de troca também oferecem contexto, porém algumas relações são removidas antes da exclusão da reserva e não guardam todos os estados anterior/posterior.

## 10. Falhas parciais e visibilidade

### Criação individual/recorrente

Dentro de uma única chamada, a transação é atômica:

- conflito em uma data: rollback de todas;
- erro de banco: rollback de todas;
- sucesso: commit de todas.

Portanto, não há sucesso parcial intencional na criação atual. Porém:

- somente o primeiro conflito aparece;
- não fica explícito que nenhuma data foi criada;
- a tentativa fracassada não deixa registro;
- falha de rede depois do commit pode induzir o usuário a acreditar que nada foi criado;
- repetição manual pode conflitar com a chamada anterior;
- não existe chave de idempotência;
- concorrência pode permitir sobreposição.

### Edição e exclusão em massa

Há falha parcial real porque cada registro é processado por uma chamada diferente. Sucessos anteriores não são revertidos e a interface não identifica adequadamente os itens que falharam.

## 11. Riscos encontrados

1. Ausência de rastreabilidade da intenção original.
2. Recorrência calculada apenas no cliente.
3. Possibilidade de alteração manual das datas sem registro da diferença.
4. Bug conhecido no mapeamento de domingo.
5. Ausência de idempotência.
6. Condição de corrida na verificação de conflitos.
7. Datas e horas armazenadas como texto amplo.
8. Ausência de conflito por professor.
9. Exclusão física sem histórico.
10. Exclusão de vínculos de troca antes da reserva.
11. Ausência de cancelamento lógico.
12. Edição sem snapshots anterior/posterior.
13. Troca de sala sem auditoria geral da reserva.
14. Operações em massa feitas como várias requisições independentes.
15. Mensagens de falha incompletas.
16. Ausência de lote para criação recorrente.
17. Impossibilidade de reconstruir autoria e instante de reservas legadas.

## 12. Arquitetura recomendada

### 12.1 Lote de operação

`AgendamentoLote` representa a intenção completa:

- individual ou recorrente;
- executor e professor beneficiário;
- sala;
- período;
- horários;
- status global;
- contagens de sucesso/falha/reversão;
- correlação/idempotência;
- payload original.

O lote deve ser criado antes das validações e permanecer registrado mesmo se tudo falhar.

### 12.2 Dias selecionados

`AgendamentoLoteDiaSemana` registra os dias ISO originalmente marcados (`segunda=1 ... domingo=7`). Isso evita depender somente de JSON e permite consulta relacional.

### 12.3 Ocorrências

`AgendamentoLoteItem` contém uma linha para cada data gerada ou alterada manualmente:

- data e horário;
- origem da data;
- resultado;
- reserva criada;
- reserva conflitante;
- código e mensagem de falha;
- snapshot do conflito.

Modos recomendados:

- `ATOMICO`: todas ou nenhuma;
- `PARCIAL`: cria as disponíveis e relata as rejeitadas.

O comportamento deve ser explícito no contrato e na interface.

### 12.4 Auditoria imutável

`AgendamentoAuditoria` registra criação, edição, cancelamento, reativação, exclusão, troca e falhas, contendo:

- ator e instante UTC;
- reserva, lote e ocorrência;
- resultado;
- motivo;
- dados anteriores e posteriores em JSON;
- metadados, IP e user-agent.

`id_agendamento` não deve ter FK para `agendamentos`: o histórico precisa sobreviver caso algum código legado ainda faça exclusão física.

### 12.5 Relacionamentos

```text
professores
   ├── AgendamentoLote.criado_por
   ├── AgendamentoLote.id_professor
   └── AgendamentoAuditoria.ator_id (snapshot histórico)

Salas
   └── AgendamentoLote.id_sala

AgendamentoLote
   ├── AgendamentoLoteDiaSemana
   ├── AgendamentoLoteItem
   ├── agendamentos.id_lote
   └── AgendamentoAuditoria.id_lote

AgendamentoLoteItem
   ├── id_agendamento_criado
   └── id_agendamento_conflitante

agendamentos
   └── AgendamentoAuditoria.id_agendamento
       (sem FK intencionalmente)
```

## 13. Índices recomendados

- Lotes por executor e data.
- Lotes por professor e período.
- Itens por lote, resultado e data.
- Itens por reserva criada.
- Auditoria por reserva e data descendente.
- Auditoria por ator e data descendente.
- Reservas ativas por sala, data e horários tipados.
- Reservas por lote e data.

Um índice ajuda a consulta, mas não impede intervalos sobrepostos. O controle de concorrência continua necessário.

## 14. Alterações necessárias no backend

1. Gerar recorrência no servidor a partir de período e dias ISO.
2. Registrar datas geradas, adicionadas manualmente e removidas manualmente.
3. Criar lote antes do processamento.
4. Gravar lote, itens, reservas e auditoria de forma transacional.
5. Retornar JSON estruturado por ocorrência.
6. Usar `OUTPUT INSERTED.id_agendamento`.
7. Aceitar `correlation_id` idempotente.
8. Aplicar trava por sala/data, preferencialmente `sp_getapplock` dentro da transação.
9. Escrever simultaneamente nas colunas textuais legadas e temporais tipadas durante a transição.
10. Capturar a linha completa antes de editar/cancelar/excluir.
11. Registrar snapshots anterior e posterior na mesma transação da mutação.
12. Criar endpoints de edição/cancelamento em lote.
13. Implementar cancelamento e exclusão lógica.
14. Filtrar consultas operacionais por `status = 'ATIVO'`.
15. Auditar trocas simples, em lote e diretas.
16. Auditar exclusões automáticas/legadas.
17. Passar o usuário da sessão para exclusões por intervalo.
18. Fazer falha de auditoria provocar rollback da ação principal.
19. Avaliar conflito simultâneo do professor, conforme regra de negócio.

## 15. Alterações necessárias no frontend

- Enviar regra de recorrência, além da lista final.
- Mostrar prévia do período, dias e todas as datas.
- Destacar datas adicionadas ou removidas manualmente.
- Informar claramente modo atômico ou parcial.
- Mostrar resultado por data, motivo e conflito.
- Mostrar número/código do lote.
- Permitir consultar lote e histórico.
- Exibir criador, executor de alterações e datas das ações.
- Usar cancelamento como ação operacional padrão.
- Reservar exclusão para ação administrativa.
- Usar endpoint único para ações em massa.
- Mostrar detalhes de erro na interface, não apenas no console.
- Corrigir o mapeamento de domingo.
- Remover funções duplicadas/legadas depois da estabilização.

## 16. Estratégia de migração

1. Criar tabelas, colunas e índices de forma aditiva.
2. Manter vínculos/autoria opcionais para registros antigos.
3. Marcar reservas existentes como `ATIVO`.
4. Não inventar autoria nem data de criação dos registros legados.
5. Criar colunas temporais tipadas em paralelo.
6. Preencher somente valores convertíveis com `TRY_CONVERT`.
7. Sanear valores inválidos antes de tornar campos obrigatórios.
8. Publicar backend com escrita dupla em campos antigos e novos.
9. Ativar lote e auditoria em todas as mutações.
10. Migrar o frontend para o novo contrato.
11. Após estabilização, parar exclusões físicas.
12. Em fase posterior, eliminar a dependência de datas/horas textuais.

A migração não consegue reconstruir autoria, instante ou histórico das reservas existentes. A rastreabilidade completa começa após a implantação do novo fluxo.

## 17. Script SQL proposto para execução manual futura

> Este script é apenas uma proposta e não foi executado. Criar a estrutura sem publicar o backend correspondente não fará o sistema preencher a auditoria.

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    IF COL_LENGTH('dbo.agendamentos', 'id_lote') IS NULL
        ALTER TABLE dbo.agendamentos ADD id_lote BIGINT NULL;

    IF COL_LENGTH('dbo.agendamentos', 'status') IS NULL
        ALTER TABLE dbo.agendamentos
        ADD status VARCHAR(20) NOT NULL
            CONSTRAINT DF_agendamentos_status DEFAULT ('ATIVO') WITH VALUES;

    IF COL_LENGTH('dbo.agendamentos', 'criado_em') IS NULL
        ALTER TABLE dbo.agendamentos
        ADD criado_em DATETIME2(3) NULL
            CONSTRAINT DF_agendamentos_criado_em DEFAULT SYSUTCDATETIME();

    IF COL_LENGTH('dbo.agendamentos', 'criado_por') IS NULL
        ALTER TABLE dbo.agendamentos ADD criado_por INT NULL;

    IF COL_LENGTH('dbo.agendamentos', 'atualizado_em') IS NULL
        ALTER TABLE dbo.agendamentos ADD atualizado_em DATETIME2(3) NULL;

    IF COL_LENGTH('dbo.agendamentos', 'atualizado_por') IS NULL
        ALTER TABLE dbo.agendamentos ADD atualizado_por INT NULL;

    IF COL_LENGTH('dbo.agendamentos', 'cancelado_em') IS NULL
        ALTER TABLE dbo.agendamentos ADD cancelado_em DATETIME2(3) NULL;

    IF COL_LENGTH('dbo.agendamentos', 'cancelado_por') IS NULL
        ALTER TABLE dbo.agendamentos ADD cancelado_por INT NULL;

    IF COL_LENGTH('dbo.agendamentos', 'motivo_cancelamento') IS NULL
        ALTER TABLE dbo.agendamentos ADD motivo_cancelamento NVARCHAR(1000) NULL;

    IF COL_LENGTH('dbo.agendamentos', 'excluido_em') IS NULL
        ALTER TABLE dbo.agendamentos ADD excluido_em DATETIME2(3) NULL;

    IF COL_LENGTH('dbo.agendamentos', 'excluido_por') IS NULL
        ALTER TABLE dbo.agendamentos ADD excluido_por INT NULL;

    IF COL_LENGTH('dbo.agendamentos', 'motivo_exclusao') IS NULL
        ALTER TABLE dbo.agendamentos ADD motivo_exclusao NVARCHAR(1000) NULL;

    IF COL_LENGTH('dbo.agendamentos', 'data_reserva_date') IS NULL
        ALTER TABLE dbo.agendamentos ADD data_reserva_date DATE NULL;

    IF COL_LENGTH('dbo.agendamentos', 'hora_inicio_time') IS NULL
        ALTER TABLE dbo.agendamentos ADD hora_inicio_time TIME(0) NULL;

    IF COL_LENGTH('dbo.agendamentos', 'hora_fim_time') IS NULL
        ALTER TABLE dbo.agendamentos ADD hora_fim_time TIME(0) NULL;

    IF OBJECT_ID('dbo.AgendamentoLote', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.AgendamentoLote
        (
            id_lote BIGINT IDENTITY(1,1) NOT NULL,
            correlation_id UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT DF_AgendamentoLote_correlation DEFAULT NEWSEQUENTIALID(),
            tipo_operacao VARCHAR(20) NOT NULL,
            modo_processamento VARCHAR(20) NOT NULL
                CONSTRAINT DF_AgendamentoLote_modo DEFAULT ('ATOMICO'),
            origem VARCHAR(30) NOT NULL
                CONSTRAINT DF_AgendamentoLote_origem DEFAULT ('WEB'),
            criado_por INT NOT NULL,
            ator_nome NVARCHAR(200) NULL,
            ator_login NVARCHAR(255) NULL,
            ator_permissao NVARCHAR(50) NULL,
            criado_em DATETIME2(3) NOT NULL
                CONSTRAINT DF_AgendamentoLote_criado_em DEFAULT SYSUTCDATETIME(),
            id_sala INT NOT NULL,
            id_professor INT NOT NULL,
            data_inicio DATE NOT NULL,
            data_fim DATE NOT NULL,
            hora_inicio TIME(0) NOT NULL,
            hora_fim TIME(0) NOT NULL,
            tipo_aula NVARCHAR(720) NULL,
            motivo NVARCHAR(720) NULL,
            status VARCHAR(30) NOT NULL
                CONSTRAINT DF_AgendamentoLote_status DEFAULT ('RECEBIDO'),
            total_datas_geradas INT NOT NULL
                CONSTRAINT DF_AgendamentoLote_total_geradas DEFAULT (0),
            total_criadas INT NOT NULL
                CONSTRAINT DF_AgendamentoLote_total_criadas DEFAULT (0),
            total_falhas INT NOT NULL
                CONSTRAINT DF_AgendamentoLote_total_falhas DEFAULT (0),
            total_revertidas INT NOT NULL
                CONSTRAINT DF_AgendamentoLote_total_revertidas DEFAULT (0),
            iniciado_em DATETIME2(3) NULL,
            concluido_em DATETIME2(3) NULL,
            codigo_erro VARCHAR(100) NULL,
            mensagem_erro NVARCHAR(2000) NULL,
            requisicao_json NVARCHAR(MAX) NULL,

            CONSTRAINT PK_AgendamentoLote PRIMARY KEY CLUSTERED (id_lote),
            CONSTRAINT UQ_AgendamentoLote_correlation UNIQUE (correlation_id),
            CONSTRAINT CK_AgendamentoLote_tipo
                CHECK (tipo_operacao IN ('INDIVIDUAL', 'RECORRENTE')),
            CONSTRAINT CK_AgendamentoLote_modo
                CHECK (modo_processamento IN ('ATOMICO', 'PARCIAL')),
            CONSTRAINT CK_AgendamentoLote_origem
                CHECK (origem IN ('WEB', 'API', 'IMPORTACAO', 'SISTEMA')),
            CONSTRAINT CK_AgendamentoLote_status
                CHECK (status IN ('RECEBIDO','PROCESSANDO','SUCESSO',
                                  'SUCESSO_PARCIAL','FALHA','REVERTIDO')),
            CONSTRAINT CK_AgendamentoLote_periodo CHECK (data_inicio <= data_fim),
            CONSTRAINT CK_AgendamentoLote_horario CHECK (hora_inicio < hora_fim),
            CONSTRAINT CK_AgendamentoLote_requisicao_json
                CHECK (requisicao_json IS NULL OR ISJSON(requisicao_json) = 1),
            CONSTRAINT FK_AgendamentoLote_criado_por
                FOREIGN KEY (criado_por) REFERENCES dbo.professores(id_professor),
            CONSTRAINT FK_AgendamentoLote_professor
                FOREIGN KEY (id_professor) REFERENCES dbo.professores(id_professor),
            CONSTRAINT FK_AgendamentoLote_sala
                FOREIGN KEY (id_sala) REFERENCES dbo.Salas(id_sala)
        );
    END;

    IF OBJECT_ID('dbo.AgendamentoLoteDiaSemana', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.AgendamentoLoteDiaSemana
        (
            id_lote BIGINT NOT NULL,
            dia_semana TINYINT NOT NULL,
            CONSTRAINT PK_AgendamentoLoteDiaSemana
                PRIMARY KEY CLUSTERED (id_lote, dia_semana),
            CONSTRAINT CK_AgendamentoLoteDiaSemana_dia
                CHECK (dia_semana BETWEEN 1 AND 7),
            CONSTRAINT FK_AgendamentoLoteDiaSemana_lote
                FOREIGN KEY (id_lote) REFERENCES dbo.AgendamentoLote(id_lote)
        );
    END;

    IF OBJECT_ID('dbo.AgendamentoLoteItem', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.AgendamentoLoteItem
        (
            id_item BIGINT IDENTITY(1,1) NOT NULL,
            id_lote BIGINT NOT NULL,
            ordem INT NOT NULL,
            data_reserva DATE NOT NULL,
            hora_inicio TIME(0) NOT NULL,
            hora_fim TIME(0) NOT NULL,
            origem_data VARCHAR(30) NOT NULL
                CONSTRAINT DF_AgendamentoLoteItem_origem DEFAULT ('GERADA'),
            resultado VARCHAR(30) NOT NULL
                CONSTRAINT DF_AgendamentoLoteItem_resultado DEFAULT ('PENDENTE'),
            id_agendamento_criado INT NULL,
            id_agendamento_conflitante INT NULL,
            codigo_falha VARCHAR(100) NULL,
            motivo_falha NVARCHAR(2000) NULL,
            conflito_json NVARCHAR(MAX) NULL,
            processado_em DATETIME2(3) NULL,
            criado_em DATETIME2(3) NOT NULL
                CONSTRAINT DF_AgendamentoLoteItem_criado_em DEFAULT SYSUTCDATETIME(),

            CONSTRAINT PK_AgendamentoLoteItem PRIMARY KEY CLUSTERED (id_item),
            CONSTRAINT UQ_AgendamentoLoteItem_data
                UNIQUE (id_lote, data_reserva, hora_inicio, hora_fim),
            CONSTRAINT CK_AgendamentoLoteItem_horario CHECK (hora_inicio < hora_fim),
            CONSTRAINT CK_AgendamentoLoteItem_origem
                CHECK (origem_data IN ('GERADA','ADICIONADA_MANUALMENTE',
                                       'REMOVIDA_MANUALMENTE')),
            CONSTRAINT CK_AgendamentoLoteItem_resultado
                CHECK (resultado IN ('PENDENTE','CRIADO','FALHA_CONFLITO',
                    'FALHA_VALIDACAO','FALHA_PERMISSAO','FALHA_BANCO',
                    'REMOVIDO_ANTES_ENVIO','REVERTIDO')),
            CONSTRAINT CK_AgendamentoLoteItem_conflito_json
                CHECK (conflito_json IS NULL OR ISJSON(conflito_json) = 1),
            CONSTRAINT FK_AgendamentoLoteItem_lote
                FOREIGN KEY (id_lote) REFERENCES dbo.AgendamentoLote(id_lote)
        );
    END;

    IF OBJECT_ID('dbo.AgendamentoAuditoria', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.AgendamentoAuditoria
        (
            id_auditoria BIGINT IDENTITY(1,1) NOT NULL,
            correlation_id UNIQUEIDENTIFIER NOT NULL
                CONSTRAINT DF_AgendamentoAuditoria_correlation DEFAULT NEWSEQUENTIALID(),
            id_agendamento INT NULL,
            id_lote BIGINT NULL,
            id_lote_item BIGINT NULL,
            acao VARCHAR(40) NOT NULL,
            resultado VARCHAR(20) NOT NULL
                CONSTRAINT DF_AgendamentoAuditoria_resultado DEFAULT ('SUCESSO'),
            ator_id INT NULL,
            ator_nome NVARCHAR(200) NULL,
            ator_login NVARCHAR(255) NULL,
            ator_permissao NVARCHAR(50) NULL,
            ocorrido_em DATETIME2(3) NOT NULL
                CONSTRAINT DF_AgendamentoAuditoria_ocorrido_em DEFAULT SYSUTCDATETIME(),
            motivo NVARCHAR(2000) NULL,
            codigo_erro VARCHAR(100) NULL,
            mensagem_erro NVARCHAR(2000) NULL,
            dados_anteriores NVARCHAR(MAX) NULL,
            dados_posteriores NVARCHAR(MAX) NULL,
            metadados NVARCHAR(MAX) NULL,
            ip_origem VARCHAR(45) NULL,
            user_agent NVARCHAR(1000) NULL,

            CONSTRAINT PK_AgendamentoAuditoria PRIMARY KEY CLUSTERED (id_auditoria),
            CONSTRAINT CK_AgendamentoAuditoria_acao
                CHECK (acao IN ('CRIACAO','EDICAO','CANCELAMENTO','REATIVACAO',
                    'EXCLUSAO','TROCA_SALA','TROCA_PROFESSOR','FALHA_CRIACAO',
                    'EXCLUSAO_INTERVALO','EXCLUSAO_AUTOMATICA')),
            CONSTRAINT CK_AgendamentoAuditoria_resultado
                CHECK (resultado IN ('SUCESSO','FALHA','REVERTIDO')),
            CONSTRAINT CK_AgendamentoAuditoria_json_anterior
                CHECK (dados_anteriores IS NULL OR ISJSON(dados_anteriores) = 1),
            CONSTRAINT CK_AgendamentoAuditoria_json_posterior
                CHECK (dados_posteriores IS NULL OR ISJSON(dados_posteriores) = 1),
            CONSTRAINT CK_AgendamentoAuditoria_json_metadados
                CHECK (metadados IS NULL OR ISJSON(metadados) = 1),
            CONSTRAINT FK_AgendamentoAuditoria_lote
                FOREIGN KEY (id_lote) REFERENCES dbo.AgendamentoLote(id_lote),
            CONSTRAINT FK_AgendamentoAuditoria_lote_item
                FOREIGN KEY (id_lote_item) REFERENCES dbo.AgendamentoLoteItem(id_item)
        );
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = 'FK_agendamentos_lote'
          AND parent_object_id = OBJECT_ID('dbo.agendamentos')
    )
    BEGIN
        ALTER TABLE dbo.agendamentos WITH CHECK
        ADD CONSTRAINT FK_agendamentos_lote
            FOREIGN KEY (id_lote) REFERENCES dbo.AgendamentoLote(id_lote);
    END;

    IF NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = 'CK_agendamentos_status'
          AND parent_object_id = OBJECT_ID('dbo.agendamentos')
    )
    BEGIN
        ALTER TABLE dbo.agendamentos WITH CHECK
        ADD CONSTRAINT CK_agendamentos_status
            CHECK (status IN ('ATIVO','CANCELADO','EXCLUIDO'));
    END;

    UPDATE dbo.agendamentos
    SET data_reserva_date =
        TRY_CONVERT(DATE, NULLIF(LTRIM(RTRIM(data_reservas)), ''), 23)
    WHERE data_reserva_date IS NULL AND data_reservas IS NOT NULL;

    UPDATE dbo.agendamentos
    SET hora_inicio_time =
        TRY_CONVERT(TIME(0), NULLIF(LTRIM(RTRIM(hora_inicio)), ''))
    WHERE hora_inicio_time IS NULL AND hora_inicio IS NOT NULL;

    UPDATE dbo.agendamentos
    SET hora_fim_time =
        TRY_CONVERT(TIME(0), NULLIF(LTRIM(RTRIM(hora_fim)), ''))
    WHERE hora_fim_time IS NULL AND hora_fim IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_AgendamentoLote_executor_data'
          AND object_id = OBJECT_ID('dbo.AgendamentoLote'))
        CREATE INDEX IX_AgendamentoLote_executor_data
        ON dbo.AgendamentoLote (criado_por, criado_em DESC)
        INCLUDE (status, tipo_operacao, id_sala, id_professor, data_inicio, data_fim);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_AgendamentoLote_professor_periodo'
          AND object_id = OBJECT_ID('dbo.AgendamentoLote'))
        CREATE INDEX IX_AgendamentoLote_professor_periodo
        ON dbo.AgendamentoLote (id_professor, data_inicio, data_fim)
        INCLUDE (id_sala, status, criado_em);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_AgendamentoLoteItem_lote_resultado'
          AND object_id = OBJECT_ID('dbo.AgendamentoLoteItem'))
        CREATE INDEX IX_AgendamentoLoteItem_lote_resultado
        ON dbo.AgendamentoLoteItem (id_lote, resultado, data_reserva)
        INCLUDE (id_agendamento_criado, id_agendamento_conflitante, codigo_falha);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_AgendamentoLoteItem_agendamento'
          AND object_id = OBJECT_ID('dbo.AgendamentoLoteItem'))
        CREATE INDEX IX_AgendamentoLoteItem_agendamento
        ON dbo.AgendamentoLoteItem (id_agendamento_criado)
        WHERE id_agendamento_criado IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_AgendamentoAuditoria_agendamento_data'
          AND object_id = OBJECT_ID('dbo.AgendamentoAuditoria'))
        CREATE INDEX IX_AgendamentoAuditoria_agendamento_data
        ON dbo.AgendamentoAuditoria (id_agendamento, ocorrido_em DESC)
        INCLUDE (acao, resultado, ator_id, id_lote);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_AgendamentoAuditoria_ator_data'
          AND object_id = OBJECT_ID('dbo.AgendamentoAuditoria'))
        CREATE INDEX IX_AgendamentoAuditoria_ator_data
        ON dbo.AgendamentoAuditoria (ator_id, ocorrido_em DESC)
        INCLUDE (acao, resultado, id_agendamento, id_lote);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_agendamentos_conflito_ativo'
          AND object_id = OBJECT_ID('dbo.agendamentos'))
        CREATE INDEX IX_agendamentos_conflito_ativo
        ON dbo.agendamentos
            (id_sala, data_reserva_date, hora_inicio_time, hora_fim_time)
        INCLUDE (id_agendamento, id_professor)
        WHERE status = 'ATIVO'
          AND data_reserva_date IS NOT NULL
          AND hora_inicio_time IS NOT NULL
          AND hora_fim_time IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE name = 'IX_agendamentos_lote'
          AND object_id = OBJECT_ID('dbo.agendamentos'))
        CREATE INDEX IX_agendamentos_lote
        ON dbo.agendamentos (id_lote, data_reserva_date)
        INCLUDE (id_agendamento, id_sala, id_professor, status,
                 hora_inicio_time, hora_fim_time)
        WHERE id_lote IS NOT NULL;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Diagnóstico pós-migração, somente leitura:
SELECT id_agendamento, data_reservas, hora_inicio, hora_fim
FROM dbo.agendamentos
WHERE data_reserva_date IS NULL
   OR hora_inicio_time IS NULL
   OR hora_fim_time IS NULL
   OR hora_inicio_time >= hora_fim_time
ORDER BY id_agendamento;
```

## 18. Conclusão

A prioridade é registrar primeiro a intenção integral do lote e cada data gerada. Em seguida, geração, validação, criação e auditoria devem acontecer no backend, com uma identidade de correlação e controle explícito de concorrência.

Com essa arquitetura será possível responder com evidências se uma data nunca foi solicitada, foi retirada manualmente, conflitou, falhou, foi revertida, foi criada e depois editada, trocada, cancelada ou excluída.
