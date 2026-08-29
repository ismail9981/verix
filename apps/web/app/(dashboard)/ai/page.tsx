import type { Metadata } from "next";
import { AiView } from "../../../components/dashboard/ai/ai-view";
import { requirePageCapability } from "../../../src/server/auth/page-authorization";

export const metadata: Metadata = {
  title: "AI Assistant",
};

export default async function AiPage() {
  await requirePageCapability("workspace.read");
  return <AiView />;
}
