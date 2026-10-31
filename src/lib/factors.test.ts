import { expect, test } from 'vitest';
import { attractionById } from '../data/attractions';
import { flags, unflagged } from './factors';

const get = (id: string) => attractionById(id)!;

test('an etiquette flag keeps its first sentence; the rest rides along as its note', () => {
  const f = flags(get('takeshita-street')).find((x) => x.line === 'vibe')!;
  expect(f.text).toBe('Finish your crêpe beside the stand');
  expect(f.note).toBe('Eating while walking the packed lane is frowned on.');
});

test('a one-sentence etiquette flag has no note', () => {
  const f = flags(get('golden-gai')).find((x) => x.line === 'vibe')!;
  expect(f.text).toBe('Some bars ban photos, and a few are for regulars only');
  expect(f.note).toBeUndefined();
});

test('a place with nothing easy to miss has no flags', () => {
  expect(flags(get('senso-ji'))).toEqual([]);
});

test('the months flag carries the months note; unflagged() drops a note a flag already says', () => {
  const sumo = get('ryogoku-sumo');
  const fl = flags(sumo).filter((x) => x.line === 'conditions');
  expect(fl.map((x) => x.text)).toContain('Tokyo tournaments run only in January, May and September');
  expect(unflagged(sumo.conditions.monthsNote, fl)).toBeUndefined();
  const senso = get('senso-ji');
  expect(unflagged(senso.conditions.monthsNote, [])).toBe(senso.conditions.monthsNote);
  expect(unflagged(undefined, [])).toBeUndefined();
});
