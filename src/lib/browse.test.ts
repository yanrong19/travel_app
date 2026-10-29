import { describe, expect, test } from 'vitest';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import {
  BROWSE_FILTERS,
  browseList,
  browsePool,
  browseRows,
  filterCounts,
  freezeOrder,
  inView,
  markerName,
  markerOf,
  markersFor,
  matchesAll,
  rowAction,
  type BrowseFilterId,
} from './browse';
import { isRainProof } from './factors';
import type { Trip } from './trips';
import type { Quad } from '../map/camera';

const trip = (over: Partial<Trip> = {}): Trip => ({
  version: 1,
  id: 't1',
  name: 'Tokyo',
  places: [{ level: 'prefecture', id: '13' }],
  startDate: null,
  days: [
    { stops: ['senso-ji', 'tokyo-national-museum', 'yanaka-ginza'], wet: [], start: '09:00', end: '19:00' },
    { stops: ['meiji-jingu', 'shibuya-sky'], wet: ['teamlab-planets'], start: '09:00', end: '19:00' },
  ],
  saved: ['golden-gai'],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});
const a = (id: string) => attractionById(id)!;
const ids = (xs: { a: { id: string } }[]) => xs.map((x) => x.a.id);

describe('markers', () => {
  test("today's stops are numbered in route order, other days' stops are marked other, the rest free", () => {
    const m = markersFor(trip(), 0);
    expect(m['senso-ji']).toEqual({ kind: 'today', day: 0, n: 1 });
    expect(m['tokyo-national-museum']).toEqual({ kind: 'today', day: 0, n: 2 });
    expect(m['yanaka-ginza']).toEqual({ kind: 'today', day: 0, n: 3 });
    expect(m['meiji-jingu']).toEqual({ kind: 'other', day: 1 });
    expect(markerOf(m, 'golden-gai')).toEqual({ kind: 'free' });
  });

  test('another day picked: its stops become the numbered ones', () => {
    const m = markersFor(trip(), 1);
    expect(m['meiji-jingu']).toEqual({ kind: 'today', day: 1, n: 1 });
    expect(m['shibuya-sky']).toEqual({ kind: 'today', day: 1, n: 2 });
    expect(m['senso-ji']).toEqual({ kind: 'other', day: 0 });
  });

  test('wet-weather plan places get no marker of their own', () => {
    expect(markerOf(markersFor(trip(), 1), 'teamlab-planets')).toEqual({ kind: 'free' });
  });

  test('ids the data no longer has are skipped, so the numbers match the day list', () => {
    const m = markersFor(trip({ days: [{ stops: ['gone', 'senso-ji'], wet: [], start: '09:00', end: '19:00' }] }), 0);
    expect(m['senso-ji']).toEqual({ kind: 'today', day: 0, n: 1 });
    expect(m.gone).toBeUndefined();
  });

  test('accessible names say the day, the stop number and the cost', () => {
    const m = markersFor(trip(), 0);
    expect(markerName(a('senso-ji'), m['senso-ji'])).toBe('Sensō-ji, Day 1 stop 1, ¥360');
    expect(markerName(a('meiji-jingu'), m['meiji-jingu'])).toBe('Meiji Jingu, on Day 2, ¥400');
    expect(markerName(a('golden-gai'), markerOf(m, 'golden-gai'))).toBe('Golden Gai, not planned, ¥2,800');
  });
});

describe('filters', () => {
  test('the chips: four factor filters, then the three parts of the day', () => {
    expect(BROWSE_FILTERS.map((f) => f.label)).toEqual(['Rain-proof', 'Easy', 'Local', 'Free', 'Morning', 'Afternoon', 'Evening']);
  });

  test('parts of the day count only when rated good', () => {
    const evening = ATTRACTIONS.filter((x) => matchesAll(x, ['evening'])).map((x) => x.id);
    expect(evening.sort()).toEqual([
      'golden-gai', 'miyashita-park', 'nonbei-yokocho', 'omoide-yokocho', 'shibuya-crossing', 'shibuya-sky',
      'sumida-park', 'teamlab-planets', 'tocho-observatory', 'tokyo-skytree',
    ]);
  });

  test('several chips combine with AND', () => {
    const hits = ATTRACTIONS.filter((x) => matchesAll(x, ['rain', 'evening'])).map((x) => x.id);
    expect(hits.sort()).toEqual(['golden-gai', 'nonbei-yokocho', 'omoide-yokocho', 'teamlab-planets', 'tocho-observatory', 'tokyo-skytree']);
    expect(matchesAll(a('senso-ji'), [])).toBe(true);
  });

  test('each chip counts what the list would show with it on, alongside the chips already on', () => {
    const none = filterCounts(ATTRACTIONS, []);
    expect(none.evening).toBe(10);
    expect(none.free).toBe(ATTRACTIONS.filter((x) => x.cost.entry === 0).length);
    const withRain = filterCounts(ATTRACTIONS, ['rain']);
    expect(withRain.evening).toBe(6);
    // An active chip shows the list's own count.
    expect(withRain.rain).toBe(ATTRACTIONS.filter((x) => matchesAll(x, ['rain'])).length);
  });
});

