export const SELECTED_SUBJECT_STORAGE_KEY = 'neia_selected_subject_context';

export interface SelectedSubjectContext {
  subject_id: string;
  display_name: string;
  subject_type?: string | null;
}

export function readSelectedSubjectContext(): SelectedSubjectContext | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_SUBJECT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SelectedSubjectContext>;
    if (!parsed || typeof parsed.subject_id !== 'string' || typeof parsed.display_name !== 'string') {
      return null;
    }
    return {
      subject_id: parsed.subject_id,
      display_name: parsed.display_name,
      subject_type: parsed.subject_type ?? null,
    };
  } catch {
    return null;
  }
}
