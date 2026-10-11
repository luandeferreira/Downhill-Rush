@AGENTS.md

# Downhill Rush

Jogo mobile de corrida de mountain bike descendo a montanha. Visão 2D lateral (estilo Trials / Alto's Adventure), clima arcade, orientação paisagem.

## Modos de jogo

- **Solo**: corrida contra bots.
- **Contra o relógio**: corrida contra o fantasma da melhor volta.
- **Multiplayer local**: mesma rede Wi-Fi, até 4 jogadores; vagas vazias são preenchidas com bots.

## Stack

- Expo SDK 57, TypeScript, expo-router (rotas em `src/app/`)
- `@shopify/react-native-skia` — renderização
- `react-native-reanimated` (+ `react-native-worklets`) — game loop
- `matter-js` — física
- `expo-sensors` (giroscópio), `expo-haptics`, `expo-audio`
- Rede (ainda **não instalada**, entra na etapa 6): `react-native-udp`, `react-native-tcp-socket`, `react-native-zeroconf`. Têm código nativo: exigem development build (`npx expo run:android` / `eas build --profile development`), **não funcionam no Expo Go**.

## Estrutura de pastas

```
src/
  app/            Rotas do expo-router (finas: só importam telas de src/screens)
  screens/        Telas (menu, corrida, lobby, resultados)
  game/
    engine/       Game loop, mundo de física, estado da corrida, input abstrato
    entities/     Ciclista/bike, bots, fantasma
    track/        Geração procedural da pista (seed determinística)
    ai/           Comportamento dos bots
  net/            Descoberta (zeroconf), sincronização UDP/TCP, protocolo
  input/          Toque/giroscópio → `BikeInput` (game/engine/input.ts); ajustes de controle
  render/         Componentes Skia, câmera, conversão de unidades
```

## Convenções

- **TypeScript estrito** (`strict: true`). Sem `any`; prefira tipos discriminados para estados e mensagens de rede.
- **Lógica de jogo pura separada da renderização**: nada em `src/game/` importa React, Skia, Reanimated ou módulos Expo. O jogo é uma função de `(estado, input, dt) → estado`, testável sem dispositivo. Entrada (giroscópio, toque) é convertida para um input abstrato antes de chegar ao `game/`.
- **Unidades**: toda a física e lógica de jogo usa **metros** (e segundos, radianos). A conversão para pixels acontece **somente** em `src/render/units.ts` (`metersToPixels` / `pixelsToMeters`). Nunca use constantes de pixel fora de `src/render/`.
- Pista e bots devem ser determinísticos a partir de uma seed — necessário para fantasma e multiplayer.
- Instale pacotes com `npx expo install` (resolve versões compatíveis com o SDK).
- Antes de concluir uma tarefa: `npx tsc --noEmit` e `npx expo lint`.

## Roteiro

1. **Física** — mundo matter-js com bike (corpo + duas rodas com constraints), terreno estático, passo fixo.
2. **Controles + câmera** — giroscópio/toque para inclinar e pedalar/frear; câmera seguindo o ciclista com suavização.
3. **Pista procedural** — terreno gerado por seed (rampas, gaps, trechos técnicos), chunks carregados sob demanda, linha de chegada.
4. **Bots** — IA que controla a mesma interface de input do jogador, com níveis de dificuldade.
5. **Manobras + boost** — detecção de flips/aéreos, pontuação, barra de boost; modo contra o relógio com fantasma.
6. **Multiplayer LAN** — descoberta via zeroconf, lobby via TCP, estado via UDP, até 4 jogadores + bots.
7. **Polimento** — áudio, haptics, partículas, parallax, menus, ajustes de desempenho.

## Status

Etapa 0 concluída: projeto criado, dependências de renderização/física instaladas, tela inicial.

Etapa 1 implementada (protótipo de física em `/race`, aberto pelo botão "Solo"): pista fixa com 2 gaps, bike com suspensão, passo fixo 60 Hz, câmera suave, debug de FPS/velocidade, Reset. Validada em simulação headless; falta ajuste fino no dispositivo.

Etapa 2 implementada: controles por toque (inclinar trás/frente, ambos = freio, pedalar, pular) ou giroscópio (tela Ajustes, só em memória), detecção de queda com haptics e respawn. Validada em simulação headless; não testada em aparelho.

Decisões de física que valem para as próximas etapas:
- O matter-js roda em escala interna de 50 unidades/m (`src/game/engine/physics-scale.ts`); fora de `game/engine` tudo é metro.
- As rodas **não têm atrito e não giram** no matter (o atrito dele faz círculos quicarem e travarem). Elas deslizam; o giro é só visual (`wheelSpin`). Tração e freio (etapa 2) devem ser forças aplicadas por nós, não atrito.
- A suspensão tem batente de curso em `updateBike` — sem ele pousos duros invertem a roda através do quadro.
- Todo controle chega ao jogo como `BikeInput { lean, pedal, brake, jump }` — toque, giroscópio, bots e rede usam a mesma interface. Pedal/freio/hop são forças nossas (`entities/bike-control.ts`), usando os contatos com o terreno do passo anterior (`engine/contacts.ts`).
- `stepRace` devolve `RaceEvent[]` (queda, respawn, hop, pouso); efeitos colaterais (haptics, som) ficam fora de `game/`.
- Queda: cabeça no chão, pouso com > 60° em relação ao terreno, ou tocar um trecho `pit` (fundo de gap). Respawn após 1,5 s no último ponto seguro ≥ 1 s antes da queda, com a velocidade que tinha.
- Botões de segurar usam react-native-gesture-handler (Pressable não aceita multitoque simultâneo).
- A simulação roda no thread JS (requestAnimationFrame) e publica cada quadro num SharedValue lido pelo Skia.
