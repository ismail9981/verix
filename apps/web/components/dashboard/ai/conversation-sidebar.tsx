import { StarIcon } from "../crm/icons";
import { MessageIcon, TemplateIcon } from "./icons";
import { CONVERSATIONS, TEMPLATES } from "./mock-data";
import type { Conversation } from "./types";

interface ConversationSidebarProps {
  activeId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onSelectTemplate: (prompt: string) => void;
}

function SidebarTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

function ConversationButton({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active ? "bg-accent/10" : "hover:bg-canvas"
      }`}
    >
      <MessageIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">
          {conversation.title}
        </span>
        <span className="block truncate text-xs text-muted">
          {conversation.preview}
        </span>
      </span>
    </button>
  );
}

export function ConversationSidebar({
  activeId,
  onSelectConversation,
  onSelectTemplate,
}: ConversationSidebarProps) {
  const favorites = CONVERSATIONS.filter((c) => c.favorite);

  return (
    <aside
      aria-label="Conversations"
      className="hidden h-[600px] flex-col overflow-y-auto rounded-2xl border border-hairline bg-surface/40 p-2 lg:flex"
    >
      <SidebarTitle>Recent conversations</SidebarTitle>
      <ul className="flex flex-col gap-0.5">
        {CONVERSATIONS.map((conversation) => (
          <li key={conversation.id}>
            <ConversationButton
              conversation={conversation}
              active={conversation.id === activeId}
              onSelect={() => onSelectConversation(conversation)}
            />
          </li>
        ))}
      </ul>

      <SidebarTitle>Favorites</SidebarTitle>
      <ul className="flex flex-col gap-0.5">
        {favorites.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelectConversation(conversation)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <StarIcon className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate text-sm text-white">{conversation.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <SidebarTitle>Templates</SidebarTitle>
      <ul className="flex flex-col gap-0.5">
        {TEMPLATES.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onSelectTemplate(template.prompt)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <TemplateIcon className="h-4 w-4 shrink-0 text-muted" />
              <span className="truncate text-sm text-white">{template.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
