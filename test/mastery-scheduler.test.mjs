// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueue, projectRetention, scheduleCard, updateMastery } from '../src/index.mjs';

test('a correct answer raises the estimate and a wrong one lowers it', () => {
  const up = updateMastery({ prior: 0.4, correct: true });
  const down = updateMastery({ prior: 0.4, correct: false });
  assert.ok(up > 0.4);
  assert.ok(down < 0.4);
});

test('the estimate stays inside [0,1] for extreme priors', () => {
  for (const prior of [0, 0.0001, 0.5, 0.9999, 1]) {
    const up = updateMastery({ prior, correct: true });
    const down = updateMastery({ prior, correct: false });
    assert.ok(up >= 0 && up <= 1, `up ${prior}=${up}`);
    assert.ok(down >= 0 && down <= 1, `down ${prior}=${down}`);
  }
});

test('ten correct answers move mastery above 0.9', () => {
  let p = 0.3;
  for (let i = 0; i < 10; i += 1) p = updateMastery({ prior: p, correct: true });
  assert.ok(p > 0.9, `got ${p}`);
});

test('SM-2 intervals are 1, 6, then interval * ease', () => {
  const first = scheduleCard({}, 5);
  assert.equal(first.repetitions, 1);
  assert.equal(first.intervalDays, 1);
  const second = scheduleCard(first, 5);
  assert.equal(second.repetitions, 2);
  assert.equal(second.intervalDays, 6);
  const third = scheduleCard(second, 5);
  assert.equal(third.repetitions, 3);
  assert.equal(third.intervalDays, Math.round(6 * second.ease));
});

test('quality below 3 resets repetitions and sends the card back tomorrow', () => {
  const learned = { ease: 2.6, intervalDays: 40, repetitions: 4 };
  const reset = scheduleCard(learned, 2);
  assert.equal(reset.repetitions, 0);
  assert.equal(reset.intervalDays, 1);
  assert.equal(reset.dueInDays, 1);
});

test('ease never drops below 1.3', () => {
  let card = { ease: 1.3, intervalDays: 20, repetitions: 5 };
  for (let i = 0; i < 10; i += 1) card = scheduleCard(card, 0);
  assert.equal(card.ease, 1.3);
});

test('quality 5 raises ease, quality 3 lowers it, quality 4 holds it', () => {
  assert.ok(scheduleCard({ ease: 2.5 }, 5).ease > 2.5);
  assert.ok(scheduleCard({ ease: 2.5 }, 3).ease < 2.5);
  assert.equal(scheduleCard({ ease: 2.5 }, 4).ease, 2.5);
});

test('the queue contains only due, unsuspended cards', () => {
  const now = Date.UTC(2026, 0, 10);
  const cards = [
    { id: 'due', dueAt: now - 1000, ease: 2.5 },
    { id: 'future', dueAt: now + 86_400_000, ease: 2.5 },
    { id: 'suspended', dueAt: now - 2000, ease: 2.5, suspended: true },
    { id: 'just-due', dueAt: now, ease: 2.0 },
  ];
  assert.deepEqual(buildQueue(cards, now), ['due', 'just-due']);
});

test('the queue puts the oldest overdue card first, then the easier one', () => {
  const now = 1_000_000_000;
  const cards = [
    { id: 'b', dueAt: now - 5000, ease: 2.5 },
    { id: 'a', dueAt: now - 5000, ease: 1.8 },
    { id: 'c', dueAt: now - 9000, ease: 3.0 },
  ];
  assert.deepEqual(buildQueue(cards, now), ['c', 'a', 'b']);
});

test('the queue is stable for the same input and now', () => {
  const now = 1_700_000_000_000;
  const cards = [
    { id: 'x', dueAt: now - 1, ease: 2.5 },
    { id: 'y', dueAt: now - 2, ease: 1.4 },
    { id: 'z', dueAt: now - 3, ease: 2.0 },
  ];
  assert.deepEqual(buildQueue(cards, now), buildQueue([...cards].reverse(), now));
});

test('retention decays with overdue time and stays in [0,1]', () => {
  const now = 1_000_000_000;
  const fresh = projectRetention({ ease: 2.5, intervalDays: 6, dueAt: now }, now);
  const late = projectRetention({ ease: 2.5, intervalDays: 6, dueAt: now - 30 * 86_400_000 }, now);
  assert.equal(fresh, 1);
  assert.ok(late < fresh);
  assert.ok(late > 0);
});

test('invalid quality and invalid probabilities are refused', () => {
  assert.throws(() => scheduleCard({}, 6), RangeError);
  assert.throws(() => scheduleCard({}, -1), RangeError);
  assert.throws(() => scheduleCard({}, 3.5), RangeError);
  assert.throws(() => updateMastery({ correct: true, prior: 1.1 }), RangeError);
  assert.throws(() => updateMastery({ correct: 'yes' }), TypeError);
});
