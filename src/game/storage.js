// Some browsers disable localStorage for file:// or in private browsing.
// The game remains playable in that case; the HUD reports that saving failed.
export function readStored(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

export function writeStored(key, value) {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}
