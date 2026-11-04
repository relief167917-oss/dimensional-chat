type TypingIndicatorProps = {
  names: string[];
};

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} 正在输入`
      : names.length === 2
        ? `${names[0]}、${names[1]} 正在输入`
        : `${names[0]} 等 ${names.length} 人正在输入`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-[13px] text-neutral-500 dark:text-neutral-400">
      <span>{label}</span>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        <span className="typing-dot h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
        <span className="typing-dot h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
        <span className="typing-dot h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
      </span>
    </div>
  );
}
