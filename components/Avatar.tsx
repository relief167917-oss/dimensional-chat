type AvatarProps = {
  src: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
};

const sizeClass = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-10 w-10 text-lg",
} as const;

function isImageSrc(src: string): boolean {
  return (
    src.startsWith("/") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    /\.(webp|png|jpe?g|gif|svg)(\?.*)?$/i.test(src)
  );
}

export function Avatar({ src, size = "md", className = "", title }: AvatarProps) {
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700 ${sizeClass[size]} ${className}`;

  if (isImageSrc(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export; simple avatar img
      <img
        src={src}
        alt={title ?? ""}
        title={title}
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <span
      title={title}
      aria-hidden={!title}
      className={base}
    >
      {src}
    </span>
  );
}
