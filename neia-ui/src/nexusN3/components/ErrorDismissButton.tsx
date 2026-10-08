import React from 'react';

export const ErrorDismissButton = ({ onClick, label = 'Dismiss error' }: {
  onClick: () => void;
  label?: string;
}) => (
  <button type="button" className="error-dismiss" onClick={onClick} aria-label={label} title={label}>
    <span aria-hidden="true">×</span>
  </button>
);
