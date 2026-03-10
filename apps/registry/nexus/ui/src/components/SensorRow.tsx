import { useAtom } from 'jotai';
import { BatteryIcon } from './BatteryIcon';
import { Sensor, placedSensorsAtom } from '../store/atoms';
import { useIdentifySensor } from '../hooks/useIdentifySensor';

export const SensorRow = ({ subjectId, subjectName, sensor }: { subjectId: number; subjectName: string; sensor: Sensor }) => {
  const [placedSensors, setPlacedSensors] = useAtom(placedSensorsAtom);
  const { identifySensor, isIdentifying, errorMsg } = useIdentifySensor();
  const sensorKey = `${subjectId}:${sensor.id}`;
  const isPlaced = placedSensors.has(sensorKey);

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
      <BatteryIcon level={76} />
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
