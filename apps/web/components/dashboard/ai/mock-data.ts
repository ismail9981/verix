import { AiIcon, AnalyticsIcon, WebsiteIcon } from "../../landing/icons";
import { MailIcon } from "../bookings/icons";
import {
  BoltIcon,
  BookmarkIcon,
  HashIcon,
  MegaphoneIcon,
  MessageIcon,
} from "./icons";
import type { AiStat, Conversation, PromptTemplate } from "./types";

/* All AI Assistant content is mock (Bloom Studio, a salon). Kept here so a
   real model/API can be dropped in without touching any component. */

export const STATS: AiStat[] = [
  { id: "conversations", label: "Conversations", value: "128", icon: MessageIcon },
  { id: "automations", label: "Automations", value: "12", icon: BoltIcon },
  { id: "prompts", label: "Saved prompts", value: "34", icon: BookmarkIcon },
  { id: "tokens", label: "Tokens used", value: "84.2k", icon: AiIcon },
];

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "marketing",
    name: "Marketing",
    description: "Campaign ideas and promotions",
    icon: MegaphoneIcon,
    prompt: "Suggest a summer marketing campaign to bring back lapsed clients to my salon.",
  },
  {
    id: "email",
    name: "Email",
    description: "Draft customer emails",
    icon: MailIcon,
    prompt: "Write a friendly email announcing a 20% off midweek promotion at Bloom Studio.",
  },
  {
    id: "website",
    name: "Website Copy",
    description: "Headlines and page copy",
    icon: WebsiteIcon,
    prompt: "Write a hero headline and subtitle for my salon's booking website.",
  },
  {
    id: "social",
    name: "Social Media",
    description: "Captions and post ideas",
    icon: HashIcon,
    prompt: "Write 5 Instagram captions for a before-and-after balayage transformation.",
  },
  {
    id: "analysis",
    name: "Business Analysis",
    description: "Insights from your data",
    icon: AnalyticsIcon,
    prompt: "Analyze why my Tuesday bookings are low and suggest ways to improve them.",
  },
];

export const SUGGESTED_PROMPTS = [
  "Write a promo email for our summer color special",
  "Draft 3 Instagram captions for a new nail service",
  "Suggest ways to reduce weekday no-shows",
  "Create a loyalty program for repeat customers",
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    title: "Summer campaign ideas",
    preview: "Here are three campaign concepts you could run…",
    time: "2h ago",
    favorite: true,
    messages: [
      { id: "m1", role: "user", content: "Give me a few summer marketing campaign ideas for my salon." },
      {
        id: "m2",
        role: "assistant",
        content:
          "Here are three concepts you could run this summer:\n\n1. \"Bright & Bold\" — a color refresh package promoted with before/after photos.\n2. Midweek Membership — a discount for Tuesday–Thursday bookings to fill quiet days.\n3. Referral Rewards — existing clients get a credit for every friend they bring.\n\nWant me to draft the promo copy for any of these?",
      },
    ],
  },
  {
    id: "c2",
    title: "Instagram captions",
    preview: "Here are 5 captions for the balayage post…",
    time: "Yesterday",
    favorite: true,
    messages: [
      { id: "m1", role: "user", content: "Write 5 Instagram captions for a balayage transformation." },
      {
        id: "m2",
        role: "assistant",
        content:
          "Here are five you can choose from:\n\n1. \"From roots to radiance ✨\"\n2. \"Sun-kissed and salon-approved.\"\n3. \"Your color glow-up starts here.\"\n4. \"Balayage that speaks for itself.\"\n5. \"Booked, blended, beautiful.\"",
      },
    ],
  },
  {
    id: "c3",
    title: "Reduce no-shows",
    preview: "A few tactics that consistently cut no-shows…",
    time: "2 days ago",
    favorite: false,
    messages: [
      { id: "m1", role: "user", content: "How can I reduce no-shows?" },
      {
        id: "m2",
        role: "assistant",
        content:
          "A few tactics that consistently help:\n\n• Send an SMS reminder 24 hours before.\n• Require a small deposit for new clients.\n• Offer easy self-serve rescheduling.\n• Follow up with no-shows to rebook.",
      },
    ],
  },
  {
    id: "c4",
    title: "Pricing for bridal package",
    preview: "For a bridal package, consider bundling…",
    time: "4 days ago",
    favorite: false,
    messages: [
      { id: "m1", role: "user", content: "How should I price a bridal package?" },
      {
        id: "m2",
        role: "assistant",
        content:
          "For a bridal package, consider bundling a trial run, day-of styling, and a touch-up kit. Price it 10–15% below the sum of individual services to signal value while protecting your margin.",
      },
    ],
  },
];

/** A canned assistant reply for the mock chat. */
export function mockAssistantReply(prompt: string): string {
  const trimmed = prompt.trim();
  const snippet = trimmed.length > 70 ? `${trimmed.slice(0, 70)}…` : trimmed;
  return `Here's a draft based on your request:\n\n"${snippet}"\n\nI'd lead with a clear benefit and a single call to action. Want me to adjust the tone, shorten it, or generate a few variations?`;
}
