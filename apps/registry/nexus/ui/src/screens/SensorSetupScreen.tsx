import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { Setup, setupsAtom, selectedSetupIdAtom } from '../store/atoms';

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
    <main className="nexus-content sensor-setup-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="sub-header-row">
        <BackButton onClick={handleBack} />
        <h2 className="screen-title">SENSOR SETUP</h2>
        <InfoButton />
      </div>

      <div
        className="sensor-setup-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: '20px',
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          minHeight: 0,
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
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <h3
            style={{
              margin: '20px',
              marginBottom: '30px',
              textAlign: 'center',
              fontSize: '32px',
              fontWeight: 500,
              color: '#fff',
              textTransform: 'uppercase',
            }}
          >
            DEFAULT SETUPS
          </h3>
          <div
            className="setup-list"
            style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '20px',
              marginLeft: '10px',
              marginRight: '10px',
              gap: '20px',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: '20px',
            }}
          >
            {setups.map((setup) => (
              <div
                key={setup.id}
                className={`setup-item ${selectedSetupId === setup.id ? 'selected' : ''}`}
                onClick={() => setSelectedSetupId(setup.id)}
                style={{ fontSize: '24px', textTransform: 'uppercase' }}
              >
                <span>{setup.name}</span>
                {setup.isCustom && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={(e) => handleRenameSetup(setup.id, setup.name, e)} className="setup-action-btn" title="Rename">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button onClick={(e) => handleDeleteSetup(setup.id, e)} className="setup-action-btn delete" title="Delete">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="panel-action-btn" onClick={handleAddCustomSetup}>
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
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div className="sensor-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '20px' }}>
            {selectedSetup?.sensors && selectedSetup.sensors.length > 0 ? (
              <>
                {selectedSetup.sensors.map((sensor, i) => (
                  <div key={i} className="sensor-card">
                    <div style={{ fontWeight: 'bold' }}>{sensor.type}</div>
                    <div style={{ opacity: 0.8, color: '#aaa' }}>{sensor.loc}</div>
                    <div style={{ color: '#888', fontStyle: 'italic' }}>Computes: {sensor.comp}</div>
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
                  fontSize: '24px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>NO SENSORS ADDED</div>
                  <div style={{}}>Add new sensors to create your custom setup</div>
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
      </div>

      {/* Footer Buttons */}
      <div
        className="action-row"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '20px',
          marginTop: '20px',
          marginBottom: '20px',
          width: '100%',
        }}
      >
        <div></div>
        <button className="nexus-btn secondary-btn" onClick={handleModifyDefault}>
          Modify default
        </button>
        <button className="nexus-btn continue-btn" onClick={() => navigate('/session')}>
          Create session
        </button>
      </div>
    </main>
  );
};
