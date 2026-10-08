import React from 'react';
import { MemoryRouter, Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import './NexusN3View.css';
import './styles/App.compact.css';
import logo from './assets/logo.svg';
import { NEXUS_N3_APP } from './config';
import { HomeScreen } from './screens/HomeScreen';
import { NewSessionScreen } from './screens/NewSessionScreen';
import { SubjectsRequiredScreen } from './screens/SubjectsRequiredScreen';
import { SensorSetupScreen } from './screens/SensorSetupScreen';
import { SessionScreen } from './screens/SessionScreen';
import { AssignSensorsScreen } from './screens/AssignSensorsScreen';
import { ActiveSessionScreen } from './screens/ActiveSessionScreen';
import { NewActivityScreen } from './screens/NewActivityScreen';
import { SubjectActivityScreen } from './screens/SubjectActivityScreen';
import { ConfigBootstrapScreen } from './screens/ConfigBootstrapScreen';
import { ResetButton } from './components/ResetButton';
import { ErrorDismissButton } from './components/ErrorDismissButton';
import { activeActivityAtom, batteryStatusesAtom, configuredSubjectsAtom, connectedSensorsAtom, selectedSessionConfigAtom, selectedSubjectAtom, sessionNameAtom, sessionStageAtom, subjectCountAtom, subjectPrefixAtom } from './store/atoms';
import { GatewaySocketProvider } from './hooks/useGatewaySocket';
import { useServerReadiness } from './hooks/useServerReadiness';
import { useBatteryUpdatesCore } from './hooks/useBatteryUpdatesCore';
import { useConnectedSensorUpdatesCore } from './hooks/useConnectedSensorUpdatesCore';
import { useResetSession } from './hooks/useResetSession';
import { useStreamLifecycleCore } from './hooks/useStreamLifecycleCore';
import { useSessionEventIngestion } from './hooks/useSessionEventIngestion';
import { readSelectedSubjectContext } from './utils/subjectContext';
import { readSelectedSessionConfig } from './utils/sessionConfigContext';
import { fallbackRouteForStage, hasReachedStage, type SessionStage } from './sessionWorkflow';
import { Toaster } from 'sonner';
const StageGuard = ({
  required,
  children,
}: {
  required: SessionStage;
  children: React.ReactElement;
}) => {
  const [stage] = useAtom(sessionStageAtom);
  return hasReachedStage(stage, required)
    ? children
    : <Navigate to={fallbackRouteForStage(stage)} replace />;
};

const AppContent = () => {
  useServerReadiness(); // Request and listen for server readiness
  useStreamLifecycleCore();
  useSessionEventIngestion();
  const location = useLocation();
  const navigate = useNavigate();
  const [sessionName] = useAtom(sessionNameAtom);
  const [activeActivity] = useAtom(activeActivityAtom);
  const setConfiguredSubjects = useSetAtom(configuredSubjectsAtom);
  const setSelectedSessionConfig = useSetAtom(selectedSessionConfigAtom);
  const setSelectedSubject = useSetAtom(selectedSubjectAtom);
  const setSessionName = useSetAtom(sessionNameAtom);
  const setSubjectCount = useSetAtom(subjectCountAtom);
  const setSubjectPrefix = useSetAtom(subjectPrefixAtom);
  const setConnectedSensors = useSetAtom(connectedSensorsAtom);
  const setBatteryStatuses = useSetAtom(batteryStatusesAtom);
  const { batteryStatuses } = useBatteryUpdatesCore();
  const { connectedSensors: liveConnectedSensors } = useConnectedSensorUpdatesCore();
  const { reset, isResetting, isDrainPending, errorMsg: resetError, dismissError: dismissResetError } = useResetSession();
  const isHome = location.pathname === '/';
  const isSessionRelated =
    location.pathname === '/session' ||
    location.pathname === '/assign-sensors' ||
    location.pathname === '/active-session' ||
    location.pathname === '/completed' ||
    location.pathname === '/new-activity' ||
    location.pathname.startsWith('/activity/subject/');

  const headerTitle = activeActivity
    ? (activeActivity as string).toUpperCase()
    : isSessionRelated
    ? sessionName
    : 'CREATE NEW SESSION';

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
    const sessionConfig = readSelectedSessionConfig();
    if (!sessionConfig || sessionConfig.app_id !== NEXUS_N3_APP.id) {
      return;
    }
    const configuredSubjects = Array.isArray(sessionConfig.subjects)
      ? sessionConfig.subjects
          .filter((subject) => typeof subject.subject_id === 'string')
          .map((subject) => ({
            subject_id: subject.subject_id,
            display_name: subject.display_name || subject.subject_id,
            subject_type: subject.subject_type ?? null,
          }))
      : [];
    if (configuredSubjects.length > 0) {
      setConfiguredSubjects(configuredSubjects);
      setSubjectCount(configuredSubjects.length);
      setSubjectPrefix('');
    }
    setSelectedSessionConfig({
      session_config_id: sessionConfig.session_config_id,
      name: sessionConfig.name,
      activity: sessionConfig.activity ?? null,
    });
    setSessionName(sessionConfig.name);
    if (location.pathname === '/') {
      navigate('/config-bootstrap', { replace: true });
    }
  }, [
    location.pathname,
    navigate,
    setConfiguredSubjects,
    setSelectedSessionConfig,
    setSessionName,
    setSubjectCount,
    setSubjectPrefix,
  ]);

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
            
          </div>
          <div className="header-center">
            <div className="header-app-meta">
              <span className="facility-name">{isHome ? NEXUS_N3_APP.name : headerTitle}</span>
            </div>
          </div>
          <div className="header-right">
            <ResetButton onClick={reset} disabled={isResetting || isDrainPending} />
          </div>
        </header>

        <div className="header-line"></div>

        {isResetting ? <div role="status">Resetting session...</div> : null}
        {resetError ? (
          <div className="error-banner error-dismissible" role="alert">
            <p>{resetError}</p>
            <p>The UI has been reset. Sensor cleanup remains unconfirmed; check the gateway and affected sensors before creating a new session.</p>
            <ErrorDismissButton onClick={dismissResetError} />
          </div>
        ) : null}
        <div className="route-stage">
          {!isResetting && <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/new-session" element={<StageGuard required="session_creation"><NewSessionScreen /></StageGuard>} />
            <Route path="/subjects" element={<StageGuard required="subject_selection"><SubjectsRequiredScreen /></StageGuard>} />
            <Route path="/config-bootstrap" element={<ConfigBootstrapScreen />} />
            <Route path="/sensor-setup" element={<StageGuard required="sensor_configuration"><SensorSetupScreen /></StageGuard>} />
            <Route path="/session" element={<StageGuard required="sensor_discovery"><SessionScreen /></StageGuard>} />
            <Route path="/assign-sensors" element={<StageGuard required="sensor_discovery"><AssignSensorsScreen /></StageGuard>} />
            <Route path="/active-session" element={<StageGuard required="active"><ActiveSessionScreen /></StageGuard>} />
            <Route path="/completed" element={<StageGuard required="completed"><ActiveSessionScreen /></StageGuard>} />
            <Route path="/new-activity" element={<StageGuard required="session_readiness"><NewActivityScreen /></StageGuard>} />
            <Route path="/activity/subject/:id" element={<StageGuard required="active"><SubjectActivityScreen /></StageGuard>} />
          </Routes>}
        </div>
      </div>
    </div>
  );
};

export const NexusN3View = () => {
  return (
    <>
      <div className="nexus-n3-built-in-view">
        <MemoryRouter>
        <GatewaySocketProvider>
          <AppContent />
        </GatewaySocketProvider>
        </MemoryRouter>
      </div>
      <Toaster
          position="top-right"
          richColors
          closeButton
      />
    </>
  );
};

export default NexusN3View;
