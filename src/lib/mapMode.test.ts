import { expect, test } from 'vitest';
import { readMapMode, writeMapMode } from './mapMode';

test('defaults to map; reads a stored 3d', () => {
  expect(readMapMode({ getItem: () => null })).toBe('map');
  expect(readMapMode({ getItem: () => '3d' })).toBe('3d');
});

test('junk or a throwing store reads as map', () => {
  expect(readMapMode({ getItem: () => 'banana' })).toBe('map');
  expect(
    readMapMode({
      getItem: () => {
        throw new Error('denied');
      },
    }),
  ).toBe('map');
});

test('write survives a throwing store', () => {
  expect(() =>
    writeMapMode('3d', {
      setItem: () => {
        throw new Error('quota');
      },
    }),
  ).not.toThrow();
});
