import React from 'react';
import { ErrorDismissButton } from './ErrorDismissButton';

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
      <div className={`overlay-modal${!busy && onDismiss ? ' error-dismissible' : ''}`} onClick={(event) => event.stopPropagation()}>
        {busy && <div className="overlay-spinner" />}
        {statusText && <div className="overlay-status">{statusText}</div>}
        {visibleErrors.map((error, index) => (
          <div key={`${error}-${index}`} className="overlay-error">
            {error}
          </div>
        ))}
        {!busy && onDismiss && (
          <ErrorDismissButton onClick={onDismiss} label={dismissLabel} />
        )}
      </div>
    </div>
  );
};
