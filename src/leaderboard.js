// Shared by the browser and the local Node server. Sorting never mutates callers.
export function validateName(name) {
  return typeof name === 'string' && /^[\p{L}\p{N}_]{3,12}$/u.test(name);
}

function isoWithOffset(date) {
  // Retain a supplied ISO offset rather than sorting dates lexicographically.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date))) return date;
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) throw new TypeError('Invalid achievement date');
  const pad = (n) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}` +
    `${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

export function makeEntry({ name, score, nights_won, seed, date = new Date() }) {
  if (!validateName(name)) throw new TypeError('Name must contain 3–12 letters, numbers or underscores');
  if (!Number.isSafeInteger(score) || score < 0) throw new TypeError('Invalid score');
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) throw new TypeError('Invalid nights_won');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError('Invalid seed');
  return { name, score, nights_won, achieved_at: isoWithOffset(date), seed };
}

export function sortEntries(entries) {
  // Array.sort is stable: an exact tie retains insertion order.
  return [...entries].sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
}

export function insertEntry(entries, entry) {
  return sortEntries([...entries, entry]).slice(0, 10);
}
