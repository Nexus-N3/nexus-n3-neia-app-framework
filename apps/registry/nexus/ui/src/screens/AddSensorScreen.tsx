import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
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
  const setSetups = useSetAtom(setupsAtom);
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

    const newSensors: Sensor[] = selectedPlacements.map((placementId, index) => {
      const placementLabel = PLACEMENT_OPTIONS.find((opt) => opt.id === placementId)?.label || placementId;
      // specific casing if needed, or just capitalize first letter
      const loc = placementLabel.charAt(0) + placementLabel.slice(1).toLowerCase();

      return {
        id: `sensor-${Date.now()}-${index}`,
        type: sensorTypeName.toUpperCase(),
        loc: loc,
        comp: 'Loading',
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
            {SENSOR_TYPES.map((type) => (
              <div
                key={type.id}
                className={`setup-item ${selectedType === type.id ? 'selected' : ''}`}
                onClick={() => setSelectedType(type.id)}
                style={{ textTransform: 'uppercase' }}
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
                <button
                  className={`setup-item centered ${selectedPlacements.includes('head') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('head')}
                  style={{ gridColumn: '1 / 3', width: '100%' }}
                >
                  HEAD
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('left_wrist') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('left_wrist')}
                  style={{ width: '100%' }}
                >
                  LEFT WRIST
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('right_wrist') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('right_wrist')}
                  style={{ width: '100%' }}
                >
                  RIGHT WRIST
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('waist') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('waist')}
                  style={{ gridColumn: '1 / 3', width: '100%' }}
                >
                  WAIST
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('left_thigh') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('left_thigh')}
                  style={{ width: '100%' }}
                >
                  LEFT THIGH
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('right_thigh') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('right_thigh')}
                  style={{ width: '100%' }}
                >
                  RIGHT THIGH
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('left_ankle') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('left_ankle')}
                  style={{ width: '100%' }}
                >
                  LEFT ANKLE
                </button>

                <button
                  className={`setup-item centered ${selectedPlacements.includes('right_ankle') ? 'selected' : ''}`}
                  onClick={() => togglePlacement('right_ankle')}
                  style={{ width: '100%' }}
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

          <div className="list-content" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px 10px' }}>
            {selectedPlacements.length > 0 ? (
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
