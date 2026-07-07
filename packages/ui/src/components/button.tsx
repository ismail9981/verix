"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => twMerge(clsx(...inputs));

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-busy:cursor-wait",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
        secondary:
          "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus-visible:ring-zinc-500",
        outline:
          "border border-zinc-300 bg-transparent text-zinc-900 hover:bg-zinc-100 focus-visible:ring-zinc-500",
        ghost:
          "bg-transparent text-zinc-900 hover:bg-zinc-100 focus-visible:ring-zinc-500",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled = false,
      fullWidth,
      leftIcon,
      loading = false,
      rightIcon,
      size,
      type = "button",
      variant,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ fullWidth, size, variant }), className)}
        disabled={isDisabled}
        type={type}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading ? rightIcon : null}
      </button>
    );
  },
);

Button.displayName = "Button";

export { buttonVariants };
