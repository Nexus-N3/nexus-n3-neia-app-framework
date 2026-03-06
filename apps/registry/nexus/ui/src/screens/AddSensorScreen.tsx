import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { setupsAtom, selectedSetupIdAtom, Sensor, supportedSensorsAtom, supportedLocationsAtom, supportedComputationsAtom } from '../store/atoms';

interface SensorType {
  id: string;
  name: string;
}

const FALLBACK_SENSOR_TYPES: SensorType[] = [
  { id: 'movella', name: 'Movella DOT' },
  { id: 'movesense', name: 'Movesense HR+' },
];

const FALLBACK_PLACEMENT_OPTIONS = [
  { id: 'head', label: 'HEAD', row: 1, colSpan: 2 },
  { id: 'left_wrist', label: 'LEFT WRIST', row: 2, colSpan: 1 },
  { id: 'right_wrist', label: 'RIGHT WRIST', row: 2, colSpan: 1 },
  { id: 'waist', label: 'WAIST', row: 3, colSpan: 2 },
  { id: 'left_thigh', label: 'LEFT THIGH', row: 4, colSpan: 1 },
  { id: 'right_thigh', label: 'RIGHT THIGH', row: 4, colSpan: 1 },
  { id: 'left_ankle', label: 'LEFT ANKLE', row: 5, colSpan: 1 },
  { id: 'right_ankle', label: 'RIGHT ANKLE', row: 5, colSpan: 1 },
];

export const AddSensorScreen: React.FC = () => {
  const navigate = useNavigate();
  const setSetups = useSetAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);
  const [supportedSensors] = useAtom(supportedSensorsAtom);
  const [supportedLocations] = useAtom(supportedLocationsAtom);
  const [supportedComputations] = useAtom(supportedComputationsAtom);
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [selectedComputation, setSelectedComputation] = useState<string | null>(null);

  // Derived state for sensors
  const availableSensors: SensorType[] = supportedSensors.length > 0
    ? supportedSensors.map(name => ({ id: name, name }))
    : FALLBACK_SENSOR_TYPES;

  // Default to first sensor type if available and none selected
  useEffect(() => {
    if (!selectedType && availableSensors.length > 0) {
      setSelectedType(availableSensors[0].id);
    }
  }, [availableSensors, selectedType]);

  // Default to first computation if available
  useEffect(() => {
    if (selectedType && supportedComputations[selectedType] && supportedComputations[selectedType].length > 0) {
      const currentValid = supportedComputations[selectedType].some(c => c.name === selectedComputation);
      if (!selectedComputation || !currentValid) {
        setSelectedComputation(supportedComputations[selectedType][0].name);
      }
    } else {
      setSelectedComputation(null);
    }
  }, [selectedType, supportedComputations]); // Removed selectedComputation from deps to avoid loop if logic was complex, but simple here.

  const handleBack = () => navigate(-1); // Go back

  const togglePlacement = (loc: string) => {
    setSelectedPlacements((prev) => (prev.includes(loc) ? prev.filter((p) => p !== loc) : [...prev, loc]));
  };

  const handleAddSensor = () => {
    if (!selectedType || selectedPlacements.length === 0) return;

    // Use the selectedType directly as the name if from server, or look up from fallback
    const sensorObj = availableSensors.find(s => s.id === selectedType);
    const sensorTypeName = sensorObj ? sensorObj.name : selectedType;

    const newSensors: Sensor[] = selectedPlacements.map((loc, index) => {
      // Find label if it's a fallback ID, otherwise use the loc string itself (cleaned up)
      const fallbackOpt = FALLBACK_PLACEMENT_OPTIONS.find(opt => opt.id === loc);
      const displayLoc = fallbackOpt ? fallbackOpt.label : loc.replace(/_/g, ' ');
      
      // Formatting similar to before: Capitalize
      const formattedLoc = displayLoc.charAt(0) + displayLoc.slice(1).toLowerCase();

      return {
        id: `sensor-${Date.now()}-${index}`,
        type: sensorTypeName,
        loc: formattedLoc,
        comp: selectedComputation || 'Loading',
      };
    });

    setSetups((prevSetups) =>
      prevSetups.map((setup) => {
        if (setup.id === selectedSetupId) {
          return {
            ...setup,
            sensors: [...setup.sensors, ...newSensors],
          };
        }
        return setup;
      }),
    );

    navigate(-1);
  };

  return (
    <main className="nexus-content add-sensor-content">
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">ADD SENSOR</h2>
        <InfoButton />
      </div>

      <div className="add-sensor-grid">
        {/* Column 1: SENSOR TYPE */}
        <div className="column-panel type-col">
          <div className="column-header">
            <h3>SENSOR TYPE</h3>
            <div className="column-subtext">Select one</div>
          </div>

          <div className="list-content">
            {availableSensors.map((sensor) => (
              <div
                key={sensor.id}
                className={`setup-item ${selectedType === sensor.id ? 'selected' : ''}`}
                onClick={() => setSelectedType(sensor.id)}
              >
                <span>{sensor.name}</span>
                <div onClick={(e) => e.stopPropagation()}>
                  <InfoButton
                    className="item-info-btn"
                    onClick={() => console.log('Info for', sensor.name)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: PLACEMENT */}
        <div className="column-panel placement-col">
          <div className="column-header">
            <h3>PLACEMENT</h3>
            <div className="column-subtext">Select one or more</div>
          </div>

          <div className="list-content">
            {selectedType ? (
              <div className="placement-grid">
                {supportedLocations[selectedType] ? (
                  supportedLocations[selectedType].map((loc) => (
                    <button
                      key={loc}
                      className={`placement-btn ${selectedPlacements.includes(loc) ? 'selected' : ''}`}
                      onClick={() => togglePlacement(loc)}
                    >
                      {loc.replace(/_/g, ' ')}
                    </button>
                  ))
                ) : (
                  FALLBACK_PLACEMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`placement-btn ${selectedPlacements.includes(opt.id) ? 'selected' : ''}`}
                      onClick={() => togglePlacement(opt.id)}
                      style={opt.colSpan === 2 ? { gridColumn: '1 / 3' } : undefined}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="empty-state-msg">
                Select a sensor type first
              </div>
            )}
          </div>
        </div>

        {/* Column 3: COMPUTATIONS */}
        <div className="column-panel comp-col">
          <div className="column-header">
            <h3>COMPUTATIONS</h3>
            <div className="column-subtext">Computations</div>
          </div>

          <div className="list-content">
            {selectedType && supportedComputations[selectedType] ? (
              supportedComputations[selectedType].map((comp, idx) => (
                <div 
                    key={idx} 
                    className={`setup-item computation-item ${selectedComputation === comp.name ? 'selected' : ''}`} 
                    onClick={() => setSelectedComputation(comp.name)}
                >
                  <span className="computation-name">{comp.name.replace(/_/g, ' ')}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <InfoButton 
                      className="item-info-btn" 
                      onClick={() => console.log('Info for', comp.name)} 
                    />
                  </div>
                </div>
              ))
            ) : selectedPlacements.length > 0 ? (
              <div className="setup-item selected">
                <span>LOADING (default)</span>
                <InfoButton className="item-info-btn" onClick={() => console.log('Info for LOADING')} />
              </div>
            ) : (
              <div className="empty-state-msg">
                Select placement first
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="action-row">
        <div></div>
        <div></div>
        <button
          className="nexus-btn"
          disabled={!selectedType || selectedPlacements.length === 0}
          onClick={handleAddSensor}
        >
          Add sensor
        </button>
      </div>
    </main>
  );
};
