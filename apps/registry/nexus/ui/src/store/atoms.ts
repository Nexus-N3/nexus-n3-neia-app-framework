import { atom } from 'jotai';

export interface Sensor {
  id: string; // Add ID to sensor for key/reference
  type: string;
  loc: string; // Comma separated if multiple
  comp: string;
}

export interface Setup {
  id: string;
  name: string;
  isCustom: boolean;
  sensors: Sensor[];
}

export const setupsAtom = atom<Setup[]>([
  {
    id: 'default',
    name: 'DEFAULT',
    isCustom: false,
    sensors: [
      { id: 'default-1', type: 'MOVELLA DOT', loc: 'Left ankle', comp: 'Loading' },
      { id: 'default-2', type: 'MOVELLA DOT', loc: 'Right ankle', comp: 'Loading' },
    ],
  },
]);

export const selectedSetupIdAtom = atom<string>('default');

export const sessionNameAtom = atom<string>('');
export const subjectCountAtom = atom<number>(4);
