import { atom } from 'jotai';

export interface Computation {
  name: string;
  inputs?: Record<string, unknown>;
  description?: string;
}

export interface SupportedSensor {
  name: string;
  locations: string[];
  computations: Computation[];
}

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
    name: 'loading',
    isCustom: false,
    sensors: [
      { id: 'default-1', type: 'Movella DOT', loc: 'Left ankle', comp: 'Loading' },
      { id: 'default-2', type: 'Movella DOT', loc: 'Right ankle', comp: 'Loading' },
    ],
  },
]);

export const selectedSetupIdAtom = atom<string>('default');

export const sessionNameAtom = atom<string>('');
export const subjectPrefixAtom = atom<string>('');
export const activeActivityAtom = atom<string | false>(false);
export const subjectCountAtom = atom<number>(4);

// Format: `${subjectId}:${sensorId}`
export const placedSensorsAtom = atom<Set<string>>(new Set<string>());

export const serverReadyAtom = atom<boolean>(false);
export const supportedSensorsAtom = atom<string[]>([]);
export const supportedLocationsAtom = atom<Record<string, string[]>>({});
export const supportedComputationsAtom = atom<Record<string, Computation[]>>({});
