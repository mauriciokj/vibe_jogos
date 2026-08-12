(function configureCrazyGamesPlatform() {
  const query = new URLSearchParams(window.location.search);
  const hostname = window.location.hostname.toLowerCase();
  const requestedPlatform = String(query.get('platform') || '').toLowerCase();
  const isCrazyGames =
    requestedPlatform === 'crazygames' ||
    hostname === 'crazygames.com' ||
    hostname.endsWith('.crazygames.com');

  if (!isCrazyGames) return;

  const previousConfig =
    window.RIO_DE_ACO_CONFIG && typeof window.RIO_DE_ACO_CONFIG === 'object'
      ? window.RIO_DE_ACO_CONFIG
      : {};
  const previousEventHandler =
    typeof previousConfig.onEvent === 'function' ? previousConfig.onEvent : null;
  const state = {
    sdk: null,
    available: false,
    loadingComplete: false,
    gameplayActive: false,
    gameLoaded: false,
    settingsListener: null,
  };

  function loadSdkScript() {
    if (window.CrazyGames?.SDK) return Promise.resolve(window.CrazyGames.SDK);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
      script.async = true;
      script.onload = () => resolve(window.CrazyGames?.SDK || null);
      script.onerror = () => reject(new Error('CrazyGames SDK could not be loaded'));
      document.head.appendChild(script);
    });
  }

  function setExternalMute(muted) {
    window.RIO_DE_ACO_PLATFORM?.setExternalMute(Boolean(muted));
  }

  function applySettings(settings = state.sdk?.game?.settings) {
    setExternalMute(settings?.muteAudio === true);
  }

  function gameplayStart() {
    if (!state.available || state.gameplayActive) return;
    state.sdk.game.gameplayStart();
    state.gameplayActive = true;
  }

  function gameplayStop() {
    if (!state.available || !state.gameplayActive) return;
    state.sdk.game.gameplayStop();
    state.gameplayActive = false;
  }

  function finishLoading() {
    if (!state.available || state.loadingComplete) return;
    state.sdk.game.loadingStop();
    state.loadingComplete = true;
  }

  function handleGameEvent(event) {
    previousEventHandler?.(event);
    if (!state.available) return;

    switch (event.type) {
      case 'game_loaded':
        state.gameLoaded = true;
        finishLoading();
        applySettings();
        break;
      case 'run_started':
        state.sdk.game.setGameContext?.({
          mode: String(event.payload.mode || 'classic'),
          round: String(event.payload.round || 1),
        });
        gameplayStart();
        break;
      case 'run_resumed':
      case 'player_respawned':
        gameplayStart();
        break;
      case 'run_paused':
      case 'player_crashed':
        gameplayStop();
        break;
      case 'run_ended':
        gameplayStop();
        state.sdk.game.clearGameContext?.();
        break;
      default:
        break;
    }
  }

  window.RIO_DE_ACO_CONFIG = {
    ...previousConfig,
    platform: 'crazygames',
    locale: 'en',
    externalFullscreen: true,
    onEvent: handleGameEvent,
  };

  const initializeSdk = async () => {
    try {
      const sdk = await loadSdkScript();
      if (!sdk) return state;
      await sdk.init();
      state.sdk = sdk;
      state.available = sdk.environment === 'local' || sdk.environment === 'crazygames';
      if (!state.available) return state;

      sdk.game.loadingStart();
      state.settingsListener = (settings) => applySettings(settings);
      sdk.game.addSettingsChangeListener?.(state.settingsListener);
      applySettings();
      if (state.gameLoaded) finishLoading();
    } catch (error) {
      console.warn('CrazyGames SDK unavailable; continuing without platform services.', error);
    }
    return state;
  };

  window.RIO_DE_ACO_PLATFORM_READY = Promise.race([
    initializeSdk(),
    new Promise((resolve) => window.setTimeout(() => resolve(state), 4500)),
  ]);
})();
