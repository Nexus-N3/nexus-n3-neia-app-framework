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
    <main className="nexus-content add-sensor-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">ADD SENSOR</h2>
        <InfoButton />
      </div>

      <div
        className="add-sensor-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr', // Three equal columns
          gridTemplateRows: '1fr auto', // Main content takes available space, buttons take auto
          gap: '30px',
          marginTop: '30px',
          flex: 1, // Grow to fill the flex container
          width: '100%',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Column 1: SENSOR TYPE */}
        <div
          className="column-panel"
          style={{
            gridColumn: '1 / 2',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(231, 238, 243, 0.05)',
            borderRadius: '4px',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: 0, textAlign: 'center' }}>SENSOR TYPE</h3>
            <div style={{ color: '#fff', fontSize: '24px', marginTop: '5px', textAlign: 'center', textTransform: 'uppercase' }}>Select one</div>
          </div>

          <div
            className="list-content"
            style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px 10px', display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {availableSensors.map((sensor) => (
              <div
                key={sensor.id}
                className={`setup-item ${selectedType === sensor.id ? 'selected' : ''}`}
                onClick={() => setSelectedType(sensor.id)}
                style={{ textTransform: 'uppercase' }}
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
        <div
          className="column-panel"
          style={{
            gridColumn: '2 / 3',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(231, 238, 243, 0.05)',
            borderRadius: '4px',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: 0, textAlign: 'center' }}>PLACEMENT</h3>
            <div style={{ color: '#fff', fontSize: '24px', marginTop: '5px', textAlign: 'center', textTransform: 'uppercase' }}>Select one or more</div>
          </div>

          <div className="list-content" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
            {selectedType ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {supportedLocations[selectedType] ? (
                  // Server provided locations
                  supportedLocations[selectedType].map((loc) => (
                    <button
                      key={loc}
                      className={`setup-item centered ${selectedPlacements.includes(loc) ? 'selected' : ''}`}
                      onClick={() => togglePlacement(loc)}
                      style={{ width: '100%', textTransform: 'uppercase' }}
                    >
                      {loc.replace(/_/g, ' ')}
                    </button>
                  ))
                ) : (
                  // Fallback locations
                  FALLBACK_PLACEMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`setup-item centered ${selectedPlacements.includes(opt.id) ? 'selected' : ''}`}
                      onClick={() => togglePlacement(opt.id)}
                      style={{ 
                        width: '100%', 
                        gridColumn: opt.colSpan === 2 ? '1 / 3' : 'auto' 
                      }}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#aaa',
                }}
              >
                Select a sensor type first
              </div>
            )}
          </div>
        </div>

        {/* Column 3: COMPUTATIONS */}
        <div
          className="column-panel"
          style={{
            gridColumn: '3 / 4',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(231, 238, 243, 0.05)',
            borderRadius: '4px',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: 0, textAlign: 'center' }}>COMPUTATIONS</h3>
            <div style={{ color: '#fff', fontSize: '24px', marginTop: '5px', textAlign: 'center', textTransform: 'uppercase' }}>Computations</div>
          </div>

          <div className="list-content" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px 10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {selectedType && supportedComputations[selectedType] ? (
              // Show computations for selected sensor type
              supportedComputations[selectedType].map((comp, idx) => (
                <div 
                    key={idx} 
                    className={`setup-item ${selectedComputation === comp.name ? 'selected' : ''}`} 
                    style={{ cursor: 'pointer', textTransform: 'uppercase' }}
                    onClick={() => setSelectedComputation(comp.name)}
                >
                  <span style={{ fontSize: '18px', textAlign: 'center', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2' }}>{comp.name.replace(/_/g, ' ')}</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <InfoButton 
                      className="item-info-btn" 
                      onClick={() => console.log('Info for', comp.name)} 
                    />
                  </div>
                </div>
              ))
            ) : selectedPlacements.length > 0 ? (
              // Fallback if no specific computations found but placement selected
              <div className="setup-item selected" style={{ cursor: 'default' }}>
                <span>LOADING (default)</span>
                <InfoButton className="item-info-btn" onClick={() => console.log('Info for LOADING')} />
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#aaa',
                }}
              >
                Select placement first
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            gridColumn: '3 / 4',
            gridRow: '2 / 3',
            display: 'flex',
            marginTop: 'auto',
          }}
        >
          <button
            className="nexus-btn continue-btn"
            style={{
              width: '100%',
              opacity: selectedType && selectedPlacements.length > 0 ? 1 : 0.5,
              cursor: selectedType && selectedPlacements.length > 0 ? 'pointer' : 'not-allowed',
            }}
            disabled={!selectedType || selectedPlacements.length === 0}
            onClick={handleAddSensor}
          >
            Add sensor
          </button>
        </div>
      </div>
    </main>
  );
};
