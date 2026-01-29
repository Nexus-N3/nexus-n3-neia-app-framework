type Step = {
  id: string;
  name: string;
  command?: string;
};

type StepListProps = {
  steps: Step[];
  activeIndex: number;
  completed: Record<string, boolean>;
  isPrevStepsComplete: (index: number) => boolean;
  onSelect: (index: number) => void;
};

export default function StepList({ steps, activeIndex, completed, isPrevStepsComplete, onSelect }: StepListProps) {
  return (
    <div className="steps">
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex;
        const isComplete = !!completed[step.id];
        const canEnter = idx <= activeIndex || isComplete || isPrevStepsComplete(idx);
        const typeClass = step.command ? " command-step" : " input-step";
        const completeClass = isComplete ? (step.command ? " done-command" : " done-input") : "";
        const className = `step${typeClass}${isActive ? " active" : ""}${completeClass}${!canEnter ? " locked" : ""}`;
        return (
          <div
            key={step.id}
            className={className}
            onClick={() => {
              if (!canEnter) return;
              onSelect(idx);
            }}
          >
            {step.name}
          </div>
        );
      })}
    </div>
  );
}
