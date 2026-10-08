import React from 'react';
import { ErrorDismissButton } from './ErrorDismissButton';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className={`error-banner${onDismiss ? ' error-dismissible' : ''}`} role="alert">
      {message}
      {onDismiss ? <ErrorDismissButton onClick={onDismiss} /> : null}
    </div>
  );
};
