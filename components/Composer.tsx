"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { MentionPicker } from "@/components/MentionPicker";
import { filterCharacters } from "@/lib/mentions";
import type { CharacterCard } from "@/lib/types";

type ComposerProps = {
  characters: CharacterCard[];
  onSend: (text: string) => void;
  disabled?: boolean;
};

type MentionState = {
  start: number;
  query: string;
} | null;

export function Composer({ characters, onSend, disabled = false }: ComposerProps) {
  const [text, setText] = useState("");
  const [mention, setMention] = useState<MentionState>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(
    () => (mention ? filterCharacters(characters, mention.query) : []),
    [characters, mention],
  );

  const safeIndex =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  function parseMention(value: string, caret: number): MentionState {
    const before = value.slice(0, caret);
    const match = before.match(/@([^\s@]*)$/);
    if (!match) return null;
    return {
      start: caret - match[0].length,
      query: match[1] ?? "",
    };
  }

  function handleChange(value: string) {
    setText(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const next = parseMention(value, caret);
    const mentionChanged =
      (mention === null) !== (next === null) ||
      (mention !== null &&
        next !== null &&
        (mention.start !== next.start || mention.query !== next.query));
    setMention(next);
    if (mentionChanged) setActiveIndex(0);
  }

  function insertMention(character: CharacterCard) {
    if (!mention) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const next = `${before}@${character.name} ${after}`;
    setText(next);
    setMention(null);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const pos = before.length + character.name.length + 2;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    setMention(null);
    setActiveIndex(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (mention && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          const cur = Math.min(i, filtered.length - 1);
          return (cur + 1) % filtered.length;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          const cur = Math.min(i, filtered.length - 1);
          return (cur - 1 + filtered.length) % filtered.length;
        });
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(filtered[safeIndex]);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[safeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        setActiveIndex(0);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="shrink-0 border-t border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="relative mx-auto max-w-[600px] px-3 py-3">
        {mention && filtered.length > 0 ? (
          <MentionPicker
            characters={characters}
            query={mention.query}
            activeIndex={safeIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={insertMention}
            onClose={() => {
              setMention(null);
              setActiveIndex(0);
            }}
          />
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            placeholder={
              disabled ? "等待回复中…" : "说点什么… 输入 @ 提及角色"
            }
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
            onClick={() => {
              const caret = textareaRef.current?.selectionStart ?? text.length;
              const next = parseMention(text, caret);
              const mentionChanged =
                (mention === null) !== (next === null) ||
                (mention !== null &&
                  next !== null &&
                  (mention.start !== next.start ||
                    mention.query !== next.query));
              setMention(next);
              if (mentionChanged) setActiveIndex(0);
            }}
            className="max-h-[140px] min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !text.trim()}
            aria-label="发送"
            className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-neutral-400 dark:text-neutral-500">
          Enter 发送 · Shift+Enter 换行 · @ 后可用方向键选择
        </p>
      </div>
    </div>
  );
}
