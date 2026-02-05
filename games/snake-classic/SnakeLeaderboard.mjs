const MAX_NAME_LENGTH = 12;

export function normalizePlayerName(rawName) {
  const cleaned = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Jogador';
  return cleaned.slice(0, MAX_NAME_LENGTH);
}

export function addLeaderboardEntry(entries, entry, limit = 10) {
  const next = [...entries, {
    name: normalizePlayerName(entry.name),
    score: Number(entry.score) || 0,
    at: entry.at ?? Date.now(),
  }];

  next.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.at - b.at;
  });

  return next.slice(0, limit);
}

export function loadLeaderboard(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(Number(entry.score)))
      .map((entry) => ({
        name: normalizePlayerName(entry.name),
        score: Number(entry.score),
        at: Number(entry.at) || 0,
      }));
  } catch {
    return [];
  }
}

export function saveLeaderboard(storage, key, entries) {
  storage.setItem(key, JSON.stringify(entries));
}

export function parseLeaderboardPayload(payload) {
  if (!payload || !Array.isArray(payload.entries)) return [];
  return payload.entries
    .filter((entry) => entry && typeof entry.name === 'string' && Number.isFinite(Number(entry.score)))
    .map((entry) => ({
      name: normalizePlayerName(entry.name),
      score: Number(entry.score),
      at: Number(entry.at) || 0,
    }));
}

export async function fetchLeaderboard(apiUrl) {
  const response = await fetch(apiUrl, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Leaderboard request failed: ${response.status}`);
  }

  const payload = await response.json();
  return parseLeaderboardPayload(payload);
}

export async function submitLeaderboardScore(apiUrl, entry) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: normalizePlayerName(entry.name),
      score: Number(entry.score) || 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Leaderboard submit failed: ${response.status}`);
  }

  const payload = await response.json();
  return {
    entries: parseLeaderboardPayload(payload),
    position: Number.isInteger(payload.position) ? payload.position : null,
  };
}
