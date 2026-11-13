"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiFetch, errorMessage } from "@/lib/api";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { isEmail } from "@/lib/utils";
import { useSaveStep } from "./hooks";
import { StepFooter, StepHeader } from "./StepChrome";

const ROLE_OPTIONS = [
  { value: "Admin", label: "Admin" },
  { value: "QA", label: "QA Lead" },
  { value: "Engineer", label: "Engineer" },
  { value: "BA / FA", label: "Viewer" },
];

interface SentInvite {
  email: string;
  role: string;
  url: string;
}

export function Step6Team() {
  const { state, patch } = useOnboarding();
  const { save, pending, error } = useSaveStep();
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState("Engineer");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<SentInvite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function add() {
    const emails = draft
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .filter((e) => !state.invitedEmails.includes(e));
    const invalid = emails.find((e) => !isEmail(e));
    if (invalid) return setDraftError(`"${invalid}" is not a valid e-mail.`);
    if (emails.length === 0) return setDraftError("Enter a new teammate e-mail.");
    setSending(true);
    setDraftError(null);
    const next = [...state.invitedEmails];
    const created: SentInvite[] = [];
    for (const email of emails) {
      try {
        const result = await apiFetch<{ inviteUrl: string }>("/api/dashboard/team", {
          method: "POST",
          json: { email, role, name: email.split("@")[0] },
        });
        next.push(email);
        created.push({ email, role, url: result.inviteUrl });
      } catch (caught) {
        setDraftError(errorMessage(caught));
      }
    }
    patch({ invitedEmails: [...new Set(next)].slice(0, 20) });
    setInvites((current) => [...created, ...current]);
    setDraft("");
    setSending(false);
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-8">
      <StepHeader step={6} title="Bring your team" subtitle="Send signed invitation links. Each teammate joins this exact workspace with the role you assign." />

      <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto] sm:items-end">
        <Input
          label="Invite by e-mail"
          type="email"
          placeholder="teammate@yourcompany.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
          error={draftError ?? undefined}
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Role</span>
          <select className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={() => void add()} disabled={!draft.trim() || sending} loading={sending} loadingText="Sending…">
          Send invite
        </Button>
      </div>

      {state.invitedEmails.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {state.invitedEmails.map((email) => {
            const invite = invites.find((item) => item.email === email);
            return (
              <li key={email} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{email.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate">{email}</span>
                {invite && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">{invite.role}</span>}
                {invite && (
                  <button type="button" onClick={() => void copy(invite.url)} className="text-xs font-semibold text-brand-600 hover:underline">
                    {copied === invite.url ? "Copied" : "Copy invite link"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => patch({ invitedEmails: state.invitedEmails.filter((e) => e !== email) })}
                  className="text-xs text-slate-400 hover:text-red-600"
                  aria-label={`Remove ${email}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">Just you for now. QA works better with the people who ship.</p>
      )}

      {invites.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {invites.length} invitation{invites.length > 1 ? "s" : ""} sent. The links above are signed, expire in 7 days, and place each teammate in this organisation.
        </div>
      )}

      <StepFooter
        step={6}
        pending={pending}
        error={error}
        continueLabel={state.invitedEmails.length > 0 ? `Continue with ${state.invitedEmails.length} teammate${state.invitedEmails.length > 1 ? "s" : ""}` : "Continue"}
        onSkip={() => save({ step: 6, skip: true, invitedEmails: [] }, "skip")}
        onContinue={() => save({ step: 6, invitedEmails: state.invitedEmails })}
      />
    </div>
  );
}
