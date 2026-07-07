"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => twMerge(clsx(...inputs));

const inputVariants = cva(
  [
    "w-full rounded-md border bg-white text-zinc-900 transition-colors",
    "placeholder:text-zinc-400",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50",
  ],
  {
    variants: {
      inputSize: {
        sm: "h-8 text-sm",
        md: "h-10 text-sm",
        lg: "h-12 text-base",
      },
      hasError: {
        true: "border-red-500 focus-visible:ring-red-600",
        false: "border-zinc-300 focus-visible:ring-zinc-500",
      },
    },
    defaultVariants: {
      inputSize: "md",
      hasError: false,
    },
  },
);

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
>;

export interface InputProps
  extends NativeInputProps,
    Pick<VariantProps<typeof inputVariants>, "inputSize"> {
  label?: string;
  helperText?: string;
  error?: string;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="10"
        cy="10"
        r="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
    >
      <path
        d="M2.5 2.5l15 15M8.28 8.34a2.25 2.25 0 0 0 3.18 3.18M6.1 6.15C3.6 7.4 1.5 10 1.5 10s3 6 8.5 6c1.53 0 2.86-.46 3.98-1.13M12.1 4.53A9.3 9.3 0 0 1 10 4c5.5 0 8.5 6 8.5 6-.34.68-.98 1.7-1.94 2.68"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-zinc-400"
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      disabled = false,
      error,
      helperText,
      id,
      inputSize,
      label,
      leftIcon,
      loading = false,
      required = false,
      rightIcon,
      type = "text",
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword
      ? showPassword
        ? "text"
        : "password"
      : type;

    const isDisabled = disabled || loading;
    const showError = Boolean(error);
    const hasRightSlot = loading || isPassword || Boolean(rightIcon);
    const describedBy = showError ? errorId : helperText ? helperId : undefined;

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-900">
            {label}
            {required ? (
              <span aria-hidden="true" className="ml-0.5 text-red-500">
                *
              </span>
            ) : null}
          </label>
        ) : null}

        <div className="relative flex items-center">
          {leftIcon ? (
            <span className="pointer-events-none absolute left-3 flex items-center text-zinc-400">
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={isDisabled}
            required={required}
            aria-invalid={showError || undefined}
            aria-describedby={describedBy}
            className={cn(
              inputVariants({ inputSize, hasError: showError }),
              leftIcon ? "pl-9" : "pl-4",
              hasRightSlot ? "pr-9" : "pr-4",
              className,
            )}
            {...props}
          />

          {hasRightSlot ? (
            <span className="absolute right-3 flex items-center">
              {loading ? (
                <Spinner />
              ) : isPassword ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isDisabled}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="rounded text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:pointer-events-none disabled:opacity-50"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              ) : rightIcon ? (
                <span className="pointer-events-none text-zinc-400">
                  {rightIcon}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        {showError ? (
          <p id={errorId} role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-sm text-zinc-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";

export { inputVariants };
