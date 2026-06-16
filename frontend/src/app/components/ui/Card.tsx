import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ className = "", children, ...props }) => (
  <div
    className={`rounded-xl border border-gray-800 bg-gray-900/40 shadow-sm ${className}`}
    {...props}
  >
    {children}
  </div>
);

export default Card; 