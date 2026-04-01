import type { SelectedSubjectContext } from './subjectContext';

export interface WorkflowSubject {
  id: number;
  name: string;
  displayName: string;
}

export function buildWorkflowSubjects(
  subjectCount: number,
  subjectPrefix: string,
  configuredSubjects: Array<{ subject_id: string; display_name: string }> | null,
  selectedSubject: SelectedSubjectContext | null,
): WorkflowSubject[] {
  if (configuredSubjects && configuredSubjects.length > 0) {
    return configuredSubjects.map((subject, index) => ({
      id: index + 1,
      name: subject.subject_id,
      displayName: subject.display_name,
    }));
  }

  if (selectedSubject) {
    return [
      {
        id: 1,
        name: selectedSubject.subject_id,
        displayName: selectedSubject.display_name,
      },
    ];
  }

  return Array.from({ length: subjectCount }, (_, index) => {
    const id = index + 1;
    const name = `${subjectPrefix}${id}`;
    return {
      id,
      name,
      displayName: name,
    };
  });
}
