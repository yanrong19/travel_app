import { expect, test } from 'vitest';
import { onwardState, planningDay, planningState, plannerPath, plannerReturn, readPlannerOpen, readPlanning, readPlanSearch, SEARCH_STATE, searchStep, type Planning } from './planning';

const at = (hops: number, search = '?day=2&view=prefecture:13', day: number | null = null): Planning => ({ tripId: 't1', search, hops, day });

test('planningState starts one hop from the planner and keeps its search', () => {
  expect(planningState('t1', '?day=2&view=prefecture:13')).toEqual({ planning: { tripId: 't1', search: '?day=2&view=prefecture:13', hops: 1, day: null } });
  expect(planningState('t1', 'day=2').planning.search).toBe('?day=2');
  expect(planningState('t1', '').planning.search).toBe('');
});

test('onwardState adds a hop, keeps the trip and search, and carries the bar day', () => {
  const p = planningState('t1', '?day=2').planning;
  expect(onwardState(p).planning).toEqual({ tripId: 't1', search: '?day=2', hops: 2, day: null });
  expect(onwardState(p, 2).planning).toEqual({ tripId: 't1', search: '?day=2', hops: 2, day: 2 });
  expect(onwardState(onwardState(p, 2).planning).planning).toMatchObject({ hops: 3, day: 2 });
});

test('readPlanning reads what planningState and onwardState wrote', () => {
  expect(readPlanning(planningState('t1', '?day=3'))).toEqual({ tripId: 't1', search: '?day=3', hops: 1, day: null });
  expect(readPlanning(onwardState(at(1), 0))).toEqual({ ...at(2), day: 0 });
});

test('readPlanning is null without a planning context', () => {
  for (const s of [null, undefined, 'x', 3, {}, { planning: null }, { planning: 'x' }, { planning: { tripId: '' } }, { planning: { tripId: 4 } }, { notice: 'hi' }]) {
    expect(readPlanning(s)).toBeNull();
  }
});

test('readPlanning repairs a missing search and treats odd hops (0) and days (null) as unknown', () => {
  expect(readPlanning({ planning: { tripId: 't1' } })).toEqual({ tripId: 't1', search: '', hops: 0, day: null });
  expect(readPlanning({ planning: { tripId: 't1', search: 'day=2', hops: 1.5, day: -1 } })).toEqual({ tripId: 't1', search: '?day=2', hops: 0, day: null });
  expect(readPlanning({ planning: { tripId: 't1', search: '', hops: -1, day: 'x' } })).toMatchObject({ hops: 0, day: null });
});

test('plannerPath is the trip page with the search, on another day when asked', () => {
  expect(plannerPath(at(1))).toBe('/trips/t1?day=2&view=prefecture:13');
  expect(plannerPath({ ...at(1), tripId: 'a b', search: '' })).toBe('/trips/a%20b');
  expect(plannerPath(at(1), 1)).toBe('/trips/t1?day=2&view=prefecture:13');
  expect(plannerPath(at(1), 2)).toBe('/trips/t1?day=3&view=prefecture%3A13');
  // No day in the search means the first day.
  expect(plannerPath(at(1, ''), 0)).toBe('/trips/t1');
  expect(plannerPath(at(1, ''), 1)).toBe('/trips/t1?day=2');
});

test('planningDay: the carried day, else the planner search day, clamped to the trip', () => {
  expect(planningDay(at(1, '?day=2&place=1'), 3)).toBe(1);
  expect(planningDay(at(1, ''), 3)).toBe(0);
  expect(planningDay(at(1, '?day=9'), 3)).toBe(2);
  expect(planningDay(at(1, '?day=0'), 3)).toBe(0);
  expect(planningDay(at(1, '?day=x'), 3)).toBe(0);
  expect(planningDay(at(1, '?day=1.5'), 3)).toBe(0);
  expect(planningDay(at(2, '?day=2', 2), 3)).toBe(2);
  expect(planningDay(at(2, '?day=2', 7), 3)).toBe(2);
});

test('plannerReturn steps back when the planner is the previous entry and nothing changed', () => {
  expect(plannerReturn(at(1))).toEqual({ kind: 'back' });
  expect(plannerReturn(at(1), { day: 1 })).toEqual({ kind: 'back' });
});

test('plannerReturn with a changed day steps back and replaces the planner entry with the new day', () => {
  expect(plannerReturn(at(1), { day: 2 })).toEqual({ kind: 'back-replace', to: '/trips/t1?day=3&view=prefecture%3A13', state: undefined });
});

test('plannerReturn with a card to open steps back and replaces, with the card in state', () => {
  expect(plannerReturn(at(1), { day: 1, open: 'senso-ji' })).toEqual({ kind: 'back-replace', to: '/trips/t1?day=2&view=prefecture:13', state: { open: 'senso-ji' } });
});

test('plannerReturn pushes the planner URL when it is not the previous entry', () => {
  expect(plannerReturn(at(2))).toEqual({ kind: 'push', to: '/trips/t1?day=2&view=prefecture:13', state: undefined });
  expect(plannerReturn(at(0), { day: 2, open: 'x' })).toEqual({ kind: 'push', to: '/trips/t1?day=3&view=prefecture%3A13', state: { open: 'x' } });
});

test('readPlannerOpen reads the card to open', () => {
  expect(readPlannerOpen({ open: 'senso-ji' })).toBe('senso-ji');
  for (const s of [null, undefined, {}, { open: '' }, { open: 3 }, 'x']) expect(readPlannerOpen(s)).toBeNull();
});

test('readPlanSearch is true only for the open search’s own state', () => {
  expect(readPlanSearch(SEARCH_STATE)).toBe(true);
  for (const s of [null, undefined, {}, { planSearch: 'yes' }, { planSearch: 1 }, { open: 'senso-ji' }, 'x']) expect(readPlanSearch(s)).toBe(false);
  // The search's entry is never mistaken for a card to open, or a card's for the search.
  expect(readPlannerOpen(SEARCH_STATE)).toBeNull();
});

test('searchStep closes cleanly, even off a doubled search entry', () => {
  const at = (open: boolean, wasOpen: boolean, leaving: boolean, narrow = true) => searchStep({ open, wasOpen, leaving, narrow });
  // Opening: nothing more to do.
  expect(at(true, false, false)).toBe('stay');
  // A close stepped back onto the planner: closed.
  expect(at(false, true, true)).toBe('closed');
  // The Back gesture closed it (no close asked for): closed all the same.
  expect(at(false, true, false)).toBe('closed');
  // A close landed on a second search entry (a double tap pushed two): step back again.
  expect(at(true, true, true)).toBe('back');
  // The Back gesture from the second entry onto the first: the search stays open, as the user sees it.
  expect(at(true, true, false)).toBe('stay');
  // Widened to a laptop with the search open: step back off it, so no stray entry stays.
  expect(at(true, true, false, false)).toBe('back');
  expect(at(true, false, false, false)).toBe('back');
  // Nothing open, nothing was: nothing to do.
  expect(at(false, false, false)).toBe('stay');
  expect(at(false, false, true, false)).toBe('stay');
});
