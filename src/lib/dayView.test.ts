import { expect, test } from 'vitest';
import { readDayView, writeDayView } from './dayView';

const q = (s: string) => new URLSearchParams(s);

test('Plan with the toggle off is the default and leaves no params', () => {
  expect(readDayView(q('day=2&place=1'))).toEqual({ tab: 'plan', wet: false });
  expect(writeDayView(q('day=2&tab=browse&wet=1'), { tab: 'plan', wet: false }).toString()).toBe('day=2');
});

test('wet=1 turns the toggle on, on either sub-tab; anything else leaves it off', () => {
  expect(readDayView(q('wet=1'))).toEqual({ tab: 'plan', wet: true });
  expect(readDayView(q('tab=browse&wet=1'))).toEqual({ tab: 'browse', wet: true });
  expect(readDayView(q('wet=0'))).toEqual({ tab: 'plan', wet: false });
  expect(readDayView(q('wet=true'))).toEqual({ tab: 'plan', wet: false });
});

test('an old link’s tab=wet opens Plan with the toggle on; an unknown tab is Plan', () => {
  expect(readDayView(q('tab=wet'))).toEqual({ tab: 'plan', wet: true });
  expect(readDayView(q('tab=summary'))).toEqual({ tab: 'plan', wet: false });
});

test('writing one part keeps the other and the rest of the search', () => {
  const on = writeDayView(q('day=3&place=2&view=region:kanto&tab=browse'), { wet: true });
  expect(readDayView(on)).toEqual({ tab: 'browse', wet: true });
  expect([on.get('day'), on.get('place'), on.get('view')]).toEqual(['3', '2', 'region:kanto']);
  const plan = writeDayView(on, { tab: 'plan' });
  expect(plan.toString()).toBe('day=3&place=2&view=region%3Akanto&wet=1');
  // The old tab=wet is rewritten as the toggle.
  expect(writeDayView(q('tab=wet'), { tab: 'browse' }).toString()).toBe('tab=browse&wet=1');
});

test('writing never changes the search it was given', () => {
  const p = q('tab=browse');
  writeDayView(p, { wet: true, tab: 'plan' });
  expect(p.toString()).toBe('tab=browse');
});
