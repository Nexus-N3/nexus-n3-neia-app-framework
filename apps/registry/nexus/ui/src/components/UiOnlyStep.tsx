type UiOnlyStepProps = {
  onComplete: () => void;
};

export default function UiOnlyStep({ onComplete }: UiOnlyStepProps) {
  return (
    <>
      <p className="note">UI-only step. Add your own inputs and logic here.</p>
      <button className="primary mark-complete" onClick={onComplete}>
        Mark Step Complete
      </button>
    </>
  );
}
