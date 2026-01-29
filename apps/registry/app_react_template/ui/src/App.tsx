import React, { useEffect, useMemo, useState } from "react";
import LiveResults from "./components/LiveResults";
import StepList from "./components/StepList";
import TemplateHeader from "./components/TemplateHeader";
import UiOnlyStep from "./components/UiOnlyStep";

type Step = {
  id: string;
  name: string;
  command?: string;
};

const FALLBACK_STEPS: Step[] = [
  { id: "check_readiness", name: "Check Server Readiness", command: "is_server_ready" },
  { id: "who_session", name: "Who + Session Label" },
  { id: "subjects", name: "Subjects" },
  { id: "sensors", name: "Sensors" },
  { id: "locations", name: "Locations" },
  { id: "algorithms", name: "Algorithms" },
  { id: "init_system", name: "Init System", command: "init_system" },
  { id: "discover_sensors", name: "Discover Sensors", command: "discover_sensors" },
  { id: "connect_sensors", name: "Connect Sensors", command: "connect_all" },
  { id: "identify_sensors", name: "Identify Sensors (Assign Locations)", command: "identify_sensor" },
  { id: "start_stream", name: "Start Stream", command: "start_stream_for_all" },
  { id: "stop_stream", name: "Stop Stream", command: "stop_stream_for_all" },
  { id: "final_results", name: "View Final Results" },
  { id: "disconnect", name: "Disconnect Sensors", command: "disconnect_all" }
];

const DEFAULT_PAYLOADS: Record<string, unknown> = {
  init_system: {
    init_label: "Anna_bdc",
    subjects: []
  },
  connect_subjects: { subject_ids: ["subject1"] },
  identify_sensor: { subject_id: "subject1", location: "LEFT_ANKLE" },
  start_stream_for_all: { tag: "run" },
  start_stream_for_subjects: { subject_ids: ["subject1"], tag: "run" },
  stop_stream_for_subjects: { subject_ids: ["subject1"] },
  disconnect_subjects: { subject_ids: ["subject1"] }
};

