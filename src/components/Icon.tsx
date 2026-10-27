// One outline icon set, 1.5px stroke on a 24px grid.
const PATHS = {
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  cloud: 'M7.5 18h9a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 6.6 11.1 3.5 3.5 0 0 0 7.5 18Z',
  rain: 'M7.5 14h9a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.2 8.1 3 3 0 0 0 7.5 14ZM9 17l-1 2.5M13 17l-1 2.5M17 17l-1 2.5',
  storm: 'M7.5 13h9a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.2 7.1 3 3 0 0 0 7.5 13ZM8 16l-1.2 3M11.5 16l-1.2 3M15 16l-1.2 3M18.5 16l-1.2 3',
  wind: 'M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h7',
  heat: 'M12 14.5V5a2 2 0 1 0-4 0v9.5a3.5 3.5 0 1 0 4 0ZM10 11v5M16 6h3M16 9.5h3',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  bookmark: 'M7 4h10v16l-5-3.8L7 20V4Z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z',
  map: 'M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4ZM9 4v14M15 6v14',
  home: 'M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5V11Z',
  clock: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v4.5l3 2',
  yen: 'M7 4l5 7 5-7M12 11v9M8 13h8M8 16.5h8',
  walk: 'M13 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 21l2-6 2.5 2.5V21M9 11l2.5-3 3 1.5 2 3M11.5 8 10 13l2 2',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M17 14.5a4.5 4.5 0 0 1 3.5 4.5',
  ticket: 'M4 8.5V6h16v2.5a2 2 0 0 0 0 4V15H4v-2.5a2 2 0 0 0 0-4ZM14 6v9',
  zoomOut: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20M7.5 10.5h6',
  minus: 'M5 12h14',
  train: 'M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2ZM5 11h14M8.5 15h.01M15.5 15h.01M8 18l-2 3M16 18l2 3',
  trip: 'M5 7h14v12H5zM9 7V5h6v2M5 11h14',
  target: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 3v3M12 18v3M3 12h3M18 12h3M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  alert: 'M12 4 21 19H3L12 4ZM12 10v4M12 16.5h.01',
  chevronUp: 'M6 15l6-6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  swap: 'M5 8h13l-3.5-3.5M19 16H6l3.5 3.5',
  sliders: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4',
  calendar: 'M5 6.5h14V20H5zM5 10.5h14M9 4v4.5M15 4v4.5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className, filled = false }: { name: IconName; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
