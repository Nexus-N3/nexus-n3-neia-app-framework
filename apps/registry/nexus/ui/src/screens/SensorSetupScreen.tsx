import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { EditButton } from '../components/EditButton';
import { DeleteButton } from '../components/DeleteButton';
import { setupsAtom, selectedSetupIdAtom, sessionNameAtom, subjectCountAtom, supportedComputationsAtom, Setup, subjectPrefixAtom } from '../store/atoms';
import { useSystemInitialization } from '../hooks/useSystemInitialization';

export const SensorSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const [setups, setSetups] = useAtom(setupsAtom);
  const [selectedSetupId, setSelectedSetupId] = useAtom(selectedSetupIdAtom);
  const [sessionName] = useAtom(sessionNameAtom);
  const [subjectCount] = useAtom(subjectCountAtom);
  const [supportedComputations] = useAtom(supportedComputationsAtom);
  const [subjectPrefix] = useAtom(subjectPrefixAtom);

  const { isInitializing, errorMsg, initSystem } = useSystemInitialization(() => {
    navigate('/session');
  });

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

  const handleDeleteSensor = (sensorIndex: number) => {
    if (!selectedSetup?.isCustom) return;
    setSetups((prev) =>
      prev.map((s) =>
        s.id === selectedSetupId
          ? { ...s, sensors: s.sensors.filter((_, i) => i !== sensorIndex) }
          : s
      )
    );
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

  const handleCreateSession = async () => {
    // 1. Group sensors by Type & Computation to support mixed algorithms
    // Key: "SensorType::ComputationName"
    const sensorsByGroup: Record<string, string[]> = {};
    
    if (selectedSetup) { 
       selectedSetup.sensors.forEach((s) => {
         const type = s.type;
         // Handle default/loading state for computation
         let compKey = s.comp;
         if (!compKey || compKey === 'Loading') {
            compKey = 'DEFAULT';
         }

         const groupKey = `${type}::${compKey}`;

         // Normalize location "Left ankle" -> "LEFT_ANKLE"
         const normalizedLoc = s.loc.toUpperCase().replace(/\s+/g, '_');
         
         if (!sensorsByGroup[groupKey]) {
           sensorsByGroup[groupKey] = [];
         }
         sensorsByGroup[groupKey].push(normalizedLoc);
       });
    }

    // 2. Build init_system payload
    // Iterate over groups and construct payload
    const sensorsPayload = Object.entries(sensorsByGroup).map(([groupKey, locations]) => {
      const parts = groupKey.split('::');
      const type = parts[0];
      const compName = parts[1]; // Parts[1] is the computation or 'DEFAULT'

      // Find supported algorithms for this sensor type
      const algos = supportedComputations[type] || [];
      
      let algo;
      if (compName && compName !== 'DEFAULT') {
          algo = algos.find(a => a.name === compName);
      }

      if (!algo) {
          // Default selection logic
          // Pick 'standard_loading_intensity' if available, else first
          algo = algos.find(a => a.name === 'standard_loading_intensity');
          if (!algo && algos.length > 0) algo = algos[0];
          if (!algo) algo = { name: 'pass_through', inputs: {} }; // fallback
      }

      return {
        local_name: type,
        number_of: locations.length,
        compute_algorithm: {
          name: algo.name,
          inputs: algo.inputs || {}
        },
        locations: locations 
      };
    });


    // 3. Replicate for all subjects
    // Use user-defined prefix or default to 'Subject_'
    const prefix = subjectPrefix;

    const subjectsPayload = Array.from({ length: subjectCount }, (_, i) => ({
      subject_id: `${prefix}${i + 1}`,
      sensors: sensorsPayload
    }));

    const payload = {
      type: 'init_system' as const,
      payload: {
        init_label: sessionName || `Session_${new Date().toISOString()}`,
        subjects: subjectsPayload
      }
    };
    
    await initSystem(payload);
  };

  return (
    <main className="nexus-content screen-layout sensor-setup-screen">
      <div className="sub-header-row">
        <BackButton onClick={handleBack} disabled={isInitializing} />
        <h2 className="screen-title">SENSOR SETUP</h2>
        <InfoButton />
      </div>

      {errorMsg && (
        <div className="error-banner">
          Error: {errorMsg}
        </div>
      )}

      <div className="split-panel-grid">
        {/* Left: Setup List */}
        <div className="setup-list-panel">
          <h3 className="setup-panel-header">DEFAULT SETUPS</h3>
          <div className="setup-list">
            {setups.map((setup) => (
              <div
                key={setup.id}
                className={`setup-item ${selectedSetupId === setup.id ? 'selected' : ''}`}
                onClick={() => setSelectedSetupId(setup.id)}
              >
                <span>{setup.name}</span>
                {setup.isCustom && (
                  <div className="setup-item-controls">
                    <EditButton onClick={(e) => handleRenameSetup(setup.id, setup.name, e)} title="Rename" />
                    <DeleteButton onClick={(e) => handleDeleteSetup(setup.id, e)} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="panel-action-btn" onClick={handleAddCustomSetup}>
            + New custom setup
          </button>
        </div>

        {/* Right: Sensor List */}
        <div className="sensor-list-panel">
          <div className="sensor-list-container">
            {selectedSetup?.sensors && selectedSetup.sensors.length > 0 ? (
              <>
                {selectedSetup.sensors.map((sensor, i) => (
                  <div key={i} className="sensor-card">
                    <div className="sensor-info-type">{sensor.type}</div>
                    <div className="sensor-info-loc">{sensor.loc}</div>
                    <div className="sensor-info-comp">Computes: {sensor.comp}</div>
                    {selectedSetup.isCustom && (
                      <DeleteButton onClick={() => handleDeleteSensor(i)} title="Remove sensor" />
                    )}
                  </div>
                ))}
                {selectedSetup.isCustom && (
                  <div className="add-sensor-btn" onClick={() => navigate('/add-sensor')}>
                    + Add new sensor
                  </div>
                )}
              </>
            ) : (
              <div className="no-sensors-msg">
                <div className="no-sensors-text-box">
                  <div className="no-sensors-title">NO SENSORS ADDED</div>
                  <div>Add new sensors to create your custom setup</div>
                </div>
                {selectedSetup.isCustom && (
                  <button className="add-sensor-btn" onClick={() => navigate('/add-sensor')}>
                    + add new sensor configuration
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
        <div></div>
        <button className="nexus-btn secondary-btn" onClick={handleModifyDefault} disabled={isInitializing}>
          Modify default
        </button>
        <button className="nexus-btn" onClick={handleCreateSession} disabled={isInitializing}>
          {isInitializing ? 'INITIALIZING...' : 'Create session'}
        </button>
      </div>
    </main>
  );
};
