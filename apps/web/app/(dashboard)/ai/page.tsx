import type { Metadata } from "next";
import { AiView } from "../../../components/dashboard/ai/ai-view";

export const metadata: Metadata = {
  title: "AI Assistant",
};

export default function AiPage() {
  return <AiView />;
}
