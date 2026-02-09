export type FlowState =
  | "idle"
  | "awaiting_server_ready"
  | "awaiting_session_owner"
  | "awaiting_session_label"
  | "awaiting_subject_count"
  | "awaiting_sensor_setup"
  | "awaiting_sensor_locations"
  | "awaiting_algorithm"
  | "initializing"
  | "awaiting_sensors_on"
  | "discovering"
  | "connecting"
  | "identifying"
  | "awaiting_identify_confirm"
  | "awaiting_start_stream"
  | "streaming_starting"
  | "streaming"
  | "stopping"
  | "awaiting_disconnect_confirm"
  | "disconnecting"
  | "error";

export type VoiceIntent = {
  intent?: string;
  text?: string;
  _raw_text?: string;
  name?: string;
  label?: string;
  count?: number;
  sensor_name?: string;
  sensor_count?: number;
  locations?: string[];
  inputs?: Record<string, any>;
  tag?: string;
};

export type FlowContext = {
  session_owner?: string;
  init_label?: string;
  subject_count: number;
  sensor_count?: number;
  sensor_name?: string;
  locations: string[];
  algorithm_name: string;
  algorithm_inputs: Record<string, any>;
  tag?: string;
};

export function defaultFlowContext(): FlowContext {
  return {
    subject_count: 1,
    locations: [],
    algorithm_name: "standard_loading_intensity",
    algorithm_inputs: { gravity: 9.80665 }
  };
}

export function flowStatusText(state: FlowState) {
  if (state === "idle") return "";
  if (state === "awaiting_server_ready") return "Checking server readiness...";
  if (state === "awaiting_session_owner") return "Who is running the session?";
  if (state === "awaiting_session_label") return "What is the session called?";
  if (state === "awaiting_subject_count") return "Please tell me the number of subjects.";
  if (state === "awaiting_sensor_setup") return "Which sensors are you using and how many?";
  if (state === "awaiting_sensor_locations") return "Where are the sensors being placed?";
  if (state === "awaiting_algorithm") return "What algorithm should I use?";
  if (state === "initializing") return "Initializing system...";
  if (state === "awaiting_sensors_on") return "Are sensors turned on?";
  if (state === "discovering") return "Discovering sensors...";
  if (state === "connecting") return "Connecting sensors...";
  if (state === "identifying") return "Identifying sensors...";
  if (state === "awaiting_identify_confirm") return "Is the sensor placed?";
  if (state === "awaiting_start_stream") return 'Please provide a tag, for example: "test one".';
  if (state === "streaming_starting") return "Starting stream...";
  if (state === "streaming") return "Listening for stop stream...";
  if (state === "stopping") return "Stopping stream...";
  if (state === "awaiting_disconnect_confirm") return "Should I disconnect sensors or repeat?";
  if (state === "disconnecting") return "Disconnecting sensors...";
  if (state === "error") return "There was an error. Say retry, change inputs, or cancel.";
  return "Working...";
}

export function flowActionText(state: FlowState) {
  if (state === "awaiting_server_ready") return "Checking server readiness...";
  if (state === "initializing") return "Initializing system...";
  if (state === "discovering") return "Discovering sensors...";
  if (state === "connecting") return "Connecting sensors...";
  if (state === "identifying") return "Identifying sensors...";
  if (state === "streaming_starting") return "Starting stream...";
  if (state === "streaming") return "Streaming active.";
  if (state === "stopping") return "Stopping stream...";
  if (state === "disconnecting") return "Disconnecting sensors...";
  if (state === "error") return "An error occurred.";
  return "";
}

export function flowPromptText(state: FlowState) {
  if (state === "awaiting_session_owner") return "Who is running the session?";
  if (state === "awaiting_session_label") return "What is the session called?";
  if (state === "awaiting_subject_count") return "Please tell me the number of subjects.";
  if (state === "awaiting_sensor_setup") return "Which sensors are you using and how many?";
  if (state === "awaiting_sensor_locations") return "Where are the sensors being placed?";
  if (state === "awaiting_algorithm") return "What algorithm should I use?";
  if (state === "awaiting_sensors_on") return "Are sensors turned on?";
  if (state === "awaiting_identify_confirm") return "Is the sensor placed?";
  if (state === "awaiting_start_stream") return 'Please provide a tag, for example: "test one".';
  if (state === "awaiting_disconnect_confirm") return "Should I disconnect sensors or repeat?";
  if (state === "error") return "Say retry, change inputs, or cancel.";
  return "";
}
