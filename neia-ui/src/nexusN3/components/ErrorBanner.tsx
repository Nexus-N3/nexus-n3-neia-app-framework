import React from 'react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className="error-banner" onClick={onDismiss}>
      {message}
    </div>
  );
};
