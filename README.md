# mastery-scheduler

A mastery estimate that actually moves, and a review date that follows it.

`updateMastery` is Bayesian Knowledge Tracing without the four-parameter fitting theatre: prior in, observation out. `scheduleCard` is SM-2 with the classic intervals. Both are pure functions, so the whole scheduler is testable offline and deterministic on replay.

## Why

Two numbers decide what a learner sees tomorrow: "how well do they know this?" and "when should we ask again?". Most products store a streak and call it mastery. This module keeps them separate, makes both auditable, and never touches the clock directly.

## Quickstart

```sh
node --test test/        # 12 tests, no dependencies
node src/cli.mjs         # updates mastery, schedules, builds a due queue
node verify.mjs          # tests + CLI smoke, writes evidence.json
```

```js
import { updateMastery, scheduleCard, buildQueue } from './src/index.mjs';

updateMastery({ prior: 0.3, correct: true });   // ~0.494
scheduleCard({ repetitions: 0, intervalDays: 1, ease: 2.5 }, 5);
// { ease: 2.6, intervalDays: 1, repetitions: 1, dueInDays: 1 }
```

Final CLI line: `SCHEDULER ok=true`.

## Contract

| Export | Meaning |
|---|---|
| `updateMastery({ prior, correct, slip?, guess?, learn? })` | BKT posterior + learn step, clamped to `[0,1]` |
| `scheduleCard(card, quality)` | SM-2 update from a 0–5 recall quality |
| `nextDue(card, now?)` | ISO timestamp of the next review |
| `buildQueue(cards, now?)` | Ids of due, unsuspended cards, oldest due first |
| `projectRetention(card, now?)` | Forgetting-curve estimate `exp(-overdue / (ease × interval))` |

### `updateMastery`

```
p(correct | known) = 1 - slip
p(correct | unknown) = guess
posterior = prior·p(correct|known) / (prior·p(correct|known) + (1-prior)·p(correct|unknown))
mastery   = posterior + (1 - posterior)·learn
```

Defaults: `prior 0.3`, `slip 0.1`, `guess 0.2`, `learn 0.15`. All four must be in `[0,1]`; `correct` must be a boolean. Denominator zero falls back to the prior instead of producing `NaN`.

### `scheduleCard`

- `quality < 3`: lapse. `ease := max(1.3, ease - 0.2)`, `interval := 1`, `repetitions := 0`.
- `quality ≥ 3`: `repetitions += 1`; interval is 1, then 6, then `round(interval × ease)`.
- Ease delta is `0.1 - (5-q)(0.08 + (5-q)·0.02)`, floored at 1.3.
- Output is rounded to 2 decimals.

### `buildQueue`

Filters out suspended cards and cards without a finite `dueAt`; keeps `due <= now`; sorts by due time, then ease, then id; returns ids only.

### `projectRetention`

Clamps overdue days at zero, so a card reviewed early reads as full retention rather than >1.

## Invariants (tested)

1. Mastery stays within `[0,1]` for every legal input.
2. A correct answer never lowers mastery; a wrong answer never raises it.
3. A lapse resets repetitions and the interval to 1 day.
4. The queue is stable and totally ordered (due, ease, id).
5. Suspended and malformed cards are excluded, not crashed on.
6. Scheduling is pure: same card + quality ⇒ same result, no hidden clock.
7. Out-of-range quality and unit parameters throw `RangeError`.

## Limits

- SM-2 is a heuristic; intervals are not fitted to a population.
- No timezone logic: dates are UTC epoch millis.
- `updateMastery` is one observation at a time; no batch fitting.
- Retention is exponential, not a fitted forgetting curve.

## Permissions

No network, no dependencies, no secrets, no writes. CI requests `contents: read`. See `permission-manifest.json`.

## License

MIT © 2026 Revan
