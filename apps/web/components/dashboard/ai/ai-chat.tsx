"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessages } from "./chat-messages";
import { ConversationSidebar } from "./conversation-sidebar";
import { EmptyConversation } from "./empty-conversation";
import { PromptInput } from "./prompt-input";
import { mockAssistantReply } from "./mock-data";
import type { Conversation, Message } from "./types";

/* The chat layout: conversations sidebar + message panel + prompt input. Owns
   the working conversation state. "New chat" is handled by the parent
   remounting this component, which resets to the empty state. */
export function AiChat() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);
  const timers = useRef<number[]>([]);

  const nextId = () => `msg-${Date.now()}-${(idCounter.current += 1)}`;

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  // Clear any pending reply timers on unmount (e.g. when "New chat" remounts).
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed }]);
    setIsTyping(true);

    const timer = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: mockAssistantReply(trimmed) },
      ]);
      setIsTyping(false);
    }, 1400);
    timers.current.push(timer);
  };

  const selectConversation = (conversation: Conversation) => {
    setActiveId(conversation.id);
    setMessages(conversation.messages);
    setIsTyping(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <ConversationSidebar
        activeId={activeId}
        onSelectConversation={selectConversation}
        onSelectTemplate={send}
      />

      <div className="flex h-[560px] flex-col rounded-2xl border border-hairline bg-surface/40 lg:h-[600px]">
        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {messages.length === 0 ? (
            <EmptyConversation onPrompt={send} />
          ) : (
            <ChatMessages messages={messages} isTyping={isTyping} />
          )}
        </div>
        <div className="border-t border-hairline p-3 sm:p-4">
          <PromptInput onSend={send} disabled={isTyping} />
        </div>
      </div>
    </div>
  );
}
