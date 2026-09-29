import React from 'react';

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const ResetButton: React.FC<ResetButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button className="reset-header-btn" onClick={onClick} disabled={disabled} aria-label="Reset UI">
      Reset
    </button>
  );
};
