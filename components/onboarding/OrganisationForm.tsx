"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { apiFetch, ApiError, errorMessage } from "@/lib/api";
import { useOnboarding } from "@/lib/context/OnboardingContext";
import { hostOf, isValidSlug, normalizeWebsite, slugify } from "@/lib/utils";

type SlugStatus =
  | { state: "idle" }
  | { state: "invalid" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; suggestion: string | null }
  | { state: "error" };

const SLUG_DEBOUNCE_MS = 350;
const MAX_LOGO_BYTES = 300 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** "Create your organisation" form (left panel of /onboard/organisation). */
export function OrganisationForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const { state, patchOrganisation } = useOnboarding();
  const org = state.organisation;
  const fileRef = useRef<HTMLInputElement>(null);

  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ownerName && defaultName) patchOrganisation({ ownerName: defaultName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slug = slugOverride ?? slugify(org.name);
  const hasName = org.name.trim().length > 0;
  const websiteFilled = org.website.trim().length > 0;
  const normalizedWebsite = normalizeWebsite(org.website);
  const ownerValid = org.ownerName.trim().length >= 2;

  useEffect(() => {
    patchOrganisation({ slug });
  }, [slug, patchOrganisation]);

  useEffect(() => {
    if (!hasName) return setSlugStatus({ state: "idle" });
    if (!isValidSlug(slug)) return setSlugStatus({ state: "invalid" });
    setSlugStatus({ state: "checking" });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ available: boolean; suggestion?: string | null }>(
          `/api/onboard/check-slug?slug=${encodeURIComponent(slug)}`,
          { signal: controller.signal },
        );
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

  const canSubmit = ownerValid && slugStatus.state === "available" && (!websiteFilled || normalizedWebsite !== null) && !submitting;

  function onLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setLogoError("Upload a PNG, JPEG or WebP image.");
    if (file.size > MAX_LOGO_BYTES) return setLogoError("Logo must be under 300 KB.");
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && patchOrganisation({ logoUrl: reader.result });
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch<{ next: string }>("/api/onboard", {
        method: "POST",
        json: {
          ownerName: org.ownerName,
          name: org.name,
          slug,
          website: org.website,
          addToKnowledgeBase: org.addToKnowledgeBase,
          logoUrl: org.logoUrl,
        },
      });
      router.push(res.next);
      router.refresh();
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create your organisation</h1>
        <p className="mt-2 text-sm text-slate-500">Your workspace is where QASyn learns your product. It only takes a minute.</p>
      </div>

      <Input
        label="Your name *"
        name="ownerName"
        autoComplete="name"
        placeholder="Jane Cooper"
        maxLength={80}
        value={org.ownerName}
        onChange={(e) => patchOrganisation({ ownerName: e.target.value })}
        error={org.ownerName && !ownerValid ? "Enter your name." : null}
      />

      <Input
        label="Organisation name *"
        name="organisation"
        autoComplete="organization"
        placeholder="Your company"
        maxLength={60}
        value={org.name}
        onChange={(e) => {
          setSlugOverride(null);
          patchOrganisation({ name: e.target.value });
        }}
        trailing={slugStatus.state === "checking" ? <Spinner className="text-slate-400" /> : null}
        error={slugStatus.state === "invalid" ? "Use at least 3 letters or numbers." : null}
        hint={<SlugHint status={slugStatus} onUseSuggestion={setSlugOverride} />}
      />

      <div className="space-y-3">
        <Input
          label="Company website (Optional)"
          name="website"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://yourcompany.com"
          maxLength={300}
          value={org.website}
          onChange={(e) => patchOrganisation({ website: e.target.value })}
          error={websiteFilled && !normalizedWebsite ? "Enter a valid website, e.g. https://example.com" : null}
        />
        <Checkbox
          checked={org.addToKnowledgeBase}
          onChange={(checked) => patchOrganisation({ addToKnowledgeBase: checked })}
          label="Add website to Knowledge Base"
          description={
            normalizedWebsite
              ? `QASyn will crawl public pages of ${hostOf(normalizedWebsite)} to learn your product.`
              : "QASyn reads your public pages to learn your product."
          }
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700">Organisation logo</p>
        <div className="mt-2 flex items-center gap-4">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="Logo preview" className="size-12 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-semibold text-white">
              {(org.name.trim().charAt(0) || "?").toUpperCase()}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={LOGO_TYPES.join(",")}
            className="hidden"
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            Upload logo
          </Button>
          {org.logoUrl && (
            <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => patchOrganisation({ logoUrl: null })}>
              Remove
            </button>
          )}
        </div>
        <p className={logoError ? "mt-1.5 text-xs text-red-600" : "mt-1.5 text-xs text-slate-400"}>
          {logoError ?? "PNG, JPEG or WebP, up to 300 KB."}
        </p>
      </div>

      {formError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Creating organisation…" disabled={!canSubmit}>
        Create organisation
      </Button>
    </form>
  );
}

function SlugHint({ status, onUseSuggestion }: { status: SlugStatus; onUseSuggestion: (slug: string) => void }) {
  switch (status.state) {
    case "available":
      return <span className="font-medium text-emerald-600">✓ Organisation name is available.</span>;
    case "unavailable":
      return (
        <span className="text-red-600">
          This organisation name is already taken.{" "}
          {status.suggestion && (
            <button type="button" onClick={() => onUseSuggestion(status.suggestion!)} className="font-medium text-brand-600 hover:underline">
              Use {status.suggestion}
            </button>
          )}
        </span>
      );
    case "checking":
      return <span>Checking availability…</span>;
    case "error":
      return <span className="text-amber-600">Couldn&apos;t check availability. Keep typing to retry.</span>;
    default:
      return null;
  }
}
