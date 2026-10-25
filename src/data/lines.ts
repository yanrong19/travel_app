// The five factor groups, each drawn as a Tokyo Metro style line.
// Hues follow real line colours: Tozai, Marunouchi, Fukutoshin, Chiyoda, Ginza.
export type LineId = 'conditions' | 'effort' | 'vibe' | 'logistics' | 'cost';

export interface Line {
  id: LineId;
  code: string;
  name: string;
  question: string;
}

export const LINES: Line[] = [
  { id: 'conditions', code: 'C', name: 'Conditions', question: 'Will weather or season spoil it?' },
  { id: 'effort', code: 'E', name: 'Effort', question: 'How hard is it on the body?' },
  { id: 'vibe', code: 'V', name: 'Vibe', question: 'What does it feel like to be there?' },
  { id: 'logistics', code: 'L', name: 'Logistics', question: 'What does it take to actually go?' },
  { id: 'cost', code: '¥', name: 'Cost', question: 'What will it really cost?' },
];

export const lineById = (id: LineId) => LINES.find((l) => l.id === id)!;
