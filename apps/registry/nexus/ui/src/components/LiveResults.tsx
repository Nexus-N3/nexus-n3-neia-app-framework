type LiveResultsProps = {
  subjectIds: string[];
  resultViewSubjectIndex: number;
  onSubjectChange: (index: number) => void;
  resultCounts: Record<string, { compute: number; intermediate: number }>;
  lastCompute: Record<string, any>;
  lastIntermediate: Record<string, any>;
  subjectSensors: Record<string, { name: string; count: number }>;
  defaultSensorCount: number;
  jsonString: (value: unknown) => string;
};

export default function LiveResults({
  subjectIds,
  resultViewSubjectIndex,
  onSubjectChange,
  resultCounts,
  lastCompute,
  lastIntermediate,
  subjectSensors,
  defaultSensorCount,
  jsonString
}: LiveResultsProps) {
  if (!subjectIds.length) return null;
  const subjectId = subjectIds[resultViewSubjectIndex] || subjectIds[0];
  const counts = resultCounts[subjectId] || { compute: 0, intermediate: 0 };
  const latestCompute = lastCompute[subjectId];
  const latestIntermediate = lastIntermediate[subjectId];
  const sensorCount = subjectSensors[subjectId]?.count || defaultSensorCount;
  return (
    <div className="events">
      <h4>Live Results</h4>
      <div className="field">
        <label className="label">View Subject:</label>
        <select
          className="select-input third"
          value={String(resultViewSubjectIndex)}
          onChange={(e) => onSubjectChange(parseInt(e.target.value, 10) || 0)}
        >
          {subjectIds.map((id, idx) => (
            <option key={id} value={String(idx)}>
              {id}
            </option>
          ))}
        </select>
      </div>
      <h4>Latest Compute Results ({counts.compute})</h4>
      <div className="result-grid">
        {Array.from({ length: sensorCount || 1 }).map((_, idx) => (
          <div className="result-box" key={`compute-${idx}`}>
            <h4>Sensor {idx + 1} Result</h4>
            <pre>{latestCompute ? jsonString(latestCompute) : "No results yet"}</pre>
          </div>
        ))}
      </div>
      <div className="result-box">
        <h4>Latest Intermediate Result ({counts.intermediate})</h4>
        <pre>{latestIntermediate ? jsonString(latestIntermediate) : "No results yet"}</pre>
      </div>
    </div>
  );
}
