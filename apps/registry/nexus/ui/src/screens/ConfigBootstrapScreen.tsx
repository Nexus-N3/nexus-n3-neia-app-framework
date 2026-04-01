import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { ScreenLayout } from '../components/ScreenLayout';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusOverlay } from '../components/StatusOverlay';
import { configuredSubjectsAtom, selectedSessionConfigAtom } from '../store/atoms';
import { useSystemInitialization } from '../hooks/useSystemInitialization';
import { clearSelectedSessionConfig, readSelectedSessionConfig } from '../utils/sessionConfigContext';

export const ConfigBootstrapScreen: React.FC = () => {
  const navigate = useNavigate();
  const [configuredSubjects] = useAtom(configuredSubjectsAtom);
  const [selectedSessionConfig] = useAtom(selectedSessionConfigAtom);
  const setConfiguredSubjects = useSetAtom(configuredSubjectsAtom);
  const bootstrapStartedRef = React.useRef(false);
  const sessionConfig = React.useMemo(() => readSelectedSessionConfig(), []);

  const { isInitializing, errorMsg: initError, initSystem } = useSystemInitialization(() => {
    clearSelectedSessionConfig();
    navigate('/session', { replace: true });
  });

  React.useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }
    if (!sessionConfig?.init_payload || !Array.isArray(sessionConfig.init_payload.subjects)) {
      return;
    }
    bootstrapStartedRef.current = true;
    initSystem({
      type: 'init_system',
      payload: {
        init_label: sessionConfig.init_payload.init_label || sessionConfig.name,
        app_id: sessionConfig.init_payload.app_id || 'nexus',
        app_name: sessionConfig.init_payload.app_name || 'Nexus Session Management',
        subjects: sessionConfig.init_payload.subjects,
      },
    });
  }, [initSystem, sessionConfig]);

  React.useEffect(() => {
    if (!sessionConfig && !selectedSessionConfig) {
      setConfiguredSubjects(null);
      navigate('/', { replace: true });
    }
  }, [navigate, selectedSessionConfig, sessionConfig, setConfiguredSubjects]);

  const statusText = isInitializing ? 'Initializing workflow from session config...' : null;

  return (
    <ScreenLayout className="screen-layout">
      <ScreenHeader center={<h2 className="screen-title">CONFIG BOOTSTRAP</h2>} />
      <div className="form-container">
        <p className="input-hint">
          {selectedSessionConfig?.name || sessionConfig?.name || 'Preparing configured workflow'}
        </p>
        <p className="input-hint">
          Subjects: {(configuredSubjects ?? []).map((subject) => subject.display_name).join(', ')}
        </p>
      </div>
      <StatusOverlay
        busy={isInitializing}
        statusText={statusText}
        errors={[initError]}
      />
    </ScreenLayout>
  );
};
