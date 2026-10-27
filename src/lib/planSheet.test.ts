import { expect, test } from 'vitest';
import { HEAD_PHONE, PEEK_PHONE, SHEET_CLEAR, headBottom, phoneInsets, sheetBarH, sheetTopAt } from './planSheet';
import { guideProgress, settleTarget } from './useGuideScroll';

test('the sheet rests at the peek above the tab bar and comes up to its top', () => {
  expect(sheetTopAt(0, { vh: 844, top: 0 })).toBe(844 - PEEK_PHONE - SHEET_CLEAR);
  expect(sheetTopAt(1, { vh: 844, top: 0 })).toBe(0);
  expect(sheetTopAt(1, { vh: 844, top: 47 })).toBe(47);
  expect(sheetTopAt(0.5, { vh: 780, peek: 100, clear: 80, top: 0 })).toBe(300);
});

test('progress outside 0..1 stays at the ends', () => {
  expect(sheetTopAt(-1, { vh: 844, top: 0 })).toBe(sheetTopAt(0, { vh: 844, top: 0 }));
  expect(sheetTopAt(2, { vh: 844, top: 0 })).toBe(0);
});

test('barH puts the fully-up sheet exactly at its top, whatever the viewport and safe area', () => {
  for (const vh of [844, 780, 640]) {
    for (const top of [0, 24, 47]) {
      const barH = sheetBarH(top);
      // The scroll that useGuideScroll calls progress 1 (and settles to).
      const span = vh - PEEK_PHONE - barH;
      expect(guideProgress(span, vh, PEEK_PHONE, barH)).toBe(1);
      // The sheet sits vh - peek - clear down the page (styles.css: .plan-sheet's margin-top).
      const onScreen = vh - PEEK_PHONE - SHEET_CLEAR - span;
      expect(onScreen).toBe(top);
      expect(sheetTopAt(guideProgress(span, vh, PEEK_PHONE, barH), { vh, top })).toBe(top);
    }
  }
});

test('halfway up the sheet settles to the nearer end', () => {
  const vh = 844;
  const barH = sheetBarH(0);
  const span = vh - PEEK_PHONE - barH;
  expect(settleTarget(guideProgress(span * 0.3, vh, PEEK_PHONE, barH))).toBe('top');
  expect(settleTarget(guideProgress(span * 0.7, vh, PEEK_PHONE, barH))).toBe('guides');
});

test('the map frames between the header and the peek', () => {
  expect(headBottom(0)).toBe(HEAD_PHONE);
  expect(headBottom(47)).toBe(HEAD_PHONE + 47);
  const i = phoneInsets(0);
  expect(i.top).toBeGreaterThan(HEAD_PHONE);
  expect(i.bottom).toBe(PEEK_PHONE + SHEET_CLEAR + 16);
  expect(phoneInsets(47).top - phoneInsets(0).top).toBe(47);
});

test('the header leaves room for the map on the smallest phones', () => {
  // 360 × 640: the band between the header and the resting sheet still shows a good piece of map.
  const vh = 640;
  expect(sheetTopAt(0, { vh, top: 0 }) - headBottom(0)).toBeGreaterThanOrEqual(200);
});
