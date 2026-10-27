import { expect, test } from 'vitest';
import { backTarget, onwardState, planningDay, planningState, plannerPath, readPlanning } from './planning';

test('planningState starts one hop from the planner and keeps its search', () => {
  expect(planningState('t1', '?day=2&view=prefecture:13')).toEqual({ planning: { tripId: 't1', search: '?day=2&view=prefecture:13', hops: 1 } });
  expect(planningState('t1', 'day=2').planning.search).toBe('?day=2');
  expect(planningState('t1', '').planning.search).toBe('');
});

test('onwardState adds a hop and keeps the trip and search', () => {
  const p = planningState('t1', '?day=2').planning;
  expect(onwardState(p).planning).toEqual({ tripId: 't1', search: '?day=2', hops: 2 });
  expect(onwardState(onwardState(p).planning).planning.hops).toBe(3);
});

test('readPlanning reads what planningState wrote', () => {
  expect(readPlanning(planningState('t1', '?day=3'))).toEqual({ tripId: 't1', search: '?day=3', hops: 1 });
});

test('readPlanning is null without a planning context', () => {
  for (const s of [null, undefined, 'x', 3, {}, { planning: null }, { planning: 'x' }, { planning: { tripId: '' } }, { planning: { tripId: 4 } }, { notice: 'hi' }]) {
    expect(readPlanning(s)).toBeNull();
  }
});

test('readPlanning repairs a missing search and treats odd hops as unknown (0)', () => {
  expect(readPlanning({ planning: { tripId: 't1' } })).toEqual({ tripId: 't1', search: '', hops: 0 });
  expect(readPlanning({ planning: { tripId: 't1', search: 'day=2', hops: 1.5 } })).toEqual({ tripId: 't1', search: '?day=2', hops: 0 });
  expect(readPlanning({ planning: { tripId: 't1', search: '', hops: -1 } })?.hops).toBe(0);
});

test('plannerPath is the trip page with the search', () => {
  expect(plannerPath({ tripId: 't1', search: '?day=2&view=prefecture:13', hops: 1 })).toBe('/trips/t1?day=2&view=prefecture:13');
  expect(plannerPath({ tripId: 'a b', search: '', hops: 1 })).toBe('/trips/a%20b');
});

test('planningDay reads the 1-based day and clamps it to the trip', () => {
  expect(planningDay('?day=2&place=1', 3)).toBe(1);
  expect(planningDay('', 3)).toBe(0);
  expect(planningDay('?day=9', 3)).toBe(2);
  expect(planningDay('?day=0', 3)).toBe(0);
  expect(planningDay('?day=x', 3)).toBe(0);
  expect(planningDay('?day=1.5', 3)).toBe(0);
});

test('backTarget steps back in history only when the planner is the previous entry', () => {
  expect(backTarget({ tripId: 't1', search: '?day=2', hops: 1 })).toEqual({ delta: -1 });
  expect(backTarget({ tripId: 't1', search: '?day=2', hops: 2 })).toEqual({ to: '/trips/t1?day=2' });
  expect(backTarget({ tripId: 't1', search: '?day=2', hops: 0 })).toEqual({ to: '/trips/t1?day=2' });
});
