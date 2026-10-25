// Countries shown on the landing globe and given a country page. Only Japan
// has checked attractions so far; the rest are "coming soon" with landmark photos.
import { WORLD, slug, type Place } from './places';

export interface Landmark {
  /** Photo id in public/photos (see scripts/build-photos.mjs). */
  photo: string;
  name: string;
}

export interface Destination {
  slug: string;
  name: string;
  /** The country's own name in its script, when it differs. */
  local?: string;
  /** Natural Earth id, to find the country's shape on the globe. */
  worldId: string;
  /** Where the globe card's leader line attaches. */
  anchor: [number, number];
  oneLiner: string;
  live: boolean;
  landmarks: Landmark[];
}

export const DESTINATIONS: Destination[] = [
  {
    slug: 'japan',
    name: 'Japan',
    local: '日本',
    worldId: '392',
    anchor: [138.5, 36.5],
    oneLiner: 'Bullet trains, ancient temples and the world’s best convenience stores.',
    live: true,
    landmarks: [
      { photo: 'senso-ji', name: 'Sensō-ji, Tokyo' },
      { photo: 'meiji-jingu', name: 'Meiji Jingu, Tokyo' },
      { photo: 'mount-takao', name: 'Mount Takao, Tokyo' },
    ],
  },
  {
    slug: 'south-korea',
    name: 'South Korea',
    local: '대한민국',
    worldId: '410',
    anchor: [127.8, 36.4],
    oneLiner: 'Royal palaces, K-pop and barbecue sizzling at every table.',
    live: false,
    landmarks: [
      { photo: 'kr-1', name: 'Gyeongbokgung Palace, Seoul' },
      { photo: 'kr-2', name: 'Seoul from Namsan' },
      { photo: 'kr-3', name: 'Seongsan Ilchulbong, Jeju' },
    ],
  },
  {
    slug: 'thailand',
    name: 'Thailand',
    local: 'ประเทศไทย',
    worldId: '764',
    anchor: [101, 15.5],
    oneLiner: 'Golden temples, street food and limestone islands.',
    live: false,
    landmarks: [
      { photo: 'th-1', name: 'Wat Arun, Bangkok' },
      { photo: 'th-2', name: 'Phi Phi Islands' },
      { photo: 'th-3', name: 'Doi Suthep, Chiang Mai' },
    ],
  },
  {
    slug: 'australia',
    name: 'Australia',
    worldId: '036',
    anchor: [134, -25],
    oneLiner: 'The Opera House, the Outback and the Great Barrier Reef.',
    live: false,
    landmarks: [
      { photo: 'au-1', name: 'Sydney Opera House' },
      { photo: 'au-2', name: 'Uluru' },
      { photo: 'au-3', name: 'Great Barrier Reef' },
    ],
  },
  {
    slug: 'new-zealand',
    name: 'New Zealand',
    local: 'Aotearoa',
    worldId: '554',
    anchor: [172.5, -41.5],
    oneLiner: 'Fjords, alpine lakes and the hills of Middle-earth.',
    live: false,
    landmarks: [
      { photo: 'nz-1', name: 'Milford Sound' },
      { photo: 'nz-2', name: 'Lake Tekapo' },
      { photo: 'nz-3', name: 'Hobbiton' },
    ],
  },
  {
    slug: 'egypt',
    name: 'Egypt',
    local: 'مصر',
    worldId: '818',
    anchor: [30.5, 26.5],
    oneLiner: 'The pyramids of Giza and temples along the Nile.',
    live: false,
    landmarks: [
      { photo: 'eg-1', name: 'Pyramids of Giza' },
      { photo: 'eg-2', name: 'Abu Simbel' },
      { photo: 'eg-3', name: 'Karnak, Luxor' },
    ],
  },
  {
    slug: 'morocco',
    name: 'Morocco',
    local: 'المغرب',
    worldId: '504',
    anchor: [-6.5, 31.8],
    oneLiner: 'Blue-washed towns, buzzing souks and Sahara dunes.',
    live: false,
    landmarks: [
      { photo: 'ma-1', name: 'Chefchaouen' },
      { photo: 'ma-2', name: 'Jemaa el-Fnaa, Marrakesh' },
      { photo: 'ma-3', name: 'Merzouga dunes' },
    ],
  },
  {
    slug: 'italy',
    name: 'Italy',
    local: 'Italia',
    worldId: '380',
    anchor: [12.5, 42.8],
    oneLiner: 'Ancient Rome, Renaissance art and pasta made by hand.',
    live: false,
    landmarks: [
      { photo: 'it-1', name: 'Colosseum, Rome' },
      { photo: 'it-2', name: 'Grand Canal, Venice' },
      { photo: 'it-3', name: 'Positano, Amalfi Coast' },
    ],
  },
  {
    slug: 'france',
    name: 'France',
    worldId: '250',
    anchor: [2.4, 46.6],
    oneLiner: 'The Eiffel Tower, café terraces and fields of lavender.',
    live: false,
    landmarks: [
      { photo: 'fr-1', name: 'Eiffel Tower, Paris' },
      { photo: 'fr-2', name: 'Mont-Saint-Michel' },
      { photo: 'fr-3', name: 'Lavender in Provence' },
    ],
  },
  {
    slug: 'iceland',
    name: 'Iceland',
    local: 'Ísland',
    worldId: '352',
    anchor: [-18.6, 64.9],
    oneLiner: 'Waterfalls, glaciers and the northern lights.',
    live: false,
    landmarks: [
      { photo: 'is-1', name: 'Skógafoss' },
      { photo: 'is-2', name: 'Jökulsárlón' },
      { photo: 'is-3', name: 'Kirkjufell' },
    ],
  },
  {
    slug: 'usa',
    name: 'United States',
    worldId: '840',
    anchor: [-98, 39],
    oneLiner: 'Canyons, skylines and road trips without end.',
    live: false,
    landmarks: [
      { photo: 'us-1', name: 'Grand Canyon' },
      { photo: 'us-2', name: 'Golden Gate Bridge' },
      { photo: 'us-3', name: 'Manhattan' },
    ],
  },
  {
    slug: 'peru',
    name: 'Peru',
    local: 'Perú',
    worldId: '604',
    anchor: [-75, -9.5],
    oneLiner: 'Machu Picchu above the clouds and the kitchens of Lima.',
    live: false,
    landmarks: [
      { photo: 'pe-1', name: 'Machu Picchu' },
      { photo: 'pe-2', name: 'Plaza de Armas, Cusco' },
      { photo: 'pe-3', name: 'Rainbow Mountain' },
    ],
  },
  {
    slug: 'brazil',
    name: 'Brazil',
    local: 'Brasil',
    worldId: '076',
    anchor: [-51, -10.5],
    oneLiner: 'Rio’s beaches, the Amazon and the biggest Carnival on earth.',
    live: false,
    landmarks: [
      { photo: 'br-1', name: 'Christ the Redeemer, Rio' },
      { photo: 'br-2', name: 'Iguazu Falls' },
      { photo: 'br-3', name: 'Copacabana, Rio' },
    ],
  },
];

export const destinationBySlug = (s?: string) => DESTINATIONS.find((d) => d.slug === s);
export const destinationByWorldId = (id: string) => DESTINATIONS.find((d) => d.worldId === id);
export const worldShape = (d: Destination): Place | undefined => WORLD.find((f) => f.id === d.worldId);
/** The map URL uses the Natural Earth name ("united-states-of-america"), not the short slug. */
export const countrySlugOf = (d: Destination) => slug(worldShape(d)!.properties.name);
