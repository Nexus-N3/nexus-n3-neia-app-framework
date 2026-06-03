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
    name: 'Loading intensity',
    isCustom: false,
    sensors: [
      { id: 'default-1', type: 'Movella DOT', loc: 'Left ankle', comp: 'standard_loading_intensity' },
      { id: 'default-2', type: 'Movella DOT', loc: 'Right ankle', comp: 'standard_loading_intensity' },
    ],
  },
]);

export const siteNameAtom = atom<string>('Lunar facility');

export const selectedSetupIdAtom = atom<string>('default');

export const sessionNameAtom = atom<string>('');
export const subjectPrefixAtom = atom<string>('');
export const activeActivityAtom = atom<string | false>(false);
export const subjectCountAtom = atom<number>(1);
export const selectedSubjectAtom = atom<{ subject_id: string; display_name: string; subject_type?: string | null } | null>(null);

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

export interface ConnectedSensorInfo {
  address: string;
  status: string;
  location: string | null;
}

// Connected sensors per subject keyed by subject id.
export interface ConnectedSensorsMap {
  [subjectId: string]: ConnectedSensorInfo[];
}
export const connectedSensorsAtom = atom<ConnectedSensorsMap>({});

export interface BatteryStatusInfo {
  batteryLevel: number | null;
  isCharging: boolean | null;
}

export interface BatteryStatusMap {
  [address: string]: BatteryStatusInfo;
}

export const batteryStatusesAtom = atom<BatteryStatusMap>({});

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
export const latestIntermediateResultsAtom = atom<LatestComputeResultsMap>({});

export interface IntermediateComparisonResult {
  pair: string[];
  data: Record<string, { x?: number | null; y?: number | null; z?: number | null; mag?: number | null }>;
}

export interface LatestIntermediateComparisonsMap {
  [subjectId: string]: IntermediateComparisonResult[];
}

export const latestIntermediateComparisonsAtom = atom<LatestIntermediateComparisonsMap>({});

export interface SubjectResultHistoryEntry {
  timestamp: number;
  resultCount: number;
  results: LatestSensorResult[];
}

export interface ComputeResultsHistoryMap {
  [subjectId: string]: SubjectResultHistoryEntry[];
}

export const computeResultsHistoryAtom = atom<ComputeResultsHistoryMap>({});

export type StreamLifecyclePhase =
  | 'idle'
  | 'starting'
  | 'warming_up'
  | 'retrying'
  | 'official_streaming'
  | 'startup_failed'
  | 'stopping'
  | 'stopped';

export interface SubjectStreamLifecycleState {
  phase: StreamLifecyclePhase;
  attempt: number;
  maxAttempts: number;
  countdownStartedAtMs: number | null;
  gateDurationSeconds: number;
  statusMessage: string;
  reason: string | null;
  isOfficial: boolean;
  lastEventType: string | null;
}

export interface StreamLifecycleStateMap {
  [subjectId: string]: SubjectStreamLifecycleState;
}

export const streamLifecycleBySubjectAtom = atom<StreamLifecycleStateMap>({});
export const activeStreamTargetSubjectIdsAtom = atom<string[]>([]);
