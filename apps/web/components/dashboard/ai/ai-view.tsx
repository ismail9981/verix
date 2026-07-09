"use client";

import { useEffect, useState } from "react";
import { Reveal, RevealItem } from "../../landing/reveal";
import { AiChat } from "./ai-chat";
import { AiHeader } from "./ai-header";
import { AiStats } from "./ai-stats";
import { ChatSkeleton } from "./chat-skeleton";

export function AiView() {
  const [loading, setLoading] = useState(true);
  // Bumping the key remounts AiChat, resetting it to a fresh "new chat".
  const [chatKey, setChatKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Reveal as="div" className="flex flex-col gap-6">
      <RevealItem>
        <AiHeader onNewChat={() => setChatKey((key) => key + 1)} />
      </RevealItem>
      <RevealItem>
        <AiStats />
      </RevealItem>
      <RevealItem>
        {loading ? <ChatSkeleton /> : <AiChat key={chatKey} />}
      </RevealItem>
    </Reveal>
  );
}
