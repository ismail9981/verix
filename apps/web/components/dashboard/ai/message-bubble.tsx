"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AiIcon } from "../../landing/icons";
import type { Message } from "./types";

export function MessageBubble({ message }: { message: Message }) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser ? (
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
        >
          <AiIcon className="h-4 w-4" />
        </span>
      ) : null}
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-accent text-white"
            : "border border-hairline bg-canvas/60 text-white"
        }`}
      >
        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
        {message.content}
      </div>
    </motion.div>
  );
}
