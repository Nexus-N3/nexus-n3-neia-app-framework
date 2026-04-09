import type { ConnectedSensorInfo } from './gatewaySensorTypes';

type UnknownRecord = Record<string, unknown>;

interface SubjectPayload {
  subject_id: string;
  discovered_sensors?: string[];
  connected_sensors?: ConnectedSensorInfo[];
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    if (Array.isArray(value.disconnected_sensors)) {
      return value.disconnected_sensors;
    }

    if (Array.isArray(value.payload)) {
      return value.payload;
    }

    if (Array.isArray(value.subjects)) {
      return value.subjects;
    }

    if (Array.isArray(value.results)) {
      return value.results;
    }
  }

  return [];
};

const parseConnectedSensor = (value: unknown): ConnectedSensorInfo | null => {
  if (typeof value === 'string') {
    const match = value.match(/^(?<address>[^()]+?)(?:\s*\((?<status>[^)]+)\))?$/);
    const address = match?.groups?.address?.trim() ?? value.trim();
    const status = match?.groups?.status?.trim() ?? 'CONNECTED';

    if (!address) {
      return null;
    }

    return {
      address,
      status,
      location: null,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const address = typeof value.address === 'string' ? value.address.trim() : '';
  if (!address) {
    return null;
  }

  return {
    address,
    status: typeof value.status === 'string' && value.status.trim() ? value.status : 'CONNECTED',
    location: typeof value.location === 'string' ? value.location : null,
  };
};

export const getDiscoveredSubjectsFromPayload = (payload: unknown): SubjectPayload[] =>
  asArray(payload)
    .filter(isRecord)
    .map((subject) => ({
      subject_id: typeof subject.subject_id === 'string' ? subject.subject_id : '',
      discovered_sensors: Array.isArray(subject.discovered_sensors)
        ? subject.discovered_sensors.filter((sensor): sensor is string => typeof sensor === 'string')
        : [],
    }))
    .filter((subject) => subject.subject_id);

export const getConnectedSubjectsFromPayload = (payload: unknown): SubjectPayload[] =>
  asArray(payload)
    .filter(isRecord)
    .map((subject) => ({
      subject_id: typeof subject.subject_id === 'string' ? subject.subject_id : '',
      connected_sensors: Array.isArray(subject.connected_sensors)
        ? subject.connected_sensors
            .map(parseConnectedSensor)
            .filter((sensor): sensor is ConnectedSensorInfo => sensor !== null)
        : [],
    }))
    .filter((subject) => subject.subject_id);

export const getDisconnectedAddressesFromPayload = (payload: unknown): string[] =>
  asArray(payload)
    .map((value) => {
      if (typeof value === 'string') {
        return value;
      }

      if (isRecord(value) && typeof value.address === 'string') {
        return value.address;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
