"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Message } from "@/lib/types";

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

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(withTypingDemo(demoMessages, Date.now()));
  }, []);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visible.length, typingNames.length]);

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
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-neutral-950">
      <ChatHeader groupName={demoGroup.name} members={characters} />

      <div
        ref={listRef}
        className="mx-auto flex w-full max-w-[600px] flex-1 flex-col"
      >
        <div className="flex-1 divide-y divide-neutral-100 dark:divide-neutral-900">
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
            />
          ))}
          <TypingIndicator names={typingNames} />
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      <Composer characters={characters} onSend={handleSend} />
    </div>
  );
}
