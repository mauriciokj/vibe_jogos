// One background request per page load. The game never waits for analytics.
export async function showVisitorCount(element: HTMLElement, readOnly = false) {
  try {
    readOnly ||= !navigator.cookieEnabled;
    const response = await fetch('/api/visitors?game=asfalto-bruto', {
      method: readOnly ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: readOnly ? {} : {'X-Game-Visit': '1'},
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return;
    const data = await response.json();
    if (!Number.isSafeInteger(data.visitors) || data.visitors < 0 || !Number.isFinite(Date.parse(data.since))) return;
    const total = data.visitors as number;
    element.querySelector('[data-visitor-message]')!.textContent = total === 0
      ? 'Seja a primeira pessoa a tentar a sorte.'
      : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'pessoa já tentou' : 'pessoas já tentaram'} a sorte.`;
    const since = new Date(data.since).toLocaleDateString('pt-BR');
    element.querySelector('[data-visitor-since]')!.textContent = `VISITANTES DESDE ${since}`;
    element.title = 'Estimativa por navegador. Recarregar a página não aumenta o total. Outro dispositivo, janela anônima ou apagar cookies pode contar uma nova visita.';
    element.hidden = false;
  } catch { /* Offline or unavailable: leave the menu and race working normally. */ }
}
