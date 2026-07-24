import type { StartupStage } from "../types";

export function StartupSequence({ stage, exiting }: { stage: StartupStage; exiting: boolean }) {
  const statusText =
    stage === "booting"
      ? "Initializing edge systems..."
      : stage === "waking"
        ? "NEIA waking up..."
        : stage === "preSpeak" || stage === "speaking"
          ? "Voice online."
          : "Welcome to Nexus N3.";

  return (
    <div className={`startup-overlay stage-${stage}${exiting ? " exiting" : ""}`}>
      <div className="startup-robot" aria-hidden="true">
        <div className="robot-head">
          <div className="robot-eyes">
            <span className="robot-eye" />
            <span className="robot-eye" />
          </div>
          <div className="robot-mouth" />
        </div>
      </div>
      <p className="startup-status">{statusText}</p>
    </div>
  );
}
