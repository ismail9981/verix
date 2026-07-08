import {
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from "react";
import type { Validator } from "./validation";

export type FieldValidators = Record<string, Validator[]>;

type Values = Record<string, string>;
type Errors = Partial<Record<string, string>>;
type Touched = Partial<Record<string, boolean>>;

function runValidators(
  name: string,
  value: string,
  values: Values,
  validators: FieldValidators,
): string | undefined {
  for (const validate of validators[name] ?? []) {
    const error = validate(value, values);
    if (error) return error;
  }
  return undefined;
}

export interface AuthForm {
  values: Values;
  isSubmitting: boolean;
  submitError: string | null;
  isSuccess: boolean;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (event: FocusEvent<HTMLInputElement>) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** The visible error for a field: only surfaced once it has been touched. */
  fieldError: (name: string) => string | undefined;
}

/* Headless form controller shared by every auth form. It owns values,
   per-field validation (on blur + after first touch), and the async submit
   lifecycle (loading / error / success) so the form components stay purely
   presentational and consistent. */
export function useAuthForm(
  validators: FieldValidators,
  onSubmit: (values: Values) => Promise<void>,
): AuthForm {
  const names = Object.keys(validators);
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(names.map((name) => [name, ""])),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Touched>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      // Re-validate live only after the field has been touched, so users
      // aren't warned while first typing.
      if (touched[name]) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: runValidators(name, value, next, validators),
        }));
      }
      return next;
    });
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: runValidators(name, value, values, validators),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Errors = {};
    for (const name of names) {
      nextErrors[name] = runValidators(name, values[name] ?? "", values, validators);
    }
    setErrors(nextErrors);
    setTouched(Object.fromEntries(names.map((name) => [name, true])));
    if (names.some((name) => nextErrors[name])) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      setIsSuccess(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldError = (name: string) =>
    touched[name] ? errors[name] : undefined;

  return {
    values,
    isSubmitting,
    submitError,
    isSuccess,
    handleChange,
    handleBlur,
    handleSubmit,
    fieldError,
  };
}
