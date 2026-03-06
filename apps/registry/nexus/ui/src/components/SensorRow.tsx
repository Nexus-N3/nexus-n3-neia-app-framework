import React, { useState } from 'react';
import { useAtom } from 'jotai';
import { ToggleSwitch } from './ToggleSwitch';
import { BatteryIcon } from './BatteryIcon';
import { Sensor, placedSensorsAtom } from '../store/atoms';

export const SensorRow = ({ subjectId, sensor }: { subjectId: number; sensor: Sensor }) => {
  const [isOn, setIsOn] = useState(false);
  const [placedSensors, setPlacedSensors] = useAtom(placedSensorsAtom);
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

  return (
    <div className="sensor-row">
      <ToggleSwitch isOn={isOn} onToggle={() => setIsOn(!isOn)} />
      <span className="sensor-name">{sensor.type}</span>
      <BatteryIcon level={76} />
      <span className="sensor-location">{sensor.loc}</span>
      <div className="sensor-actions">
        <button className="sensor-action-btn-large">
          Identify
        </button>
        <button
          className={`sensor-action-btn-large ${isPlaced ? 'placed' : ''}`}
          onClick={togglePlaced}
        >
          {isPlaced ? 'Placed' : 'Place'}
        </button>
      </div>
    </div>
  );
};
