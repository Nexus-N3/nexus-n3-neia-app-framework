import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { setupsAtom, selectedSetupIdAtom, Sensor } from '../store/atoms';

interface SensorType {
  id: string;
  name: string;
}

const SENSOR_TYPES: SensorType[] = [
  { id: 'movella', name: 'Movella DOT' },
  { id: 'movesense', name: 'Movesense HR+' },
];

const PLACEMENT_OPTIONS = [
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
  const [setups, setSetups] = useAtom(setupsAtom);
  const [selectedSetupId] = useAtom(selectedSetupIdAtom);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);

  const handleBack = () => navigate(-1); // Go back

  const togglePlacement = (id: string) => {
    setSelectedPlacements((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleAddSensor = () => {
    if (!selectedType || selectedPlacements.length === 0) return;

    const sensorTypeName = SENSOR_TYPES.find((t) => t.id === selectedType)?.name || selectedType;
    const locationString = selectedPlacements
      .map((p) => PLACEMENT_OPTIONS.find((opt) => opt.id === p)?.label)
      .filter(Boolean)
      .join(', ');

    const newSensor: Sensor = {
      id: `sensor-${Date.now()}`,
      type: sensorTypeName.toUpperCase(), // Match style in sensor list
      loc: locationString.charAt(0) + locationString.slice(1).toLowerCase(), // Sentence case roughly
      comp: 'Loading',
    };

    setSetups((prevSetups) =>
      prevSetups.map((setup) => {
        if (setup.id === selectedSetupId) {
          return {
            ...setup,
            sensors: [...setup.sensors, newSensor],
          };
        }
        return setup;
      }),
    );

    navigate(-1);
  };

  return (
    <main className="nexus-content add-sensor-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
          }}
        >
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '12px', color: '#888', letterSpacing: '1px', margin: 0, textAlign: 'center' }}>SENSOR TYPE</h3>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '5px', textAlign: 'center', textTransform: 'uppercase' }}>Select one</div>
          </div>

          <div className="list-content" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px 10px' }}>
            {SENSOR_TYPES.map((type) => (
              <div
                key={type.id}
                className={`setup-item ${selectedType === type.id ? 'selected' : ''}`}
                onClick={() => setSelectedType(type.id)}
                style={{
                  padding: '15px',
                  background: selectedType === type.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  marginBottom: '10px',
                  borderRadius: '4px',
                  border: selectedType === type.id ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                  color: selectedType === type.id ? '#5960F6' : '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{type.name}</span>
                <div onClick={(e) => e.stopPropagation()}>
                  <InfoButton
                    className="item-info-btn"
                    onClick={() => console.log('Info for', type.name)} // Placeholder
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
          }}
        >
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '12px', color: '#888', letterSpacing: '1px', margin: 0, textAlign: 'center' }}>PLACEMENT</h3>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '5px', textAlign: 'center', textTransform: 'uppercase' }}>Select one or more</div>
          </div>

          <div className="list-content" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
            {selectedType ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  className={`setup-item ${selectedPlacements.includes('head') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('head')}
                  style={{
                    gridColumn: '1 / 3',
                    padding: '15px',
                    background: selectedPlacements.includes('head') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    marginBottom: '0',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('head') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('head') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  HEAD
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('left_wrist') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('left_wrist')}
                  style={{
                    padding: '15px',
                    background: selectedPlacements.includes('left_wrist') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('left_wrist') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('left_wrist') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  LEFT WRIST
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('right_wrist') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('right_wrist')}
                  style={{
                    padding: '15px',
                    background: selectedPlacements.includes('right_wrist') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('right_wrist') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('right_wrist') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  RIGHT WRIST
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('waist') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('waist')}
                  style={{
                    gridColumn: '1 / 3',
                    padding: '15px',
                    background: selectedPlacements.includes('waist') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('waist') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('waist') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  WAIST
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('left_thigh') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('left_thigh')}
                  style={{
                    padding: '15px',
                    background: selectedPlacements.includes('left_thigh') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('left_thigh') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('left_thigh') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  LEFT THIGH
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('right_thigh') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('right_thigh')}
                  style={{
                    padding: '15px',
                    background: selectedPlacements.includes('right_thigh') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('right_thigh') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('right_thigh') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  RIGHT THIGH
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('left_ankle') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('left_ankle')}
                  style={{
                    padding: '15px',
                    background: selectedPlacements.includes('left_ankle') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('left_ankle') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('left_ankle') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  LEFT ANKLE
                </button>

                <button
                  className={`setup-item ${selectedPlacements.includes('right_ankle') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('right_ankle')}
                  style={{
                    padding: '15px',
                    background: selectedPlacements.includes('right_ankle') ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderRadius: '4px',
                    border: selectedPlacements.includes('right_ankle') ? '1px solid #5960F6' : '1px solid rgba(255, 255, 255, 0.2)',
                    color: selectedPlacements.includes('right_ankle') ? '#5960F6' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 600,
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  RIGHT ANKLE
                </button>
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
                  fontSize: '14px',
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
          }}
        >
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '12px', color: '#888', letterSpacing: '1px', margin: 0, textAlign: 'center' }}>COMPUTATIONS</h3>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '5px', textAlign: 'center', textTransform: 'uppercase' }}>Computations</div>
          </div>

          <div className="list-content" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px 10px' }}>
            {selectedPlacements.length > 0 ? (
              <div
                className="setup-item selected"
                style={{
                  padding: '15px',
                  background: 'rgba(255,255,255,0.08)',
                  marginBottom: '10px',
                  borderRadius: '4px',
                  border: '1px solid #5960F6',
                  color: '#5960F6',
                  textAlign: 'left',
                  cursor: 'default',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
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
                  fontSize: '14px',
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
