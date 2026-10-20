import { useAtom } from 'jotai';
import { BatteryIcon } from './BatteryIcon';
import { Sensor, batteryStatusesAtom, connectedSensorsAtom, placedSensorsAtom } from '../store/atoms';
import { useIdentifySensor } from '../hooks/useIdentifySensor';

const normalizeLocation = (value: string | null) => (value ?? '').replace(/\s+/g, '_').toUpperCase();

export const SensorRow = ({ subjectId, subjectName, sensor }: { subjectId: number; subjectName: string; sensor: Sensor }) => {
  const [placedSensors, setPlacedSensors] = useAtom(placedSensorsAtom);
  const [connectedSensors] = useAtom(connectedSensorsAtom);
  const [batteryStatuses] = useAtom(batteryStatusesAtom);
  const { identifySensor, isIdentifying, errorMsg } = useIdentifySensor();
  const sensorKey = `${subjectId}:${sensor.id}`;
  const isPlaced = placedSensors.has(sensorKey);
  const subjectConnectedSensors = connectedSensors[subjectName.toLowerCase()] ?? connectedSensors[subjectName] ?? [];
  const matchingConnectedSensor = subjectConnectedSensors.find(
    (connectedSensor) => normalizeLocation(connectedSensor.location) === normalizeLocation(sensor.loc),
  );
  const batteryLevel = matchingConnectedSensor ? batteryStatuses[matchingConnectedSensor.address]?.batteryLevel ?? null : null;

  const togglePlaced = () => {
    const next = new Set(placedSensors);
    if (next.has(sensorKey)) {
      next.delete(sensorKey);
    } else {
      next.add(sensorKey);
    }
    setPlacedSensors(next);
  };

  const handleIdentify = () => {
    identifySensor(subjectName, sensor.loc);
  };

  return (
    <div className="sensor-row">
      <span className="sensor-name">{sensor.type}</span>
      <BatteryIcon level={batteryLevel} />
      <span className="sensor-location">{sensor.loc}</span>
      <div className="sensor-actions">
        <button className="sensor-action-btn-large" onClick={handleIdentify} disabled={isIdentifying}>
          {isIdentifying ? 'Identifying...' : 'Identify'}
        </button>
        <button
          className={`sensor-action-btn-large ${isPlaced ? 'placed' : 'primary'}`}
          onClick={togglePlaced}
        >
          {isPlaced ? 'Placed' : 'Place'}
        </button>
      </div>
      {errorMsg && <div className="sensor-row-error">{errorMsg}</div>}
    </div>
  );
};
