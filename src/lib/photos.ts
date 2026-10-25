import credits from '../data/photo-credits.json';

export type PhotoSize = 720 | 1600;

/** Web-sized copies made by scripts/build-photos.mjs. */
export const photo = (id: string, size: PhotoSize = 720) => `/photos/${id}-${size}.webp`;
export const photoSet = (id: string) => `${photo(id, 720)} 720w, ${photo(id, 1600)} 1600w`;

export interface Credit {
  id: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  page: string;
}

export const CREDITS: Credit[] = (credits as { file: string; title: string; creator: string; license: string; licenseUrl: string; page: string }[]).map(
  (c) => ({
    id: c.file.split('/').pop()!.replace(/\.jpg$/, ''),
    title: c.title,
    creator: c.creator,
    license: c.license,
    licenseUrl: c.licenseUrl,
    page: c.page,
  }),
);

export const creditFor = (id: string) => CREDITS.find((c) => c.id === id);
