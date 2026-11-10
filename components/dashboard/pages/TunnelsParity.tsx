"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CqaIcon,
  Modal,
  StatusPill,
  cqaBtnPrimary,
  cqaBtnSecondary,
  cqaCard,
  cqaIconBtn,
  cqaInput,
  cqaLabel,
  useAction,
} from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface TunnelMachineRow {
  id: string;
  name: string;
  os: string;
  status: string;
  browserHost: boolean;
  routeCount: number;
  createdAt: string;
}

export interface TunnelAlertPrefs {
  sendAlerts: boolean;
  delivery: "Immediate" | "Daily digest";
  digestHour: string;
  channel: string;
  recipients: string[];
}

export interface TunnelsProps {
  readOnly: boolean;
  orgName: string;
  machines: TunnelMachineRow[];
  alerts: TunnelAlertPrefs;
  maxMachines: number;
  maxRoutes: number;
}

const OS_ICON: Record<string, string> = { win: "desktop_windows", mac: "laptop_mac", linux: "terminal" };
const OS_LABEL: Record<string, string> = { win: "Windows", mac: "macOS", linux: "Linux" };

function statusMeta(status: string) {
  if (status === "connected") return { hint: "connected", label: "Connected", tone: "active" };
  if (status === "pending") return { hint: "waiting for agent", label: "Pending", tone: "pending" };
  if (status === "offline") return { hint: "not answering", label: "Offline", tone: "offline" };
  return { hint: "command expired", label: "Expired", tone: "expired" };
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cqaBtnSecondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      <CqaIcon name={copied ? "check" : "content_copy"} className="text-[16px]" />
      {copied ? "Copied" : label}
    </button>
  );
}

