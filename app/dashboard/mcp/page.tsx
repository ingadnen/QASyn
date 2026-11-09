import type { Metadata } from "next";
import { McpConnect } from "@/components/dashboard/pages/McpConnect";

export const metadata: Metadata = { title: "MCP" };
export const dynamic = "force-dynamic";

export default function McpPage() {
  return <McpConnect />;
}
