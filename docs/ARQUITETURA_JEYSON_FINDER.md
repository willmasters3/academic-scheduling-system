# Arquitetura da JEYSON no Finder

O assistente do Finder é separado do chatbot geral. Seu fluxo é:

```text
SpeechRecognition
→ buffer de utterance
→ sessão conversacional
→ interpretação determinística
→ fallback semântico Ollama (somente quando necessário)
→ validação de entidades no catálogo local
→ busca determinística no dataset da unidade/turno
→ resposta construída pelo código
→ SpeechSynthesis
```

## Componentes

- `agendamentos-voice-core.js`: funções puras de normalização, catálogo, intents, fuzzy, resolução e busca.
- `agendamentos-voice.js`: Web Speech API, estados, timers, buffer, interface, fallback semântico e síntese.
- `agendamentos.js`: ciclo de vida e identidade do dataset da unidade, contexto e destaque.
- `POST /api/finder-voice/interpret`: interpretação semântica opcional por Ollama. O endpoint não consulta nem responde dados reais.

## Estados

- `DISABLED`: assistente desligado.
- `STANDBY`: reconhecimento ativo, aguardando wake word.
- `LISTENING`: fala em andamento e buffer aberto.
- `PROCESSING`: interpretação e busca.
- `RESPONDING`: síntese ativa; reconhecimento interrompido para evitar autoescuta.
- `CONVERSATION`: follow-ups aceitos sem wake word até a expiração.

## Configuração

Os defaults ficam em `AgendamentosVoiceCore.CONFIG`:

- silêncio para concluir fala: `1800 ms`;
- sessão conversacional: `9000 ms`;
- alternativas do reconhecimento: `5`;
- threshold da wake word: `0.72`;
- threshold fuzzy de nomes: `0.86`;
- threshold de nomes curtos: `0.93`;
- margem mínima sobre o segundo candidato: `0.06`.

O diagnóstico detalhado pode ser habilitado no navegador com `localStorage.VOICE_DEBUG = "1"`. Quando desligado, o pipeline não registra nomes/transcripts no console.

## Regras de segurança e consistência

- Ollama interpreta linguagem, mas não informa salas nem escolhe resultados.
- Pessoas, salas e turmas retornadas pelo modelo são validadas no catálogo do dataset atual.
- Consultas determinísticas continuam funcionando sem Ollama.
- A troca de unidade invalida o dataset anterior antes da requisição.
- Cada carregamento recebe uma versão; respostas antigas são descartadas.
- O contexto conversacional é curto e apagado ao expirar.

## Turmas numéricas e proteção de follow-up

O catálogo de turmas também indexa identificadores iniciados por número obtidos diretamente de `motivo`, inclusive valores puramente numéricos. A intenção pode ser inferida por correspondência inequívoca com o catálogo, sem exigir a palavra `turma`. Se o mesmo código existir como sala e turma, palavras de contexto ou a intenção anterior decidem; sem evidência suficiente, o sistema pede esclarecimento.

Cada reinício da Web Speech API cria uma nova instância e um novo `recognitionSessionId`. Ao responder, o buffer e seu timer são cancelados, a sessão atual é invalidada e o reconhecimento é parado antes do SpeechSynthesis. Eventos de IDs antigos são descartados. Ao terminar a síntese, uma nova sessão é criada para `CONVERSATION`.

Falas sem wake word durante `CONVERSATION` passam por um gate. São aceitas apenas quando há entidade forte no catálogo, intenção pendente válida, referência contextual forte ou alternativas corroborantes. Fragmentos sem entidade/contexto suficiente são ignorados silenciosamente.
