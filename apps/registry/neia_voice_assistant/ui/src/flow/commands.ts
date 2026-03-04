import type { FlowContext } from "./states";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  won: 1,
  single: 1,
  a: 1,
  an: 1,
  two: 2,
  to: 2,
  too: 2,
  three: 3,
  four: 4,
  for: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12
};

export function parseSimpleCount(text: string): number | null {
  const cleaned = (text || "").toLowerCase();
  const digit = cleaned.match(/\b(\d+)\b/);
  if (digit) return parseInt(digit[1], 10);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(cleaned)) return value;
  }
  return null;
}

export function parseLocations(text: string): string[] {
  const cleaned = (text || "").toLowerCase();
  const out: string[] = [];
  const pairs: Array<[string, string]> = [
    ["ankle", "ANKLE"],
    ["wrist", "WRIST"],
    ["knee", "KNEE"],
    ["hip", "HIP"],
    ["shoulder", "SHOULDER"],
    ["head", "HEAD"],
    ["elbow", "ELBOW"]
  ];
  for (const [body, token] of pairs) {
    if (cleaned.includes(`left ${body}`)) out.push(`LEFT_${token}`);
    if (cleaned.includes(`right ${body}`)) out.push(`RIGHT_${token}`);
    if (cleaned.includes(`both ${body}`) || cleaned.includes(`both ${body}s`)) {
      out.push(`LEFT_${token}`, `RIGHT_${token}`);
    }
  }
  return [...new Set(out)];
}

export function extractComputeLocation(event: any): string {
  const payload = event?.payload;
  if (payload && typeof payload === "object") {
    const direct = payload.location || payload.sensor_location || payload.body_location;
    if (typeof direct === "string" && direct.trim()) return direct.trim().toUpperCase();
    const sensor = payload.sensor;
    if (sensor && typeof sensor === "object") {
      const sensorLoc = sensor.location || sensor.sensor_location || sensor.body_location;
      if (typeof sensorLoc === "string" && sensorLoc.trim()) return sensorLoc.trim().toUpperCase();
    }
    const nested = payload.result;
    if (nested && typeof nested === "object") {
      const loc = nested.location || nested.sensor_location || nested.body_location;
      if (typeof loc === "string" && loc.trim()) return loc.trim().toUpperCase();
    }
  }
  return "UNKNOWN";
}

export function buildSubjects(ctx: FlowContext): Array<Record<string, any>> {
  const subjects: Array<Record<string, any>> = [];
  const subjectCount = Math.max(1, ctx.subject_count || 1);
  for (let i = 0; i < subjectCount; i += 1) {
    subjects.push({
      subject_id: `subject${i + 1}`,
      sensors: [
        {
          number_of: ctx.sensor_count || 1,
          local_name: ctx.sensor_name || "Movella DOT",
          compute_algorithm: {
            name: ctx.algorithm_name,
            inputs: ctx.algorithm_inputs
          },
          locations: ctx.locations || []
        }
      ]
    });
  }
  return subjects;
}
