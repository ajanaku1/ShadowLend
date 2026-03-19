import { EXPLORER_BASE } from "../config/constants";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HX = "0123456789abcdef";
export const rh = (n) => {
  let s = "0x";
  for (let i = 0; i < n; i++) s += HX[Math.floor(Math.random() * 16)];
  return s;
};

export const truncAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");
export const truncHash = (h) => (h ? `${h.slice(0, 10)}...` : "");
export const txLink = (hash) => hash ? `${EXPLORER_BASE}${hash}` : null;

// Max borrow = score mapped linearly: 650->$1,000 .. 850->$10,000
export function getMaxBorrow(score) {
  if (!score || score < 650) return 0;
  return Math.trunc(1000 + ((score - 650) / 200) * 9000);
}

export function getQuickAmounts(maxBorrow) {
  const max = Math.floor(maxBorrow);
  if (max <= 0) return [];
  const pcts = [0.25, 0.5, 0.75, 1];
  return pcts.map((p) => {
    const raw = Math.round((max * p) / 100) * 100; // round to nearest 100
    return Math.max(100, Math.min(raw, max));
  }).filter((v, i, a) => a.indexOf(v) === i); // dedupe
}

// Interest rate: 650->8%, 850->2% (matches agent's getRate)
export function getInterestRate(score) {
  if (!score || score <= 650) return 8;
  if (score >= 850) return 2;
  return parseFloat((8 - ((score - 650) / 200) * 6).toFixed(1));
}

export function getScoreColor(eligible) {
  return eligible ? "var(--green)" : "var(--rose)";
}
