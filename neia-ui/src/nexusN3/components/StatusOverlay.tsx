import React from 'react';

interface StatusOverlayProps {
  busy?: boolean;
  statusText?: string | null;
  errors?: Array<string | null | undefined>;
  dismissLabel?: string;
  onDismiss?: () => void;
}

export const StatusOverlay: React.FC<StatusOverlayProps> = ({
  busy = false,
  statusText,
  errors = [],
  dismissLabel = 'Dismiss',
  onDismiss,
}) => {
  const visibleErrors = errors.filter(Boolean) as string[];
  const isVisible = busy || !!statusText || visibleErrors.length > 0;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="overlay-backdrop" onClick={!busy ? onDismiss : undefined}>
      <div className="overlay-modal" onClick={(event) => event.stopPropagation()}>
        {busy && <div className="overlay-spinner" />}
        {statusText && <div className="overlay-status">{statusText}</div>}
        {visibleErrors.map((error, index) => (
          <div key={`${error}-${index}`} className="overlay-error">
            {error}
          </div>
        ))}
        {!busy && onDismiss && (
          <button className="nexus-btn" onClick={onDismiss}>
            {dismissLabel}
          </button>
        )}
      </div>
    </div>
  );
};
