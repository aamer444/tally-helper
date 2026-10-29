import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-blue-700 font-semibold text-white hover:bg-blue-800",
  secondary: "border border-slate-200 bg-white font-medium hover:bg-slate-50",
  danger: "border border-red-200 bg-white font-medium text-red-700 hover:bg-red-50",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
}

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-md px-5 py-2.5 text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
