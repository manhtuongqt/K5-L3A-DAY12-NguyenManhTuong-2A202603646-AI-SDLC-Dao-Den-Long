// Bảng xếp hạng phía client: gọi API của scripts/play.mjs, không có server thì dùng localStorage.
import { makeEntry, insertEntry } from '../leaderboard.js';

const KEY = 'dao-den-long.leaderboard.v1';

function readLocal() {
  try {
    const a = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
function writeLocal(entries) {
  try { window.localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* bỏ qua */ }
}

export async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    const o = await r.json();
    if (!o || !Array.isArray(o.entries)) throw new Error('bad');
    return { entries: o.entries, source: 'server' };
  } catch {
    return { entries: readLocal(), source: 'local' };
  }
}

// trả về { source: 'server' | 'local' }
export async function submitScore({ name, score, nights_won, seed }) {
  const entry = makeEntry({ name, score, nights_won, seed, date: new Date() });
  try {
    const r = await fetch('/api/leaderboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    });
    if (r.ok) return { source: 'server' };
    throw new Error(String(r.status));
  } catch {
    writeLocal(insertEntry(readLocal(), entry));
    return { source: 'local' };
  }
}
