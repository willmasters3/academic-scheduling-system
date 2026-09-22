# Gestão Docente — lista geral de professores

## Escopo entregue

Página `/gestao-docente/professores`, API `GET /api/gestao-docente/professores`.
Sem perfil individual, edição, upload, exportação ou alterações nos fatos/alocações.
O menu, cabeçalho, avatar e os períodos são compartilhados com a Visão Geral em
`gestao-docente-common.js`. A Visão Geral mantém seus cálculos existentes.

## Cadastro e autorização

Origem: `professores` e `ProfessorUnidade`, como no serviço de professores do
Agendamento. Não se inventa filtro por situação cadastral ou nova distinção de
perfil de docente. Registros do cadastro podem incluir coordenadores/admins.
Cada ID aparece uma vez, com suas unidades permitidas; administrador sem filtro
também vê docentes sem vínculo de unidade. Coordenador só vê as unidades autorizadas.

Turno e jornada usam `turno_principal` e `carga_horaria_semanal`, não cargas de UC.
A detecção de colunas opcionais reutiliza `getProfessorOptionalColumns` do cadastro.
Se a coluna de turno não existir, seu filtro é omitido e a API rejeita o parâmetro.
Campos ausentes aparecem como `--`. Métricas válidas sem registros aparecem como 0h;
cobertura sem carga prevista aparece como `--`.

Foto: `foto_url`, gravada pelo cadastro/perfil em `/imagens/<arquivo>`, servida pelo
servidor existente. Falha, URL inválida ou ausência usa iniciais. Cabeçalho lê
`foto_url` de `/user-info`, a mesma sessão do Agendamento; antes havia apenas ícone.
Nenhum caminho de foto individual foi fixado, nenhum upload/armazenamento criado.

A rota de página usa `checkAuth` + `checkPermissions`; a API permanece sob
`requireAuthenticatedSession` + `requireManagement` (admin/coordenador).
As restrições de unidade são reaproveitadas no serviço, para cadastro e planejamentos.
Não houve mudança de autorização do Agendamento.

## Filtros e períodos

- Unidade restringe cadastro, unidades exibidas e obrigações acadêmicas.
- Professor busca trecho do nome via parâmetro; comparação segue a collation existente.
- Turno procura o turno cadastrado, inclusive listas separadas por vírgulas do perfil.
  Não infere turno principal a partir das alocações.
- Período: mês atual, semana atual, próxima semana e datas personalizadas. Usa a
  função compartilhada extraída da Visão Geral. Considera a carga integral do
  planejamento que intersecta o período; não faz rateio diário.
- Curso seleciona obrigações do curso. Docentes sem planejamento desse curso
  não entram nesse filtro, inclusive na combinação curso + sem planejamento.
- Situação filtra as próprias obrigações pela classificação da Visão Geral.
  Linhas e indicadores consideram somente esses planejamentos. Sem planejamento
  seleciona docentes sem obrigação aplicável; com os demais filtros livres,
  docentes sem alocação continuam visíveis.

Aplicar captura os filtros; paginação, ordenação e Atualizar usam os filtros
aplicados, sem aplicar silenciosamente valores ainda em edição no formulário.
Limpar restaura mês atual e filtros livres.

## Métricas e compartilhamento

Vínculo docente/planejamento: alocação ativa com turma + UC + datas exatamente
iguais, ou fato ativo já vinculado no período (preserva o vínculo histórico real).
`UNION` elimina repetição de professor/planejamento. Nenhuma inferência por texto.
Planejamento precisa estar ATIVO e ter versão aplicável. Fatos são agregados por
planejamento/professor, somente ATIVOS e dentro das datas selecionadas.

Por linha: carga integral de cada obrigação vinculada, uma vez por ID de
planejamento; agendado do próprio docente; faltante/excesso apurados por obrigação
como max(previsto-agendado,0) e max(agendado-previsto,0), respectivamente.
A jornada contratual é independente. Cobertura preserva valores acima de 100%;
apenas a largura da barra é limitada à área disponível.

Indicadores gerais: união dos planejamentos das linhas filtradas, sem repetir a
carga quando há vários professores. Agendado soma fatos dos professores filtrados
uma única vez. Cobertura é agendado total / previsto único × 100. Faltantes e
excessos são somados por obrigação, sem compensar déficit de uma UC com excesso de outra.
Trocar página não altera indicadores. Somar as cargas individuais de obrigações
compartilhadas não reproduz o total geral, por definição; a tela explica isso.

Não há regra nova de situação agregada do professor: exibem-se contagens das
classificações de seus planejamentos. `enriquecerPlanejamento` e
`classificarPlanejamento` são reutilizadas sem alteração. A situação considera a
obrigação completa (horas de todos os docentes), coerente com a Visão Geral;
uma linha pode ter saldo individual e situação adequada no planejamento compartilhado.
Sem situação cadastral comprovada no código, não se exibe um selo “Ativo” inventado.

## Paginação e desempenho

Limite de 10, 25, 50 ou 100 linhas na resposta, padrão 25. Ordenação global por nome,
previsto, agendado, faltante ou cobertura; desempate por ID. Cobertura nula fica no fim.
Filtros e somas são feitos no backend; nenhuma lista histórica de agendamentos é
enviada ao navegador. Consultas em lote, sem chamada por docente.

IDs/nomes e agregados do conjunto filtrado são lidos para produzir classificação,
totais e ordenação no serviço; somente depois a página é recortada. Dados completos
de perfil/foto são buscados em lote apenas para os IDs dessa página. Esse processamento
dos resumos ainda cresce com o conjunto filtrado; não é paginação SQL de todas as
métricas. A decisão permite reutilizar a classificação JavaScript existente sem
duplicá-la em SQL. Filtros de inicialização não carregam a lista inteira de professores.

## Apresentação e validação manual

Tabela com rolagem horizontal própria, nomes longos, estados de carregamento,
erro e vazio. Respostas antigas não substituem filtros mais recentes. Tooltips por
hover, foco e toque/clique; Esc fecha. Azul previsto, verde agendado, roxo cobertura
e excesso, âmbar para faltantes associados a planejamento em atenção/crítico.
As legendas se referem a registros, nunca a faltas ou execução real das aulas.

William deve validar: acesso admin/coordenador e negativa de professor comum,
escopo de unidades, foto existente/quebrada/ausente, dois professores compartilhando
20h com total geral de 20h, ausência de fatos, cobertura acima de 100%, zero previsto,
filtros combinados, ordenação, navegação entre páginas, teclado e largura de celular.

Não houve acesso ao banco, execução SQL, aplicação, testes runtime ou reinício.
Confirmar manualmente a presença/preenchimento das colunas opcionais, os arquivos
referenciados por foto_url e a collation usada na busca. Não há coluna de situação
cadastral presumida nem campo de área/curso principal inventado.
Perfil individual e exportação ficam para a próxima etapa.
