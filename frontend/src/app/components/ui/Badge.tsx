import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
  className?: string;
  children: React.ReactNode;
}

const variantClasses = {
  default: "bg-blue-600 text-white border-transparent",
  secondary: "bg-gray-700 text-white border-transparent",
  outline: "bg-transparent text-blue-600 border-blue-600 border",
};

const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  className = "",
  children,
  ...props
}) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${variantClasses[variant]} ${className}`}
    {...props}
  >
    {children}
  </span>
);

export default Badge; 