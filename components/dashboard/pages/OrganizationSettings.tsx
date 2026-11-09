"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationPreferences } from "@/lib/tenant";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaIconBtn, useAction } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface SettingsViewport {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
}
export interface SettingsProxy {
  id: string;
  name: string;
  url: string;
  host: string;
  port: number;
  username: string;
}
export interface SettingsRemoteBrowser {
  id: string;
  name: string;
  remoteUrl: string;
  username: string;
  status: string;
}
export interface SettingsKnowledge {
  id: string;
  title: string;
}

interface Props {
  readOnly: boolean;
  orgName: string;
  logoUrl: string | null;
  initial: OrganizationPreferences;
  viewports: SettingsViewport[];
  proxies: SettingsProxy[];
  remotes: SettingsRemoteBrowser[];
  knowledge: SettingsKnowledge[];
}

const TABS = [
  { id: "company", label: "Company Information" },
  { id: "execution", label: "Test Execution" },
  { id: "ai", label: "AI Configuration" },
  { id: "notifications", label: "Notifications" },
  { id: "viewports", label: "Viewport" },
  { id: "proxy", label: "Proxy" },
  { id: "remote", label: "Remote Browser" },
];

const inputCls =
  "h-[41px] w-full rounded-md border border-[#d1d5db] bg-white px-3 text-[14px] text-[#0a0a0a] outline-none transition placeholder:text-[#9ca3af] focus:border-[#8b80ff] focus:ring-2 focus:ring-[#e4e1fd] disabled:bg-[#f9fafb] disabled:text-[#6b7280]";
const labelCls = "mb-2 block text-[14px] font-medium text-[#374151]";
const cardCls = "rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]";
const cardTitleCls = "mb-5 text-[18px] font-semibold text-[#262626]";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[22px] w-[40px] shrink-0 rounded-full transition", checked ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
    >
      <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

