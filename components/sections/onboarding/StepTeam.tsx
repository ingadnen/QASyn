"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { firstName, isEmail } from "@/lib/utils";
import { useStepSubmit } from "./hooks";
import { StepFooter, StepShell } from "./StepShell";

const MAX_INVITES = 20;

/** Étape 6 — "Invite your team". */
export function StepTeam() {
  const { state, patch } = useOnboarding();
  const { submit, pending, error } = useStepSubmit();
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const invites = state.teamInvites;

  function add() {
    const emails = draft
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;
    const invalid = emails.find((e) => !isEmail(e));
    if (invalid) {
      setDraftError(`“${invalid}” is not a valid e-mail address.`);
      return;
    }
    const next = [...new Set([...invites, ...emails])];
    if (next.length > MAX_INVITES) {
      setDraftError(`You can invite up to ${MAX_INVITES} teammates during setup.`);
      return;
    }
    patch({ teamInvites: next });
    setDraft("");
    setDraftError(null);
  }

  return (
    <StepShell step={6}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex items-end gap-2"
      >
        <Input
          label="Teammate e-mails"
          type="text"
          inputMode="email"
          placeholder="sam@company.com, priya@company.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          error={draftError}
          className="flex-1"
        />
        <Button type="submit" variant="secondary" className={draftError ? "mb-6" : undefined}>
          Add
        </Button>
      </form>

      <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar label={state.organisation.ownerName || "You"} />
          <div className="flex-1 text-sm">
            <p className="font-medium text-slate-800">{state.organisation.ownerName || "You"}</p>
            <p className="text-xs text-slate-400">Owner</p>
          </div>
        </li>
        {invites.map((email) => (
          <li key={email} className="flex items-center gap-3 px-4 py-3 animate-fade-in">
            <Avatar label={email} />
            <div className="flex-1 text-sm">
              <p className="font-medium text-slate-800">{email}</p>
              <p className="text-xs text-slate-400">Invite pending · Member</p>
            </div>
            <button
              type="button"
              onClick={() => patch({ teamInvites: invites.filter((i) => i !== email) })}
              className="text-xs font-medium text-slate-400 hover:text-red-600"
              aria-label={`Remove ${email}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <StepFooter
        step={6}
        pending={pending}
        error={error}
        continueLabel={invites.length ? `Send ${invites.length} invite${invites.length > 1 ? "s" : ""}` : `Just ${firstName(state.organisation.ownerName) || "me"} for now`}
        pendingLabel="Sending invites…"
        onContinue={() => submit({ step: 6, teamInvites: invites })}
      />
    </StepShell>
  );
}

function Avatar({ label }: { label: string }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}
