// Builds small GeoJSON files for the map from world-atlas (Natural Earth)
// and jpn-atlas (GSI Global Map Japan). Run with: node scripts/build-geo.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as topo from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoArea, geoAzimuthalEqualArea } from 'd3-geo';

// jpn-atlas ships pre-projected pixel coordinates. This is the projection from its
// prepare script; inverting it gives longitude and latitude back.
const jpnProjection = geoAzimuthalEqualArea().center([138.5, 36 - 18 / 60]).rotate([-138.5, -36 + 18 / 60]).scale(1700).translate([2500, -1930]);
function unproject(geom) {
  const r = (c) => (typeof c[0] === 'number' ? jpnProjection.invert(c) : c.map(r));
  return { type: geom.type, coordinates: r(geom.coordinates) };
}

const require = createRequire(import.meta.url);
const out = new URL('../src/data/geo/', import.meta.url);
mkdirSync(out, { recursive: true });

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
function roundGeom(geom, d) {
  const r = (c) => (typeof c[0] === 'number' ? [round(c[0], d), round(c[1], d)] : c.map(r));
  return { type: geom.type, coordinates: r(geom.coordinates) };
}
// d3-geo wants clockwise outer rings. GSI data winds the other way, which makes
// each polygon cover the whole globe except itself; reverse those rings.
function rewind(geom) {
  const fix = (rings) => (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings);
  if (geom.type === 'Polygon') return { ...geom, coordinates: fix(geom.coordinates) };
  if (geom.type === 'MultiPolygon') return { ...geom, coordinates: geom.coordinates.map(fix) };
  return geom;
}
function write(name, fc) {
  const json = JSON.stringify(fc);
  writeFileSync(new URL(name, out), json);
  console.log(name, (json.length / 1024).toFixed(0) + ' KB', fc.features.length + ' features');
}

// World: Natural Earth 1:50m countries, lightly simplified.
{
  let t = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));
  t = presimplify(t);
  t = simplify(t, quantile(t, 0.14));
  const fc = topo.feature(t, t.objects.countries);
  const seen = new Set(); // Natural Earth reuses 036 for Australia and Ashmore
  const uid = (f) => { const id = String(f.id ?? f.properties.name); const u = seen.has(id) ? f.properties.name : id; seen.add(u); return u; };
  write('world.json', {
    type: 'FeatureCollection',
    features: fc.features
      .filter((f) => f.geometry && f.properties.name !== 'Antarctica')
      .map((f) => ({ type: 'Feature', id: uid(f), properties: { name: f.properties.name }, geometry: roundGeom(f.geometry, 3) })),
  });
}

const PREFS = ['Hokkaidō','Aomori','Iwate','Miyagi','Akita','Yamagata','Fukushima','Ibaraki','Tochigi','Gunma','Saitama','Chiba','Tokyo','Kanagawa','Niigata','Toyama','Ishikawa','Fukui','Yamanashi','Nagano','Gifu','Shizuoka','Aichi','Mie','Shiga','Kyoto','Osaka','Hyōgo','Nara','Wakayama','Tottori','Shimane','Okayama','Hiroshima','Yamaguchi','Tokushima','Kagawa','Ehime','Kōchi','Fukuoka','Saga','Nagasaki','Kumamoto','Ōita','Miyazaki','Kagoshima','Okinawa'];

// Tokyo municipalities on the mainland (islands 133xx–134xx left out).
const TOKYO = {
  13101: ['Chiyoda', '千代田区'], 13102: ['Chūō', '中央区'], 13103: ['Minato', '港区'], 13104: ['Shinjuku', '新宿区'],
  13105: ['Bunkyō', '文京区'], 13106: ['Taitō', '台東区'], 13107: ['Sumida', '墨田区'], 13108: ['Kōtō', '江東区'],
  13109: ['Shinagawa', '品川区'], 13110: ['Meguro', '目黒区'], 13111: ['Ōta', '大田区'], 13112: ['Setagaya', '世田谷区'],
  13113: ['Shibuya', '渋谷区'], 13114: ['Nakano', '中野区'], 13115: ['Suginami', '杉並区'], 13116: ['Toshima', '豊島区'],
  13117: ['Kita', '北区'], 13118: ['Arakawa', '荒川区'], 13119: ['Itabashi', '板橋区'], 13120: ['Nerima', '練馬区'],
  13121: ['Adachi', '足立区'], 13122: ['Katsushika', '葛飾区'], 13123: ['Edogawa', '江戸川区'],
  13201: ['Hachiōji', '八王子市'], 13202: ['Tachikawa', '立川市'], 13203: ['Musashino', '武蔵野市'], 13204: ['Mitaka', '三鷹市'],
  13205: ['Ōme', '青梅市'], 13206: ['Fuchū', '府中市'], 13207: ['Akishima', '昭島市'], 13208: ['Chōfu', '調布市'],
  13209: ['Machida', '町田市'], 13210: ['Koganei', '小金井市'], 13211: ['Kodaira', '小平市'], 13212: ['Hino', '日野市'],
  13213: ['Higashimurayama', '東村山市'], 13214: ['Kokubunji', '国分寺市'], 13215: ['Kunitachi', '国立市'], 13218: ['Fussa', '福生市'],
  13219: ['Komae', '狛江市'], 13220: ['Higashiyamato', '東大和市'], 13221: ['Kiyose', '清瀬市'], 13222: ['Higashikurume', '東久留米市'],
  13223: ['Musashimurayama', '武蔵村山市'], 13224: ['Tama', '多摩市'], 13225: ['Inagi', '稲城市'], 13227: ['Hamura', '羽村市'],
  13228: ['Akiruno', 'あきる野市'], 13229: ['Nishitokyo', '西東京市'], 13303: ['Mizuho', '瑞穂町'], 13305: ['Hinode', '日の出町'],
  13307: ['Hinohara', '檜原村'], 13308: ['Okutama', '奥多摩町'],
};

{
  const raw = JSON.parse(readFileSync(require.resolve('jpn-atlas/japan/japan.json'), 'utf8'));

  // Prefectures: simplified harder, they are only seen at country scale.
  let t = presimplify(JSON.parse(JSON.stringify(raw)));
  t = simplify(t, quantile(t, 0.06));
  const prefs = topo.feature(t, t.objects.prefectures);
  write('japan-prefectures.json', {
    type: 'FeatureCollection',
    features: prefs.features.map((f) => {
      const code = String(f.id).padStart(2, '0');
      return { type: 'Feature', id: code, properties: { name: PREFS[Number(code) - 1] }, geometry: rewind(roundGeom(unproject(f.geometry), 3)) };
    }),
  });

  // Tokyo municipalities: keep more detail; several codes come in pieces, so merge by code.
  let tt = presimplify(JSON.parse(JSON.stringify(raw)));
  tt = simplify(tt, quantile(tt, 0.5));
  const byCode = new Map();
  for (const g of tt.objects.municipalities.geometries) {
    const code = Number(g.id);
    if (!TOKYO[code]) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(g);
  }
  write('tokyo.json', {
    type: 'FeatureCollection',
    features: [...byCode].map(([code, geoms]) => ({
      type: 'Feature',
      id: String(code),
      properties: { name: TOKYO[code][0], ja: TOKYO[code][1], kind: code < 13200 ? 'ward' : code < 13300 ? 'city' : 'town' },
      geometry: rewind(roundGeom(unproject(topo.merge(tt, geoms)), 4)),
    })),
  });
}
