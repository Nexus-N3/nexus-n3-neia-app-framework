export const SELECTED_SESSION_CONFIG_STORAGE_KEY = 'neia_selected_session_config';

export interface SessionConfigSubject {
  subject_id: string;
  display_name?: string | null;
  subject_type?: string | null;
  sensors?: Array<{
    local_name: string;
    number_of: number;
    compute_algorithm: {
      name: string;
      inputs: Record<string, unknown>;
    };
    locations: string[];
  }>;
}

export interface SelectedSessionConfig {
  session_config_id: string;
  name: string;
  app_id?: string | null;
  app_name?: string | null;
  activity?: string | null;
  subjects?: SessionConfigSubject[];
  init_payload?: {
    init_label?: string;
    app_id?: string;
    app_name?: string;
    subjects?: Array<{
      subject_id: string;
      sensors: Array<{
        local_name: string;
        number_of: number;
        compute_algorithm: {
          name: string;
          inputs: Record<string, unknown>;
        };
        locations: string[];
      }>;
    }>;
  };
}

export function readSelectedSessionConfig(): SelectedSessionConfig | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SelectedSessionConfig>;
    if (!parsed || typeof parsed.session_config_id !== 'string' || typeof parsed.name !== 'string') {
      return null;
    }
    return parsed as SelectedSessionConfig;
  } catch {
    return null;
  }
}

export function clearSelectedSessionConfig(): void {
  window.localStorage.removeItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
}