export function Tunnels(props: TunnelsProps) {
  const { readOnly, orgName, machines, alerts, maxMachines, maxRoutes } = props;
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [installGuide, setInstallGuide] = useState(false);
  const [networkGuide, setNetworkGuide] = useState(false);
  const [commandMachine, setCommandMachine] = useState<{ name: string; token: string } | null>(null);
  const [prefs, setPrefs] = useState<TunnelAlertPrefs>(alerts);
  const [testAlertSent, setTestAlertSent] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const activeMachines = useMemo(() => machines.filter((m) => m.status === "connected").length, [machines]);
  const routes = useMemo(() => machines.reduce((sum, m) => sum + m.routeCount, 0), [machines]);

  async function savePrefs(next: TunnelAlertPrefs) {
    setPrefs(next);
    await run("alerts", "/api/dashboard/tunnels", {
      method: "PATCH",
      json: { action: "alerts", sendAlerts: next.sendAlerts, delivery: next.delivery, digestHour: next.digestHour, channel: next.channel, recipients: next.recipients },
    });
  }

  async function renew(machine: TunnelMachineRow) {
    const res = await run(`renew-${machine.id}`, "/api/dashboard/tunnels", {
      method: "PATCH",
      json: { action: "renew", id: machine.id },
    });
    if (res) {
      const payload = res as { machine?: { token?: string } };
      setCommandMachine({ name: machine.name, token: payload.machine?.token ?? machine.id });
      router.refresh();
    }
  }

  async function remove(machine: TunnelMachineRow) {
    if (!window.confirm(`Remove machine "${machine.name}"? Routes published through it stop working.`)) return;
    await run(`del-${machine.id}`, `/api/dashboard/tunnels?id=${encodeURIComponent(machine.id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#111827]">Tunnels</h1>
        <p className="mt-1 max-w-4xl text-[13.5px] leading-5 text-[#6b7280]">
          Publish an app running on your machine as a URL QASyn can test. One agent per machine; one URL per route.
        </p>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[12px] text-[#4b5563]">
          <CqaIcon name="lan" className="text-[15px] text-[#6b7280]" />
          {activeMachines} of {maxMachines} machines Â· {routes} of {maxRoutes} routes
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className={cqaBtnSecondary} onClick={() => setAlertsOpen((v) => !v)} aria-expanded={alertsOpen}>
            <CqaIcon name="notifications" className="text-[16px]" /> Alerts
          </button>
          <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => { setError(null); setAddOpen(true); }}>
            <CqaIcon name="add" className="text-[17px]" /> Add machine
          </button>
        </div>

        {alertsOpen && (
          <div className="absolute right-0 top-11 z-40 w-full max-w-[560px] rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#111827]">Alerts</h2>
              <button type="button" className={cqaIconBtn} aria-label="Close alerts" onClick={() => setAlertsOpen(false)}>
                <CqaIcon name="close" className="text-[18px]" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3 py-2">
              <span className="text-[12.5px] font-medium text-[#374151]">Send alerts</span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.sendAlerts}
                aria-label="Send alerts"
                disabled={readOnly}
                onClick={() => void savePrefs({ ...prefs, sendAlerts: !prefs.sendAlerts })}
                className={cn("relative h-[22px] w-[40px] rounded-full transition", prefs.sendAlerts ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
              >
                <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", prefs.sendAlerts ? "left-[21px]" : "left-[3px]")} />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className={cqaLabel}>Delivery</p>
                <div className="space-y-1.5">
                  {["Immediate", "Daily digest Â· 09:00 CST"].map((label, i) => {
                    const value = i === 0 ? "Immediate" : "Daily digest";
                    return (
                      <label key={value} className="flex items-center gap-2 text-[12.5px] text-[#374151]">
                        <input
                          type="radio"
                          name="tunnel-delivery"
                          checked={prefs.delivery === value}
                          disabled={readOnly}
                          onChange={() => void savePrefs({ ...prefs, delivery: value as TunnelAlertPrefs["delivery"] })}
                          className="size-3.5 accent-[#5b4ee8]"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className={cqaLabel}>Digest hour</span>
                <select
                  className={cqaInput}
                  value={prefs.digestHour}
                  disabled={readOnly || prefs.delivery !== "Daily digest"}
                  onChange={(e) => void savePrefs({ ...prefs, digestHour: e.target.value })}
                >
                  {["06:00", "07:00", "08:00", "09:00", "10:00", "17:00", "18:00"].map((h) => <option key={h}>{h}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="font-medium text-[#374151]">Slack channel</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#9ca3af]">{prefs.channel || "Not set"}</span>
                  <button type="button" className="text-[12px] font-medium text-[#5b4ee8] hover:underline" onClick={() => void savePrefs({ ...prefs, channel: "#qa-alerts" })}>
                    choose
                  </button>
                </div>
              </div>
              {!prefs.channel && (
                <div className="flex items-start gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11.5px] leading-4 text-[#92400e]">
                  <CqaIcon name="warning" className="mt-0.5 text-[15px]" />
                  <p>
                    <span className="font-semibold">No channel to post to.</span> Tunnel alerts are on, but nothing will be delivered until a channel is chosen here, or a default is set in Settings â†’ Slack.{" "}
                    <a href="/dashboard/integrations" className="font-semibold underline">Open Settings</a>
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[#f0f1f3] pt-3 text-[12.5px]">
              <div>
                <p className="font-medium text-[#374151]">Recipients</p>
                <p className="text-[12px] text-[#6b7280]">Tenant admins ({prefs.recipients.length})</p>
              </div>
              <button type="button" onClick={() => { setRecipientError(null); setManageOpen(true); }} className="text-[12px] font-medium text-[#5b4ee8] hover:underline">manage</button>
            </div>
            <p className="mt-3 text-[11.5px] leading-4 text-[#6b7280]">
              A machine that stops answering for 10 minutes alerts, and so does a route that fails three checks in a row. Auth failures always alert. Recovery is sent when it comes back.
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#f0f1f3] pt-3">
              <span className="text-[12px] text-[#9ca3af]">{testAlertSent ? "Test alert sent to your channel." : "No down alerts yet"}</span>
              <button
                type="button"
                className={cqaBtnSecondary}
                onClick={() => {
                  setTestAlertSent(true);
                  window.setTimeout(() => setTestAlertSent(false), 2400);
                }}
              >
                Send test alert
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-[20px] font-semibold text-[#111827]">Machines</h2>
          <span className="text-[12px] text-[#9ca3af]">{machines.length} Â· worst first</span>
        </div>

        {machines.length === 0 ? (
          <div className={cn(cqaCard, "px-6 py-14 text-center")}>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]">
              <CqaIcon name="lan" className="text-[26px]" />
            </div>
            <p className="mt-3 text-[14px] font-medium text-[#374151]">No machines yet</p>
            <p className="mt-1 text-[12.5px] text-[#9ca3af]">Add a machine to publish apps running on your network.</p>
            <button type="button" className={cn(cqaBtnPrimary, "mt-4")} disabled={readOnly} onClick={() => setAddOpen(true)}>
              <CqaIcon name="add" className="text-[17px]" /> Add machine
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {machines.map((machine) => {
              const meta = statusMeta(machine.status);
              return (
                <div key={machine.id} className={cn(cqaCard, "overflow-hidden")}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#4b5563]" title={OS_LABEL[machine.os] ?? machine.os}>
                      <CqaIcon name={OS_ICON[machine.os] ?? "desktop_windows"} className="text-[20px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-[#111827]">{machine.name}</p>
                        <StatusPill value={meta.tone} label={meta.label} />
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-[#9ca3af]">
                        {meta.hint}
                        {machine.browserHost ? " Â· browser host" : ""}
                        {machine.routeCount > 0 ? ` Â· ${machine.routeCount} route${machine.routeCount === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <button type="button" className={cqaBtnSecondary} disabled={readOnly || pending === `renew-${machine.id}`} onClick={() => void renew(machine)}>
                        <CqaIcon name="refresh" className="text-[16px]" />
                        {pending === `renew-${machine.id}` ? "Creatingâ€¦" : "Create new command"}
                      </button>
                      <details className="relative">
                        <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-medium text-[#374151] hover:bg-[#f9fafb] [&::-webkit-details-marker]:hidden">
                          More <CqaIcon name="expand_more" className="text-[16px]" />
                        </summary>
                        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                          <button type="button" disabled={readOnly} onClick={() => void remove(machine)} className="block w-full px-3 py-1.5 text-left text-[12.5px] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50">
                            Removeâ€¦
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                  {machine.status === "expired" && (
                    <div className="border-t border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-[12px] leading-4 text-[#92400e]">
                      The install command for {machine.name} expired before the machine connected. Create a new command; it comes with a new one-time token and nothing else changes.
                    </div>
                  )}
                  {machine.status === "pending" && (
                    <div className="border-t border-[#e0e7ff] bg-[#eef2ff] px-4 py-2.5 text-[12px] leading-4 text-[#4338ca]">
                      Waiting for {machine.name} to connect. The install command expires ten minutes after it is created.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-[#f0f1f3] pt-3 text-[12px] text-[#6b7280]">
          <span>Routes are checked every 2 min.</span>
          <button type="button" className="font-medium text-[#5b4ee8] hover:underline" onClick={() => setInstallGuide(true)}>Install guide</button>
          <span className="text-[#d1d5db]">Â·</span>
          <button type="button" className="font-medium text-[#5b4ee8] hover:underline" onClick={() => setNetworkGuide(true)}>Network requirements</button>
        </div>
      </section>

      <AddMachineModal
        open={addOpen}
        readOnly={readOnly}
        orgName={orgName}
        onClose={() => setAddOpen(false)}
        onCreated={(machine) => {
          setAddOpen(false);
          setCommandMachine({ name: machine.name, token: machine.token });
          router.refresh();
        }}
      />

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Alert recipients"
        footer={<button type="button" className={cqaBtnSecondary} onClick={() => setManageOpen(false)}>Done</button>}
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-5 text-[#6b7280]">
            Tunnel down and recovery alerts are delivered to these addresses. Changes save immediately.
          </p>
          <ul className="divide-y divide-[#f3f4f6] overflow-hidden rounded-lg border border-[#e5e7eb]">
            {prefs.recipients.map((email) => (
              <li key={email} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] text-[#374151]">
                <span className="inline-flex items-center gap-2">
                  <CqaIcon name="mail" className="text-[16px] text-[#9ca3af]" />
                  {email}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  disabled={readOnly || prefs.recipients.length <= 1}
                  onClick={() => void savePrefs({ ...prefs, recipients: prefs.recipients.filter((entry) => entry !== email) })}
                  className="rounded p-1 text-[#9ca3af] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-40"
                >
                  <CqaIcon name="close" className="text-[16px]" />
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const email = recipientDraft.trim().toLowerCase();
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                setRecipientError("Enter a valid email address.");
                return;
              }
              if (prefs.recipients.includes(email)) {
                setRecipientError("That address is already a recipient.");
                return;
              }
              setRecipientError(null);
              setRecipientDraft("");
              void savePrefs({ ...prefs, recipients: [...prefs.recipients, email] });
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="email"
              aria-label="New recipient email"
              placeholder="name@company.com"
              value={recipientDraft}
              onChange={(event) => setRecipientDraft(event.target.value)}
              disabled={readOnly}
              className={cn(cqaInput, "h-9 flex-1")}
            />
            <button type="submit" disabled={readOnly || pending === "alerts"} className={cn(cqaBtnSecondary, "h-9")}>
              <CqaIcon name="add" className="text-[16px]" /> Add recipient
            </button>
          </form>
          {recipientError && <p className="text-[12px] text-red-600">{recipientError}</p>}
        </div>
      </Modal>

      <InstallCommandModal
        machine={commandMachine}
        onClose={() => setCommandMachine(null)}
      />

      <Modal
        open={installGuide}
        onClose={() => setInstallGuide(false)}
        title="Install guide"
        size="lg"
        footer={<button type="button" className={cqaBtnSecondary} onClick={() => setInstallGuide(false)}>Done</button>}
      >
        <div className="space-y-3 text-[13px] leading-5 text-[#4b5563]">
          <p>Install the QASyn agent on a machine that can reach your app.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Add the machine here. Click <span className="font-medium text-[#111827]">+ Add machine</span>, name it and pick its system. You get an install command and a one-time token that expires after a few minutes.</li>
            <li>Run the command on that machine â€” in Terminal on macOS or Linux, or in PowerShell opened as administrator on Windows. It needs admin rights, and the machine must be allowed to connect out (see <span className="font-medium text-[#111827]">Network requirements</span>).</li>
            <li>Wait for it to enroll. It appears here as <span className="font-medium text-[#111827]">Enrolled</span>, usually within a minute.</li>
            <li>Publish an app. On the machine, run <code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11.5px]">qasyn add-route web http://localhost:3000</code>. Your app gets an address like <code className="rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[11.5px]">https://web-{orgName.toLowerCase()}.tunl.qasyn.dev</code>.</li>
          </ol>
          <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] p-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Useful commands on the machine</p>
            <dl className="mt-2 space-y-1.5 text-[12.5px]">
              {[
                ["qasyn status", "Is the agent running and connected?"],
                ["qasyn doctor", "Six health checks. Start here when something is wrong."],
                ["qasyn remove-route web", "Stop publishing a route."],
                ["qasyn uninstall", "Remove the agent. Run it with admin rights."],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex flex-wrap items-baseline gap-2">
                  <dt><code className="rounded bg-white px-1.5 py-0.5 text-[11.5px] text-[#111827]">{cmd}</code></dt>
                  <dd className="text-[12px] text-[#6b7280]">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Modal>

      <Modal
        open={networkGuide}
        onClose={() => setNetworkGuide(false)}
        title="Network requirements"
        size="lg"
        footer={<button type="button" className={cqaBtnSecondary} onClick={() => setNetworkGuide(false)}>Done</button>}
      >
        <div className="space-y-3 text-[13px] leading-5 text-[#4b5563]">
          <p>The agent only connects out from your machine. Nothing needs to reach in â€” no open ports, no VPN, no public IP.</p>
          <p>Ask your IT team to allow these outbound connections from that machine:</p>
          <div className="overflow-hidden rounded-lg border border-[#e5e7eb]">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-[#fafafa] text-[11px] uppercase tracking-[0.06em] text-[#9ca3af]">
                <tr>
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">Port</th>
                  <th className="px-3 py-2 font-medium">For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {[
                  ["get.qasyn.com", "TCP 443", "Downloading the agent"],
                  ["server.qasyn.com", "TCP 443", "Setup and publishing"],
                  ["pang.tunl.qasyn.dev", "TCP 443", "Tunnel control"],
                  ["tunl.qasyn.dev", "UDP 51820", "Your app's traffic (encrypted)"],
                  ["tunl.qasyn.dev", "UDP 21820", "Keeping the connection open"],
                ].map(([a, p, f]) => (
                  <tr key={`${a}-${p}`}>
                    <td className="px-3 py-2 font-mono text-[11.5px] text-[#374151]">{a}</td>
                    <td className="px-3 py-2 text-[#4b5563]">{p}</td>
                    <td className="px-3 py-2 text-[#6b7280]">{f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CopyButton value={"get.qasyn.com TCP 443\nserver.qasyn.com TCP 443\npang.tunl.qasyn.dev TCP 443\ntunl.qasyn.dev UDP 51820\ntunl.qasyn.dev UDP 21820"} label="Copy for IT" />
          <p className="text-[12px] text-[#9ca3af]">Copies these rules plus the details a network team needs.</p>
          <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-[12.5px] text-[#92400e]">
            <p className="font-semibold">If the machine enrolls but your app doesn&apos;t load</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Both UDP ports, 51820 and 21820, must be open.</li>
              <li>The firewall must keep idle UDP connections for at least 10 minutes. Many default to 60 seconds.</li>
              <li>A web proxy can&apos;t carry this traffic. The machine needs direct outbound UDP.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function AddMachineModal({
  open,
  readOnly,
  orgName,
  onClose,
  onCreated,
}: {
  open: boolean;
  readOnly: boolean;
  orgName: string;
  onClose: () => void;
  onCreated: (machine: { name: string; token: string }) => void;
}) {
  const { run, pending, error, setError } = useAction();
  const [name, setName] = useState("");
  const [os, setOs] = useState("win");
  const [browserHost, setBrowserHost] = useState(false);

  const valid = /^[a-z][a-z0-9-]{0,20}$/.test(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run("machine", "/api/dashboard/tunnels", { json: { name, os, browserHost } });
    if (res) {
      const payload = res as { machine?: { name?: string; token?: string } };
      onCreated({ name: payload.machine?.name ?? name, token: payload.machine?.token ?? "" });
      setName("");
      setOs("win");
      setBrowserHost(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { setError(null); onClose(); }}
      title="Add a machine"
      footer={
        <>
          <button type="button" className={cqaBtnSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="machine-form" className={cqaBtnPrimary} disabled={readOnly || pending === "machine" || !valid}>
            {pending === "machine" ? "Creatingâ€¦" : "Create install command"}
          </button>
        </>
      }
    >
      <form id="machine-form" onSubmit={submit} className="space-y-4">
        <p className="text-[12.5px] leading-5 text-[#6b7280]">Installs the QASyn agent on a machine and connects it to {orgName}.</p>
        <label className="block">
          <span className={cqaLabel}>Machine name</span>
          <input
            className={cqaInput}
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            required
            maxLength={21}
            placeholder="qa"
          />
          <span className="mt-1 block text-[11px] leading-4 text-[#9ca3af]">
            Lowercase letters, digits and hyphens, starting with a letter, up to 21 characters. Reserved for you until the command expires.
          </span>
        </label>
        <div>
          <span className={cqaLabel}>System</span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "win", label: "Windows", icon: "desktop_windows" },
              { value: "mac", label: "macOS", icon: "laptop_mac" },
              { value: "linux", label: "Linux", icon: "terminal" },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={os === o.value}
                onClick={() => setOs(o.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[12px] transition",
                  os === o.value ? "border-[#5b4ee8] bg-[#f5f3ff] text-[#4338ca]" : "border-[#e5e7eb] text-[#4b5563] hover:border-[#cbc6fb]",
                )}
              >
                <CqaIcon name={o.icon} className="text-[20px]" />
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={cqaLabel}>Options</span>
          <div className="rounded-lg border border-[#f0f1f3] bg-[#fafafa] px-3 py-2.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12.5px] font-medium text-[#111827]">Enable browser host</p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-[#9ca3af]">Run QASyn browsers on this machine for tests behind your firewall (about 1 GB)</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={browserHost}
                aria-label="Enable browser host"
                onClick={() => setBrowserHost((v) => !v)}
                className={cn("relative mt-0.5 h-[22px] w-[40px] shrink-0 rounded-full transition", browserHost ? "bg-[#5b4ee8]" : "bg-[#d1d5db]")}
              >
                <span className={cn("absolute top-[3px] size-4 rounded-full bg-white shadow transition", browserHost ? "left-[21px]" : "left-[3px]")} />
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-[#9ca3af]">Creates a short-lived, one-time token.</p>
        </div>
        {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}

function InstallCommandModal({
  machine,
  onClose,
}: {
  machine: { name: string; token: string } | null;
  onClose: () => void;
}) {
  const command = machine
    ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://get.qasyn.com/install.ps1 | iex; qasyn connect --name ${machine.name} --token ${machine.token}"`
    : "";
  return (
    <Modal
      open={machine !== null}
      onClose={onClose}
      title={machine ? `Install command for ${machine.name}` : "Install command"}
      size="lg"
      footer={<button type="button" className={cqaBtnSecondary} onClick={onClose}>Done</button>}
    >
      <div className="space-y-4">
        <p className="text-[12.5px] leading-5 text-[#6b7280]">
          Run this once on the machine, in PowerShell opened as administrator. The one-time token expires in ten minutes; create a new command if it does.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-[#10141c] p-3 text-[11.5px] leading-5 text-[#cbd5e1]"><code>{command}</code></pre>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={command} label="Copy command" />
          {machine && <CopyButton value={machine.token} label="Copy token" />}
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-[#e0e7ff] bg-[#eef2ff] px-3 py-2 text-[11.5px] leading-4 text-[#4338ca]">
          <CqaIcon name="encrypted" className="mt-0.5 text-[15px]" />
          The token is shown once. Nothing else changes if you create a new command.
        </div>
      </div>
    </Modal>
  );
}
