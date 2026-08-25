import React from 'react';

interface ScreenHeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  leftWrapperClassName?: string;
  centerWrapperClassName?: string;
  rightWrapperClassName?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  left,
  center,
  right,
  className = '',
  leftWrapperClassName = '',
  centerWrapperClassName = '',
  rightWrapperClassName = '',
}) => {
  return (
    <div className={`sub-header-row ${className}`.trim()}>
      <div className={leftWrapperClassName}>{left}</div>
      <div className={centerWrapperClassName}>{center}</div>
      <div className={rightWrapperClassName}>{right}</div>
    </div>
  );
};
