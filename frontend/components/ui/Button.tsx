import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  danger: "text-red-600 hover:text-red-800",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
