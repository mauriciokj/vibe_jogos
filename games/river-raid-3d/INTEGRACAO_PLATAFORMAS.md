# Integração de plataformas — Rio de Aço 3D

Esta camada permite conectar portais, aplicativos e SDKs de anúncios sem criar versões diferentes do jogo. Sem configuração externa, nenhum anúncio é solicitado ou exibido.

## Configuração antes de carregar o jogo

Defina `window.RIO_DE_ACO_CONFIG` antes do script principal:

```html
<script>
  window.RIO_DE_ACO_CONFIG = {
    platform: 'portal-exemplo',
    leaderboardApiUrl: 'https://vibe-jogos.vercel.app/api/leaderboard/',
    onEvent(event) {
      console.log(event.type, event.payload);
    },
    ads: {
      async showInterstitial(context) {
        // Chame o SDK do portal e aguarde o fechamento.
        return { shown: true };
      },
      async showRewarded(context) {
        // Informe rewarded somente após a conclusão exigida pelo portal.
        return { shown: true, rewarded: true };
      },
    },
  };
</script>
```

## Eventos padronizados

Todo evento contém `type`, `at`, `game`, `version`, `platform` e `payload`. Ele é entregue simultaneamente ao callback `onEvent` e como `CustomEvent` global `rio-de-aco:event`.

Eventos atuais:

- `game_loaded`
- `run_started`
- `run_paused`
- `run_resumed`
- `run_ended`
- `player_crashed`
- `player_respawned`
- `entity_destroyed`
- `environment_changed`
- `score_submitted`
- `preference_changed`
- `ad_unavailable`
- `ad_started`
- `ad_finished`
- `ad_error`

## API disponível em execução

```js
await window.RIO_DE_ACO_PLATFORM.requestInterstitial('game_over');

const result = await window.RIO_DE_ACO_PLATFORM.requestRewarded('continue');
if (result.rewarded) {
  // A recompensa deve ser concedida explicitamente pela futura regra do jogo.
}

const state = window.RIO_DE_ACO_PLATFORM.getState();
```

Anúncios iniciados durante uma partida pausam o jogo, soltam os controles pressionados, silenciam o motor e retomam somente quando a Promise do provedor termina. Solicitações sem provedor configurado retornam `{ shown: false, reason: 'unavailable' }` sem interromper a partida.

## Política inicial de publicidade

Quando o primeiro provedor for conectado, serão usados somente dois pontos:

1. **Entre partidas:** anúncio intersticial depois do Game Over e antes de iniciar uma nova missão, respeitando intervalo mínimo para não aparecer em toda tentativa.
2. **Vida extra opcional:** anúncio recompensado oferecido por um botão explícito. A vida só será concedida quando o provedor confirmar `rewarded: true`.

Não serão usados banners permanentes, anúncios durante combate, anúncios a cada ponte ou interrupções automáticas no meio de uma missão.

## Regras para integrações futuras

- Não mostrar anúncio no meio de combate sem uma regra de produto aprovada.
- Não conceder recompensa quando `rewarded` for falso.
- Aguardar o SDK terminar antes de resolver a Promise do adaptador.
- Preservar os links de privacidade e suporte do menu.
- Registrar novos tipos de evento neste documento e no changelog.
