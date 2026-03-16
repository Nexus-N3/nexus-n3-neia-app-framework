import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { BackButton } from '../components/BackButton';
import { InfoButton } from '../components/InfoButton';
import { setupsAtom, selectedSetupIdAtom, sessionNameAtom, subjectCountAtom, supportedComputationsAtom, subjectPrefixAtom } from '../store/atoms';
import { useSystemInitialization } from '../hooks/useSystemInitialization';

export const SensorSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const [setups] = useAtom(setupsAtom);
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

  const buildSetupSummary = (setup: Setup) => {
    const sensorTypeCounts = new Map<string, number>();
    setup.sensors.forEach((sensor) => {
      sensorTypeCounts.set(sensor.type, (sensorTypeCounts.get(sensor.type) ?? 0) + 1);
    });

    const uniqueLocations = Array.from(new Set(setup.sensors.map((sensor) => sensor.loc)));

    return {
      title: setup.name.length > 0 ? `${setup.name.charAt(0).toUpperCase()}${setup.name.slice(1).toLowerCase()}` : setup.name,
      groupedTypes: Array.from(sensorTypeCounts.entries()).map(([type, count]) => `${count}x ${type}`),
      locations: uniqueLocations.length > 0 ? [uniqueLocations.join(' ')] : [],
      computations: Array.from(new Set(setup.sensors.map((sensor) => sensor.comp).filter(Boolean))),
    };
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
              (() => {
                const summary = buildSetupSummary(setup);
                return (
              <div
                key={setup.id}
                className={`setup-item ${selectedSetupId === setup.id ? 'selected' : ''}`}
                onClick={() => setSelectedSetupId(setup.id)}
              >
                <div className="setup-item-main">
                  <span className="setup-item-title">{summary.title}</span>
                  <div className="setup-item-summary">
                    <>
                      {summary.groupedTypes.map((line) => (
                        <div key={`${setup.id}-${line}`} className="setup-item-summary-line">
                          {line}
                        </div>
                      ))}
                      {summary.locations.map((location) => (
                        <div key={`${setup.id}-${location}`} className="setup-item-summary-line">
                          {location}
                        </div>
                      ))}
                      {summary.computations.map((computation) => (
                        <div
                          key={`${setup.id}-${computation}`}
                          className="setup-item-summary-line setup-item-summary-line-computes"
                        >
                          {computation}
                        </div>
                      ))}
                    </>
                  </div>
                </div>
              </div>
                );
              })()
            ))}
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="action-row">
        <button className="nexus-btn" onClick={handleCreateSession} disabled={isInitializing}>
          {isInitializing ? 'INITIALIZING...' : 'Create session'}
        </button>
      </div>
    </main>
  );
};
