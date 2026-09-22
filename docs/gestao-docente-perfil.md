# Perfil individual — Gestão Docente

## Navegação e autorização

- Página: `/gestao-docente/professores/:idProfessor`.
- API: `GET /api/gestao-docente/professores/:idProfessor`.
- Entrada pelo botão Ver perfil ou pelo nome/foto na lista, com o ID real.
- A página usa checkAuth/checkPermissions e a API o middleware administrativo
  existente da Gestão. O serviço valida o ID, cadastro e unidades autorizadas.
  Professor inexistente ou fora do escopo do coordenador retorna 404; unidade
  explicitamente não autorizada retorna 403. Professor comum não acessa a API.
- A lista guarda seus filtros aplicados, página e ordenação no sessionStorage ao
  abrir um perfil. Voltar para lista solicita a restauração; armazenamento é opcional.
  Perfil recebe apenas unidade e datas da lista, não sua busca/curso/situação.

## Fontes e cálculos

`obterPerfilProfessor` fica no serviço existente. Reutiliza pool, controle de
unidades, detecção de colunas opcionais do cadastro e contarLegado.
`obterDashboard` recebeu uma opção interna somentePlanejamentos: executa a mesma
consulta, enriquecerPlanejamento, classificação e totais da Visão Geral, retornando
os planejamentos completos antes de buscar cards/ocorrências exclusivos do dashboard.
O endpoint público do dashboard mantém o comportamento anterior.

Previsto vem da versão aplicável de cada planejamento ativo no período.
Agendado vem da duração dos fatos ativos daquele professor, ligados por ID ao
planejamento e dentro das datas. Vínculo por alocação usa turma/UC/datas iguais;
também se preserva o vínculo explícito já existente nos fatos. EXISTS evita repetir
carga quando há várias alocações. Não há rateio por professor nem soma de carga de
alocação com planejamento. Cada perfil vê a obrigação integral compartilhada;
somar perfis distintos não produz o total único das obrigações da instituição.

Faltantes e excessos são calculados por planejamento e somados, como na Visão Geral:
max(previsto-agendado,0) e max(agendado-previsto,0). Excesso de uma UC não compensa
déficit de outra. Cobertura é soma agendada / soma prevista, sem média dos percentuais.
Sem denominador, o perfil apresenta `--`; acima de 100%, mantém o valor e informa excesso.
Para mesmo professor, unidade e período, os cálculos e classificações são os mesmos
da Visão Geral com esses filtros. Não foi criada uma regra nova de classificação.

Período usa a função compartilhada da Gestão. Planejamento intersectando o período
contribui com sua carga integral, sem rateio diário. Fatos/histórico são limitados
pelas datas selecionadas. O backend fornece os totais e a proporção da rosca;
o frontend apenas formata números e desenha os segmentos. A rosca representa
agendadas e faltantes; excesso já está em agendadas e é destacado na legenda.

## Cadastro e foto

Usa professores/ProfessorUnidade/Unidades, os campos opcionais já identificados
pelo cadastro e foto_url em /imagens. Cabeçalho global continua usando /user-info.
Foto inválida/ausente usa iniciais. Carga semanal vem exclusivamente de
carga_horaria_semanal. Ausência de cadastro é `--`, ausência de registros para uma
métrica válida é 0h. Não há upload, edição ou identidade de professor inventada.

## Histórico e limites do código disponível

Agendamentos são lidos da fonte existente dbo.agendamentos, com sala/unidade por
Salas, filtrados por professor, unidade autorizada e período. Dez registros por
página no backend; ordem decrescente por data, horário e ID. Contagem e listagem
são consultas fixas, sem uma chamada por UC ou agendamento. Planejamentos chegam
em uma consulta agregada e são apresentados em páginas locais de dez itens.

Duração histórica é a diferença dos horários reais em segundos / 60, equivalente
à regra temporal do serviço de Agendamentos, sem blocos por turno. Horários inválidos
ou fim não posterior ao início deixam duração indisponível, sem inventar horas.

Não foi identificado no código um campo confiável ligando cada agendamento bruto
ao fato/planejamento. Portanto turma e UC do histórico ficam `--`; motivo permanece
texto histórico, sem inferência. Isso não altera as UCs estruturadas da tabela
acadêmica, que vêm do planejamento. A contagem de legado reutiliza a marca explícita
LEGADO_NAO_CLASSIFICADO nos fatos ativos. Não é a contagem de todos os agendamentos
brutos e não identifica quais linhas brutas originaram cada fato.

Situação cadastral ativo/inativo e área/curso principal do cadastro não têm fonte
confirmada no código: situação mostra `--` e área principal não é exibida.
William deve confirmar qualquer futura associação desses campos; não houve consulta
ao banco para descobri-los. O resumo de situação conta planejamentos classificados;
fatos legados são mostrados separadamente, sem confundir os dois tipos de registro.

## Interface e validação manual pendente

Seções funcionais: resumo, Unidades Curriculares/planejamentos e últimos agendamentos.
Os links de seção são âncoras reais. Não há abas vazias. Foto, períodos, shell e
tooltips reutilizam o componente comum. Tooltips funcionam por mouse, foco e toque.
Carregamento esconde dados anteriores; respostas antigas não sobrescrevem o período
novo. Erros são amigáveis, sem stack trace. As tabelas têm rolagem própria.

William deve conferir manualmente: entrada pelos dois links; retorno aos filtros;
ID inexistente/inacessível; negativa de API para professor comum; professor sem
planejamento; 20h/0h; excesso; duas alocações compartilhadas; comparação com Visão
Geral usando mesmo professor/unidade/período; períodos personalizados; horários
07:45–11:45 e 19:00–22:40; fotos ausentes/quebradas; paginação e teclado/mobile.

Ficam para depois: edição oficial do professor, disponibilidade, auditoria/histórico
de alterações, abas dedicadas adicionais e vínculo explícito entre agendamentos
brutos e planejamentos. Não foram alterados Agendamentos, Alocação, fatos ou banco.
Nenhuma aplicação, teste runtime, SQL real, Node, PM2 ou serviço foi executado.