describe('rows', () => {
  test('unplanned first, then by name; planned ones stay, with their day', () => {
    const rows = browseRows(ATTRACTIONS, trip(), 0, [], null);
    expect(rows).toHaveLength(ATTRACTIONS.length);
    const firstPlanned = rows.findIndex((r) => r.on !== null);
    expect(rows.slice(firstPlanned).every((r) => r.on !== null)).toBe(true);
    expect(firstPlanned).toBe(ATTRACTIONS.length - 5);
    const names = rows.slice(0, firstPlanned).map((r) => r.a.name);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)));
    expect(ids(rows.slice(firstPlanned))).toEqual(['meiji-jingu', 'senso-ji', 'shibuya-sky', 'tokyo-national-museum', 'yanaka-ginza']);
  });

  test("a row knows its day, today's stop number and its quick facts", () => {
    const rows = browseRows(ATTRACTIONS, trip(), 0, [], null);
    const senso = rows.find((r) => r.a.id === 'senso-ji')!;
    expect(senso.on).toBe(0);
    expect(senso.n).toBe(1);
    expect(senso.facts).toEqual({ cost: '¥360', effort: 'Stroll', rainProof: false, best: 'morning' });
    const meiji = rows.find((r) => r.a.id === 'meiji-jingu')!;
    expect(meiji.on).toBe(1);
    expect(meiji.n).toBeNull();
    const gai = rows.find((r) => r.a.id === 'golden-gai')!;
    expect(gai.facts).toMatchObject({ rainProof: true, best: 'evening' });
    expect(gai.saved).toBe(true);
    expect(meiji.saved).toBe(false);
  });

  test('filters narrow the rows', () => {
    const f: BrowseFilterId[] = ['evening'];
    expect(ids(browseRows(ATTRACTIONS, trip(), 0, f, null))).toEqual([
      'golden-gai', 'miyashita-park', 'nonbei-yokocho', 'omoide-yokocho', 'shibuya-crossing', 'sumida-park',
      'teamlab-planets', 'tocho-observatory', 'tokyo-skytree', 'shibuya-sky',
    ]);
    expect(browseRows(ATTRACTIONS, trip(), 0, ['evening', 'easy', 'local', 'free', 'morning', 'rain'], null)).toEqual([]);
  });
});

describe('row actions', () => {
  test('add, remove from today, or move here from another day', () => {
    expect(rowAction(trip(), 0, 'golden-gai', null)).toEqual({ kind: 'add', label: 'Add to Day 1' });
    expect(rowAction(trip(), 0, 'senso-ji', null)).toEqual({ kind: 'remove', label: 'Remove from Day 1' });
    expect(rowAction(trip(), 0, 'meiji-jingu', null)).toEqual({ kind: 'move', label: 'On Day 2: move here' });
  });

  test('in replace mode every other row offers itself as the replacement, as the Saved tray does', () => {
    expect(rowAction(trip(), 0, 'golden-gai', 'senso-ji')).toEqual({ kind: 'replace', label: 'Use as replacement' });
    expect(rowAction(trip(), 0, 'meiji-jingu', 'senso-ji')).toEqual({ kind: 'replace', label: 'On Day 2 · use as replacement' });
    expect(rowAction(trip(), 0, 'senso-ji', 'senso-ji')).toEqual({ kind: 'note', label: 'Being replaced' });
    expect(rowAction(trip(), 0, 'yanaka-ginza', 'senso-ji')).toEqual({ kind: 'note', label: 'Already on Day 1' });
  });
});

describe('which attractions', () => {
  test("at the attraction level, the viewed place's own", () => {
    const taito = browsePool({ level: 'area', id: '13106' }, [{ level: 'prefecture', id: '13' }]);
    expect(taito.map((x) => x.id).sort()).toEqual([
      'hanayashiki', 'kappabashi', 'senso-ji', 'sumida-park', 'tokyo-national-museum', 'yanaka-ginza',
    ]);
    // Tokyo itself is above the attraction level now: it lists what the trip's places cover.
    expect(browsePool({ level: 'prefecture', id: '13' }, [{ level: 'prefecture', id: '13' }])).toHaveLength(ATTRACTIONS.length);
  });

  test('a neighbourhood lists all of Tokyo, since its map pins every attraction', () => {
    expect(browsePool({ level: 'neighbourhood', id: 'JP-N-TOKYO-HARAJUKU' }, [{ level: 'prefecture', id: '13' }])).toHaveLength(30);
  });

  test("above it, everything the trip's places cover, once each", () => {
    const pool = browsePool({ level: 'country', id: '392' }, [{ level: 'prefecture', id: '13' }, { level: 'area', id: '13106' }]);
    expect(pool).toHaveLength(ATTRACTIONS.length);
  });

  test('none for places without data', () => {
    expect(browsePool({ level: 'prefecture', id: '26' }, [{ level: 'prefecture', id: '26' }])).toEqual([]);
    expect(browsePool(null, [])).toEqual([]);
  });
});

