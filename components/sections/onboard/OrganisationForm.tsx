"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch, ApiError, errorMessage } from "@/lib/api";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import type { OnboardingState } from "@/lib/types";
import { hostOf, isValidSlug, normalizeWebsite, slugify } from "@/lib/utils";

type SlugStatus =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; suggestion: string | null }
  | { state: "error" };

interface SlugResponse {
  available: boolean;
  slug: string;
  suggestion?: string | null;
}

/** Délai de debounce de la vérification de disponibilité du slug. */
const SLUG_DEBOUNCE_MS = 350;

/** Formulaire "Create your organisation" (volet gauche de /onboard/organisation). */
export function OrganisationForm() {
  const router = useRouter();
  const { state, patchOrganisation } = useOnboarding();
  const org = state.organisation;

  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const [touched, setTouched] = useState({ ownerName: false, website: false });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const slug = slugOverride ?? slugify(org.name);
  const hasName = org.name.trim().length > 0;
  const normalizedWebsite = normalizeWebsite(org.website);
  const ownerValid = org.ownerName.trim().length >= 2;

  // Synchronise le slug calculé avec le contexte (aperçu "qasyn.app/<slug>")
  useEffect(() => {
    patchOrganisation({ slug });
  }, [slug, patchOrganisation]);

  // Vérification en temps réel de la disponibilité (debounce + annulation)
  useEffect(() => {
    if (!hasName) {
      setSlugStatus({ state: "idle" });
      return;
    }
    if (!isValidSlug(slug)) {
      setSlugStatus({ state: "invalid" });
      return;
    }
    setSlugStatus({ state: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<SlugResponse>(`/api/onboard/check-slug?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });
        setSlugStatus(res.available ? { state: "available" } : { state: "unavailable", suggestion: res.suggestion ?? null });
      } catch {
        if (!controller.signal.aborted) setSlugStatus({ state: "error" });
      }
    }, SLUG_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug, hasName]);

  const canSubmit = ownerValid && slugStatus.state === "available" && normalizedWebsite !== null && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ ownerName: true, website: true });
    if (!canSubmit) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch<{ state: OnboardingState; next: string }>("/api/onboard", {
        method: "POST",
        json: {
          ownerName: org.ownerName,
          name: org.name,
          slug,
          website: org.website,
          addWebsiteToKb: org.addWebsiteToKb,
        },
      });
      router.push(res.next);
      // `submitting` reste à true jusqu'à la navigation
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const suggestion = typeof error.data.suggestion === "string" ? error.data.suggestion : null;
        setSlugStatus({ state: "unavailable", suggestion });
      }
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Get started</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Create your organisation</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your workspace is where Ship learns your product. It only takes a minute.
        </p>
      </div>

      <Input
        label="Your name"
        name="ownerName"
        autoComplete="name"
        placeholder="Adnen Rebhi"
        maxLength={80}
        value={org.ownerName}
        onChange={(e) => patchOrganisation({ ownerName: e.target.value })}
        onBlur={() => setTouched((t) => ({ ...t, ownerName: true }))}
        error={touched.ownerName && !ownerValid ? "Enter your name." : null}
        required
      />

      <Input
        label="Organisation name"
        name="organisation"
        autoComplete="organization"
        placeholder="gmailad"
        maxLength={60}
        value={org.name}
        onChange={(e) => {
          setSlugOverride(null);
          patchOrganisation({ name: e.target.value });
        }}
        trailing={<SlugIndicator status={slugStatus} />}
        error={slugStatus.state === "invalid" ? "Use at least 3 letters or numbers." : null}
        hint={<SlugHint slug={slug} status={slugStatus} onUseSuggestion={setSlugOverride} />}
        required
      />

      <div className="space-y-3">
        <Input
          label="Company website"
          name="website"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://gmail.com"
          maxLength={300}
          value={org.website}
          onChange={(e) => patchOrganisation({ website: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, website: true }))}
          trailing={
            normalizedWebsite ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white" title="Valid website">
                ✓
              </span>
            ) : null
          }
          error={touched.website && !normalizedWebsite ? "Enter a valid website, e.g. https://example.com" : null}
          required
        />
        <Checkbox
          checked={org.addWebsiteToKb}
          onChange={(checked) => patchOrganisation({ addWebsiteToKb: checked })}
          label="Add website to Knowledge Base"
          description={
            normalizedWebsite
              ? `Ship will read public pages of ${hostOf(normalizedWebsite)} to learn your product.`
              : "Ship reads your public pages to learn your product."
          }
        />
      </div>

      {formError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Creating organisation..." disabled={!canSubmit}>
        Create organisation
      </Button>

      <p className="text-center text-xs text-slate-400">
        By continuing you agree to the Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}

function SlugIndicator({ status }: { status: SlugStatus }) {
  switch (status.state) {
    case "checking":
      return <Spinner className="text-slate-400" />;
    case "available":
      return (
        <span className="relative flex size-2.5" title="Available">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
      );
    case "unavailable":
      return <span className="inline-flex size-2.5 rounded-full bg-red-500" title="Not available" />;
    default:
      return null;
  }
}

function SlugHint({
  slug,
  status,
  onUseSuggestion,
}: {
  slug: string;
  status: SlugStatus;
  onUseSuggestion: (slug: string) => void;
}) {
  if (!slug) return <span>Your workspace URL will be qasyn.app/your-organisation</span>;
  const url = <span className="font-mono text-slate-600">qasyn.app/{slug}</span>;

  switch (status.state) {
    case "checking":
      return <span>Checking {url}…</span>;
    case "available":
      return (
        <span className="text-emerald-600">
          {url} is available
        </span>
      );
    case "unavailable":
      return (
        <span className="text-red-600">
          {url} is already taken.{" "}
          {status.suggestion && (
            <button
              type="button"
              onClick={() => onUseSuggestion(status.suggestion!)}
              className="font-medium text-brand-600 underline-offset-2 hover:underline"
            >
              Use {status.suggestion}
            </button>
          )}
        </span>
      );
    case "error":
      return <span className="text-amber-600">Couldn&apos;t check availability. Retrying when you type.</span>;
    default:
      return <span>Your workspace URL: {url}</span>;
  }
}
