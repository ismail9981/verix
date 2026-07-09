import { Button } from "@repo/ui";
import { CTA_PRIMARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { PageHeader } from "../ui/page-header";

export function AiHeader({ onNewChat }: { onNewChat: () => void }) {
  return (
    <PageHeader
      title="AI Assistant"
      subtitle="Generate content, automate work, and get business insights."
      actions={
        <Button
          type="button"
          className={CTA_PRIMARY}
          leftIcon={<PlusIcon className="h-4 w-4" />}
          onClick={onNewChat}
        >
          New chat
        </Button>
      }
    />
  );
}
