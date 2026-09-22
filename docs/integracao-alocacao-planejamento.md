# Alocação Docente e planejamento acadêmico

Implementação no serviço existente `alocacoesDocentesService.js`, sem nova conexão,
rota, tabela ou alteração de estrutura. Nenhum comando SQL foi executado na entrega.

## Criação e reutilização

`garantirPlanejamentoDaAlocacao` recebe a transação da operação e o registro salvo.
Criação individual, coletiva, edição e reativação usam a mesma rotina.
PREPARACAO não gera planejamento. O coletivo atual aceita exclusivamente esse tipo;
esta entrega não amplia o contrato do coletivo para alocações acadêmicas.

A chave lógica é turma + UC do curso + data inicial + data final, sem professor,
turno ou dias da semana. Um planejamento ativo existente é reutilizado mantendo
sua versão original, inclusive se foi cadastrado manualmente. Mais de um registro
para a chave, planejamento não ativo ou versão inválida interrompem a operação.
Não há reativação implícita de planejamento nem escolha silenciosa entre duplicatas.

Sem planejamento, usa-se a última versão por numero_versao e id_versao_carga.
Não há regra de vigência temporal de versões implementada no código anterior.
Se não houver versão, cria-se a inicial com numero_versao=1,
versao_anterior_id=NULL, natureza_alteracao=INICIAL e carga atual do catálogo
convertida em minutos inteiros por Math.round(horas * 60).
Nome e perfil são snapshots do usuário autenticado, sem identidade inventada.
Uma mudança posterior na carga do catálogo não gera versão automaticamente.

UPDLOCK/HOLDLOCK na UC e nas consultas de existência serializam a garantia da
estrutura. A transação inclui alocação, dias, planejamento, versão e auditoria:
falhas propagam e causam rollback. Não há sucesso parcial silencioso.
Não se trata de uma deduplicação das próprias alocações: suas regras continuam
permitindo sobreposição confirmada. Escritas manuais devem respeitar a mesma chave.

## Edição e status

Edição e mudança de status leem a alocação sob bloqueio dentro da transação.
Ao trocar turma, UC ou período, se houver planejamento antigo ativo e nenhuma
outra alocação ativa para a chave antiga, a edição retorna 409. A operação não
transfere nem cancela uma obrigação manual ou com histórico de forma implícita.
Se houver outra alocação ativa, preserva-se o planejamento antigo e garante-se
o planejamento da nova chave. Trocas sem mudança de chave reaproveitam o existente.

Inativar alocação libera o professor, mas não cancela a obrigação acadêmica da
turma. O planejamento permanece ativo, inclusive quando era a última alocação.
Reativar valida as referências acadêmicas e garante o planejamento na transação.
Repetir a ativação de um registro já ativo também garante a estrutura ausente.

O encerramento ou transferência explícita de planejamento fica para uma etapa
com política própria de ciclo de vida. O bloqueio da edição informa essa necessidade;
não foi criada tela ou rotina de manutenção do planejamento nesta entrega.

## Gestão Docente

O cálculo existente já retorna carga prevista e zero agendado sem fatos.
O filtro por professor passou a aceitar também alocação ativa com a mesma chave,
por EXISTS, sem multiplicar as linhas de planejamento pelo número de professores.
O cálculo de total_professores continua baseado nos fatos de agendamento existentes:
pode retornar zero mesmo que haja docentes alocados. Totais filtrados de professores
diferentes não devem ser somados como obrigações independentes da turma.

## Validação manual pendente — William

O repositório não contém o DDL completo de CursoUcCargaHorariaVersao e
PlanejamentoTurmaUc. Foram usados os campos lidos pela Gestão e os campos de versão
especificados na tarefa. Confirmar campos obrigatórios adicionais, defaults,
tipos e restrições do ambiente antes da implantação. Nenhum esquema foi consultado.

- UC 20h sem versão/planejamento: uma versão de 1200 minutos e um planejamento;
  Gestão no período correspondente com 20h previstas e 0h agendadas, sem fatos.
- Outro professor na mesma chave: o mesmo planejamento e a mesma versão;
  total geral previsto permanece 20h, inclusive com filtros por professor.
- Planejamento manual existente: manter ID e versão, sem duplicação.
- Duas criações concorrentes para a mesma chave: uma estrutura compartilhada;
  eventual falha transacional deve desfazer toda a operação afetada.
- Coletivo PREPARACAO: alocações usuais, nenhuma obrigação acadêmica artificial.
- Edição com outro docente na chave antiga: preservar o antigo e garantir o novo.
- Edição da última alocação que deixaria planejamento ativo sem responsável: 409,
  nenhuma alteração persistida. Inativação preserva a obrigação acadêmica.
- Erro de versão/planejamento: nenhuma alocação, dias ou auditoria parcialmente salvos.

Não houve testes automatizados ou runtime, acesso ao banco ou reinício de serviços.
Integração com Agendamentos, geração de FatoAgendamentoDocente e migração de dados
anteriores ficam para a próxima etapa. Nenhum fato é criado ou alterado aqui.
