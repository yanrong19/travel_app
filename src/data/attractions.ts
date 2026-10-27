// Mock data for the UI. Values are plausible but unverified; the analysis
// pipeline will replace this file.
import { CROWD_START_HOUR, type Attraction, type Rating } from './types';

const R: Record<string, Rating> = { g: 'good', o: 'ok', p: 'poor' };
/** "ggoopp…" → twelve month ratings. */
const months = (s: string) => s.split('').map((c) => R[c]);

/** Same opening hours every day, minus the closed weekdays (0 = Monday). */
const week = (open: string, close: string, closed: number[] = []) =>
  Array.from({ length: 7 }, (_, d) => (closed.includes(d) ? null : ([open, close] as [string, string])));

/** A bell-shaped busyness curve over 06:00–23:00, null outside opening hours. */
function crowd(open: number, close: number, peakAt: number, peak: number, spread: number, base: number) {
  return Array.from({ length: 18 }, (_, i) => {
    const h = CROWD_START_HOUR + i;
    if (h < Math.floor(open) || h >= Math.ceil(close)) return null;
    const v = base + (peak - base) * Math.exp(-((h + 0.5 - peakAt) ** 2) / (2 * spread ** 2));
    return Math.round(Math.min(100, v));
  });
}
const busier = (c: (number | null)[], k: number) => c.map((v) => (v == null ? null : Math.min(100, Math.round(v * k))));

const sensojiWk = crowd(6, 21, 13, 72, 3, 15);
const teamlabWk = crowd(9, 22, 14, 78, 3, 30);
const meijiWk = crowd(5, 17, 11, 52, 3, 10);
const skyWk = crowd(10, 22.5, 17.5, 88, 2, 30);
const tsukijiWk = crowd(5, 14, 10, 82, 2, 20);
const takaoWk = crowd(8, 18, 11, 45, 2, 10);
const yanakaWk = crowd(10, 18, 15, 45, 3, 10);
const tnmWk = crowd(9, 17, 13, 40, 3, 10);
const gaiWk = crowd(19, 24, 22, 60, 1.5, 20);
const ghibliWk = crowd(10, 18, 13, 70, 3, 40);
const todorokiWk = crowd(9, 17, 13, 25, 3, 5);
const sumoWk = crowd(8, 18, 16, 90, 2, 10);
const shimoWk = crowd(11, 21, 16, 58, 3, 15);
const nakanoWk = crowd(12, 20, 16, 52, 3, 15);
const kiyosumiWk = crowd(9, 17, 13, 18, 3, 5);
const skytreeWk = crowd(10, 21, 15, 78, 3, 25);

