import { describe, expect, it } from 'vitest';
import type { CoreCapabilities } from '../types';
import {
  buildInitSubjects,
  changeSensorType,
  createEmptySensorRow,
  fallbackRouteForStage,
  hasReachedStage,
  reconcileSubjectSensorRows,
  validateSensorRow,
  validateSessionDraft,
  type SubjectSensorRows,
} from './sessionWorkflow';

const capabilities: CoreCapabilities = {
  available: true,
  connection_state: 'connected',
  sensors: [
    {
      id: 'movella',
      display_name: 'Movella DOT',
      supported_locations: ['LEFT_ANKLE', 'RIGHT_ANKLE'],
      supported_algorithms: ['loading'],
      available: true,
    },
    {
      id: 'movesense',
      display_name: 'Movesense',
      supported_locations: ['CHEST'],
      supported_algorithms: ['heart_rate'],
      available: true,
    },
  ],
  algorithms: [
    {
      id: 'loading',
      display_name: 'Loading',
      compatible_sensor_types: ['movella'],
      result_stages: ['realtime'],
      output_types: [],
      inputs: { window: 10 },
      available: true,
    },
    {
      id: 'heart_rate',
      display_name: 'Heart rate',
      compatible_sensor_types: ['movesense'],
      result_stages: ['realtime'],
      output_types: [],
      available: true,
    },
  ],
};

const subjects = [
  { id: 1, name: 'subject-1', displayName: 'Subject 1' },
  { id: 2, name: 'subject-2', displayName: 'Subject 2' },
];

describe('session workflow model', () => {
  it('starts every subject with zero sensors and preserves independent existing rows', () => {
    const existing: SubjectSensorRows = {
      'subject-1': [
        { id: 'one', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] },
      ],
    };

    expect(reconcileSubjectSensorRows(subjects, existing)).toEqual({
      'subject-1': existing['subject-1'],
      'subject-2': [],
    });
    expect(createEmptySensorRow('new')).toEqual({
      id: 'new',
      sensorType: '',
      location: '',
      algorithms: [],
    });
  });

  it('clears location and algorithm selections that are incompatible with a changed type', () => {
    const changed = changeSensorType(
      { id: 'one', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] },
      'movesense',
      capabilities,
    );

    expect(changed).toEqual({
      id: 'one',
      sensorType: 'movesense',
      location: '',
      algorithms: [],
    });
  });

  it('blocks empty, incomplete, and unsupported rows without hard-coded fallbacks', () => {
    expect(validateSessionDraft(subjects, {}, capabilities).valid).toBe(false);
    expect(validateSensorRow(createEmptySensorRow('empty'), capabilities).errors).toHaveLength(3);
    expect(
      validateSensorRow(
        { id: 'bad', sensorType: 'movella', location: 'CHEST', algorithms: ['heart_rate'] },
        capabilities,
      ).valid,
    ).toBe(false);
    expect(validateSessionDraft(subjects, {
      'subject-1': [{ id: 'one', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] }],
      'subject-2': [],
    }, capabilities).valid).toBe(false);
  });

  it('builds a subject-owned init_system payload only from validated capability IDs', () => {
    const result = buildInitSubjects(subjects, {
      'subject-1': [
        { id: 'one', sensorType: 'movella', location: 'LEFT_ANKLE', algorithms: ['loading'] },
        { id: 'two', sensorType: 'movella', location: 'RIGHT_ANKLE', algorithms: ['loading'] },
      ],
      'subject-2': [
        { id: 'three', sensorType: 'movesense', location: 'CHEST', algorithms: ['heart_rate'] },
      ],
    }, capabilities);

    expect(result).toEqual([
      {
        subject_id: 'subject-1',
        sensors: [{
          local_name: 'movella',
          number_of: 2,
          compute_algorithm: { name: 'loading', inputs: { window: 10 } },
          locations: ['LEFT_ANKLE', 'RIGHT_ANKLE'],
        }],
      },
      {
        subject_id: 'subject-2',
        sensors: [{
          local_name: 'movesense',
          number_of: 1,
          compute_algorithm: { name: 'heart_rate', inputs: {} },
          locations: ['CHEST'],
        }],
      },
    ]);
  });

  it('enforces forward route stages and provides a safe fallback route', () => {
    expect(hasReachedStage('sensor_configuration', 'subject_selection')).toBe(true);
    expect(hasReachedStage('subject_selection', 'sensor_discovery')).toBe(false);
    expect(fallbackRouteForStage('subject_selection')).toBe('/subjects');
    expect(fallbackRouteForStage('completed')).toBe('/completed');
  });
});
