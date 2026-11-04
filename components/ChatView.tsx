"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CharacterSheet } from "@/components/CharacterSheet";
import { ChatHeader } from "@/components/ChatHeader";
import { Composer } from "@/components/Composer";
import { MessageItem } from "@/components/MessageItem";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  characterById,
  characters,
  demoGroup,
  demoMessages,
  withTypingDemo,
} from "@/lib/mock";
import type { CharacterCard, Message } from "@/lib/types";

const NEAR_BOTTOM_PX = 80;

function replyPreviewFor(
  messages: Message[],
  replyTo: string | null,
): string | null {
  if (!replyTo) return null;
  const target = messages.find((m) => m.id === replyTo);
  if (!target) return null;
  let name = "系统";
  if (target.senderType === "owner") name = demoGroup.ownerNickname;
  else if (target.senderType === "character") {
    name = characterById[target.senderId]?.name ?? "角色";
  }
  const snippet =
    target.text.length > 36 ? `${target.text.slice(0, 36)}…` : target.text;
  return `${name}：${snippet}`;
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const [unreadSinceId, setUnreadSinceId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterCard | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stuckRef = useRef(true);
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const prevVisibleLenRef = useRef(0);

  useEffect(() => {
    setMessages(withTypingDemo(demoMessages, Date.now()));
  }, []);

  useEffect(() => {
    stuckRef.current = stuckToBottom;
  }, [stuckToBottom]);

  useEffect(() => {
    const pending = messages.filter(
      (m) => Date.parse(m.deliverAt) > Date.now(),
    );
    if (pending.length === 0) return;

    const nearest = Math.min(
      ...pending.map((m) => Date.parse(m.deliverAt) - Date.now()),
    );
    const delay = Math.max(50, nearest + 20);
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [messages, now]);

  const visible = useMemo(
    () => messages.filter((m) => Date.parse(m.deliverAt) <= now),
    [messages, now],
  );

  const typingNames = useMemo(() => {
    const pending = messages.filter((m) => Date.parse(m.deliverAt) > now);
    const names: string[] = [];
    for (const m of pending) {
      if (m.senderType !== "character") continue;
      const name = characterById[m.senderId]?.name;
      if (name && !names.includes(name)) names.push(name);
    }
    return names;
  }, [messages, now]);

  const scrollToLatest = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    setStuckToBottom(true);
    stuckRef.current = true;
    setUnreadSinceId(null);
    setUnreadCount(0);
  }, []);

  // Track newly delivered messages while scrolled up
  useEffect(() => {
    const prevIds = visibleIdsRef.current;
    const nextIds = new Set(visible.map((m) => m.id));
    const newcomers = visible.filter((m) => !prevIds.has(m.id));
    visibleIdsRef.current = nextIds;

    if (newcomers.length === 0) {
      prevVisibleLenRef.current = visible.length;
      return;
    }

    if (stuckRef.current) {
      requestAnimationFrame(() => scrollToLatest(prevVisibleLenRef.current > 0));
      setUnreadSinceId(null);
      setUnreadCount(0);
    } else {
      const firstNew = newcomers[0];
      setUnreadSinceId((curr) => curr ?? firstNew.id);
      setUnreadCount((c) => c + newcomers.length);
    }
    prevVisibleLenRef.current = visible.length;
  }, [visible, scrollToLatest]);

  // Keep stickiness for typing indicator changes when already at bottom
  useEffect(() => {
    if (stuckRef.current) {
      requestAnimationFrame(() => scrollToLatest(true));
    }
  }, [typingNames.length, scrollToLatest]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = isNearBottom(el);
    setStuckToBottom(near);
    stuckRef.current = near;
    if (near) {
      setUnreadSinceId(null);
      setUnreadCount(0);
    }
  }

  function handleSend(text: string) {
    const stamp = new Date().toISOString();
    const next: Message = {
      id: `local-${Date.now()}`,
      groupId: demoGroup.id,
      senderType: "owner",
      senderId: "owner",
      text,
      replyTo: null,
      createdAt: stamp,
      deliverAt: stamp,
    };
    setMessages((prev) => [...prev, next]);
    setNow(Date.now());
    // Own sends always jump to latest
    requestAnimationFrame(() => scrollToLatest(true));
  }

  const showJump = !stuckToBottom && (unreadCount > 0 || visible.length > 0);

  return (
    <div className="relative flex h-dvh flex-col bg-white dark:bg-neutral-950">
      <ChatHeader
        groupName={demoGroup.name}
        members={characters}
        onSelectCharacter={setSelectedCharacter}
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {visible.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                replyPreview={replyPreviewFor(messages, message.replyTo)}
                character={
                  message.senderType === "character"
                    ? (characterById[message.senderId] ?? null)
                    : null
                }
                ownerNickname={demoGroup.ownerNickname}
                characters={characters}
                showUnreadSeparator={message.id === unreadSinceId}
                onAvatarClick={setSelectedCharacter}
              />
            ))}
            <TypingIndicator names={typingNames} />
            <div ref={bottomRef} className="h-2" />
          </div>
        </div>

        {showJump ? (
          <button
            type="button"
            onClick={() => scrollToLatest(true)}
            className="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-800 shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 5v14" />
              <path d="M19 12l-7 7-7-7" />
            </svg>
            最新
            {unreadCount > 0 ? (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      <Composer characters={characters} onSend={handleSend} />

      <CharacterSheet
        character={selectedCharacter}
        onClose={() => setSelectedCharacter(null)}
      />
    </div>
  );
}
