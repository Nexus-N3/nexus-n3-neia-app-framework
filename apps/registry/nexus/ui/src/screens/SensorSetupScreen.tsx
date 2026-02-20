import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { Sensor, Setup, setupsAtom, selectedSetupIdAtom } from '../store/atoms';

export const SensorSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const [setups, setSetups] = useAtom(setupsAtom);
  const [selectedSetupId, setSelectedSetupId] = useAtom(selectedSetupIdAtom);

  const selectedSetup = setups.find((s) => s.id === selectedSetupId);

  const handleBack = () => navigate('/subjects');

  const handleRenameSetup = (setupId: string, currentName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newName = window.prompt('Enter new setup name:', currentName);
    if (newName && newName.trim() !== '') {
      setSetups((prev) => prev.map((s) => (s.id === setupId ? { ...s, name: newName.trim().toUpperCase() } : s)));
    }
  };

  const handleDeleteSetup = (setupId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Are you sure you want to delete this custom setup?')) {
      const newSetups = setups.filter((s) => s.id !== setupId);
      setSetups(newSetups);

      if (selectedSetupId === setupId) {
        // If deleted setup was selected, switch to default or first available
        setSelectedSetupId('default');
      }
    }
  };

  const handleAddCustomSetup = () => {
    const newSetup: Setup = {
      id: `custom-${Date.now()}`,
      name: 'CUSTOM SETUP',
      isCustom: true,
      sensors: [],
    };
    setSetups([...setups, newSetup]);
    setSelectedSetupId(newSetup.id);
  };

  const handleModifyDefault = () => {
    // Find the default setup (assuming it has id 'default' or is the first one)
    const defaultSetup = setups.find((s) => s.id === 'default') || setups[0];
    if (!defaultSetup) return;

    const newSetup: Setup = {
      ...defaultSetup,
      id: `custom-${Date.now()}`,
      name: `${defaultSetup.name} (MODIFIED)`,
      isCustom: true,
      // Deep copy sensors to avoid reference issues
      sensors: defaultSetup.sensors.map((s) => ({ ...s, id: `sensor-${Date.now()}-${s.id}` })),
    };

    setSetups([...setups, newSetup]);
    setSelectedSetupId(newSetup.id);
  };

  return (
    <main className="nexus-content sensor-setup-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">SENSOR SETUP</h2>
        <InfoButton />
      </div>

      <div
        className="sensor-setup-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'calc((100% - 60px) / 3) 1fr', // Matches AddSensor layout: (Total - 2*30px gap) / 3
          gridTemplateRows: '1fr auto', // Main content takes available space, buttons take auto
          gap: '30px',
          marginTop: '30px',
          flex: 1, // Grow to fill the flex container
          width: '100%',
        }}
      >
        {/* Top Left: Default Setups (spans 1 row) */}
        <div
          className="setup-list-panel"
          style={{
            gridColumn: '1 / 2',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(231, 238, 243, 0.05)',
            borderRadius: '4px',
          }}
        >
          <h3
            style={{
              fontSize: '12px',
              color: '#888',
              marginBottom: '10px',
              letterSpacing: '1px',
              padding: '15px',
              textAlign: 'center',
              marginLeft: '10px',
              marginRight: '10px',
            }}
          >
            DEFAULT SETUPS
          </h3>
          <div className="setup-list" style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', marginLeft: '10px', marginRight: '10px' }}>
            {setups.map((setup) => (
              <div key={setup.id} className={`setup-item ${selectedSetupId === setup.id ? 'selected' : ''}`} onClick={() => setSelectedSetupId(setup.id)}>
                <span>{setup.name}</span>
                {setup.isCustom && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={(e) => handleRenameSetup(setup.id, setup.name, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid currentColor',
                        color: 'inherit',
                        fontSize: '0.8em',
                        padding: 0,
                        cursor: 'pointer',
                        opacity: 0.8,
                      }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => handleDeleteSetup(setup.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid currentColor',
                        color: '#ff6b6b',
                        fontSize: '0.8em',
                        padding: 0,
                        cursor: 'pointer',
                        opacity: 0.8,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="custom-setup-btn" onClick={handleAddCustomSetup}>
            + New custom setup
          </button>
        </div>

        {/* Top Right: Sensor List */}
        <div
          className="sensor-list-panel"
          style={{
            gridColumn: '2 / 3',
            gridRow: '1 / 2',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div className="sensor-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {selectedSetup?.sensors && selectedSetup.sensors.length > 0 ? (
              <>
                {selectedSetup.sensors.map((sensor, i) => (
                  <div
                    key={i}
                    className="sensor-card"
                    style={{
                      display: 'flex',
                      gap: '20px',
                      padding: '20px',
                      background: 'rgba(255,255,255,0.05)',
                      marginBottom: '15px',
                      alignItems: 'center',
                      borderRadius: '4px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{sensor.type}</div>
                    <div style={{ fontSize: '0.9em', opacity: 0.8, color: '#aaa' }}>{sensor.loc}</div>
                    <div style={{ fontSize: '0.9em', color: '#888', fontStyle: 'italic' }}>Computes: {sensor.comp}</div>
                  </div>
                ))}
                {selectedSetup.isCustom && (
                  <div className="add-sensor-btn" onClick={() => navigate('/add-sensor')}>
                    + Add new sensor
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  color: '#aaa',
                  gap: '20px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2em', marginBottom: '8px' }}>NO SENSORS ADDED</div>
                  <div style={{ fontSize: '0.9em' }}>Add new sensors to create your custom setup</div>
                </div>
                {selectedSetup.isCustom && (
                  <button className="add-sensor-btn" onClick={() => navigate('/add-sensor')}>
                    + add new sensor
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Left: Empty (Implicitly handled by grid placement, but explicit for clarity) */}
        <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }}></div>

        {/* Bottom Right: Buttons */}
        <div
          className="action-row"
          style={{
            gridColumn: '2 / 3',
            gridRow: '2 / 3',
            display: 'flex',
            gap: '20px',
            marginTop: 'auto', // Align to bottom if row has height, though grid handles placement
          }}
        >
          <button className="nexus-btn secondary-btn" onClick={handleModifyDefault} style={{ flex: 1 }}>
            Modify default
          </button>
          <button className="nexus-btn continue-btn" style={{ flex: 1 }}>
            Create session
          </button>
        </div>
      </div>
    </main>
  );
};
