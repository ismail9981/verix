import type { IconComponent } from "../types";

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  time: string;
  favorite: boolean;
  messages: Message[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  icon: IconComponent;
  prompt: string;
}

export interface AiStat {
  id: string;
  label: string;
  value: string;
  icon: IconComponent;
}
