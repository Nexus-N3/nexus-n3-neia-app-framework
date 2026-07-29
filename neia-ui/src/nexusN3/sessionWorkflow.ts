import type { CoreCapabilities, CoreSensorCapability } from '../types';
import type { InitSubject } from './hooks/useSystemInitialization';
import type { WorkflowSubject } from './utils/subjects';

export type SessionStage =
  | 'idle'
  | 'session_creation'
  | 'subject_selection'
  | 'sensor_configuration'
  | 'sensor_discovery'
  | 'session_readiness'
  | 'active'
  | 'completed';

export interface LogicalSensorRow {
  id: string;
  sensorType: string;
  location: string;
  algorithms: string[];
}

export type SubjectSensorRows = Record<string, LogicalSensorRow[]>;

export interface SensorRowValidation {
  valid: boolean;
  errors: string[];
}

const normalizeLocation = (location: string) =>
  location.trim().toUpperCase().replace(/\s+/g, '_');

export const createEmptySensorRow = (id = `sensor-${Date.now()}`): LogicalSensorRow => ({
  id,
  sensorType: '',
  location: '',
  algorithms: [],
});

export function reconcileSubjectSensorRows(
  subjects: WorkflowSubject[],
  current: SubjectSensorRows,
): SubjectSensorRows {
  return Object.fromEntries(subjects.map((subject) => [subject.name, current[subject.name] ?? []]));
}

export function findSensorCapability(
  capabilities: CoreCapabilities | null,
  sensorType: string,
): CoreSensorCapability | undefined {
  return capabilities?.sensors.find((sensor) => sensor.id === sensorType && sensor.available);
}

export function validateSensorRow(
  row: LogicalSensorRow,
  capabilities: CoreCapabilities | null,
): SensorRowValidation {
  const errors: string[] = [];
  const sensor = findSensorCapability(capabilities, row.sensorType);

  if (!row.sensorType) {
    errors.push('Select a sensor type.');
  } else if (!sensor) {
    errors.push('The selected sensor type is unavailable.');
  }

  if (!row.location) {
    errors.push('Select a sensor location.');
  } else if (sensor && !sensor.supported_locations.includes(row.location)) {
    errors.push('The selected location is not supported by this sensor type.');
  }

  if (row.algorithms.length === 0) {
    errors.push('Select an algorithm.');
  } else if (
    sensor &&
    row.algorithms.some((algorithmId) => {
      const algorithm = capabilities?.algorithms.find(
        (candidate) => candidate.id === algorithmId && candidate.available,
      );
      return (
        !sensor.supported_algorithms.includes(algorithmId) ||
        !algorithm ||
        (
          algorithm.compatible_sensor_types.length > 0 &&
          !algorithm.compatible_sensor_types.includes(sensor.id)
        )
      );
    })
  ) {
    errors.push('The selected algorithm is not supported by this sensor type.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateSessionDraft(
  subjects: WorkflowSubject[],
  rowsBySubject: SubjectSensorRows,
  capabilities: CoreCapabilities | null,
): { valid: boolean; errorsBySubject: Record<string, string[]> } {
  const errorsBySubject: Record<string, string[]> = {};

  subjects.forEach((subject) => {
    const rows = rowsBySubject[subject.name] ?? [];
    const errors =
      rows.length === 0
        ? ['Add at least one sensor.']
        : rows.flatMap((row, index) =>
            validateSensorRow(row, capabilities).errors.map(
              (error) => `Sensor ${index + 1}: ${error}`,
            ),
          );
    if (errors.length > 0) {
      errorsBySubject[subject.name] = errors;
    }
  });

  return {
    valid: subjects.length > 0 && Object.keys(errorsBySubject).length === 0,
    errorsBySubject,
  };
}

export function changeSensorType(
  row: LogicalSensorRow,
  sensorType: string,
  capabilities: CoreCapabilities | null,
): LogicalSensorRow {
  const sensor = findSensorCapability(capabilities, sensorType);
  const supportedAlgorithms = new Set(
    (sensor?.supported_algorithms ?? []).filter((algorithmId) => {
      const algorithm = capabilities?.algorithms.find(
        (candidate) => candidate.id === algorithmId && candidate.available,
      );
      return Boolean(
        algorithm &&
        (
          algorithm.compatible_sensor_types.length === 0 ||
          algorithm.compatible_sensor_types.includes(sensorType)
        ),
      );
    }),
  );
  return {
    ...row,
    sensorType,
    location:
      sensor && sensor.supported_locations.includes(row.location) ? row.location : '',
    algorithms: row.algorithms.filter((algorithmId) => supportedAlgorithms.has(algorithmId)),
  };
}

export function buildInitSubjects(
  subjects: WorkflowSubject[],
  rowsBySubject: SubjectSensorRows,
  capabilities: CoreCapabilities,
): InitSubject[] {
  const validation = validateSessionDraft(subjects, rowsBySubject, capabilities);
  if (!validation.valid) {
    throw new Error('The session sensor configuration is incomplete or unsupported.');
  }

  return subjects.map((subject) => {
    const grouped = new Map<
      string,
      { sensorType: string; algorithmId: string; locations: string[] }
    >();

    (rowsBySubject[subject.name] ?? []).forEach((row) => {
      const algorithmId = row.algorithms[0];
      const key = `${row.sensorType}::${algorithmId}`;
      const current = grouped.get(key) ?? {
        sensorType: row.sensorType,
        algorithmId,
        locations: [],
      };
      current.locations.push(normalizeLocation(row.location));
      grouped.set(key, current);
    });

    return {
      subject_id: subject.name,
      sensors: Array.from(grouped.values()).map((group) => {
        const algorithm = capabilities.algorithms.find(
          (candidate) => candidate.id === group.algorithmId,
        );
        return {
          local_name: group.sensorType,
          number_of: group.locations.length,
          compute_algorithm: {
            name: group.algorithmId,
            inputs: algorithm?.inputs ?? {},
          },
          locations: group.locations,
        };
      }),
    };
  });
}

const STAGE_ORDER: SessionStage[] = [
  'idle',
  'session_creation',
  'subject_selection',
  'sensor_configuration',
  'sensor_discovery',
  'session_readiness',
  'active',
  'completed',
];

export function hasReachedStage(current: SessionStage, required: SessionStage): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(required);
}

export function fallbackRouteForStage(stage: SessionStage): string {
  switch (stage) {
    case 'session_creation':
      return '/new-session';
    case 'subject_selection':
      return '/subjects';
    case 'sensor_configuration':
      return '/sensor-setup';
    case 'sensor_discovery':
    case 'session_readiness':
      return '/session';
    case 'active':
      return '/active-session';
    case 'completed':
      return '/completed';
    default:
      return '/';
  }
}
