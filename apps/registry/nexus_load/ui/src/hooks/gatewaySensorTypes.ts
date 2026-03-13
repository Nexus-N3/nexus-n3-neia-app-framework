export interface BatteryStatusInfo {
  batteryLevel: number | null;
  isCharging: boolean | null;
}

export interface BatteryStatusMap {
  [address: string]: BatteryStatusInfo;
}

export interface ConnectedSensorInfo {
  address: string;
  status: string;
  location: string | null;
}

export interface ConnectedSensorsMap {
  [subjectId: string]: ConnectedSensorInfo[];
}

export interface DiscoveredSensorsMap {
  [subjectId: string]: string[];
}

export type SensorFlowPhase = 'idle' | 'discovering' | 'connecting' | 'done' | 'error';
