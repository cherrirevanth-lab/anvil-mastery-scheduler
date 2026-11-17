// SPDX-License-Identifier: MIT
/**
 * mastery-scheduler - a mastery estimate that moves, and a review date that
 * follows it.
 *
 * `updateMastery` is Bayesian Knowledge Tracing without the four-parameter
 * fitting theatre: prior in, observation out. `scheduleCard` is SM-2 with the
 * classic intervals. Both are pure, so the whole thing is testable offline.
 */

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function assertUnit(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a number in [0,1]`);
  }
}

export function updateMastery({ prior = 0.3, correct, slip = 0.1, guess = 0.2, learn = 0.15 } = {}) {
  assertUnit('prior', prior);
  assertUnit('slip', slip);
  assertUnit('guess', guess);
  assertUnit('learn', learn);
  if (typeof correct !== 'boolean') throw new TypeError('correct must be a boolean');

  const pCorrect = correct ? 1 - slip : slip;
  const pWrong = correct ? guess : 1 - guess;
  const numerator = prior * pCorrect;
  const denominator = numerator + (1 - prior) * pWrong;
  const posterior = denominator === 0 ? prior : numerator / denominator;
  const learned = posterior + (1 - posterior) * learn;
  return clamp(learned, 0, 1);
}

export function scheduleCard(card = {}, quality) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError('quality must be an integer 0..5');
  }
  const ease = typeof card.ease === 'number' ? card.ease : 2.5;
  const intervalDays = typeof card.intervalDays === 'number' ? card.intervalDays : 1;
  const repetitions = typeof card.repetitions === 'number' ? card.repetitions : 0;

  if (quality < 3) {
    return {
      ease: round(Math.max(1.3, ease - 0.2)),
      intervalDays: 1,
      repetitions: 0,
      dueInDays: 1,
    };
  }

  const nextReps = repetitions + 1;
  const nextInterval = nextReps === 1 ? 1 : nextReps === 2 ? 6 : Math.max(1, Math.round(intervalDays * ease));
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return {
    ease: round(Math.max(1.3, ease + delta)),
    intervalDays: nextInterval,
    repetitions: nextReps,
    dueInDays: nextInterval,
  };
}

export function nextDue(card, now = Date.now()) {
  const base = new Date(now).getTime();
  const scheduled = scheduleCard(card, 4);
  return new Date(base + scheduled.dueInDays * 86_400_000).toISOString();
}

export function buildQueue(cards = [], now = Date.now()) {
  if (!Array.isArray(cards)) throw new TypeError('cards must be an array');
  const at = new Date(now).getTime();
  return cards
    .filter((card) => card && !card.suspended)
    .map((card) => ({ ...card, due: new Date(card.dueAt).getTime() }))
    .filter((card) => Number.isFinite(card.due) && card.due <= at)
    .sort((a, b) => a.due - b.due || (a.ease ?? 2.5) - (b.ease ?? 2.5) || String(a.id).localeCompare(String(b.id)))
    .map((card) => card.id);
}

export function projectRetention(card = {}, now = Date.now()) {
  const ease = Math.max(1.3, card.ease ?? 2.5);
  const interval = Math.max(1, card.intervalDays ?? 1);
  const due = card.dueAt ? new Date(card.dueAt).getTime() : now;
  const overdueDays = Math.max(0, (new Date(now).getTime() - due) / 86_400_000);
  return clamp(Math.exp(-overdueDays / (ease * interval)), 0, 1);
}
