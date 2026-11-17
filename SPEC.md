# SPEC — mastery-scheduler

## Purpose

Two independent, pure policies: how mastery changes after an observation, and when a card is due again. No I/O, no clock reads, no randomness.

## API

### `updateMastery({ prior = 0.3, correct, slip = 0.1, guess = 0.2, learn = 0.15 }) → number`

Bayesian Knowledge Tracing, one step.

- `prior`, `slip`, `guess`, `learn` are numbers in `[0,1]`; anything else throws `RangeError`.
- `correct` must be a boolean; otherwise `TypeError`.
- Likelihoods: `P(obs|known) = correct ? 1-slip : slip`; `P(obs|unknown) = correct ? guess : 1-guess`.
- Posterior is the normalised product; if the denominator is 0, the prior is used.
- Final value: `posterior + (1-posterior)·learn`, clamped to `[0,1]`.

### `scheduleCard(card = {}, quality) → { ease, intervalDays, repetitions, dueInDays }`

- `quality` integer 0–5, else `RangeError`.
- Defaults: `ease 2.5`, `intervalDays 1`, `repetitions 0`.
- Lapse (`q < 3`): `ease = max(1.3, ease-0.2)`, `intervalDays = 1`, `repetitions = 0`.
- Pass: `reps+1`; interval `1` for the first, `6` for the second, else `max(1, round(interval·ease))`.
- Ease delta: `0.1 - (5-q)·(0.08 + (5-q)·0.02)`; ease floored at 1.3.
- All numbers rounded to two decimals.

### `nextDue(card, now = Date.now()) → ISO string`

Applies `scheduleCard(card, 4)` and adds `dueInDays × 86_400_000` to `now`.

Note: it always assumes a quality-4 review; callers that have a real quality should call `scheduleCard` and add the interval themselves.

### `buildQueue(cards = [], now = Date.now()) → string[]`

1. Drop falsy and `suspended` cards.
2. Require a finite `dueAt`.
3. Keep `due <= now`.
4. Sort by `due`, then `ease ?? 2.5`, then `String(id).localeCompare`.
5. Return ids.

### `projectRetention(card = {}, now = Date.now()) → number in [0,1]`

`exp(-overdueDays / (max(1.3, ease) × max(1, intervalDays)))`, clamped. Cards not yet due have `overdueDays = 0`, i.e. retention 1.

## Invariants

1. Monotonicity: `updateMastery(..., correct: true)` ≥ input prior, and `correct: false` ≤ it (given legal parameters).
2. Range: outputs are always in `[0,1]`.
3. Lapse reset: quality below 3 always yields `repetitions = 0`, `intervalDays = 1`.
4. Determinism: no function reads a clock except through an explicit `now` argument.
5. Total order: `buildQueue` output does not depend on input order.
6. Rejection: invalid quality/unit values throw before any state is touched.

## Known limits

- SM-2 ignores individual response time and confidence.
- The `nextDue` helper fixes quality at 4; it is a convenience, not a model.
- No leech handling, no maximum interval, no fuzz.
- Dates are UTC; local-day scheduling belongs to a caller.

## Test map

`test/mastery-scheduler.test.mjs` — correct/incorrect movement, clamping, invalid units, lapse and pass intervals, ease floor, rounding, queue filtering/order, retention bounds, `nextDue` arithmetic, determinism.
