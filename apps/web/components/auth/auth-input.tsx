import { Input, type InputProps } from "@repo/ui";

/* The shared Input is light-themed (used on white surfaces in the design
   system). This wrapper re-skins it for the dark auth cards without touching
   the shared component: the input element's colors are overridden via
   `className` (the Input merges these with twMerge, so they win over the
   base), and the label / error / password-toggle are recolored via
   arbitrary-variant selectors on the container. */
const INPUT_DARK =
  "bg-canvas border-hairline text-white placeholder:text-muted focus-visible:ring-accent focus-visible:ring-offset-canvas disabled:bg-surface";

const CONTAINER_DARK =
  "w-full [&_label]:text-white [&_p[role=alert]]:text-red-400 [&_button]:text-muted [&_button:hover]:text-white";

export function AuthInput({
  className,
  containerClassName,
  ...props
}: InputProps) {
  return (
    <Input
      {...props}
      className={`${INPUT_DARK} ${className ?? ""}`}
      containerClassName={`${CONTAINER_DARK} ${containerClassName ?? ""}`}
    />
  );
}
