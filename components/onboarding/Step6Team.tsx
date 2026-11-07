"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { isEmail } from "@/lib/utils";
import { useSaveStep } from "./hooks";
import { StepFooter, StepHeader } from "./StepChrome";

export function Step6Team() {
  const { state, patch } = useOnboarding();
  const { save, pending, error } = useSaveStep();
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  function add() {
    const emails = draft
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const invalid = emails.find((e) => !isEmail(e));
    if (invalid) return setDraftError(`"${invalid}" is not a valid e-mail.`);
    const next = [...new Set([...state.invitedEmails, ...emails])].slice(0, 20);
    patch({ invitedEmails: next });
    setDraft("");
    setDraftError(null);
  }

  return (
    <div className="space-y-8">
      <StepHeader step={6} title="Bring your team" subtitle="Teammates get an invite and land in this workspace when they sign up with the same e-mail." />

      <div className="flex items-end gap-2">
        <Input
          className="flex-1"
          label="Invite by e-mail"
          type="email"
          placeholder="teammate@yourcompany.com, another@yourcompany.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          error={draftError}
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()} className={draftError ? "mb-6" : undefined}>
          Add
        </Button>
      </div>

      {state.invitedEmails.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {state.invitedEmails.map((email) => (
            <li key={email} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {email.slice(0, 2).toUpperCase()}
                </span>
                {email}
              </span>
              <button
                type="button"
                onClick={() => patch({ invitedEmails: state.invitedEmails.filter((e) => e !== email) })}
                className="text-xs text-slate-400 hover:text-red-600"
                aria-label={`Remove ${email}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          Just you for now. QA works better with the people who ship.
        </p>
      )}

      <StepFooter
        step={6}
        pending={pending}
        error={error}
        continueLabel={state.invitedEmails.length > 0 ? `Send ${state.invitedEmails.length} invite${state.invitedEmails.length > 1 ? "s" : ""}` : "Continue"}
        onSkip={() => save({ step: 6, skip: true, invitedEmails: [] }, "skip")}
        onContinue={() => save({ step: 6, invitedEmails: state.invitedEmails })}
      />
    </div>
  );
}
