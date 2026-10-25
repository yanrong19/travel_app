import { ATTRACTIONS } from './attractions';
import { PREFECTURES } from './places';
import { summarize, type Summary } from '../lib/summary';

export interface Region {
  id: string;
  name: string;
  ja: string;
  /** Prefecture codes 1–47 (the JIS code, as in the map's feature ids). */
  prefectures: number[];
  oneLiner: string;
  /** Photo key, or null until the region has one. */
  photo: string | null;
  /** True when we have attractions to compute the summary from. */
  live: boolean;
  /** Mock summary for regions without attraction data yet. */
  rough?: Summary;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** Month flags from a 12-character string, January first: "g" = a good month. */
const m = (s: string) => s.split('').map((c) => c === 'g');

/** The eight regions of Japan, north to south. Only Kantō has real data so far. */
export const REGIONS: Region[] = [
  {
    id: 'hokkaido',
    name: 'Hokkaidō',
    ja: '北海道',
    prefectures: [1],
    oneLiner: 'Powder snow, lakes and fresh seafood.',
    photo: null,
    live: false,
    rough: { months: m('gg...ggggg..'), effort: 'Moderate', crowds: 'Quiet', cost: '¥', count: 0 },
  },
  {
    id: 'tohoku',
    name: 'Tōhoku',
    ja: '東北',
    prefectures: range(2, 7),
    oneLiner: 'Mountain hot springs, quiet coastline and autumn leaves.',
    photo: null,
    live: false,
    rough: { months: m('...ggg.gggg.'), effort: 'Moderate', crowds: 'Quiet', cost: '¥', count: 0 },
  },
  {
    id: 'kanto',
    name: 'Kantō',
    ja: '関東',
    prefectures: range(8, 14),
    oneLiner: 'Tokyo and the plain around it, from skyscrapers to shrine towns.',
    photo: 'shibuya-sky',
    live: true,
  },
  {
    id: 'chubu',
    name: 'Chūbu',
    ja: '中部',
    prefectures: range(15, 23),
    oneLiner: 'The Japanese Alps, Mount Fuji and old post towns.',
    photo: null,
    live: false,
    rough: { months: m('..gggg.gggg.'), effort: 'Hard', crowds: 'Busy', cost: '¥¥', count: 0 },
  },
  {
    id: 'kansai',
    name: 'Kansai',
    ja: '関西',
    prefectures: range(24, 30),
    oneLiner: 'Kyoto temples, Osaka street food and Nara deer.',
    photo: null,
    live: false,
    rough: { months: m('..ggg..ggggg'), effort: 'Moderate', crowds: 'Packed', cost: '¥¥', count: 0 },
  },
  {
    id: 'chugoku',
    name: 'Chūgoku',
    ja: '中国',
    prefectures: range(31, 35),
    oneLiner: 'Hiroshima, the island shrine of Miyajima and the Inland Sea.',
    photo: null,
    live: false,
    rough: { months: m('..gggg.gggg.'), effort: 'Easy', crowds: 'Quiet', cost: '¥', count: 0 },
  },
  {
    id: 'shikoku',
    name: 'Shikoku',
    ja: '四国',
    prefectures: range(36, 39),
    oneLiner: 'The 88-temple pilgrimage, river gorges and hot spring towns.',
    photo: null,
    live: false,
    rough: { months: m('..ggg..gggg.'), effort: 'Moderate', crowds: 'Quiet', cost: '¥', count: 0 },
  },
  {
    id: 'kyushu-okinawa',
    name: 'Kyūshū & Okinawa',
    ja: '九州・沖縄',
    prefectures: range(40, 47),
    oneLiner: 'Volcanoes, hot springs and the beaches of Okinawa.',
    photo: null,
    live: false,
    rough: { months: m('..gggg.gggg.'), effort: 'Moderate', crowds: 'Busy', cost: '¥¥', count: 0 },
  },
];

export const regionOfPref = (code: number) => REGIONS.find((r) => r.prefectures.includes(code));

/** Live regions summarise our attractions; the rest use their mock summary. */
export const regionSummary = (r: Region): Summary => (r.live ? summarize(ATTRACTIONS) : r.rough!);

/** English prefecture name from the map data. */
export const prefName = (code: number) => PREFECTURES.find((p) => Number(p.id) === code)?.properties.name ?? '';
