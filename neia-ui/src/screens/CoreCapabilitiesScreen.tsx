import { useCore } from "../core/CoreProvider";

function EmptyCapabilities({ disconnected }: { disconnected: boolean }) {
  return (
    <div className="empty-state-v2">
      <strong>{disconnected ? "Core is unavailable" : "No capabilities reported"}</strong>
      <p>
        {disconnected
          ? "Connect to Nexus N3 Core to load its sensors and algorithms."
          : "The connected Core did not report sensor or algorithm metadata."}
      </p>
    </div>
  );
}

export function CoreCapabilitiesScreen() {
  const { capabilities, loading } = useCore();
  const sensors = capabilities?.sensors ?? [];
  const algorithms = capabilities?.algorithms ?? [];
  const disconnected = capabilities?.connection_state !== "connected";

  return (
    <div className="system-view-v2">
      <div className="view-heading-v2">
        <div>
          <h1>Nexus N3 Capabilities</h1>
        </div>
        <span className="count-chip-v2">
          {sensors.length} sensors · {algorithms.length} algorithms
        </span>
      </div>

      {loading ? (
        <div className="empty-state-v2">Loading capabilities…</div>
      ) : sensors.length === 0 && algorithms.length === 0 ? (
        <EmptyCapabilities disconnected={disconnected} />
      ) : (
        <div className="capabilities-layout-v2">
          <section>
            <div className="section-heading-v2">
              <h2>Sensor types</h2>
              <span>{sensors.length}</span>
            </div>
            <div className="capability-list-v2">
              {sensors.map((sensor) => (
                <article className="capability-card-v2" key={sensor.id}>
                  <div className="capability-title-v2">
                    <div>
                      <h3>{sensor.display_name}</h3>
                      <code>{sensor.id}</code>
                    </div>
                    <span className={sensor.available ? "available" : "unavailable"}>
                      {sensor.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <div className="metadata-group-v2">
                    <span>Supported locations</span>
                    <div className="tag-list-v2">
                      {sensor.supported_locations.length > 0
                        ? sensor.supported_locations.map((location) => <span key={location}>{location.replace(/_/g, " ")}</span>)
                        : <em>Unknown</em>}
                    </div>
                  </div>
                  <div className="metadata-group-v2">
                    <span>Algorithms</span>
                    <div className="tag-list-v2">
                      {sensor.supported_algorithms.length > 0
                        ? sensor.supported_algorithms.map((algorithm) => <span key={algorithm}>{algorithm}</span>)
                        : <em>Unknown</em>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="section-heading-v2">
              <h2>Algorithms</h2>
              <span>{algorithms.length}</span>
            </div>
            <div className="capability-list-v2">
              {algorithms.map((algorithm) => (
                <article className="capability-card-v2 algorithm" key={algorithm.id}>
                  <div className="capability-title-v2">
                    <div>
                      <h3>{algorithm.display_name}</h3>
                      <code>{algorithm.id}</code>
                    </div>
                    <span className={algorithm.available ? "available" : "unavailable"}>
                      {algorithm.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <div className="metadata-group-v2">
                    <span>Compatible sensors</span>
                    <div className="tag-list-v2">
                      {algorithm.compatible_sensor_types.length > 0
                        ? algorithm.compatible_sensor_types.map((sensor) => <span key={sensor}>{sensor}</span>)
                        : <em>Unknown</em>}
                    </div>
                  </div>
                  <div className="metadata-group-v2">
                    <span>Result stages / outputs</span>
                    <div className="tag-list-v2">
                      {[...algorithm.result_stages, ...algorithm.output_types].length > 0
                        ? [...algorithm.result_stages, ...algorithm.output_types].map((output) => <span key={output}>{output}</span>)
                        : <em>Unknown</em>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