function jsonString(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getPayloadTemplate(command?: string) {
  if (!command) return "";
  const preset = DEFAULT_PAYLOADS[command];
  if (!preset) return "";
  return jsonString(preset);
}

function safeJson(value: string) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function Stepper({ value, onChange }: { value: number; onChange: (val: number) => void }) {
  const current = Number.isFinite(value) && value > 0 ? value : 1;
  return (
    <div className="stepper">
      <button className="secondary" onClick={() => onChange(Math.max(1, current - 1))}>
        -
      </button>
      <input className="text-input" type="number" min={1} step={1} readOnly value={String(current)} />
      <button className="secondary" onClick={() => onChange(current + 1)}>
        +
      </button>
    </div>
  );
}

export default function App() {
  const [steps, setSteps] = useState<Step[]>(FALLBACK_STEPS);
  const [index, setIndex] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [who, setWho] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [subjectBase, setSubjectBase] = useState("subject");
  const [subjectCount, setSubjectCount] = useState(1);
  const [sensorName, setSensorName] = useState("Movella DOT");
  const [sensorCount, setSensorCount] = useState(2);
  const [supportedSensors, setSupportedSensors] = useState<string[]>([]);
  const [supportedSensorLocations, setSupportedSensorLocations] = useState<Record<string, string[]>>({});
  const [supportedSensorComputations, setSupportedSensorComputations] = useState<Record<string, any[]>>({});
  const [subjectSensors, setSubjectSensors] = useState<Record<string, { name: string; count: number }>>({});
  const [subjectLocations, setSubjectLocations] = useState<Record<string, string[]>>({});
  const [locationsFallback] = useState(["LEFT_ANKLE", "RIGHT_ANKLE"]);
  const [algorithmSubjectIndex, setAlgorithmSubjectIndex] = useState(0);
  const [algorithmAssignMode, setAlgorithmAssignMode] = useState("all");
  const [subjectAlgorithms, setSubjectAlgorithms] = useState<Record<string, Record<string, { name: string; inputs: string }>>>({});
  const [algorithmAllName, setAlgorithmAllName] = useState("standard_loading_intensity");
  const [algorithmAllInputs, setAlgorithmAllInputs] = useState("{\n  \"gravity\": 9.80665\n}");
  const [discoverMode, setDiscoverMode] = useState("all");
  const [discoverSubjectIndex, setDiscoverSubjectIndex] = useState(0);
  const [connectMode, setConnectMode] = useState("all");
  const [connectSubjectIndex, setConnectSubjectIndex] = useState(0);
  const [identifySubjectIndex, setIdentifySubjectIndex] = useState(0);
  const [identifyLocation, setIdentifyLocation] = useState("");
  const [startMode, setStartMode] = useState("all");
  const [streamSubjectIndex, setStreamSubjectIndex] = useState(0);
  const [streamTag, setStreamTag] = useState("run");
  const [stopMode, setStopMode] = useState("all");
  const [stopSubjectIndex, setStopSubjectIndex] = useState(0);
  const [resultViewSubjectIndex, setResultViewSubjectIndex] = useState(0);
  const [locationSubjectIndex, setLocationSubjectIndex] = useState(0);
  const [commandPayloadText, setCommandPayloadText] = useState("");
  const [commandError, setCommandError] = useState("");
  const [site, setSite] = useState("");
  const [discoverError, setDiscoverError] = useState("");
  const [connectError, setConnectError] = useState("");
  const [identifyError, setIdentifyError] = useState("");
  const [startError, setStartError] = useState("");
  const [stopError, setStopError] = useState("");
  const [resultCounts, setResultCounts] = useState<Record<string, { compute: number; intermediate: number }>>({});
  const [lastCompute, setLastCompute] = useState<Record<string, any>>({});
  const [lastIntermediate, setLastIntermediate] = useState<Record<string, any>>({});
  const siteLabel = site || window.localStorage.getItem("neia_site") || "";

  useEffect(() => {
    fetch("/api/v1/steps")
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.steps)) {
          setSteps(data.steps);
          setCompleted({});
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("neia_site");
    if (saved) {
      setSite(saved);
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/api/v1/gateway/events`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        if (event.type === "server_ready" && event.payload?.site) {
          setSite(event.payload.site);
          window.localStorage.setItem("neia_site", event.payload.site);
        }
        if (event.type === "server_ready" && event.payload && Array.isArray(event.payload.supported_sensors)) {
          const sensors = event.payload.supported_sensors;
          if (sensors.length && typeof sensors[0] === "object") {
            setSupportedSensors(sensors.map((s: any) => s.name).filter(Boolean));
            const locMap: Record<string, string[]> = {};
            const compMap: Record<string, any[]> = {};
            sensors.forEach((s: any) => {
              if (s.name && Array.isArray(s.locations)) {
                locMap[s.name] = s.locations;
              }
              if (s.name && Array.isArray(s.computations)) {
                compMap[s.name] = s.computations;
              }
            });
            setSupportedSensorLocations(locMap);
            setSupportedSensorComputations(compMap);
          } else {
            setSupportedSensors(sensors);
          }
        }
        if (event.type === "sensors_discovered" || event.type === "sensors_discovered_for_subject") {
          setCompleted((prev) => ({ ...prev, discover_sensors: true }));
        }
        if (event.type === "sensor_connected") {
          setCompleted((prev) => ({ ...prev, connect_sensors: true }));
        }
        if (event.type === "stream_started") {
          setCompleted((prev) => ({ ...prev, start_stream: true }));
        }
        if (event.type === "stream_stopped") {
          setCompleted((prev) => ({ ...prev, stop_stream: true }));
        }
        if (event.type === "sensor_disconnected") {
          setCompleted((prev) => ({ ...prev, disconnect: true }));
        }
        if (event.type === "compute_result" && event.payload && event.payload.subject_id) {
          const sid = event.payload.subject_id;
          setLastCompute((prev) => ({ ...prev, [sid]: event }));
          setResultCounts((prev) => ({
            ...prev,
            [sid]: {
              compute: (prev[sid]?.compute || 0) + 1,
              intermediate: prev[sid]?.intermediate || 0
            }
          }));
        }
        if (event.type === "intermediate_result" && event.payload && event.payload.subject_id) {
          const sid = event.payload.subject_id;
          setLastIntermediate((prev) => ({ ...prev, [sid]: event }));
          setResultCounts((prev) => ({
            ...prev,
            [sid]: {
              compute: prev[sid]?.compute || 0,
              intermediate: (prev[sid]?.intermediate || 0) + 1
            }
          }));
        }
        setEvents((prev) => [...prev, event]);
      } catch {
        return;
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    const step = steps[index];
    if (!step || !step.command || step.id === "init_system") return;
    const nextPayload = getPayloadTemplate(step.command);
    setCommandPayloadText(nextPayload);
    setCommandError("");
  }, [index, steps]);

  useEffect(() => {
    setEvents([]);
  }, [index]);

  const subjectIds = useMemo(() => {
    const ids = [];
    for (let i = 0; i < (subjectCount || 1); i += 1) {
      ids.push(`${subjectBase || "subject"}_${i}`);
    }
    return ids;
  }, [subjectBase, subjectCount]);

  const effectiveAssignMode = useMemo(() => {
    if (!subjectIds.length) return algorithmAssignMode;
    const base = subjectSensors[subjectIds[0]]?.name;
    const allSame = subjectIds.every((id) => subjectSensors[id]?.name === base);
    return allSame ? algorithmAssignMode : "per_subject";
  }, [algorithmAssignMode, subjectIds, subjectSensors]);

  function isPrevStepsComplete(targetIndex: number) {
    for (let i = 0; i < targetIndex; i += 1) {
      const step = steps[i];
      if (!completed[step.id]) return false;
    }
    return true;
  }

  function getLocationOptions(name: string) {
    const options = supportedSensorLocations[name];
    if (Array.isArray(options) && options.length) return options;
    return locationsFallback;
  }

  function getComputationOptions(name: string) {
    const options = supportedSensorComputations[name];
    if (Array.isArray(options) && options.length) return options;
    return [];
  }

  function getComputationNames(name: string) {
    return getComputationOptions(name)
      .map((entry) => (entry && entry.name ? entry.name : null))
      .filter(Boolean) as string[];
  }

  function getComputationInputs(name: string, algoName: string) {
    const options = getComputationOptions(name);
    for (const entry of options) {
      if (entry && entry.name === algoName) {
        return entry.inputs || {};
      }
    }
    return {};
  }

  function getAlgorithmForSubject(subjectId: string, sensorType: string) {
    const options = getComputationNames(sensorType);
    const defaultName = options[0] || "standard_loading_intensity";
    if (effectiveAssignMode === "all") {
      const name = options.includes(algorithmAllName) ? algorithmAllName : defaultName;
      const inputs = name === algorithmAllName ? safeJson(algorithmAllInputs) : getComputationInputs(sensorType, name);
      return { name, inputs };
    }
    const entry = subjectAlgorithms[subjectId]?.[sensorType];
    const name = entry?.name && options.includes(entry.name) ? entry.name : defaultName;
    const inputs = entry?.inputs ? safeJson(entry.inputs) : getComputationInputs(sensorType, name);
    return { name, inputs };
  }

  function buildInitPayload() {
    const subjects = subjectIds.map((subjectId) => {
      const sensorConfig = subjectSensors[subjectId] || {
        name: sensorName,
        count: sensorCount
      };
      const locs = subjectLocations[subjectId];
      const effectiveLocations = Array.isArray(locs) && locs.length ? locs : locationsFallback;
      const algoConfig = getAlgorithmForSubject(subjectId, sensorConfig.name);
      return {
        subject_id: subjectId,
        sensors: [
          {
            local_name: sensorConfig.name,
            number_of: sensorConfig.count,
            compute_algorithm: {
              name: algoConfig.name,
              inputs: algoConfig.inputs
            },
            locations: effectiveLocations
          }
        ]
      };
    });

    const initLabel = [who.trim(), sessionLabel.trim()].filter(Boolean).join("_");
    return {
      init_label: initLabel || undefined,
      subjects
    };
  }

  function getAssignedAlgorithmsForSubject(subjectId: string) {
    if (effectiveAssignMode === "all") return algorithmAllName || "standard_loading_intensity";
    const subjectMap = subjectAlgorithms[subjectId] || {};
    const keys = Object.keys(subjectMap);
    if (!keys.length) return "None";
    return keys.map((k) => `${k}:${subjectMap[k].name}`).join(", ");
  }

  function markComplete(stepId: string) {
    setCompleted((prev) => ({ ...prev, [stepId]: true }));
  }

  function sendCommand(type: string, payload: any, onOk?: () => void, onError?: () => void) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      if (site && payload.site === undefined) {
        payload.site = site;
      }
    }
    fetch("/api/v1/gateway/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload: payload || {} })
    })
      .then((resp) => {
        if (!resp.ok) throw new Error("Command failed");
        onOk?.();
      })
      .catch(() => onError?.());
  }

  const step = steps[index];

  return (
    <div className="neia-react-template-app">
      <TemplateHeader siteLabel={siteLabel} />
      <div className="layout">
        <StepList
          steps={steps}
          activeIndex={index}
          completed={completed}
          isPrevStepsComplete={isPrevStepsComplete}
          onSelect={(idx) => {
            setIndex(idx);
            setEvents([]);
          }}
        />
        <div className="content">
          <h3>{step?.name}</h3>

          {!step?.command && step?.id === "who_session" ? (
            <>
              <p className="note">Set who owns the session and the session label.</p>
              <div className="field">
                <label className="label">Who:</label>
                <input className="text-input" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Anna" />
              </div>
              <div className="field">
                <label className="label">Label:</label>
                <input
                  className="text-input"
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  placeholder="baseline_data_collection"
                />
              </div>
              <button className="primary mark-complete" onClick={() => markComplete(step.id)}>
                Mark Step Complete
              </button>
            </>
          ) : null}

          {!step?.command && step?.id === "subjects" ? (
            <>
              <p className="note">Define subject IDs by base name + count.</p>
              <div className="field">
                <label className="label">Base Name:</label>
                <input
                  className="text-input"
                  value={subjectBase}
                  onChange={(e) => setSubjectBase(e.target.value || "subject")}
                />
              </div>
              <div className="field">
                <label className="label">Count:</label>
                <Stepper value={subjectCount} onChange={setSubjectCount} />
              </div>
              <button className="primary mark-complete" onClick={() => markComplete(step.id)}>
                Mark Step Complete
              </button>
            </>
          ) : null}

          {!step?.command && step?.id === "sensors" ? (
            <>
              <p className="note">Assign sensor type and quantity per subject.</p>
              {subjectIds.map((subjectId) => {
                const config = subjectSensors[subjectId] || { name: sensorName, count: sensorCount };
                const options = supportedSensors.length ? supportedSensors : [sensorName];
                return (
                  <div className="location-row" key={subjectId}>
                    <div className="subject-label">{subjectId}</div>
                    <select
                      className="select-input"
                      value={config.name}
                      onChange={(e) =>
                        setSubjectSensors((prev) => ({
                          ...prev,
                          [subjectId]: { ...config, name: e.target.value }
                        }))
                      }
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <Stepper
                      value={config.count}
                      onChange={(val) =>
                        setSubjectSensors((prev) => ({
                          ...prev,
                          [subjectId]: { ...config, count: val }
                        }))
                      }
                    />
                  </div>
                );
              })}
              <button className="primary mark-complete" onClick={() => markComplete(step.id)}>
                Mark Step Complete
              </button>
            </>
          ) : null}

          {!step?.command && step?.id === "locations" ? (
            <>
              <p className="note">Assign locations to each sensor for each subject.</p>
              {!subjectIds.length ? <p className="note">Add subjects first.</p> : null}
              {subjectIds.length ? (
                <>
                  <div className="field">
                    <label className="label">Subject:</label>
                    <select
                      className="select-input"
                      value={String(locationSubjectIndex)}
                      onChange={(e) => setLocationSubjectIndex(parseInt(e.target.value, 10) || 0)}
                    >
                      {subjectIds.map((id, idx) => (
                        <option key={id} value={String(idx)}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="location-nav">
                    <button
                      className="secondary"
                      disabled={locationSubjectIndex <= 0}
                      onClick={() => setLocationSubjectIndex(Math.max(0, locationSubjectIndex - 1))}
                    >
                      Prev Subject
                    </button>
                    <button
                      className="secondary"
                      disabled={locationSubjectIndex >= subjectIds.length - 1}
                      onClick={() => setLocationSubjectIndex(Math.min(subjectIds.length - 1, locationSubjectIndex + 1))}
                    >
                      Next Subject
                    </button>
                  </div>
                  {(() => {
                    const subjectId = subjectIds[locationSubjectIndex];
                    const config = subjectSensors[subjectId] || { name: sensorName, count: sensorCount };
                    const options = getLocationOptions(config.name);
                    const assigned = subjectLocations[subjectId] || [];
                    return (
                      <div className="field">
                        {Array.from({ length: config.count }).map((_, idx) => (
                          <div className="location-row" key={`${subjectId}-${idx}`}>
                            <div className="subject-label">Sensor {idx + 1}</div>
                            <select
                              className="select-input"
                              value={assigned[idx] || options[idx % options.length] || ""}
                              onChange={(e) =>
                                setSubjectLocations((prev) => ({
                                  ...prev,
                                  [subjectId]: Object.assign([], assigned, { [idx]: e.target.value })
                                }))
                              }
                            >
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="divider" />
                  <div className="field">
                    <label className="label">Assigned Locations:</label>
                    {subjectIds.map((id) => {
                      const assigned = subjectLocations[id] || [];
                      return (
                        <div className="assignment-line" key={id}>
                          {id}: {assigned.length ? assigned.join(", ") : "None"}
                        </div>
                      );
                    })}
                  </div>
                  <button className="primary mark-complete" onClick={() => markComplete(step.id)}>
                    Mark Step Complete
                  </button>
                </>
              ) : null}
            </>
          ) : null}

          {!step?.command && step?.id === "algorithms" ? (
            <>
              <p className="note">Assign algorithms to sensor types.</p>
              {!subjectIds.length ? <p className="note">Add subjects first.</p> : null}
              {subjectIds.length ? (
                <>
                  <div className="field">
                    <label className="label">Assignment Mode:</label>
                    <select
                      className="select-input half"
                      value={effectiveAssignMode}
                      onChange={(e) => setAlgorithmAssignMode(e.target.value)}
                    >
                      <option value="all" disabled={effectiveAssignMode !== "all"}>
                        One algorithm for all subjects (same sensor type)
                      </option>
                      <option value="per_subject">Per subject</option>
                    </select>
                  </div>

                  {effectiveAssignMode === "all" ? (
                    (() => {
                      const name = subjectSensors[subjectIds[0]]?.name || sensorName;
                      const options = getComputationNames(name);
                      if (!options.length) {
                        return <p className="note">No computations returned for {name}. This sensor cannot be used.</p>;
                      }
                      const selected = options.includes(algorithmAllName) ? algorithmAllName : options[0];
                      const inputsValue =
                        selected === algorithmAllName
                          ? algorithmAllInputs
                          : jsonString(getComputationInputs(name, selected));
                      return (
                        <>
                          <div className="sensor-row">
                            <div className="subject-label">{name}</div>
                            <select
                              className="select-input"
                              value={selected}
                              onChange={(e) => {
                                setAlgorithmAllName(e.target.value);
                                setAlgorithmAllInputs(jsonString(getComputationInputs(name, e.target.value)));
                              }}
                            >
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label className="label">Inputs (JSON):</label>
                            <textarea
                              className="payload"
                              value={inputsValue}
                              onChange={(e) => setAlgorithmAllInputs(e.target.value)}
                            />
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    (() => {
                      const subjectId = subjectIds[algorithmSubjectIndex] || subjectIds[0];
                      const name = subjectSensors[subjectId]?.name || sensorName;
                      const options = getComputationNames(name);
                      if (!options.length) {
                        return <p className="note">No computations returned for {name}. This sensor cannot be used.</p>;
                      }
                      const entry = subjectAlgorithms[subjectId]?.[name];
                      const selected = entry?.name && options.includes(entry.name) ? entry.name : options[0];
                      const inputsValue = entry?.inputs || jsonString(getComputationInputs(name, selected));
                      return (
                        <>
                          <div className="field">
                            <label className="label">Subject:</label>
                            <select
                              className="select-input third"
                              value={String(algorithmSubjectIndex)}
                              onChange={(e) => setAlgorithmSubjectIndex(parseInt(e.target.value, 10) || 0)}
                            >
                              {subjectIds.map((id, idx) => (
                                <option key={id} value={String(idx)}>
                                  {id}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="location-nav">
                            <button
                              className="secondary"
                              disabled={algorithmSubjectIndex <= 0}
                              onClick={() => setAlgorithmSubjectIndex(Math.max(0, algorithmSubjectIndex - 1))}
                            >
                              Prev Subject
                            </button>
                            <button
                              className="secondary"
                              disabled={algorithmSubjectIndex >= subjectIds.length - 1}
                              onClick={() => setAlgorithmSubjectIndex(Math.min(subjectIds.length - 1, algorithmSubjectIndex + 1))}
                            >
                              Next Subject
                            </button>
                          </div>
                          <div className="location-row">
                            <div className="subject-label">{name}</div>
                            <select
                              className="select-input"
                              value={selected}
                              onChange={(e) => {
                                const next = e.target.value;
                                setSubjectAlgorithms((prev) => ({
                                  ...prev,
                                  [subjectId]: {
                                    ...(prev[subjectId] || {}),
                                    [name]: { name: next, inputs: jsonString(getComputationInputs(name, next)) }
                                  }
                                }));
                              }}
                            >
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label className="label">Inputs (JSON):</label>
                            <textarea
                              className="payload"
                              value={inputsValue}
                              onChange={(e) =>
                                setSubjectAlgorithms((prev) => ({
                                  ...prev,
                                  [subjectId]: {
                                    ...(prev[subjectId] || {}),
                                    [name]: { name: selected, inputs: e.target.value }
                                  }
                                }))
                              }
                            />
                          </div>
                        </>
                      );
                    })()
                  )}

                  <div className="divider" />
                  <div className="field">
                    <label className="label">Assigned Algorithms:</label>
                    {subjectIds.map((id) => (
                      <div className="assignment-line" key={id}>
                        {id}: {getAssignedAlgorithmsForSubject(id)}
                      </div>
                    ))}
                  </div>
                  <button className="primary mark-complete" onClick={() => markComplete(step.id)}>
                    Mark Step Complete
                  </button>
                </>
              ) : null}
            </>
          ) : null}

          {!step?.command && step?.id === "final_results" ? (
            <UiOnlyStep onComplete={() => markComplete("final_results")} />
          ) : null}

          {step?.command ? (
            <>
              {step.id === "discover_sensors" ? (
                <>
                  <p className="note">Discover sensors for all subjects or a selected subject.</p>
                  <div className="field">
                    <label className="label">Mode:</label>
                    <select className="select-input third" value={discoverMode} onChange={(e) => setDiscoverMode(e.target.value)}>
                      <option value="all">Discover All</option>
                      <option value="subject">Discover by Subject</option>
                    </select>
                  </div>
                  {discoverMode === "subject" ? (
                    <>
                      <div className="field">
                        <label className="label">Subject:</label>
                        <select
                          className="select-input third"
                          value={String(discoverSubjectIndex)}
                          onChange={(e) => setDiscoverSubjectIndex(parseInt(e.target.value, 10) || 0)}
                        >
                          {subjectIds.map((id, idx) => (
                            <option key={id} value={String(idx)}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="location-nav">
                        <button
                          className="secondary"
                          disabled={discoverSubjectIndex <= 0}
                          onClick={() => setDiscoverSubjectIndex(Math.max(0, discoverSubjectIndex - 1))}
                        >
                          Prev Subject
                        </button>
                        <button
                          className="secondary"
                          disabled={discoverSubjectIndex >= subjectIds.length - 1}
                          onClick={() => setDiscoverSubjectIndex(Math.min(subjectIds.length - 1, discoverSubjectIndex + 1))}
                        >
                          Next Subject
                        </button>
                      </div>
                    </>
                  ) : null}
                  <div className="field">
                    <button
                      className="primary"
                      onClick={() => {
                        setEvents([]);
                        if (discoverMode === "subject") {
                          const subjectId = subjectIds[discoverSubjectIndex] || subjectIds[0];
                          sendCommand("discover_sensors_for_subjects", { subject_ids: [subjectId] }, () => markComplete("discover_sensors"), () => setDiscoverError("Failed to send command."));
                        } else {
                          sendCommand("discover_sensors", {}, () => markComplete("discover_sensors"), () => setDiscoverError("Failed to send command."));
                        }
                      }}
                    >
                      Discover Sensors
                    </button>
                    {discoverError ? <div className="error">{discoverError}</div> : null}
                  </div>
                </>
              ) : null}

              {step.id === "connect_sensors" ? (
                <>
                  <p className="note">Connect sensors for all subjects or a selected subject.</p>
                  <div className="field">
                    <label className="label">Mode:</label>
                    <select className="select-input third" value={connectMode} onChange={(e) => setConnectMode(e.target.value)}>
                      <option value="all">Connect All</option>
                      <option value="subject">Connect by Subject</option>
                    </select>
                  </div>
                  {connectMode === "subject" ? (
                    <>
                      <div className="field">
                        <label className="label">Subject:</label>
                        <select
                          className="select-input third"
                          value={String(connectSubjectIndex)}
                          onChange={(e) => setConnectSubjectIndex(parseInt(e.target.value, 10) || 0)}
                        >
                          {subjectIds.map((id, idx) => (
                            <option key={id} value={String(idx)}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="location-nav">
                        <button className="secondary" disabled={connectSubjectIndex <= 0} onClick={() => setConnectSubjectIndex(Math.max(0, connectSubjectIndex - 1))}>
                          Prev Subject
                        </button>
                        <button
                          className="secondary"
                          disabled={connectSubjectIndex >= subjectIds.length - 1}
                          onClick={() => setConnectSubjectIndex(Math.min(subjectIds.length - 1, connectSubjectIndex + 1))}
                        >
                          Next Subject
                        </button>
                      </div>
                    </>
                  ) : null}
                  <div className="field">
                    <button
                      className="primary"
                      onClick={() => {
                        setEvents([]);
                        if (connectMode === "subject") {
                          const subjectId = subjectIds[connectSubjectIndex] || subjectIds[0];
                          sendCommand("connect_subjects", { subject_ids: [subjectId] }, () => markComplete("connect_sensors"), () => setConnectError("Failed to send command."));
                        } else {
                          sendCommand("connect_all", {}, () => markComplete("connect_sensors"), () => setConnectError("Failed to send command."));
                        }
                      }}
                    >
                      Connect Sensors
                    </button>
                    {connectError ? <div className="error">{connectError}</div> : null}
                  </div>
                </>
              ) : null}

              {step.id === "identify_sensors" ? (
                <>
                  <p className="note">Identify sensors to confirm body locations.</p>
                  <div className="field">
                    <label className="label">Subject:</label>
                    <select
                      className="select-input third"
                      value={String(identifySubjectIndex)}
                      onChange={(e) => setIdentifySubjectIndex(parseInt(e.target.value, 10) || 0)}
                    >
                      {subjectIds.map((id, idx) => (
                        <option key={id} value={String(idx)}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const subjectId = subjectIds[identifySubjectIndex] || subjectIds[0];
                    const assignedLocations = (subjectLocations[subjectId] || []).filter(Boolean);
                    const uniqueLocations = Array.from(new Set(assignedLocations));
                    const selectedLocation = uniqueLocations.includes(identifyLocation) ? identifyLocation : uniqueLocations[0] || "";
                    if (!uniqueLocations.length) {
                      return <p className="note">No locations assigned for this subject. Set locations first.</p>;
                    }
                    return (
                      <div className="field">
                        <label className="label">Location:</label>
                        <select
                          className="select-input third"
                          value={selectedLocation}
                          onChange={(e) => setIdentifyLocation(e.target.value)}
                        >
                          {uniqueLocations.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                  <div className="field">
                    <button
                      className="primary"
                      onClick={() => {
                        setEvents([]);
                        const subjectId = subjectIds[identifySubjectIndex] || subjectIds[0];
                        const assignedLocations = (subjectLocations[subjectId] || []).filter(Boolean);
                        const uniqueLocations = Array.from(new Set(assignedLocations));
                        const location = uniqueLocations.includes(identifyLocation) ? identifyLocation : uniqueLocations[0];
                        if (!location) {
                          setIdentifyError("No locations assigned for this subject.");
                          return;
                        }
                        sendCommand("identify_sensor", { subject_id: subjectId, location }, () => markComplete("identify_sensors"), () => setIdentifyError("Failed to send command."));
                      }}
                    >
                      Identify Sensor
                    </button>
                    {identifyError ? <div className="error">{identifyError}</div> : null}
                  </div>
                </>
              ) : null}

              {step.id === "start_stream" ? (
                <>
                  <p className="note">Start streaming for all subjects or a selected subject.</p>
                  <div className="field">
                    <label className="label">Mode:</label>
                    <select className="select-input third" value={startMode} onChange={(e) => setStartMode(e.target.value)}>
                      <option value="all">Start All</option>
                      <option value="subject">Start by Subject</option>
                    </select>
                  </div>
                  {startMode === "subject" ? (
                    <div className="field">
                      <label className="label">Subject:</label>
                      <select
                        className="select-input third"
                        value={String(streamSubjectIndex)}
                        onChange={(e) => setStreamSubjectIndex(parseInt(e.target.value, 10) || 0)}
                      >
                        {subjectIds.map((id, idx) => (
                          <option key={id} value={String(idx)}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="field">
                    <label className="label">Tag:</label>
                    <input className="text-input" value={streamTag} onChange={(e) => setStreamTag(e.target.value)} />
                  </div>
                  <div className="field">
                    <button
                      className="primary"
                      onClick={() => {
                        setEvents([]);
                        if (startMode === "subject") {
                          const subjectId = subjectIds[streamSubjectIndex] || subjectIds[0];
                          sendCommand("start_stream_for_subjects", { subject_ids: [subjectId], tag: streamTag || "run" }, () => markComplete("start_stream"), () => setStartError("Failed to send command."));
                        } else {
                          sendCommand("start_stream_for_all", { tag: streamTag || "run" }, () => markComplete("start_stream"), () => setStartError("Failed to send command."));
                        }
                      }}
                    >
                      Start Stream
                    </button>
                    {startError ? <div className="error">{startError}</div> : null}
                  </div>

                  <LiveResults
                    subjectIds={subjectIds}
                    resultViewSubjectIndex={resultViewSubjectIndex}
                    onSubjectChange={setResultViewSubjectIndex}
                    resultCounts={resultCounts}
                    lastCompute={lastCompute}
                    lastIntermediate={lastIntermediate}
                    subjectSensors={subjectSensors}
                    defaultSensorCount={sensorCount}
                    jsonString={jsonString}
                  />
                </>
              ) : null}

              {step.id === "stop_stream" ? (
                <>
                  <p className="note">Stop streaming for all subjects or a selected subject.</p>
                  <div className="field">
                    <label className="label">Mode:</label>
                    <select className="select-input third" value={stopMode} onChange={(e) => setStopMode(e.target.value)}>
                      <option value="all">Stop All</option>
                      <option value="subject">Stop by Subject</option>
                    </select>
                  </div>
                  {stopMode === "subject" ? (
                    <div className="field">
                      <label className="label">Subject:</label>
                      <select
                        className="select-input third"
                        value={String(stopSubjectIndex)}
                        onChange={(e) => setStopSubjectIndex(parseInt(e.target.value, 10) || 0)}
                      >
                        {subjectIds.map((id, idx) => (
                          <option key={id} value={String(idx)}>
                            {id}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="field">
                    <button
                      className="primary"
                      onClick={() => {
                        setEvents([]);
                        if (stopMode === "subject") {
                          const subjectId = subjectIds[stopSubjectIndex] || subjectIds[0];
                          sendCommand("stop_stream_for_subjects", { subject_ids: [subjectId] }, () => markComplete("stop_stream"), () => setStopError("Failed to send command."));
                        } else {
                          sendCommand("stop_stream_for_all", {}, () => markComplete("stop_stream"), () => setStopError("Failed to send command."));
                        }
                      }}
                    >
                      Stop Stream
                    </button>
                    {stopError ? <div className="error">{stopError}</div> : null}
                  </div>
                </>
              ) : null}

              {!step.id || ["discover_sensors", "connect_sensors", "identify_sensors", "start_stream", "stop_stream"].includes(step.id) ? null : (
                <>
                  <div className="row">
                    <span className="label">Command:</span>
                    <span className="value">{step.command}</span>
                  </div>
                  {step.id === "init_system" ? (
                    <>
                      <label className="label">Payload (JSON):</label>
                      <textarea className="payload" value={jsonString(buildInitPayload())} readOnly />
                    </>
                  ) : commandPayloadText ? (
                    <>
                      <label className="label">Payload (JSON):</label>
                      <textarea className="payload" value={commandPayloadText} onChange={(e) => setCommandPayloadText(e.target.value)} />
                    </>
                  ) : null}
                  <button
                    className="primary"
                    onClick={() => {
                      setCommandError("");
                      if (step.id === "init_system") {
                        const payload = buildInitPayload();
                        sendCommand(step.command, payload, () => markComplete(step.id), () => setCommandError("Failed to send command."));
                        return;
                      }
                      let payload = {};
                      if (commandPayloadText && commandPayloadText.trim()) {
                        try {
                          payload = JSON.parse(commandPayloadText);
                        } catch {
                          setCommandError("Invalid JSON payload.");
                          return;
                        }
                      }
                      sendCommand(step.command, payload, () => markComplete(step.id), () => setCommandError("Failed to send command."));
                    }}
                  >
                    Send Command
                  </button>
                  {commandError ? <div className="error">{commandError}</div> : null}
                </>
              )}
            </>
          ) : null}

          <div className="nav-row">
            <button className="secondary" disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))}>
              Prev
            </button>
            <button
              className="secondary"
              disabled={index === steps.length - 1 || !completed[step.id]}
              onClick={() => setIndex(Math.min(steps.length - 1, index + 1))}
            >
              Next
            </button>
          </div>

          {step?.command ? (
            <div className="events">
              <h4>Event Log</h4>
              <div className="event-list">
                {events.slice(-12).map((evt, idx) => (
                  <pre className="event-line" key={idx}>
                    {jsonString(evt)}
                  </pre>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
