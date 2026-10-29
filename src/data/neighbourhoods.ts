// Neighbourhoods under Tokyo: the level between a ward and an attraction.
// Centres and radii are approximate and sized to hold every attraction listed in them.

export interface Neighbourhood {
  id: string;
  name: string;
  ja: string;
  /** [lon, lat] */
  center: [number, number];
  /** Radius of the neighbourhood's circle, in metres. */
  radiusM: number;
}

/** In display order. */
export const NEIGHBOURHOODS: Neighbourhood[] = [
  { id: 'JP-N-TOKYO-SHIBUYA', name: 'Shibuya', ja: '渋谷', center: [139.7018, 35.66], radiusM: 700 },
  { id: 'JP-N-TOKYO-HARAJUKU', name: 'Harajuku & Omotesandō', ja: '原宿・表参道', center: [139.704, 35.669], radiusM: 1700 },
  { id: 'JP-N-TOKYO-SHINJUKU', name: 'Shinjuku', ja: '新宿', center: [139.704, 35.691], radiusM: 1500 },
  { id: 'JP-N-TOKYO-ASAKUSA', name: 'Asakusa', ja: '浅草', center: [139.795, 35.7145], radiusM: 1000 },
  { id: 'JP-N-TOKYO-UENO', name: 'Ueno', ja: '上野', center: [139.7745, 35.7141], radiusM: 1500 },
  { id: 'JP-N-TOKYO-YANAKA', name: 'Yanaka', ja: '谷中', center: [139.766, 35.7278], radiusM: 1000 },
  { id: 'JP-N-TOKYO-GINZA', name: 'Ginza & Tsukiji', ja: '銀座・築地', center: [139.769, 35.668], radiusM: 1500 },
  { id: 'JP-N-TOKYO-ODAIBA', name: 'Odaiba & Toyosu', ja: 'お台場・豊洲', center: [139.7898, 35.6491], radiusM: 3000 },
  { id: 'JP-N-TOKYO-OSHIAGE', name: 'Oshiage', ja: '押上', center: [139.8107, 35.7101], radiusM: 800 },
  { id: 'JP-N-TOKYO-RYOGOKU', name: 'Ryōgoku', ja: '両国', center: [139.7934, 35.6969], radiusM: 1000 },
  { id: 'JP-N-TOKYO-KIYOSUMI', name: 'Kiyosumi', ja: '清澄', center: [139.7975, 35.6806], radiusM: 1200 },
  { id: 'JP-N-TOKYO-SHIMOKITAZAWA', name: 'Shimokitazawa', ja: '下北沢', center: [139.668, 35.6616], radiusM: 1000 },
  { id: 'JP-N-TOKYO-NAKANO', name: 'Nakano', ja: '中野', center: [139.6656, 35.7088], radiusM: 1200 },
  { id: 'JP-N-TOKYO-SETAGAYA', name: 'Setagaya', ja: '世田谷', center: [139.648, 35.6086], radiusM: 1500 },
  { id: 'JP-N-TOKYO-MITAKA', name: 'Mitaka & Kichijōji', ja: '三鷹・吉祥寺', center: [139.575, 35.7], radiusM: 1500 },
  { id: 'JP-N-TOKYO-TAKAO', name: 'Takao', ja: '高尾', center: [139.2437, 35.6251], radiusM: 2500 },
];

export const neighbourhoodById = (id: string) => NEIGHBOURHOODS.find((n) => n.id === id);
