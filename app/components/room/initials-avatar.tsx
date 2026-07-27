import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";

export interface InitialsAvatarProps {
  readonly name: string;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
  /** Optional photo URL — when present, renders above the initials
   * fallback. Radix shows the fallback automatically while the image is
   * loading or if it fails, so callers don't need their own loading state. */
  readonly src?: string | null;
}

const SIZE_CLASSES: Record<NonNullable<InitialsAvatarProps["size"]>, string> = {
  sm: "size-7 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
};

/**
 * Gradient-fill initials avatar — guest/host chips with no photo (roster
 * strip, queue added-by chip). Per design.md §8, this is the one place the
 * gradient accent is a persistent (not momentary) surface, because it's
 * small and decorative rather than a large content area.
 */
export function InitialsAvatar({
  name,
  size = "md",
  className,
  src,
}: InitialsAvatarProps) {
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-secondary font-semibold text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
