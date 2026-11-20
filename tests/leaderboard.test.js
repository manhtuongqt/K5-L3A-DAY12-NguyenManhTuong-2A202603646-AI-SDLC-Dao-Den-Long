import test from 'node:test';
import assert from 'node:assert/strict';
import { validateName, makeEntry, insertEntry, sortEntries } from '../src/leaderboard.js';

const entry = (name, score = 100, date = '2026-11-20T09:00:00+07:00') =>
  makeEntry({ name, score, nights_won: 2, seed: 42, date });

test('leaderboard: tên ASCII, số, gạch dưới và tiếng Việt có dấu', () => {
  for (const name of ['abc', 'ABC_012', '123456789012', 'Tuấn_Đỗ', 'Mây', 'Nguyễn']) assert.equal(validateName(name), true, name);
  for (const name of ['', 'ab', '1234567890123', 'abc def', 'abc-def', '<b>', 'abc\n', '🌟abc', null, 123]) {
    assert.equal(validateName(name), false, String(name));
  }
});

test('leaderboard: makeEntry lưu đủ trường và ISO có offset', () => {
  assert.deepEqual(entry('Tuấn_Đỗ'), {
    name: 'Tuấn_Đỗ', score: 100, nights_won: 2, seed: 42, achieved_at: '2026-11-20T09:00:00+07:00',
  });
  const date = new Date('2026-11-20T09:30:05.123Z');
  const actual = makeEntry({ name: 'Mây', score: 0, nights_won: 0, seed: 0, date });
  assert.match(actual.achieved_at, /[+-]\d{2}:\d{2}$/);
  assert.equal(Date.parse(actual.achieved_at), date.getTime());
});

test('leaderboard: từ chối tên, điểm, số đêm, seed và ngày không hợp lệ', () => {
  const valid = { name: 'May', score: 10, nights_won: 1, seed: 42, date: new Date(0) };
  for (const patch of [{ name: 'a' }, { score: -1 }, { score: NaN }, { score: 1.2 },
    { nights_won: 4 }, { nights_won: -1 }, { seed: -1 }, { seed: 0x100000000 }, { date: 'invalid' }]) {
    assert.throws(() => makeEntry({ ...valid, ...patch }), TypeError);
  }
});

test('leaderboard: điểm giảm, thời điểm tăng theo instant, giữ thứ tự khi cùng instant', () => {
  const entries = [entry('late', 100, '2026-11-20T10:00:00+07:00'),
    entry('equal1', 100, '2026-11-20T02:00:00+00:00'),
    entry('equal2', 100, '2026-11-20T09:00:00+07:00'),
    entry('high', 101, '2026-11-20T11:00:00+07:00'),
    entry('early', 100, '2026-11-19T23:00:00-02:00')];
  const before = structuredClone(entries);
  assert.deepEqual(sortEntries(entries).map((e) => e.name), ['high', 'early', 'equal1', 'equal2', 'late']);
  assert.deepEqual(entries, before);
});

test('leaderboard: insert giữ top 10 và không đổi mảng gốc', () => {
  const entries = Array.from({ length: 12 }, (_, i) => entry(`user${i}`, i));
  const result = insertEntry(entries, entry('winner', 20));
  assert.equal(entries.length, 12);
  assert.equal(result.length, 10);
  assert.deepEqual(result.map((e) => e.score), [20, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  const first = entry('first');
  assert.deepEqual(insertEntry([first], entry('second')).map((e) => e.name), ['first', 'second']);
});
