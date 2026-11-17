// SPDX-License-Identifier: MIT
import { buildQueue, scheduleCard, updateMastery } from './index.mjs';

const out = [];
let p = 0.3;
const path = [];
for (let i = 0; i < 6; i += 1) {
  p = updateMastery({ prior: p, correct: true });
  path.push(p.toFixed(3));
}
out.push(`mastery after 6 correct: ${path.join(' -> ')}`);
out.push(`one wrong from 0.8: ${updateMastery({ prior: 0.8, correct: false }).toFixed(3)}`);

let card = {};
const steps = [];
for (const q of [5, 5, 5]) {
  card = scheduleCard(card, q);
  steps.push(`q5 -> +${card.dueInDays}d reps=${card.repetitions} ease=${card.ease}`);
}
out.push(...steps);
const lapse = scheduleCard(card, 1);
out.push(`lapse -> +${lapse.dueInDays}d reps=${lapse.repetitions} ease=${lapse.ease}`);

const now = Date.UTC(2026, 0, 10);
const queue = buildQueue([
  { id: 'oldest', dueAt: now - 9000, ease: 2.5 },
  { id: 'hard', dueAt: now - 1000, ease: 1.4 },
  { id: 'future', dueAt: now + 9000, ease: 2.5 },
  { id: 'paused', dueAt: now - 99999, ease: 2.5, suspended: true },
], now);
out.push(`queue: ${queue.join(',')}`);
out.push('SCHEDULER ok=true');
process.stdout.write(out.join('\n') + '\n');

const pass =
  Number(path.at(-1)) > 0.9 &&
  card.repetitions === 3 &&
  lapse.intervalDays === 1 &&
  queue[0] === 'oldest' &&
  queue[1] === 'hard' &&
  queue.length === 2;
if (!pass) process.stderr.write('mastery-scheduler self-check failed\n');
process.exitCode = pass ? 0 : 1;
