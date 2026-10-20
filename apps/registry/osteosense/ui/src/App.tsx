import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import './App.css';
import './styles/App.compact.css';
import logo from './assets/osteosense_logo.png';
import appManifest from '../../app.json';
import { HomeScreen } from './screens/HomeScreen';
import { SubjectsRequiredScreen } from './screens/SubjectsRequiredScreen';
import { SensorSetupScreen } from './screens/SensorSetupScreen';
import { SessionScreen } from './screens/SessionScreen';
import { AssignSensorsScreen } from './screens/AssignSensorsScreen';
import { ActiveSessionScreen } from './screens/ActiveSessionScreen';
import { NewActivityScreen } from './screens/NewActivityScreen';
import { ResetButton } from './components/ResetButton';
import { activeActivityAtom, batteryStatusesAtom, connectedSensorsAtom, selectedSubjectAtom, sessionNameAtom, serverReadyAtom, subjectCountAtom, subjectPrefixAtom } from './store/atoms';
import { GatewaySocketProvider } from './hooks/useGatewaySocket';
import { useServerReadiness } from './hooks/useServerReadiness';
import { useBatteryUpdatesCore } from './hooks/useBatteryUpdatesCore';
import { useConnectedSensorUpdatesCore } from './hooks/useConnectedSensorUpdatesCore';
import { useResetSession } from './hooks/useResetSession';
import { useStreamLifecycleCore } from './hooks/useStreamLifecycleCore';
import { readSelectedSubjectContext } from './utils/subjectContext';

const AppContent = () => {
  useServerReadiness(); // Request and listen for server readiness
  useStreamLifecycleCore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionName] = useAtom(sessionNameAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
  const [serverReady] = useAtom(serverReadyAtom);
  const setSelectedSubject = useSetAtom(selectedSubjectAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
  const setSubjectPrefix = useSetAtom(subjectPrefixAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);
  const { batteryStatuses } = useBatteryUpdatesCore();
  const { connectedSensors: liveConnectedSensors } = useConnectedSensorUpdatesCore();
  const { reset, isResetting, isDrainPending, errorMsg: resetError, dismissError: dismissResetError, coreReadyForConfiguration, gatewayCommunicationAvailable, recoveryResults } = useResetSession();
  const isHome = location.pathname === '/';
  const isSessionRelated =
    location.pathname === '/session' ||
    location.pathname === '/assign-sensors' ||
    location.pathname === '/active-session' ||
    location.pathname === '/new-activity';

  const headerTitle = activeActivity
    ? (activeActivity as string).toUpperCase()
    : isSessionRelated
    ? sessionName
    : 'CREATE NEW SESSION';

  React.useEffect(() => {
    if (!serverReady && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, serverReady]);

  React.useEffect(() => {
    const selectedSubject = readSelectedSubjectContext();
    if (!selectedSubject) {
      return;
    }
    setSelectedSubject(selectedSubject);
    setSubjectCount(1);
    setSubjectPrefix(selectedSubject.display_name);
  }, [setSelectedSubject, setSubjectCount, setSubjectPrefix]);

  React.useEffect(() => {
    setBatteryStatuses(batteryStatuses);
  }, [batteryStatuses, setBatteryStatuses]);

  React.useEffect(() => {
    setConnectedSensors(liveConnectedSensors);
  }, [liveConnectedSensors, setConnectedSensors]);

  return (
    <div className="nexus-shell">
      <div className="nexus-app">
        <header className="nexus-header">
          <div className="header-left">
            <img src={logo} alt="Osteosense Logo" className="logo-img" />
          </div>
          <div className="header-center">
            <div className="header-app-meta">
              <span className="facility-name">{isHome ? appManifest.name : headerTitle}</span>
            </div>
          </div>
          <div className="header-right">
            <ResetButton onClick={reset} disabled={isResetting || isDrainPending} />
          </div>
        </header>

        <div className="header-line"></div>

        {isResetting ? <div role="status">Recovering session resources...</div> : null}
        {coreReadyForConfiguration === true ? <div role="status">Last Reset: Core ready for configuration. Gateway communication {gatewayCommunicationAvailable ? 'available' : 'unavailable'}.</div> : null}
        {resetError ? (
          <div className="error-banner" role="alert">
            <p>{resetError}</p>
            <p>{coreReadyForConfiguration === true
              ? 'You can configure a new session. Affected sensors remain unavailable for acquisition until reconciled.'
              : 'Core recovery has not been confirmed. Retry Reset; your configuration is retained.'}</p>
            {coreReadyForConfiguration && gatewayCommunicationAvailable && recoveryResults.some((sensor) => sensor.eligible_for_acquisition === false) ? (
              <div>
                <p>After stopping or power cycling the listed sensors, verify their measurement indicators are off. Confirming this will also reset the gateway BLE connections.</p>
                <button className="nexus-btn secondary-btn" disabled={isResetting || isDrainPending}
                  onClick={() => void reset({ allow_ble_reset: true,
                    confirmed_stopped_sensor_addresses: recoveryResults.filter((sensor) => sensor.eligible_for_acquisition === false).map((sensor) => sensor.address) })}>
                  Confirm listed sensors stopped and recover
                </button>
              </div>
            ) : null}
            <button className="nexus-btn secondary-btn" onClick={dismissResetError}>Dismiss error</button>
          </div>
        ) : null}
        <div className="route-stage">
          {!isResetting && <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/subjects" element={<SubjectsRequiredScreen />} />
            <Route path="/sensor-setup" element={<SensorSetupScreen />} />
            <Route path="/session" element={<SessionScreen />} />
            <Route path="/assign-sensors" element={<AssignSensorsScreen />} />
            <Route path="/active-session" element={<ActiveSessionScreen />} />
            <Route path="/new-activity" element={<NewActivityScreen />} />
          </Routes>}
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <GatewaySocketProvider>
        <AppContent />
      </GatewaySocketProvider>
    </BrowserRouter>
  );
};

export default App;
