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
