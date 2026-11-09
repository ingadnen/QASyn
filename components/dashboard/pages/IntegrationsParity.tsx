"use client";

import { useMemo, useState } from "react";
import { CqaIcon, cqaCard, useAction } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

type Category = "All Plugins" | "Bug Reporting" | "Product Management";

interface Plugin {
  key: string;
  name: string;
  mark: string;
  color: string;
  fg?: string;
  description: string;
  categories: Category[];
  enterprise?: boolean;
  slack?: boolean;
}

const PLUGINS: Plugin[] = [
  {
    key: "JIRA",
    name: "Jira",
    mark: "J",
    color: "#2684ff",
    description:
      "Enable your team to stay connected to your favorite Atlassian Jira Product, to raise bugs, check status and rerun on closure of bugs, etc.",
    categories: ["All Plugins", "Bug Reporting"],
  },
  {
    key: "SLACK",
    name: "Slack",
    mark: "#",
    color: "#611f69",
    description: "Connect to Slack to get notifications for your run instantly.",
    categories: ["All Plugins", "Bug Reporting"],
    slack: true,
  },
  {
    key: "CONTEXTQA_LAB",
    name: "ContextQA Lab",
    mark: "CQA",
    color: "#5b4ee8",
    description: "Connect to your ContextQA account as your test lab on cloud.",
    categories: ["All Plugins"],
    enterprise: true,
  },
  {
    key: "LINEAR",
    name: "Linear",
    mark: "L",
    color: "#5e6ad2",
    description:
      "Enable your team to report a bug on Linear, track status and rerun on closure of bug without leaving ContextQA from test case results page.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
  },
  {
    key: "AZURE_DEVOPS",
    name: "Azure DevOps Boards",
    mark: "Az",
    color: "#0078d4",
    description:
      "Enable your team to report a bug on Azure DevOps Boards, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting"],
    enterprise: true,
  },
  {
    key: "AZURE_VAULT",
    name: "Azure Vault",
    mark: "AV",
    color: "#0ea5e9",
    description: "Enable your team to securely store and access secrets using Azure Key Vault integration with ContextQA.",
    categories: ["All Plugins"],
    enterprise: true,
  },
  {
    key: "GITHUB",
    name: "GitHub",
    mark: "GH",
    color: "#111827",
    description:
      "Connect your GitHub account so ContextQA can read the repositories it analyses. Authorization happens on GitHub — no credentials are entered here.",
    categories: ["All Plugins"],
  },
  {
    key: "GITLAB",
    name: "GitLab",
    mark: "GL",
    color: "#fc6d26",
    description: "Connect GitLab to analyse merge requests and keep your tests in step with code changes.",
    categories: ["All Plugins"],
  },
  {
    key: "FIGMA",
    name: "Figma",
    mark: "F",
    color: "#a259ff",
    description:
      "Enable your team to report a bug on Figma, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins"],
    enterprise: true,
  },
  {
    key: "FRESHRELEASE",
    name: "Freshrelease",
    mark: "Fr",
    color: "#12b76a",
    description:
      "Enable your team to report a bug on Freshrelease, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    enterprise: true,
  },
  {
    key: "YOUTRACK",
    name: "YouTrack",
    mark: "Y",
    color: "#5350f6",
    description:
      "Enable your team to report a bug on YouTrack, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting"],
    enterprise: true,
  },
  {
    key: "MANTIS",
    name: "Mantis Bug Tracker",
    mark: "M",
    color: "#2f7d32",
    description:
      "Enable your team to report a bug on Mantis Bug Tracker, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting"],
    enterprise: true,
  },
  {
    key: "BACKLOG",
    name: "Backlog",
    mark: "B",
    color: "#2d8cff",
    description:
      "Enable your team to report a bug on Backlog, track status and rerun on closue of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting"],
    enterprise: true,
  },
  {
    key: "ZEPEL",
    name: "Zepel",
    mark: "Z",
    color: "#2563eb",
    description:
      "Enable your team to report a bug on Zepel, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting"],
    enterprise: true,
  },
  {
    key: "BUGZILLA",
    name: "BugZilla",
    mark: "Bz",
    color: "#cc0000",
    description:
      "Enable your team to report a bug on BugZilla, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting"],
    enterprise: true,
  },
  {
    key: "TRELLO",
    name: "Trello",
    mark: "T",
    color: "#0079bf",
    description:
      "Enable your team to report a bug on Trello, track status and rerun on closure of bug without leaving ContextQA from the test case results page.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
    enterprise: true,
  },
  {
    key: "CLICKUP",
    name: "ClickUp",
    mark: "C",
    color: "#7b68ee",
    description:
      "Enable your team to report a bug on ClickUp, track status and rerun on closure of bug without leaving ContextQA from test case results page.",
    categories: ["All Plugins", "Bug Reporting", "Product Management"],
  },
  {
    key: "PRIVATE_GRID",
    name: "Private Grid",
    mark: "PG",
    color: "#334155",
    description: "Connect to your Appium Grid account as your test lab on cloud.",
    categories: ["All Plugins"],
    enterprise: true,
  },
  {
    key: "JENKINS",
    name: "Jenkins",
    mark: "Jk",
    color: "#d33833",
    description:
      "Integration of Jenkins with ContextQA helps you to run your scripts whenever there is a change in software code. Jenkins helps to schedule your build to run the test cases from a batch file, save your test reports and the execution history.",
    categories: ["All Plugins"],
    enterprise: true,
  },
  {
    key: "CODESHIP",
    name: "CodeShip CI",
    mark: "CS",
    color: "#1f2937",
    description:
      "Codeship helps to release software quickly, automatically and multiple times a day. It integrates with ContextQA, automatically deploying when tests pass and notifying you when tests or deployments have failed.",
    categories: ["All Plugins"],
    enterprise: true,
  },
];

