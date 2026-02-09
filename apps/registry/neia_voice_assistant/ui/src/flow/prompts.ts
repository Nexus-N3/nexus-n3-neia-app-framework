export function summarizePayload(payload: unknown) {
  const serialized = JSON.stringify(payload ?? {});
  if (!serialized) return "{}";
  return serialized.length > 160 ? `${serialized.slice(0, 157)}...` : serialized;
}

export function buildServerReadySpeech(event: any) {
  const payload = event?.payload || {};
  const site = payload.site || event?.site;
  const sensors = Array.isArray(payload.supported_sensors) ? payload.supported_sensors : [];
  const lines: string[] = [];
  sensors.forEach((sensor: any) => {
    if (!sensor) return;
    if (typeof sensor === "string") {
      lines.push(`${sensor} supports no computations`);
      return;
    }
    const name = sensor.name;
    const computations = Array.isArray(sensor.computations) ? sensor.computations : [];
    const algoNames = computations.map((comp: any) => (typeof comp === "string" ? comp : comp?.name)).filter(Boolean);
    if (algoNames.length) lines.push(`${name} supports ${algoNames.join(", ")}`);
    else if (name) lines.push(`${name} supports no computations`);
  });
  const siteText = site ? ` at ${site}` : "";
  if (lines.length) return `Server is ready${siteText}. ${lines.join(". ")}.`;
  return `Server is ready${siteText}.`;
}
