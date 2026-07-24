import type { SessionConfigRecord, SubjectGroup, SubjectRecord } from "../types";

export const SELECTED_SUBJECT_STORAGE_KEY = "neia_selected_subject_context";
export const SELECTED_SESSION_CONFIG_STORAGE_KEY = "neia_selected_session_config";

function normalizeSubjectRecord(subject: unknown): SubjectRecord | null {
  if (!subject || typeof subject !== "object") {
    return null;
  }
  const candidate = subject as Record<string, unknown>;
  const subjectId = typeof candidate.subject_id === "string" ? candidate.subject_id.trim() : "";
  if (!subjectId) {
    return null;
  }
  return {
    subject_id: subjectId,
    display_name:
      typeof candidate.display_name === "string" && candidate.display_name.trim()
        ? candidate.display_name
        : subjectId,
    subject_type: typeof candidate.subject_type === "string" ? candidate.subject_type : null,
  };
}

export function mergeSubjectGroups(
  groups: SubjectGroup[] | undefined,
  sessionConfigs: SessionConfigRecord[] | undefined,
): SubjectGroup[] {
  const baseGroups = Array.isArray(groups)
    ? groups.map((group) => ({
        group_id: group.group_id ?? null,
        label: group.label ?? null,
        subjects: Array.isArray(group.subjects)
          ? group.subjects
              .map((subject) => normalizeSubjectRecord(subject))
              .filter((subject): subject is SubjectRecord => Boolean(subject))
          : [],
      }))
    : [];

  const seenSubjectIds = new Set(
    baseGroups.flatMap((group) => group.subjects.map((subject) => subject.subject_id)),
  );
  const derivedGroups = new Map<string, SubjectGroup>();

  for (const config of Array.isArray(sessionConfigs) ? sessionConfigs : []) {
    const groupId = config.subject_group_id || `session-config:${config.session_config_id}`;
    const label = config.subject_group_name || config.name || "Session Config Subjects";
    for (const subject of Array.isArray(config.subjects) ? config.subjects : []) {
      const normalizedSubject = normalizeSubjectRecord(subject);
      if (!normalizedSubject || seenSubjectIds.has(normalizedSubject.subject_id)) {
        continue;
      }
      const existing = derivedGroups.get(groupId) ?? {
        group_id: groupId,
        label,
        subjects: [],
      };
      existing.subjects.push(normalizedSubject);
      derivedGroups.set(groupId, existing);
      seenSubjectIds.add(normalizedSubject.subject_id);
    }
  }

  return [...baseGroups, ...Array.from(derivedGroups.values()).filter((group) => group.subjects.length > 0)];
}

export function readSelectedSessionConfigId(): string | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_SESSION_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { session_config_id?: unknown };
    return typeof parsed.session_config_id === "string" && parsed.session_config_id.trim()
      ? parsed.session_config_id
      : null;
  } catch {
    return null;
  }
}
