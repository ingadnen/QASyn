"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";

export function StudioTabs({ testSteps, relationships, versionHistory }: { testSteps: React.ReactNode; relationships: React.ReactNode; versionHistory: React.ReactNode }) {
  const [tab, setTab] = useState<"steps" | "relationships" | "versions">("steps");
  return (
    <div className="space-y-4">
      <Tabs
        label="Studio sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "steps", label: "Test Steps" },
          { value: "relationships", label: "Relationships" },
          { value: "versions", label: "Version History" },
        ]}
      />
      {tab === "steps" && testSteps}
      {tab === "relationships" && relationships}
      {tab === "versions" && versionHistory}
    </div>
  );
}