describe('frozen order', () => {
  test('after an action the rows keep the order they had, with their new status', () => {
    const before = browseRows(ATTRACTIONS, trip(), 0, [], null);
    const frozen = before.map((r) => r.a.id);
    // Golden Gai goes on Day 1: by the sort it would drop to the planned group.
    const t = trip({ days: [{ stops: ['senso-ji', 'tokyo-national-museum', 'yanaka-ginza', 'golden-gai'], wet: [], start: '09:00', end: '19:00' }, trip().days[1]] });
    const after = freezeOrder(browseRows(ATTRACTIONS, t, 0, [], null), frozen);
    expect(after.map((r) => r.a.id)).toEqual(frozen);
    expect(after.find((r) => r.a.id === 'golden-gai')!.action).toEqual({ kind: 'remove', label: 'Remove from Day 1' });
  });

  test('no frozen order, or a different set of rows (a filter, another place): the sort as usual', () => {
    const rows = browseRows(ATTRACTIONS, trip(), 0, [], null);
    expect(freezeOrder(rows, null)).toBe(rows);
    const evening = browseRows(ATTRACTIONS, trip(), 0, ['evening'], null);
    expect(freezeOrder(evening, rows.map((r) => r.a.id))).toBe(evening);
  });
});

describe('wet-weather toggle', () => {
  const dry = ATTRACTIONS.find((x) => !isRainProof(x))!;
  const proof = ATTRACTIONS.filter((x) => isRainProof(x) && x.id !== 'teamlab-planets');

  test('rows act on the day’s wet-weather plan: rain-proof ones add or remove, the rest say Not rain-proof', () => {
    expect(rowAction(trip(), 1, 'teamlab-planets', null, true)).toEqual({ kind: 'remove', label: 'Remove from wet-weather plan' });
    expect(rowAction(trip(), 0, 'teamlab-planets', null, true)).toEqual({ kind: 'add', label: 'Add to wet-weather plan' });
    expect(rowAction(trip(), 0, proof[0].id, null, true)).toEqual({ kind: 'add', label: 'Add to wet-weather plan' });
    expect(rowAction(trip(), 0, dry.id, null, true)).toEqual({ kind: 'note', label: 'Not rain-proof' });
  });

  test('replace mode is off with the toggle on', () => {
    expect(rowAction(trip(), 0, proof[0].id, 'senso-ji', true).label).toBe('Add to wet-weather plan');
    expect(browseRows(ATTRACTIONS, trip(), 0, [], 'senso-ji', true).some((r) => r.action.kind === 'replace')).toBe(false);
  });

  test('the rain-proof ones come first and the rest are greyed', () => {
    const rows = browseRows(ATTRACTIONS, trip(), 0, [], null, true);
    expect(rows).toHaveLength(ATTRACTIONS.length);
    const firstOff = rows.findIndex((r) => r.off);
    expect(firstOff).toBeGreaterThan(0);
    expect(rows.slice(0, firstOff).every((r) => isRainProof(r.a))).toBe(true);
    expect(rows.slice(firstOff).every((r) => r.off && !isRainProof(r.a))).toBe(true);
    // Toggle off: nothing is greyed.
    expect(browseRows(ATTRACTIONS, trip(), 0, [], null).some((r) => r.off)).toBe(false);
  });
});

// South edge 35.65: Shibuya Sky sits at 35.6585.
const SHIBUYA_QUAD: Quad = [[139.69, 35.68], [139.71, 35.68], [139.71, 35.65], [139.69, 35.65]];

test('inView keeps attractions inside the quad; null quad keeps all', () => {
  const ids = inView(ATTRACTIONS, SHIBUYA_QUAD).map((a) => a.id);
  expect(ids).toContain('shibuya-sky');
  expect(ids).not.toContain('senso-ji');
  expect(inView(ATTRACTIONS, null)).toHaveLength(ATTRACTIONS.length);
});

test('browseList: full pool until the map reports; then only what is in view', () => {
  expect(browseList(ATTRACTIONS, null, true)).toEqual({ list: ATTRACTIONS, inView: null });
  const r = browseList(ATTRACTIONS, SHIBUYA_QUAD, true);
  expect(r.inView).toBe(r.list.length);
  expect(r.list.map((a) => a.id)).toContain('shibuya-sky');
  expect(browseList(ATTRACTIONS, SHIBUYA_QUAD, false)).toEqual({ list: ATTRACTIONS, inView: null });
});