export const ATTRACTIONS: Attraction[] = [
  {
    id: 'senso-ji',
    name: 'Sensō-ji',
    ja: '浅草寺',
    area: '13106',
    lonlat: [139.7967, 35.7148],
    kind: 'Buddhist temple',
    blurb: "Tokyo's oldest temple, reached through the Nakamise shopping street.",
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'ok', heavyRain: 'poor', wind: 'ok', heat: 'ok' },
      weatherNote: 'Mostly open courtyards. The main hall is the only real shelter.',
      covered: 20,
      months: months('oggggooopogg'),
      monthsNote: 'New Year and the mid-May Sanja Matsuri bring the biggest crowds of the year.',
      bestTimes: [
        { from: 6, to: 8, label: 'Quiet at opening' },
        { from: 18, to: 21, label: 'Lit up after dark' },
      ],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'ok', evening: 'ok', note: 'Quiet at the 06:00 opening, packed by early afternoon. The hall shuts at 17:00, but the lit grounds stay open.' },
    },
    effort: {
      level: 1, walkKm: 1.2, steps: 10, climbM: 0, onFeetMin: 75, shade: 25,
      wheelchair: 'yes', stroller: 'yes', triggers: ['crowds'], recovery: 'low',
      note: 'Flat and paved. The crush along Nakamise is the tiring part.',
    },
    vibe: {
      local: 15, energy: 80, nature: 15,
      crowds: { weekday: sensojiWk, weekend: busier(sensojiWk, 1.3) },
      suits: { solo: 'good', couple: 'good', family: 'good', friends: 'good' },
      onlyHere: 'only-tokyo', onlyHereNote: 'Founded in 645, it is the city’s oldest temple.',
      photo: 75,
    },
    logistics: {
      visitMin: [60, 90], queueMin: [0, 15], travelMin: 25,
      hours: week('06:00', '17:00'),
      hoursNote: 'The main hall keeps these hours. The grounds never close.',
      booking: 'none', timing: 'flexible',
      station: 'Asakusa', walkMin: 5, lockers: true,
      holidayNote: 'On 1–3 January the queue just to reach the hall can pass an hour.',
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return metro from Tokyo Station', yen: 360 },
        { label: 'Omikuji fortune', yen: 100, optional: true },
        { label: 'Snacks on Nakamise', yen: 800, optional: true },
      ],
      cash: 'mostly-cash', cashNote: 'Nakamise stalls mostly take cash.',
      freeNote: 'Always free to enter.',
    },
  },
  {
    id: 'teamlab-planets',
    name: 'teamLab Planets',
    ja: 'チームラボプラネッツ',
    area: '13108',
    lonlat: [139.7898, 35.6491],
    kind: 'Immersive digital art',
    blurb: 'Walk barefoot through water rooms and mirrored light installations.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'good', heavyRain: 'good', wind: 'good', heat: 'good' },
      weatherNote: 'Fully indoors. One of the safest rain plans in the city.',
      covered: 100,
      months: months('ggggggoogggg'),
      monthsNote: 'Late July and August school holidays sell out first.',
      bestTimes: [{ from: 9, to: 11, label: 'First slots are calmest' }],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'ok', evening: 'good', note: 'The first slots and the last few hours are calmest. Avoid the early-afternoon peak.' },
    },
    effort: {
      level: 1, walkKm: 0.8, steps: 0, climbM: 0, onFeetMin: 90, shade: 100,
      wheelchair: 'partial', stroller: 'no', triggers: ['water', 'enclosed', 'dark'], recovery: 'low',
      note: 'You wade knee-deep through water. Wear trousers that roll above the knee.',
    },
    vibe: {
      local: 10, energy: 55, nature: 3,
      crowds: { weekday: teamlabWk, weekend: busier(teamlabWk, 1.25) },
      suits: { solo: 'ok', couple: 'good', family: 'good', friends: 'good' },
      onlyHere: 'only-tokyo', onlyHereNote: 'This permanent show exists only in Toyosu.',
      photo: 95,
    },
    logistics: {
      visitMin: [90, 120], queueMin: [10, 30], travelMin: 25,
      hours: week('09:00', '22:00'), lastEntryMin: 60,
      booking: 'required', leadDays: 14, bookingNote: 'Timed tickets. Weekend slots go two to three weeks out.',
      timing: 'fixed', station: 'Shin-toyosu', walkMin: 1, lockers: true,
      holidayNote: 'Closes on a few unannounced days a year for maintenance.',
    },
    cost: {
      entry: 3800,
      extras: [{ label: 'Return metro and Yurikamome', yen: 700 }],
      cash: 'cards', freeNote: 'Not covered by city passes.',
    },
  },
  {
    id: 'meiji-jingu',
    name: 'Meiji Jingu',
    ja: '明治神宮',
    area: '13113',
    lonlat: [139.6993, 35.6764],
    kind: 'Shinto shrine and forest',
    blurb: 'A shrine inside a 70-hectare planted forest, next to Harajuku.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'ok', heavyRain: 'poor', wind: 'ok', heat: 'good' },
      weatherNote: 'The forest canopy takes the edge off summer sun and light rain.',
      covered: 10,
      months: months('oggggggooggg'),
      monthsNote: 'Over three million people visit in the first three days of January.',
      bestTimes: [{ from: 5, to: 8, label: 'Gates open at sunrise' }],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'ok', evening: 'poor', note: 'Best in the early-morning quiet. The gates close at sunset.' },
    },
    effort: {
      level: 2, walkKm: 2.5, steps: 0, climbM: 10, onFeetMin: 70, shade: 85,
      wheelchair: 'partial', stroller: 'partial', triggers: [], recovery: 'low',
      note: 'Long gravel paths. Ten minutes on foot from the gate to the shrine.',
    },
    vibe: {
      local: 40, energy: 25, nature: 75,
      crowds: { weekday: meijiWk, weekend: busier(meijiWk, 1.45) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'ok' },
      onlyHere: 'only-japan', onlyHereNote: 'Shinto wedding processions cross the courtyard most weekends.',
      photo: 50,
    },
    logistics: {
      visitMin: [45, 75], queueMin: [0, 0], travelMin: 25,
      hours: week('05:00', '17:00'),
      hoursNote: 'Gates follow sunrise and sunset, so the times shift by month.',
      booking: 'none', timing: 'flexible', station: 'Harajuku', walkMin: 1, lockers: true,
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return JR from Tokyo Station', yen: 400 },
        { label: 'Inner garden', yen: 500, optional: true },
      ],
      cash: 'mostly-cash', freeNote: 'The shrine grounds are free. The inner garden is ¥500.',
    },
  },
  {
    id: 'shibuya-sky',
    name: 'Shibuya Sky',
    ja: '渋谷スカイ',
    area: '13113',
    lonlat: [139.7022, 35.6585],
    kind: 'Open-air observation deck',
    blurb: 'An open rooftop 229 m above Shibuya Crossing.',
    conditions: {
      weather: { sun: 'good', cloud: 'ok', rain: 'poor', heavyRain: 'poor', wind: 'poor', heat: 'ok' },
      weatherNote: 'The rooftop shuts in rain or strong wind, and tickets are not refunded for it.',
      covered: 30,
      months: months('gggoopoooggg'),
      monthsNote: 'Winter air is the clearest. Fuji often shows from December to February.',
      bestTimes: [
        { from: 16, to: 18, label: 'Sunset' },
        { from: 19, to: 22, label: 'Night view' },
      ],
      visibility: 'critical',
      visibilityNote: 'Low cloud or haze hides the view entirely.',
      timeOfDay: { morning: 'ok', afternoon: 'ok', evening: 'good', note: 'Go for sunset or the night view. Mornings are quieter but less of a show.' },
    },
    effort: {
      level: 1, walkKm: 0.5, steps: 20, climbM: 0, onFeetMin: 50, shade: 10,
      wheelchair: 'yes', stroller: 'partial', triggers: ['heights'], recovery: 'low',
      note: 'Bags, hats and tripods go into lockers before the rooftop.',
    },
    vibe: {
      local: 15, energy: 50, nature: 5,
      crowds: { weekday: skyWk, weekend: busier(skyWk, 1.15) },
      suits: { solo: 'ok', couple: 'good', family: 'ok', friends: 'good' },
      onlyHere: 'common', onlyHereNote: 'Most big cities have a sky deck. This one is open-air.',
      photo: 95,
    },
    logistics: {
      visitMin: [45, 75], queueMin: [10, 30], travelMin: 25,
      hours: week('10:00', '22:30'), lastEntryMin: 60,
      booking: 'recommended', leadDays: 28, bookingNote: 'Sunset slots sell out about four weeks ahead.',
      timing: 'fixed', station: 'Shibuya', walkMin: 1, lockers: true,
    },
    cost: {
      entry: 2500,
      extras: [
        { label: 'Return JR from Tokyo Station', yen: 400 },
        { label: 'Rooftop locker', yen: 100 },
      ],
      cash: 'cards',
    },
  },
  {
    id: 'tsukiji-outer-market',
    name: 'Tsukiji Outer Market',
    ja: '築地場外市場',
    area: '13102',
    lonlat: [139.7707, 35.6654],
    kind: 'Food market',
    blurb: 'About 400 stalls selling seafood, knives and street snacks.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'ok', heavyRain: 'poor', wind: 'ok', heat: 'poor' },
      weatherNote: 'Lanes are partly roofed. Heavy rain empties them fast.',
      covered: 40,
      months: months('ggggggoogggg'),
      monthsNote: 'Heat and fish smells peak in July and August.',
      bestTimes: [{ from: 7, to: 9, label: 'Stalls open, crowds thin' }],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'poor', evening: 'poor', note: 'A breakfast market: stalls wind down after noon and it shuts at 14:00.' },
    },
    effort: {
      level: 2, walkKm: 1.5, steps: 0, climbM: 0, onFeetMin: 90, shade: 40,
      wheelchair: 'partial', stroller: 'partial', triggers: ['crowds'], recovery: 'low',
      note: 'You stand and eat in the street. There are few places to sit.',
    },
    vibe: {
      local: 35, energy: 85, nature: 5,
      crowds: { weekday: tsukijiWk, weekend: busier(tsukijiWk, 1.2) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'good' },
      onlyHere: 'only-tokyo', onlyHereNote: 'The retail half of the old fish market, still trading after the wholesale move.',
      photo: 60,
    },
    logistics: {
      visitMin: [60, 120], queueMin: [10, 40], travelMin: 15,
      hours: week('05:00', '14:00', [6]),
      booking: 'none', timing: 'flexible', station: 'Tsukiji', walkMin: 1, lockers: false,
      holidayNote: 'Many stalls also close on Wednesdays and public holidays.',
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return metro from Tokyo Station', yen: 360 },
        { label: 'Street snacks', yen: 2500 },
        { label: 'Sushi breakfast', yen: 3500, optional: true },
      ],
      cash: 'mostly-cash',
    },
  },
  {
    id: 'mount-takao',
    name: 'Mount Takao',
    ja: '高尾山',
    area: '13201',
    lonlat: [139.2437, 35.6251],
    kind: 'Mountain hike',
    blurb: 'A 599 m forested mountain with temple trails, an hour west of the centre.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'poor', heavyRain: 'poor', wind: 'ok', heat: 'ok' },
      weatherNote: 'Trails turn slippery after rain. The chairlift stops in strong wind.',
      covered: 0,
      months: months('oogggpoooggo'),
      monthsNote: 'Mid-November autumn colour brings the busiest weekends of the year.',
      bestTimes: [{ from: 8, to: 11, label: 'Start early, be down by 15:00' }],
      visibility: 'some',
      visibilityNote: 'Fuji shows from the summit on clear winter mornings.',
      timeOfDay: { morning: 'good', afternoon: 'poor', evening: 'poor', note: 'Start early to be down by 15:00. An afternoon start runs into dusk on the trail.' },
    },
    effort: {
      level: 4, walkKm: 7.5, steps: 600, climbM: 400, onFeetMin: 240, shade: 70,
      wheelchair: 'no', stroller: 'no', triggers: ['heights'], recovery: 'high',
      note: 'About 400 m of climbing on foot. The cable car cuts it in half.',
    },
    vibe: {
      local: 70, energy: 45, nature: 95,
      crowds: { weekday: takaoWk, weekend: busier(takaoWk, 2.1) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'good' },
      onlyHere: 'only-japan', onlyHereNote: 'A sacred mountain with a temple run by yamabushi monks.',
      photo: 45,
    },
    logistics: {
      visitMin: [180, 300], queueMin: [0, 30], travelMin: 75,
      hours: week('08:00', '17:45'),
      hoursNote: 'These are cable car hours. The trails never close.',
      booking: 'none', timing: 'flexible', station: 'Takaosanguchi', walkMin: 5, lockers: true,
      lastTrainNote: 'The last cable car down leaves around 17:45. After that it is a 90-minute walk in the dark.',
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return train from Shinjuku', yen: 800 },
        { label: 'Cable car round trip', yen: 950, optional: true },
        { label: 'Soba lunch', yen: 1200, optional: true },
      ],
      cash: 'mostly-cash',
    },
  },
  {
    id: 'yanaka-ginza',
    name: 'Yanaka Ginza',
    ja: '谷中銀座',
    area: '13106',
    lonlat: [139.766, 35.7278],
    kind: 'Old shopping street',
    blurb: 'A 170 m street of family shops in one of the few districts the 1945 air raids missed.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'ok', heavyRain: 'poor', wind: 'good', heat: 'ok' },
      weatherNote: 'An open street under shop awnings. Fine in light rain.',
      covered: 25,
      months: months('gggggogogggg'),
      monthsNote: 'Quietest on weekday mornings in any season.',
      bestTimes: [{ from: 15, to: 17, label: 'Sunset from the Yūyake Dandan steps' }],
      visibility: 'none',
      timeOfDay: { morning: 'ok', afternoon: 'good', evening: 'poor', note: 'Shops open from 10:00 and the sunset steps are the highlight. Most shops shut at 18:00.' },
    },
    effort: {
      level: 2, walkKm: 2, steps: 40, climbM: 15, onFeetMin: 90, shade: 30,
      wheelchair: 'partial', stroller: 'partial', triggers: [], recovery: 'low',
      note: 'The Yūyake Dandan steps at the top are the only climb.',
    },
    vibe: {
      local: 75, energy: 40, nature: 8,
      crowds: { weekday: yanakaWk, weekend: busier(yanakaWk, 1.5) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'ok' },
      onlyHere: 'only-tokyo', onlyHereNote: 'Its wooden houses are pre-war, rare in central Tokyo.',
      photo: 55,
    },
    logistics: {
      visitMin: [60, 120], queueMin: [0, 0], travelMin: 20,
      hours: week('10:00', '18:00', [0]),
      hoursNote: 'Shop hours. Many shops close on Mondays.',
      booking: 'none', timing: 'flexible', station: 'Nippori', walkMin: 4, lockers: true,
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return JR from Tokyo Station', yen: 360 },
        { label: 'Snacks and coffee', yen: 1500 },
      ],
      cash: 'cash-only', cashNote: 'Most of the small shops take cash only.',
    },
  },
  {
    id: 'tokyo-national-museum',
    name: 'Tokyo National Museum',
    ja: '東京国立博物館',
    area: '13106',
    lonlat: [139.7765, 35.7188],
    kind: 'Museum of Japanese art',
    blurb: "Japan's oldest museum: samurai armour, scrolls and the Hōryū-ji treasures.",
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'good', heavyRain: 'good', wind: 'good', heat: 'good' },
      weatherNote: 'Six buildings joined by short garden paths.',
      covered: 95,
      months: months('gggogggggggg'),
      monthsNote: 'Ueno’s cherry season adds crowds in late March and April.',
      bestTimes: [
        { from: 9.5, to: 11, label: 'Calmest after opening' },
        { from: 17, to: 20, label: 'Friday late opening' },
      ],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'ok', evening: 'poor', note: 'Calmest just after the 09:30 opening. Evenings only on Fridays, when it stays open to 20:00.' },
    },
    effort: {
      level: 2, walkKm: 3, steps: 60, climbM: 0, onFeetMin: 150, shade: 95,
      wheelchair: 'yes', stroller: 'yes', triggers: [], recovery: 'medium',
      note: 'Big galleries. Museum fatigue sets in after about two hours.',
    },
    vibe: {
      local: 55, energy: 15, nature: 12,
      crowds: { weekday: tnmWk, weekend: busier(tnmWk, 1.6) },
      suits: { solo: 'good', couple: 'ok', family: 'ok', friends: 'ok' },
      onlyHere: 'only-japan', onlyHereNote: 'The collection holds 89 National Treasures.',
      photo: 25,
    },
    logistics: {
      visitMin: [120, 180], queueMin: [0, 10], travelMin: 15,
      hours: [null, ['09:30', '17:00'], ['09:30', '17:00'], ['09:30', '17:00'], ['09:30', '17:00'], ['09:30', '20:00'], ['09:30', '17:00']],
      lastEntryMin: 30,
      booking: 'none', bookingNote: 'Special exhibitions sell timed tickets.',
      timing: 'flexible', station: 'Ueno', walkMin: 10, lockers: true,
      holidayNote: 'When Monday is a public holiday it opens, then closes on Tuesday instead.',
    },
    cost: {
      entry: 1000,
      extras: [
        { label: 'Return JR from Tokyo Station', yen: 340 },
        { label: 'Special exhibition', yen: 2100, optional: true },
      ],
      cash: 'cards',
      freeNote: 'Free on International Museum Day (18 May).',
    },
  },
  {
    id: 'golden-gai',
    name: 'Golden Gai',
    ja: 'ゴールデン街',
    area: '13104',
    lonlat: [139.7046, 35.6938],
    kind: 'Bar alleys',
    blurb: 'Six narrow alleys with around 200 bars, most seating five to ten people.',
    conditions: {
      weather: { sun: 'ok', cloud: 'good', rain: 'good', heavyRain: 'ok', wind: 'good', heat: 'ok' },
      weatherNote: 'Once you are on a stool you are indoors. Only the alleys are open.',
      covered: 80,
      months: months('gggggggggggg'),
      monthsNote: 'The same all year. Friday and Saturday nights fill fastest.',
      bestTimes: [{ from: 20, to: 23, label: 'Most bars open around 20:00' }],
      visibility: 'none',
      timeOfDay: { morning: 'poor', afternoon: 'poor', evening: 'good', note: 'A night place: the bars open around 19:00–20:00 and the alleys are shut by day.' },
    },
    effort: {
      level: 1, walkKm: 0.8, steps: 30, climbM: 0, onFeetMin: 30, shade: 100,
      wheelchair: 'no', stroller: 'no', triggers: ['enclosed', 'loud'], recovery: 'medium',
      note: 'Many bars sit up near-vertical stairs.',
    },
    vibe: {
      local: 50, energy: 70, nature: 2,
      crowds: { weekday: gaiWk, weekend: busier(gaiWk, 1.5) },
      suits: { solo: 'good', couple: 'ok', family: 'poor', friends: 'good' },
      onlyHere: 'only-tokyo', onlyHereNote: 'Post-war wooden bar rows that outlived Shinjuku’s redevelopment.',
      photo: 50,
    },
    logistics: {
      visitMin: [90, 180], queueMin: [0, 0], travelMin: 20,
      hours: week('19:00', '02:00'),
      booking: 'none', timing: 'flexible', station: 'Shinjuku-sanchōme', walkMin: 4, lockers: false,
      lastTrainNote: 'The last trains leave Shinjuku around 00:30. After that it is a taxi.',
      etiquette: 'Some bars ban photos, and a few are for regulars only.',
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Cover charge at one bar', yen: 1000 },
        { label: 'Two drinks', yen: 1800 },
        { label: 'Taxi back after the last train', yen: 3500, optional: true },
      ],
      cash: 'mostly-cash',
    },
  },
  {
    id: 'ghibli-museum',
    name: 'Ghibli Museum',
    ja: '三鷹の森ジブリ美術館',
    area: '13204',
    lonlat: [139.5704, 35.6962],
    kind: 'Animation museum',
    blurb: "Studio Ghibli's own museum, with short films shown nowhere else.",
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'good', heavyRain: 'good', wind: 'good', heat: 'good' },
      weatherNote: 'An indoor museum. The rooftop robot garden is the only open-air part.',
      covered: 85,
      months: months('gggggggggggg'),
      monthsNote: 'Tickets, not seasons, are the limit.',
      bestTimes: [{ from: 10, to: 12, label: 'Morning entry slots' }],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'ok', evening: 'poor', note: 'Morning entry slots are the calmest. It closes at 18:00.' },
    },
    effort: {
      level: 1, walkKm: 1.5, steps: 80, climbM: 0, onFeetMin: 120, shade: 80,
      wheelchair: 'partial', stroller: 'partial', triggers: ['enclosed'], recovery: 'low',
      note: 'Spiral staircases inside, plus one lift.',
    },
    vibe: {
      local: 30, energy: 40, nature: 35,
      crowds: { weekday: ghibliWk, weekend: busier(ghibliWk, 1.25) },
      suits: { solo: 'ok', couple: 'good', family: 'good', friends: 'good' },
      onlyHere: 'only-tokyo', onlyHereNote: 'Films in its Saturn Theater are shown nowhere else.',
      photo: 20,
    },
    logistics: {
      visitMin: [120, 150], queueMin: [0, 15], travelMin: 50,
      hours: week('10:00', '18:00', [1]),
      booking: 'required', leadDays: 30,
      bookingNote: 'Tickets go on sale on the 10th of the month before and sell out within days.',
      timing: 'fixed', station: 'Mitaka', walkMin: 15, lockers: true,
      holidayNote: 'Also closes for maintenance periods and over New Year.',
      etiquette: 'No photos inside the building.',
    },
    cost: {
      entry: 1000,
      extras: [
        { label: 'Return JR from Shinjuku', yen: 460 },
        { label: 'Lunch at the Straw Hat Café', yen: 1500, optional: true },
      ],
      cash: 'cards',
    },
  },
  {
    id: 'todoroki-valley',
    name: 'Todoroki Valley',
    ja: '等々力渓谷',
    area: '13112',
    lonlat: [139.648, 35.6086],
    kind: 'Ravine walk',
    blurb: 'A 1 km wooded ravine inside the 23 wards, with a small temple at the end.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'poor', heavyRain: 'poor', wind: 'good', heat: 'good' },
      weatherNote: 'The path floods and closes after heavy rain.',
      covered: 0,
      months: months('ooggggggggo' + 'o'),
      monthsNote: 'Cool in summer. The maples turn in late November.',
      bestTimes: [{ from: 9, to: 15, label: 'Daylight only' }],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'good', evening: 'poor', note: 'Fine any time in daylight. The ravine gets dark early and its paths are unlit.' },
    },
    effort: {
      level: 2, walkKm: 2, steps: 120, climbM: 25, onFeetMin: 50, shade: 90,
      wheelchair: 'no', stroller: 'no', triggers: [], recovery: 'low',
      note: 'Steps down into the ravine, then stone paths beside the stream.',
    },
    vibe: {
      local: 90, energy: 10, nature: 85,
      crowds: { weekday: todorokiWk, weekend: busier(todorokiWk, 1.8) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'ok' },
      onlyHere: 'common', onlyHereNote: 'Ravine walks are common in Japan. One inside the city is not.',
      photo: 40,
    },
    logistics: {
      visitMin: [45, 60], queueMin: [0, 0], travelMin: 45,
      hours: week('09:00', '17:00'),
      booking: 'none', timing: 'flexible', station: 'Todoroki', walkMin: 2, lockers: false,
      holidayNote: 'Shuts without notice after heavy rain.',
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return train from Shibuya', yen: 500 },
        { label: 'Matcha at the teahouse', yen: 600, optional: true },
      ],
      cash: 'cash-only',
    },
  },
  {
    id: 'ryogoku-sumo',
    name: 'Sumo at Ryōgoku',
    ja: '両国国技館',
    area: '13107',
    lonlat: [139.7934, 35.6969],
    kind: 'Sumo tournament',
    blurb: 'Professional sumo, held here for 15 days three times a year.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'good', heavyRain: 'good', wind: 'good', heat: 'good' },
      weatherNote: 'An indoor arena.',
      covered: 100,
      months: months('gpppgpppgppp'),
      monthsNote: 'Tokyo tournaments run only in January, May and September.',
      bestTimes: [{ from: 15, to: 18, label: 'Top-division bouts' }],
      visibility: 'none',
      timeOfDay: { morning: 'ok', afternoon: 'good', evening: 'poor', note: 'Mornings are lower divisions and empty seats. The top bouts run from mid-afternoon to the 18:00 close.' },
    },
    effort: {
      level: 1, walkKm: 0.5, steps: 40, climbM: 0, onFeetMin: 20, shade: 100,
      wheelchair: 'yes', stroller: 'partial', triggers: ['crowds', 'loud'], recovery: 'medium',
      note: 'Box seats are floor cushions. Knees complain after an hour.',
    },
    vibe: {
      local: 60, energy: 75, nature: 3,
      crowds: { weekday: sumoWk, weekend: busier(sumoWk, 1.1) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'good' },
      onlyHere: 'only-japan', onlyHereNote: 'Professional sumo rarely tours abroad.',
      photo: 40,
    },
    logistics: {
      visitMin: [180, 300], queueMin: [0, 15], travelMin: 15,
      hours: week('08:00', '18:00'),
      hoursNote: 'Tournament days only.',
      booking: 'required', leadDays: 45,
      bookingNote: 'Weekend tickets sell out within hours of release, about six weeks ahead.',
      timing: 'fixed', station: 'Ryōgoku', walkMin: 2, lockers: true,
    },
    cost: {
      entry: 5000,
      extras: [
        { label: 'Return JR from Tokyo Station', yen: 340 },
        { label: 'Bento', yen: 1500, optional: true },
      ],
      cash: 'cards',
    },
  },
  {
    id: 'shimokitazawa',
    name: 'Shimokitazawa',
    ja: '下北沢',
    area: '13112',
    lonlat: [139.668, 35.6616],
    kind: 'Neighbourhood wander',
    blurb: 'Vintage clothes, tiny theatres and basement live houses.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'ok', heavyRain: 'ok', wind: 'good', heat: 'ok' },
      weatherNote: 'Mostly hopping between shops, so rain matters little.',
      covered: 60,
      months: months('gggggggggggg'),
      monthsNote: 'No real seasonal swing.',
      bestTimes: [{ from: 12, to: 18, label: 'Shops open from noon' }],
      visibility: 'none',
      timeOfDay: { morning: 'poor', afternoon: 'good', evening: 'ok', note: 'Shops open from noon. Evenings turn to bars and live houses as the shops close.' },
    },
    effort: {
      level: 2, walkKm: 3, steps: 20, climbM: 0, onFeetMin: 150, shade: 40,
      wheelchair: 'partial', stroller: 'partial', triggers: ['crowds'], recovery: 'low',
      note: 'Easy, flat wandering.',
    },
    vibe: {
      local: 80, energy: 55, nature: 5,
      crowds: { weekday: shimoWk, weekend: busier(shimoWk, 1.45) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'good' },
      onlyHere: 'common', onlyHereNote: 'Most big cities have a vintage district.',
      photo: 35,
    },
    logistics: {
      visitMin: [120, 240], queueMin: [0, 0], travelMin: 30,
      hours: week('12:00', '20:00'),
      booking: 'none', timing: 'flexible', station: 'Shimo-kitazawa', walkMin: 0, lockers: true,
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return train from Shibuya', yen: 400 },
        { label: 'Coffee', yen: 600 },
        { label: 'Vintage finds', yen: 5000, optional: true },
      ],
      cash: 'mostly-cash',
    },
  },
  {
    id: 'nakano-broadway',
    name: 'Nakano Broadway',
    ja: '中野ブロードウェイ',
    area: '13114',
    lonlat: [139.6656, 35.7088],
    kind: 'Collector mall',
    blurb: 'A 1966 mall of about 300 small shops for anime, figures and vintage watches.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'good', heavyRain: 'good', wind: 'good', heat: 'good' },
      weatherNote: 'Indoors, reached through a covered shopping arcade.',
      covered: 100,
      months: months('gggggggggggg'),
      monthsNote: 'No seasonal swing.',
      bestTimes: [{ from: 12, to: 20, label: 'Most shops open by noon' }],
      visibility: 'none',
      timeOfDay: { morning: 'poor', afternoon: 'good', evening: 'ok', note: 'Most shops open around noon. By evening there are only a few hours before the 20:00 close.' },
    },
    effort: {
      level: 1, walkKm: 1.5, steps: 60, climbM: 0, onFeetMin: 120, shade: 100,
      wheelchair: 'partial', stroller: 'partial', triggers: ['enclosed', 'crowds'], recovery: 'low',
      note: 'Four floors of narrow corridors.',
    },
    vibe: {
      local: 65, energy: 50, nature: 2,
      crowds: { weekday: nakanoWk, weekend: busier(nakanoWk, 1.5) },
      suits: { solo: 'good', couple: 'ok', family: 'ok', friends: 'good' },
      onlyHere: 'only-japan', onlyHereNote: 'Collector culture at this scale is hard to find outside Japan.',
      photo: 30,
    },
    logistics: {
      visitMin: [90, 180], queueMin: [0, 0], travelMin: 25,
      hours: week('12:00', '20:00'),
      booking: 'none', timing: 'flexible', station: 'Nakano', walkMin: 5, lockers: true,
      holidayNote: 'Many shops open late and close on Wednesdays.',
    },
    cost: {
      entry: 0,
      extras: [
        { label: 'Return JR from Tokyo Station', yen: 400 },
        { label: 'Gacha and snacks', yen: 1500, optional: true },
      ],
      cash: 'mostly-cash',
    },
  },
  {
    id: 'kiyosumi-gardens',
    name: 'Kiyosumi Gardens',
    ja: '清澄庭園',
    area: '13108',
    lonlat: [139.7975, 35.6806],
    kind: 'Stroll garden',
    blurb: 'A Meiji-era garden of stepping stones laid around a large pond.',
    conditions: {
      weather: { sun: 'good', cloud: 'good', rain: 'ok', heavyRain: 'poor', wind: 'ok', heat: 'ok' },
      weatherNote: 'An open garden with one rest house.',
      covered: 5,
      months: months('ooggggooggg' + 'o'),
      monthsNote: 'Azaleas in May, hydrangeas in June.',
      bestTimes: [{ from: 9, to: 11, label: 'Morning light on the pond' }],
      visibility: 'none',
      timeOfDay: { morning: 'good', afternoon: 'ok', evening: 'poor', note: 'Morning light on the pond is the best of it. Last entry 16:30, closed by 17:00.' },
    },
    effort: {
      level: 1, walkKm: 1, steps: 0, climbM: 0, onFeetMin: 45, shade: 30,
      wheelchair: 'partial', stroller: 'partial', triggers: ['water'], recovery: 'low',
      note: 'Stepping stones run along the pond edge and are uneven underfoot.',
    },
    vibe: {
      local: 70, energy: 5, nature: 70,
      crowds: { weekday: kiyosumiWk, weekend: busier(kiyosumiWk, 1.9) },
      suits: { solo: 'good', couple: 'good', family: 'ok', friends: 'ok' },
      onlyHere: 'only-japan', onlyHereNote: 'A classic kaiyū-shiki stroll garden.',
      photo: 50,
    },
    logistics: {
      visitMin: [40, 60], queueMin: [0, 0], travelMin: 20,
      hours: week('09:00', '17:00'), lastEntryMin: 30,
      booking: 'none', timing: 'flexible', station: 'Kiyosumi-shirakawa', walkMin: 3, lockers: false,
    },
    cost: {
      entry: 150,
      extras: [{ label: 'Return metro from Tokyo Station', yen: 360 }],
      cash: 'mostly-cash',
      freeNote: 'Free on Greenery Day (4 May) and Tokyo Citizens’ Day (1 October).',
    },
  },
  {
    id: 'tokyo-skytree',
    name: 'Tokyo Skytree',
    ja: '東京スカイツリー',
    area: '13107',
    lonlat: [139.8107, 35.7101],
    kind: 'Observation tower',
    blurb: 'The 634 m broadcast tower, with enclosed decks at 350 m and 450 m.',
    conditions: {
      weather: { sun: 'good', cloud: 'ok', rain: 'ok', heavyRain: 'ok', wind: 'ok', heat: 'good' },
      weatherNote: 'The decks are enclosed, but cloud can blank out the view.',
      covered: 100,
      months: months('gggoopoooggg'),
      monthsNote: 'The air is clearest from December to February.',
      bestTimes: [
        { from: 16, to: 18, label: 'Sunset' },
        { from: 19, to: 21, label: 'Night view' },
      ],
      visibility: 'critical',
      visibilityNote: 'If the top is in cloud, you see white.',
      timeOfDay: { morning: 'ok', afternoon: 'ok', evening: 'good', note: 'Sunset and the night view are the reason to go. Daytime queues peak mid-afternoon.' },
    },
    effort: {
      level: 1, walkKm: 0.5, steps: 0, climbM: 0, onFeetMin: 60, shade: 100,
      wheelchair: 'yes', stroller: 'yes', triggers: ['heights'], recovery: 'low',
      note: 'Lifts all the way up.',
    },
    vibe: {
      local: 15, energy: 45, nature: 5,
      crowds: { weekday: skytreeWk, weekend: busier(skytreeWk, 1.3) },
      suits: { solo: 'ok', couple: 'good', family: 'good', friends: 'ok' },
      onlyHere: 'common', onlyHereNote: 'Most big cities have a tower. This is the tallest in Japan.',
      photo: 85,
    },
    logistics: {
      visitMin: [60, 90], queueMin: [15, 45], travelMin: 20,
      hours: week('10:00', '21:00'), lastEntryMin: 60,
      booking: 'recommended', leadDays: 3, bookingNote: 'Dated tickets skip the ticket-hall queue.',
      timing: 'fixed', station: 'Oshiage', walkMin: 1, lockers: true,
    },
    cost: {
      entry: 3100,
      extras: [{ label: 'Return metro from Tokyo Station', yen: 360 }],
      cash: 'cards',
    },
  },
];

export const attractionById = (id: string) => ATTRACTIONS.find((a) => a.id === id);

// Data checks: twelve months, seven days, eighteen crowd hours.
for (const a of ATTRACTIONS) {
  console.assert(a.conditions.months.length === 12, `${a.id}: needs 12 months`);
  console.assert(a.logistics.hours.length === 7, `${a.id}: needs 7 days`);
  console.assert(a.vibe.crowds.weekday.length === 18 && a.vibe.crowds.weekend.length === 18, `${a.id}: needs 18 crowd hours`);
}
