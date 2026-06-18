"use client";
import React from 'react';

interface ToggleableValueProps {
  value: string | number;
  className?: string;
  isHidden?: boolean;
}

export const ToggleableValue: React.FC<ToggleableValueProps> = ({
  value,
  className,
  isHidden = false,
}) => {
  return (
    <span className={className}>
      {isHidden ? '--' : value}
    </span>
  );
};
