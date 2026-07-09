import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import type { Message } from "./types";

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
}

export function ChatMessages({ messages, isTyping }: ChatMessagesProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isTyping ? <TypingIndicator /> : null}
    </div>
  );
}
