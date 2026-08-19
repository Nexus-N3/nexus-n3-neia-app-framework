export type StartupStage = "booting" | "waking" | "preSpeak" | "speaking" | "postSpeak" | "done";

export type AppManifest = {
  id: string;
  name: string;
  version: string;
  description?: string | null;
  app_type?: string | null;
  developer?: string | null;
  icon?: string | null;
  entry_ui?: string | null;
  style?: string | null;
  mount?: string | null;
  layout_mode?: string | null;
  dev_entry_ui?: string | null;
  dev_mount?: string | null;
};

export type AppInfo = {
  manifest: AppManifest;
  installed: boolean;
  resolved_entry_ui?: string | null;
  resolved_mount?: string | null;
};

export type SubjectRecord = {
  subject_id: string;
  display_name: string;
  subject_type?: string | null;
};

export type SubjectSelectionOption = SubjectRecord & {
  groupLabel: string;
};

export type SubjectGroup = {
  group_id?: string | null;
  label?: string | null;
  subjects: SubjectRecord[];
};

export type SessionConfigRecord = {
  session_config_id: string;
  name: string;
  deployed?: boolean;
  app_id?: string | null;
  app_name?: string | null;
  subject_group_id?: string | null;
  subject_group_name?: string | null;
  subject_ids?: string[];
  activity?: string | null;
  workflow?: Record<string, unknown>;
  subjects?: SubjectRecord[];
  init_payload?: Record<string, unknown>;
};

export type ControlCenterCatalog = {
  customer_id?: string | null;
  site_id?: string | null;
  groups?: SubjectGroup[];
  session_configs?: SessionConfigRecord[];
};

export type RemoteOperationState = {
  active: boolean;
  device_name?: string | null;
  site_name?: string | null;
  operator_username?: string | null;
};

export type GatewayTargetSettings = {
  gateway: string;
  site?: string | null;
  target_host: string;
  cmd_port: number;
  event_port: number;
  amqp_url?: string | null;
};

export type AppsSnapshot = {
  installed: AppInfo[];
  available: AppInfo[];
};

export type StartupSpeechMode = "api" | "browser" | "none";

export type CoreConnectionState = "connected" | "connecting" | "disconnected" | "error";

export type CoreConnection = GatewayTargetSettings & {
  state: CoreConnectionState;
  available: boolean;
  error?: string | null;
  last_event_at?: string | null;
  last_ready_at?: string | null;
};

export type CoreSensorCapability = {
  id: string;
  display_name: string;
  supported_locations: string[];
  supported_algorithms: string[];
  available: boolean;
};

export type CoreAlgorithmCapability = {
  id: string;
  display_name: string;
  compatible_sensor_types: string[];
  result_stages: string[];
  output_types: string[];
  inputs?: Record<string, unknown>;
  available: boolean;
};

export type CoreCapabilities = {
  sensors: CoreSensorCapability[];
  algorithms: CoreAlgorithmCapability[];
  updated_at?: string | null;
  connection_state: CoreConnectionState;
  available: boolean;
};

export type CoreStatusValue = string | number | boolean | null;

export type CoreStatus = {
  endpoint: string | null;
  cmd_port: number | null;
  event_port: number | null;
  gateway: string | null;
  connection: Pick<
    CoreConnection,
    "state" | "available" | "error" | "last_event_at" | "last_ready_at"
  >;
  version: string | null;
  readiness: string;
  usb: {
    state: string;
    present: boolean | null;
    mounted: boolean | null;
    capacity_bytes: number | null;
    available_bytes: number | null;
    error: string | null;
  };
  ble: {
    backend: string | null;
    adapter_state: string;
    gateway_state: string;
  };
  azure_bridge: {
    state: string;
  };
  active_session: {
    state: string;
    session_id: string | null;
  };
  services: Array<Record<string, CoreStatusValue>>;
  updated_at?: string | null;
};