function ToggleRow({ label, checked, onChange, info }: { label: string; checked: boolean; onChange: (v: boolean) => void; info?: string }) {
  return (
    <div className="flex items-center gap-2 py-[7px]">
      <span className="text-[14px] text-[#374151]">{label}</span>
      {info && (
        <span title={info} className="inline-flex text-[#9ca3af]">
          <CqaIcon name="info" className="text-[15px]" />
        </span>
      )}
      <span className="ml-auto">
        <Switch checked={checked} onChange={onChange} label={label} />
      </span>
    </div>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-[#ef4444]">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] leading-5 text-[#6b7280]">{hint}</span>}
    </label>
  );
}

function categoryFor(width: number, height: number) {
  const min = Math.min(width, height);
  const max = Math.max(width, height);
  if (min <= 500) return "Mobile";
  if (min <= 800) return "Tablet";
  if (max <= 1440) return "Laptop";
  return "Desktop";
}

export function OrganizationSettings({ readOnly, orgName, logoUrl, initial, viewports, proxies, remotes, knowledge }: Props) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [tab, setTab] = useState("company");
  const [name, setName] = useState(orgName);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [prefs, setPrefs] = useState<OrganizationPreferences>(initial);
  const [saved, setSaved] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const [viewportOpen, setViewportOpen] = useState(false);
  const [viewportName, setViewportName] = useState("");
  const [viewportW, setViewportW] = useState(1440);
  const [viewportH, setViewportH] = useState(900);

  const [proxyOpen, setProxyOpen] = useState(false);
  const [proxyName, setProxyName] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyUser, setProxyUser] = useState("");
  const [proxyPass, setProxyPass] = useState("");
  const [showProxyPass, setShowProxyPass] = useState(false);

  const [remoteOpen, setRemoteOpen] = useState(false);
  const [remoteName, setRemoteName] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteUser, setRemoteUser] = useState("");
  const [remotePass, setRemotePass] = useState("");
  const [remoteTested, setRemoteTested] = useState(false);
  const [remoteMessage, setRemoteMessage] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof OrganizationPreferences>(key: K, value: OrganizationPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const grouped = useMemo(() => {
    const order = ["Mobile", "Tablet", "Laptop", "Desktop"];
    return order.map((category) => ({
      category,
      items: viewports.filter((v) => v.category.toLowerCase() === category.toLowerCase()),
    })).filter((group) => group.items.length > 0);
  }, [viewports]);

  function goTo(id: string) {
    setTab(id);
    document.getElementById(`org-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveSettings() {
    setSaved(false);
    const res = await run("save", "/api/dashboard/settings/organization/preferences", { method: "PATCH", json: prefs });
    if (!res) return;
    await run("identity", "/api/dashboard/settings/organization", { method: "PATCH", json: { name, logoUrl: logo } });
    setSaved(true);
    router.refresh();
  }

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setRemoteMessage("Logo must be 2MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function addViewport(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("viewport", "/api/dashboard/environment-data", {
      method: "POST",
      json: {
        kind: "viewport",
        name: viewportName.trim(),
        width: viewportW,
        height: viewportH,
        category: categoryFor(viewportW, viewportH),
      },
    });
    if (res) {
      setViewportOpen(false);
      setViewportName("");
      setViewportW(1440);
      setViewportH(900);
      router.refresh();
    }
  }

  async function removeViewport(id: string) {
    const res = await run("viewport", `/api/dashboard/environment-data?kind=viewport&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res) router.refresh();
  }

  async function addProxy(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("proxy", "/api/dashboard/environment-data", {
      method: "POST",
      json: { kind: "proxy", name: proxyName.trim(), proxyUrl: proxyUrl.trim(), username: proxyUser, password: proxyPass },
    });
    if (res) {
      setProxyOpen(false);
      setProxyName("");
      setProxyUrl("");
      setProxyUser("");
      setProxyPass("");
      router.refresh();
    }
  }

  async function removeProxy(id: string) {
    const res = await run("proxy", `/api/dashboard/environment-data?kind=proxy&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res) router.refresh();
  }

  async function testRemote() {
    setRemoteMessage(null);
    setRemoteTested(false);
    const res = await run("testRemote", "/api/dashboard/environment-data/test-remote", {
      method: "POST",
      json: { remoteUrl: remoteUrl.trim(), username: remoteUser, password: remotePass },
    });
    if (res) {
      setRemoteTested(true);
      setRemoteMessage("Connection successful");
    }
  }

  async function addRemote(e: React.FormEvent) {
    e.preventDefault();
    if (!remoteTested) return;
    const res = await run("remote", "/api/dashboard/environment-data", {
      method: "POST",
      json: {
        kind: "remote",
        name: remoteName.trim(),
        remoteUrl: remoteUrl.trim(),
        username: remoteUser,
        password: remotePass,
        verified: true,
      },
    });
    if (res) {
      setRemoteOpen(false);
      setRemoteName("");
      setRemoteUrl("");
      setRemoteUser("");
      setRemotePass("");
      setRemoteTested(false);
      setRemoteMessage(null);
      router.refresh();
    }
  }

  async function removeRemote(id: string) {
    const res = await run("remote", `/api/dashboard/environment-data?kind=remote&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res) router.refresh();
  }

  function addRecipient() {
    const email = newEmail.trim();
    if (!email || !email.includes("@") || prefs.weeklyReportRecipients.includes(email)) return;
    set("weeklyReportRecipients", [...prefs.weeklyReportRecipients, email]);
    setNewEmail("");
  }

  const disabled = readOnly || pending !== null;

  return (
    <div className="-mt-2 pb-10">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold leading-7 text-[#101828]">Organization Setting</h1>
        <p className="mt-1 text-[14px] leading-5 text-[#4a5565]">
          Manage company identity, execution defaults, AI behavior, and email reporting preferences.
        </p>
      </div>

      <div ref={tabsRef} className="sticky top-0 z-20 -mx-1 mb-8 overflow-x-auto bg-[#f8f9fb]/95 px-1 py-2 backdrop-blur">
        <div className="flex min-w-max items-center gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTo(t.id)}
              className={cn(
                "whitespace-nowrap border-b-2 pb-2 text-[16px] leading-6 transition",
                tab === t.id ? "border-[#5b4ee8] font-bold text-[#5b4ee8]" : "border-transparent font-semibold text-[#4a5565] hover:text-[#111827]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* Company Information */}
        <section id="org-company" className={cardCls}>
          <h3 className={cardTitleCls}>Company Information</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Company Name" required>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
            </Field>
            <div>
              <span className={labelCls}>Company Logo</span>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={readOnly}
                className="flex w-full items-center gap-4 rounded-lg border border-dashed border-[#d1d5db] bg-[#fafafa] px-4 py-3 text-left transition hover:border-[#a9a1f7] disabled:opacity-60"
              >
                {logo ? (
                  <img src={logo} alt="Company logo" className="size-12 rounded-md border border-[#e5e7eb] bg-white object-contain p-1" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-md bg-[#f0f1f3] text-[#6b7280]">
                    <CqaIcon name="cloud_upload" className="text-[22px]" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-[#374151]">Click to upload or drag and drop</span>
                  <span className="mt-1 block text-[11.5px] leading-4 text-[#6b7280]">
                    PNG with a transparent background recommended · light/white version reads best on the sidebar · JPG, JPEG accepted · Max 2MB
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Test Execution */}
        <section id="org-execution" className={cardCls}>
          <h3 className={cardTitleCls}>Test Execution Settings</h3>
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
            <Field label="Default Browser" required>
              <select className={inputCls} value={prefs.defaultBrowser} onChange={(e) => set("defaultBrowser", e.target.value as OrganizationPreferences["defaultBrowser"])} disabled={readOnly}>
                {["Chromium", "Chrome", "Firefox", "Safari", "Edge"].map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Test Case Timeout (minutes)" required>
              <input type="number" min={1} className={inputCls} value={prefs.testcaseTimeout} onChange={(e) => set("testcaseTimeout", Number(e.target.value))} disabled={readOnly} />
            </Field>
            <Field label="Crawl Timeout (minutes)" required>
              <input type="number" min={1} className={inputCls} value={prefs.crawlTimeout} onChange={(e) => set("crawlTimeout", Number(e.target.value))} disabled={readOnly} />
            </Field>
            <Field label="Retry Failed Steps" required>
              <input type="number" min={0} className={inputCls} value={prefs.retryFailedSteps} onChange={(e) => set("retryFailedSteps", Number(e.target.value))} disabled={readOnly} />
            </Field>
            <Field label="Wait Timeout for Locators (seconds)" required>
              <input type="number" min={1} className={inputCls} value={prefs.waitTimeoutLocators} onChange={(e) => set("waitTimeoutLocators", Number(e.target.value))} disabled={readOnly} />
            </Field>
            <Field label="Auto Wait Duration (seconds)" required>
              <input type="number" min={0} className={inputCls} value={prefs.autoWaitDuration} onChange={(e) => set("autoWaitDuration", Number(e.target.value))} disabled={readOnly} />
            </Field>
          </div>

          <div className="mt-5 grid gap-x-10 md:grid-cols-2">
            <div>
              <ToggleRow label="Capture All Step Screenshots" checked={prefs.captureStepScreenshots} onChange={(v) => set("captureStepScreenshots", v)} />
              <ToggleRow label="Enable Video Recording" checked={prefs.videoRecording} onChange={(v) => set("videoRecording", v)} />
              <ToggleRow label="Enable Autonomous Crawl" checked={prefs.autonomousCrawl} onChange={(v) => set("autonomousCrawl", v)} />
              <ToggleRow label="Auto approve with auto heal" checked={prefs.autoApproveAutoHeal} onChange={(v) => set("autoApproveAutoHeal", v)} />
              <ToggleRow label="Organize by module" checked={prefs.organizeByModule} onChange={(v) => set("organizeByModule", v)} info="Group generated test cases by the module they exercise." />
            </div>
            <div>
              <ToggleRow label="Show scrollbars during test runs" checked={prefs.showScrollbars} onChange={(v) => set("showScrollbars", v)} info="Keep the browser scrollbar visible while recording and replaying steps." />
              <ToggleRow label="Enable Click Press Hold" checked={prefs.clickPressHold} onChange={(v) => set("clickPressHold", v)} />
            </div>
          </div>

          <div className="mt-7 border-t border-[#e5e7eb] pt-6">
            <span className={labelCls}>Viewport <span className="text-[#ef4444]">*</span></span>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {([
                ["desktop", "Desktop", "desktop_windows"],
                ["laptop", "Laptop", "laptop_windows"],
                ["tablet", "Tablet", "tablet_mac"],
                ["mobile", "Mobile", "smartphone"],
              ] as const).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => set("viewport", value)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2.5 text-[14px] transition",
                    prefs.viewport === value ? "border-[#5b4ee8] bg-[#f5f3ff] font-medium text-[#5b4ee8]" : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#b9b1fb]",
                  )}
                >
                  <CqaIcon name={icon} className="text-[20px]" />
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Field label="Resolution">
                <select className={inputCls} value={prefs.resolution} onChange={(e) => set("resolution", e.target.value)} disabled={readOnly}>
                  <option value="">Select resolution</option>
                  {["Default (1280×720)", "Full HD (1920×1080)", "2K / QHD (2560×1440)", "4K / UHD (3840×2160)"].map((r) => <option key={r}>{r}</option>)}
                </select>
                <span className="mt-1.5 block text-[12.5px] text-[#6b7280]">Note : Default (1280×720) if not selected any resolution.</span>
              </Field>
            </div>
          </div>

          <div className="mt-6 border-t border-[#e5e7eb] pt-5">
            <div className="flex items-center gap-2">
              <h4 className="text-[15px] font-semibold text-[#262626]">Auto-fix</h4>
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[14px] text-[#374151]">Enable Auto-fix</span>
                <CqaIcon name="info" className="text-[15px] text-[#9ca3af]" />
                <Switch checked={prefs.autoFix} onChange={(v) => set("autoFix", v)} label="Enable Auto-fix" />
              </span>
            </div>
            <div className="mt-3 max-w-[320px]">
              <Field label="Auto-fix Rerun Count" required>
                <input type="number" min={0} className={inputCls} value={prefs.autoFixRerunCount} onChange={(e) => set("autoFixRerunCount", Number(e.target.value))} disabled={readOnly || !prefs.autoFix} />
              </Field>
            </div>
          </div>
        </section>

        {/* Time zone */}
        <section id="org-timezone" className={cardCls}>
          <h3 className={cardTitleCls}>Time Zone Settings</h3>
          <div className="max-w-[420px]">
            <Field label="Time Zone" required>
              <select className={inputCls} value={prefs.timeZone} onChange={(e) => set("timeZone", e.target.value)} disabled={readOnly}>
                {TIME_ZONES.map((z) => <option key={z}>{z}</option>)}
              </select>
            </Field>
          </div>
        </section>

        {/* AI Configuration */}
        <section id="org-ai" className={cardCls}>
          <div className="mb-5">
            <h3 className="text-[18px] font-semibold text-[#262626]">AI Configuration</h3>
            <p className="mt-1 text-[13.5px] text-[#6b7280]">Control AI behavior for test automation and self-healing</p>
          </div>
          <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
            <Field label="Default AI Action" required hint="AI suggests fixes but waits for approval">
              <select className={inputCls} value={prefs.defaultAiAction} onChange={(e) => set("defaultAiAction", e.target.value as OrganizationPreferences["defaultAiAction"])} disabled={readOnly}>
                {["Only action", "Create step", "Create dynamic step", "Create Partial steps"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Enable AI Smartness" required>
              <select className={inputCls} value={prefs.aiSmartness} onChange={(e) => set("aiSmartness", e.target.value as OrganizationPreferences["aiSmartness"])} disabled={readOnly}>
                {["Expert (Recommended)", "Fast", "Strict"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Default Knowledge Base" hint="Reference test case used for AI learning and context">
              <select className={inputCls} value={prefs.knowledgeBaseId} onChange={(e) => set("knowledgeBaseId", e.target.value)} disabled={readOnly}>
                <option value="">Select a knowledge base</option>
                {knowledge.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}
              </select>
            </Field>
            <div>
              <ToggleRow label="Use AI Metadata" checked={prefs.useAiMetadata} onChange={(v) => set("useAiMetadata", v)} />
              <p className="text-[12.5px] text-[#6b7280]">Use AI Metadata to .</p>
            </div>
          </div>
        </section>

        {/* Mock API */}
        <section className={cardCls}>
          <div className="mb-5">
            <h3 className="text-[18px] font-semibold text-[#262626]">Mock API Testing</h3>
            <p className="mt-1 text-[13.5px] text-[#6b7280]">Record real API responses and replay them during future test runs for faster, more stable tests.</p>
          </div>
          <div className="flex items-center gap-6 rounded-lg border border-[#f0f1f3] bg-[#fcfcfd] px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[14px] font-medium text-[#262626]">
                Mock API Testing
                <span className="rounded-[6px] border border-[#fde68a] bg-[#fef3c7] px-2 py-[2px] text-[11px] leading-[17px] text-[#92400e]">New</span>
              </p>
              <p className="mt-1 text-[12.5px] text-[#6b7280]">Record real API responses and replay them during future test runs for faster, more stable tests.&quot;</p>
            </div>
            <span className="ml-auto">
              <Switch checked={prefs.mockApi} onChange={(v) => set("mockApi", v)} label="Automatically capture on first run" />
            </span>
          </div>
        </section>

        {/* Email */}
        <section id="org-notifications" className={cardCls}>
          <h3 className={cardTitleCls}>Email Notifications</h3>
          <div className="max-w-[560px]">
            <Field label="Weekly Report Email Recipients">
              <div className="flex min-h-[41px] flex-wrap items-center gap-2 rounded-md border border-[#d1d5db] bg-white px-2 py-1.5">
                {prefs.weeklyReportRecipients.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-2 py-1 text-[12.5px] text-[#374151]">
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      disabled={readOnly}
                      onClick={() => set("weeklyReportRecipients", prefs.weeklyReportRecipients.filter((e) => e !== email))}
                      className="text-[#9ca3af] hover:text-[#dc2626]"
                    >
                      <CqaIcon name="close" className="text-[13px]" />
                    </button>
                  </span>
                ))}
                <input
                  value={newEmail}
                  disabled={readOnly}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                  placeholder={prefs.weeklyReportRecipients.length ? "Type email and press Enter" : "Type email and press Enter"}
                  className="h-7 min-w-[200px] flex-1 border-0 px-1 text-[13px] outline-none placeholder:text-[#9ca3af]"
                />
              </div>
            </Field>
          </div>
        </section>

        {/* Viewports */}
        <section id="org-viewports" className={cardCls}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-[18px] font-semibold text-[#262626]">Viewport Configurations</h3>
            <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setViewportOpen(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add Viewport
            </button>
          </div>
          <div className="space-y-5">
            {grouped.length === 0 && <p className="text-[13px] text-[#6b7280]">No viewport configurations.</p>}
            {grouped.map((group) => (
              <div key={group.category}>
                <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#6b7280]">{group.category}</h4>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-[13px] text-[#374151]">
                      {v.name} ({v.width}×{v.height})
                      <button type="button" aria-label={`Remove ${v.name}`} disabled={readOnly} onClick={() => removeViewport(v.id)} className="text-[#9ca3af] hover:text-[#dc2626]">
                        <CqaIcon name="close" className="text-[14px]" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Proxy */}
        <section id="org-proxy" className={cardCls}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[18px] font-semibold text-[#262626]">Proxy Profiles</h3>
            <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setProxyOpen(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add Proxy
            </button>
          </div>
          <p className="mb-5 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
            Proxy connections available to every test plan and test case in this organization. Assign one from a test plan&apos;s or test case&apos;s settings.
          </p>
          {proxies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fcfcfd] px-5 py-6 text-center">
              <h3 className="text-[16px] font-semibold text-[#374151]">No proxy profiles</h3>
              <p className="mt-1 text-[13px] text-[#6b7280]">Add a proxy to route test execution through your internal network.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb]">
              {proxies.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-[#f5f3ff] text-[#5b4ee8]"><CqaIcon name="vpn_lock" className="text-[19px]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-[#111827]">{p.name}</p>
                    <p className="truncate text-[12px] text-[#6b7280]">{p.url || `${p.host}:${p.port}`}{p.username ? ` · ${p.username}` : ""}</p>
                  </div>
                  <button type="button" className={cqaIconBtn} aria-label={`Delete ${p.name}`} disabled={readOnly} onClick={() => removeProxy(p.id)}>
                    <CqaIcon name="delete" className="text-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Remote Browser */}
        <section id="org-remote" className={cardCls}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[18px] font-semibold text-[#262626]">Remote Browser Profiles</h3>
            <button type="button" className={cqaBtnSecondary} disabled={readOnly} onClick={() => setRemoteOpen(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add Remote Browser
            </button>
          </div>
          <p className="mb-5 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
            Remote browser endpoints available to every test plan and test case in this organization. Assign one from a test plan&apos;s or test case&apos;s settings.
          </p>
          {remotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fcfcfd] px-5 py-6 text-center">
              <h3 className="text-[16px] font-semibold text-[#374151]">No remote browser profiles</h3>
              <p className="mt-1 text-[13px] text-[#6b7280]">Add a remote browser to run tests on an external browser endpoint.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb]">
              {remotes.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-[#eff6ff] text-[#2563eb]"><CqaIcon name="devices" className="text-[19px]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-[#111827]">{r.name}</p>
                    <p className="truncate text-[12px] text-[#6b7280]">{r.remoteUrl}{r.username ? ` · ${r.username}` : ""}</p>
                  </div>
                  <span className={cn("rounded border px-2 py-[2px] text-[11.5px]", r.status === "verified" ? "border-[#b9f8cf] bg-[#f0fdf4] text-[#00a63e]" : "border-[#fde68a] bg-[#fffbeb] text-[#d97706]")}>
                    {r.status === "verified" ? "Verified" : "Unverified"}
                  </span>
                  <button type="button" className={cqaIconBtn} aria-label={`Delete ${r.name}`} disabled={readOnly} onClick={() => removeRemote(r.id)}>
                    <CqaIcon name="delete" className="text-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {error && <p role="alert" className="mt-5 text-[12.5px] text-red-600">{error}</p>}

      <div className="sticky bottom-0 z-20 mt-8 flex items-center justify-end gap-3 border-t border-[#e5e7eb] bg-[#f8f9fb]/95 py-4 backdrop-blur">
        {saved && <span className="text-[12.5px] font-medium text-[#00a63e]">Settings saved</span>}
        <button type="button" className={cn(cqaBtnPrimary, "h-10 px-5 text-[14px]")} disabled={disabled} onClick={saveSettings}>
          <CqaIcon name="save" className="text-[18px]" />
          {pending === "save" || pending === "identity" ? "Saving…" : "Save Settings"}
        </button>
      </div>

      <Modal
        open={viewportOpen}
        onClose={() => setViewportOpen(false)}
        title="Add Viewport"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setViewportOpen(false)}>Cancel</button>
            <button type="submit" form="add-viewport-form" className={cqaBtnPrimary} disabled={pending === "viewport" || !viewportName.trim()}>
              {pending === "viewport" ? "Adding…" : "Add Viewport"}
            </button>
          </>
        }
      >
        <form id="add-viewport-form" onSubmit={addViewport} className="space-y-4">
          <Field label="Label" required>
            <input className={inputCls} placeholder="e.g. My Custom Desktop" value={viewportName} onChange={(e) => setViewportName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Width (px)" required>
              <input type="number" min={100} max={5000} className={inputCls} value={viewportW} onChange={(e) => setViewportW(Number(e.target.value))} required />
            </Field>
            <Field label="Height (px)" required>
              <input type="number" min={100} max={5000} className={inputCls} value={viewportH} onChange={(e) => setViewportH(Number(e.target.value))} required />
            </Field>
          </div>
          <Field label="Category (auto)">
            <input className={inputCls} value={categoryFor(viewportW, viewportH)} readOnly disabled />
          </Field>
        </form>
      </Modal>

      <Modal
        open={proxyOpen}
        onClose={() => setProxyOpen(false)}
        title="Add Proxy"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setProxyOpen(false)}>Cancel</button>
            <button type="submit" form="add-proxy-form" className={cqaBtnPrimary} disabled={pending === "proxy" || !proxyName.trim() || !proxyUrl.trim()}>
              {pending === "proxy" ? "Adding…" : "Add Proxy"}
            </button>
          </>
        }
      >
        <form id="add-proxy-form" onSubmit={addProxy} className="space-y-4">
          <Field label="Name" required>
            <input className={inputCls} placeholder="e.g. Corporate Proxy" value={proxyName} onChange={(e) => setProxyName(e.target.value)} required />
          </Field>
          <Field label="Proxy URL" required>
            <input className={inputCls} placeholder="http://host:port" value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Username">
              <input className={inputCls} placeholder="Username" value={proxyUser} onChange={(e) => setProxyUser(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input type={showProxyPass ? "text" : "password"} className={cn(inputCls, "pr-10")} placeholder="Password" value={proxyPass} onChange={(e) => setProxyPass(e.target.value)} autoComplete="new-password" />
                <button type="button" aria-label="Show password" onClick={() => setShowProxyPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af]">
                  <CqaIcon name="visibility" className="text-[18px]" />
                </button>
              </div>
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={remoteOpen}
        onClose={() => setRemoteOpen(false)}
        title="Add Remote Browser"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setRemoteOpen(false)}>Cancel</button>
            <button type="submit" form="add-remote-form" className={cqaBtnPrimary} disabled={pending === "remote" || !remoteTested || !remoteName.trim()}>
              {pending === "remote" ? "Adding…" : "Add Remote Browser"}
            </button>
          </>
        }
      >
        <form id="add-remote-form" onSubmit={addRemote} className="space-y-4">
          <Field label="Name" required>
            <input className={inputCls} placeholder="e.g. BrowserStack – Windows 11" value={remoteName} onChange={(e) => setRemoteName(e.target.value)} required />
          </Field>
          <Field label="Remote Browser URL" required>
            <input className={inputCls} placeholder="https://hub.browserstack.com/wd/hub" value={remoteUrl} onChange={(e) => { setRemoteUrl(e.target.value); setRemoteTested(false); }} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Username">
              <input className={inputCls} placeholder="Username" value={remoteUser} onChange={(e) => setRemoteUser(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Password">
              <input type="password" className={inputCls} placeholder="Password" value={remotePass} onChange={(e) => setRemotePass(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#f0f1f3] pt-4">
            <button type="button" className={cqaBtnSecondary} disabled={!remoteUrl.trim() || pending === "testRemote"} onClick={testRemote}>
              <CqaIcon name="cable" className="text-[17px]" />
              {pending === "testRemote" ? "Testing…" : "Test Connection"}
            </button>
            {remoteMessage && (
              <span className={cn("text-[12.5px] font-medium", remoteTested ? "text-[#00a63e]" : "text-red-600")}>{remoteMessage}</span>
            )}
            {!remoteTested && !remoteMessage && <span className="text-[12.5px] text-[#6b7280]">Test the connection to enable saving.</span>}
          </div>
        </form>
      </Modal>
    </div>
  );
}

const TIME_ZONES = [
  "UTC",
  "Eastern Time (US & Canada)",
  "Central Time (US & Canada)",
  "Mountain Time (US & Canada)",
  "Arizona",
  "Pacific Time (US & Canada)",
  "Alaska",
  "Hawaii",
  "Detroit",
  "Indiana (Indianapolis)",
  "Boise",
  "Eastern Time (Toronto)",
  "Pacific Time (Vancouver)",
  "Mountain Time (Edmonton)",
  "Central Time (Winnipeg)",
  "Saskatchewan (Regina)",
  "Atlantic Time (Halifax)",
  "Newfoundland",
  "Atlantic Time (Goose Bay)",
  "Tijuana",
  "Mexico City",
  "Monterrey",
  "Chihuahua",
  "Puerto Rico",
  "Havana",
  "Guatemala",
  "Costa Rica",
  "Panama",
  "Jamaica",
  "Port-au-Prince",
  "Santo Domingo",
  "Bogotá",
  "Caracas",
  "Lima",
  "Guayaquil",
  "La Paz",
  "Santiago",
  "Buenos Aires",
  "Brasília",
  "Montevideo",
  "Asunción",
  "Reykjavik",
  "Azores",
  "Cape Verde",
  "Canary Islands",
  "London",
  "Dublin",
  "Paris",
  "Berlin",
  "Amsterdam",
  "Brussels",
  "Madrid",
  "Rome",
  "Lisbon",
  "Zurich",
  "Vienna",
  "Warsaw",
  "Prague",
  "Budapest",
  "Bucharest",
  "Sofia",
  "Athens",
  "Stockholm",
  "Oslo",
  "Copenhagen",
  "Helsinki",
  "Riga",
  "Tallinn",
  "Vilnius",
  "Belgrade",
  "Zagreb",
  "Istanbul",
  "Kyiv",
  "Minsk",
  "Chisinau",
  "Moscow",
  "Samara",
  "Volgograd",
  "Yekaterinburg",
  "Novosibirsk",
  "Krasnoyarsk",
  "Irkutsk",
  "Yakutsk",
  "Vladivostok",
  "Kamchatka",
  "Casablanca",
  "Cairo",
  "Tunis",
  "Algiers",
  "Lagos",
  "Accra",
  "Abidjan",
  "Nairobi",
  "Addis Ababa",
  "Dar es Salaam",
  "Kampala",
  "Johannesburg",
  "Maputo",
  "Jerusalem",
  "Amman",
  "Beirut",
  "Baghdad",
  "Kuwait",
  "Riyadh",
  "Bahrain",
  "Qatar",
  "Dubai",
  "Muscat",
  "Tehran",
  "Kabul",
  "Karachi",
  "India (Kolkata)",
  "Kathmandu",
  "Dhaka",
  "Colombo",
  "Yangon",
  "Bangkok",
  "Jakarta",
  "Phnom Penh",
  "Ho Chi Minh City",
  "Singapore",
  "Kuala Lumpur",
  "Manila",
  "Hong Kong",
  "Shanghai",
  "Taipei",
  "Tokyo",
  "Seoul",
  "Tbilisi",
  "Yerevan",
  "Baku",
  "Tashkent",
  "Almaty",
  "Bishkek",
  "Dushanbe",
  "Ashgabat",
  "Perth",
  "Adelaide",
  "Darwin",
  "Brisbane",
  "Sydney",
  "Melbourne",
  "Hobart",
  "Guam",
  "Port Moresby",
  "Nouméa",
  "Fiji",
  "Auckland",
  "Chatham Islands",
  "Tonga",
  "Samoa",
  "American Samoa",
  "Tahiti",
  "Marshall Islands",
  "Norfolk Island",
];
