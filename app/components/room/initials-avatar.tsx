import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";

export interface InitialsAvatarProps {
  readonly name: string;
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
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
}: InitialsAvatarProps) {
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      <AvatarFallback className="bg-gradient-accent font-semibold text-primary-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
