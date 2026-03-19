// ---------------------------------------------------------------------------
// localStorage cache for private score data (never stored on-chain in plaintext)
// ---------------------------------------------------------------------------
export const CACHE_KEY = "shadowlend_score_";

export function cacheScore(account, data) {
  try {
    localStorage.setItem(CACHE_KEY + account.toLowerCase(), JSON.stringify({
      score: data.score,
      eligible: data.eligible,
      factors: data.factors,
      rate: data.rate,
      creditLimit: data.creditLimit,
      encryptionMode: data.encryptionMode,
      ciphertext: data.ciphertext,
      timestamp: Date.now(),
    }));
  } catch { /* localStorage full or unavailable */ }
}

export function loadCachedScore(account) {
  try {
    const raw = localStorage.getItem(CACHE_KEY + account.toLowerCase());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
