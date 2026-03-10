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

export const siteNameAtom = atom<string>('Lunar facility');

export const selectedSetupIdAtom = atom<string>('default');

export const sessionNameAtom = atom<string>('');
export const subjectPrefixAtom = atom<string>('');
export const activeActivityAtom = atom<string | false>(false);
export const subjectCountAtom = atom<number>(1);

// Format: `${subjectId}:${sensorId}`
export const placedSensorsAtom = atom<Set<string>>(new Set<string>());

export const serverReadyAtom = atom<boolean>(false);
export const supportedSensorsAtom = atom<string[]>([]);
export const supportedLocationsAtom = atom<Record<string, string[]>>({});
export const supportedComputationsAtom = atom<Record<string, Computation[]>>({});

// Discovered sensors per subject: { "subject_id": ["D4:22:CD:00:AA:6F", ...] }
export interface DiscoveredSensorsMap {
  [subjectId: string]: string[];
}
export const discoveredSensorsAtom = atom<DiscoveredSensorsMap>({});

// Connected sensors per subject: { "subject_id": ["D4:22:CD:00:AA:6F (CONNECTED)", ...] }
export interface ConnectedSensorsMap {
  [subjectId: string]: string[];
}
export const connectedSensorsAtom = atom<ConnectedSensorsMap>({});

export interface LatestSensorResult {
  address: string;
  location: string;
  algorithmName: string;
  bands: Array<{
    bandName: string;
    x: number | null;
    y: number | null;
    z: number | null;
    mag: number | null;
  }>;
}

export interface LatestComputeResultsMap {
  [subjectId: string]: {
    [address: string]: LatestSensorResult;
  };
}

export const latestComputeResultsAtom = atom<LatestComputeResultsMap>({});

export interface SubjectResultHistoryEntry {
  timestamp: number;
  resultCount: number;
  results: LatestSensorResult[];
}

export interface ComputeResultsHistoryMap {
  [subjectId: string]: SubjectResultHistoryEntry[];
}

export const computeResultsHistoryAtom = atom<ComputeResultsHistoryMap>({});
