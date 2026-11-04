type AvatarProps = {
  emoji: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

const sizeClass = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-10 w-10 text-lg",
} as const;

export function Avatar({ emoji, size = "md", className = "", title }: AvatarProps) {
  return (
    <span
      title={title}
      aria-hidden={!title}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700 ${sizeClass[size]} ${className}`}
    >
      {emoji}
    </span>
  );
}
