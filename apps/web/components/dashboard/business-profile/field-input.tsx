import { Input, type InputProps } from "@repo/ui";
import { FIELD_CONTAINER, INPUT_DARK } from "./field-styles";

/* Dark-themed wrapper around the shared @repo/ui Input, so this page reuses
   the shared component while matching the dashboard's dark surfaces. */
export function FieldInput({
  className,
  containerClassName,
  ...props
}: InputProps) {
  return (
    <Input
      {...props}
      className={`${INPUT_DARK} ${className ?? ""}`}
      containerClassName={`${FIELD_CONTAINER} ${containerClassName ?? ""}`}
    />
  );
}
