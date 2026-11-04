"use client";

import type { CharacterCard } from "@/lib/types";

type MentionPickerProps = {
  characters: CharacterCard[];
  query: string;
  onSelect: (character: CharacterCard) => void;
  onClose: () => void;
};

export function MentionPicker({
  characters,
  query,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const q = query.trim().toLowerCase();
  const filtered = characters.filter((c) => {
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.aliases.some((a) => a.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      role="listbox"
      aria-label="选择要 @ 的角色"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs text-neutral-500">提及角色</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          关闭
        </button>
      </div>
      <ul className="max-h-48 overflow-y-auto py-1">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              role="option"
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
              onClick={() => onSelect(c)}
            >
              <span className="text-lg" aria-hidden>
                {c.avatar}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {c.name}
                </span>
                <span className="truncate text-xs text-neutral-500">
                  {c.world} · {c.tagline}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