const TABS: Category[] = ["All Plugins", "Bug Reporting", "Product Management"];

function BrandMark({ plugin }: { plugin: Plugin }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold tracking-[-0.02em] text-white"
      style={{ backgroundColor: plugin.color, color: plugin.fg ?? "#fff" }}
    >
      {plugin.mark}
    </span>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-[22px] w-[40px] rounded-full transition",
        checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-4 rounded-full bg-white shadow transition",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

export function Integrations({
  connected,
  readOnly,
}: {
  connected: string[];
  readOnly: boolean;
}) {
  const [tab, setTab] = useState<Category>("All Plugins");
  const { run, pending, error } = useAction();
  const linked = useMemo(() => new Set(connected), [connected]);
  const visible = PLUGINS.filter((plugin) => plugin.categories.includes(tab));

  async function toggle(plugin: Plugin) {
    const next = !linked.has(plugin.key);
    await run(plugin.key, "/api/dashboard/integrations", {
      json: { provider: plugin.key, connected: next },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#e5e7eb]">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition",
              tab === name
                ? "border-[#5b4ee8] text-[#5b4ee8]"
                : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {visible.map((plugin) => {
          const isOn = linked.has(plugin.key);
          return (
            <article key={plugin.key} className={cn(cqaCard, "flex flex-col overflow-hidden")}>
              <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                <div className="flex items-center gap-3">
                  <BrandMark plugin={plugin} />
                  <h2 className="text-[14px] font-semibold text-[#111827]">{plugin.name}</h2>
                </div>
                <p className="text-[12.5px] leading-[19px] text-[#6b7280]">{plugin.description}</p>
                {plugin.slack && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-[6px] px-2 py-[2px] text-[11px] leading-[17px]",
                        isOn ? "bg-[#f0fdf4] text-[#00a63e]" : "bg-[#f3f4f6] text-[#374151]",
                      )}
                    >
                      {isOn ? "Workspace linked" : "Workspace not linked"}
                    </span>
                    <span className="text-[11.5px] text-[#9ca3af]">for bug reproduction</span>
                  </div>
                )}
              </div>
              <div className="flex min-h-[52px] items-center justify-end border-t border-[#f3f4f6] px-4 py-2.5">
                {plugin.enterprise ? (
                  <div className="flex w-full items-start gap-2 text-[11.5px] leading-4 text-[#6b7280]">
                    <CqaIcon name="lock" className="mt-px text-[15px] text-[#9ca3af]" />
                    <span>Upgrade to the Enterprise plan to use this integration.</span>
                  </div>
                ) : (
                  <Toggle
                    checked={isOn}
                    disabled={readOnly || pending === plugin.key}
                    label={`${isOn ? "Disable" : "Enable"} ${plugin.name}`}
                    onChange={() => void toggle(plugin)}
                  />
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
