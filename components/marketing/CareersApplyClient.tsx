"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";

interface Role {
  title: string;
  team: string;
  location: string;
  description: string;
}

interface UploadedAttachment {
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function readAttachment(file: File): Promise<UploadedAttachment> {
  return new Promise((resolve, reject) => {
    const extensionOk = /\.(pdf|doc|docx)$/i.test(file.name);
    if (!ACCEPTED_ATTACHMENT_TYPES.has(file.type) && !extensionOk) {
      reject(new Error("Please upload a PDF, DOC or DOCX file."));
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      reject(new Error("Each attachment must be 4 MB or smaller."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The selected file could not be read."));
        return;
      }
      resolve({ fileName: file.name, mimeType: file.type || "application/octet-stream", dataUrl: reader.result });
    };
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

const ROLES: Role[] = [
  {
    title: "Staff Systems Engineer — Browser Runtime",
    team: "Browser Runtime",
    location: "Remote · US / Canada",
    description: "Own the Playwright execution layer, stealth browser grid, per-step evidence capture and self-healing runtime.",
  },
  {
    title: "Senior AI Test Architect",
    team: "AI & Quality",
    location: "Remote · Global",
    description: "Design agentic test generation, calibration and PR impact analysis across web, API and enterprise applications.",
  },
  {
    title: "Product Engineer — Test Studio",
    team: "Product Engineering",
    location: "Hybrid · Montreal",
    description: "Build the Test Studio authoring experience, evidence lightbox, NLP steps and quality-gate workflows.",
  },
  {
    title: "Enterprise Solutions Architect",
    team: "Customer Engineering",
    location: "Remote · US",
    description: "Lead enterprise onboarding, SSO/security reviews, Azure DevOps integrations and executive demo programs.",
  },
];

export function CareersApplyClient() {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [cvFile, setCvFile] = useState<UploadedAttachment | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<UploadedAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRole(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function open(next: Role) {
    setRole(next);
    setSent(false);
    setError(null);
    setAttachmentError(null);
    setCvFile(null);
    setCoverLetterFile(null);
  }

  async function chooseAttachment(
    file: File | undefined,
    setter: (value: UploadedAttachment | null) => void,
    input: HTMLInputElement,
  ) {
    if (!file) {
      setter(null);
      return;
    }
    try {
      setter(await readAttachment(file));
      setAttachmentError(null);
    } catch (caught) {
      setter(null);
      input.value = "";
      setAttachmentError(caught instanceof Error ? caught.message : "The selected file could not be read.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) return;
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Full name, email and cover note are required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch("/api/marketing/lead", {
        method: "POST",
        json: {
          kind: "career",
          name,
          email,
          jobTitle: role.title,
          role: role.team,
          portfolioUrl,
          message,
          source: "careers",
          cvFileName: cvFile?.fileName,
          cvMimeType: cvFile?.mimeType,
          cvDataUrl: cvFile?.dataUrl,
          coverLetterFileName: coverLetterFile?.fileName,
          coverLetterMimeType: coverLetterFile?.mimeType,
          coverLetterDataUrl: coverLetterFile?.dataUrl,
        },
      });
      setSentEmail(email.trim());
      setSent(true);
      setName("");
      setEmail("");
      setPortfolioUrl("");
      setMessage("");
      setCvFile(null);
      setCoverLetterFile(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="grid gap-3" data-testid="careers-open-roles">
        {ROLES.map((item) => (
          <article key={item.title} className="flex flex-col gap-3 rounded-2xl border border-hairline bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-quantum-600">{item.team} · {item.location}</p>
              <h2 className="mt-1 text-base font-semibold text-[#0F172A]">{item.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
            <button type="button" data-testid="career-apply" data-role-title={item.title} onClick={() => open(item)} className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-quantum-600 px-4 text-sm font-semibold text-white hover:bg-quantum-500">
              Apply →
            </button>
          </article>
        ))}
      </div>

      {role && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Apply for ${role.title}`} data-testid="career-application-modal">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-quantum-600">JOB APPLICATION</p>
                <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">{role.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{role.team} · {role.location}</p>
              </div>
              <button type="button" aria-label="Close application" onClick={() => setRole(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>

            {sent ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900" data-testid="career-application-success">
                <p className="font-semibold">Application received.</p>
                <p className="mt-1">Your application for <strong>{role.title}</strong> has been sent to the QASyn hiring team. We&apos;ll reply to <strong>{sentEmail}</strong> after engineering review.</p>
                <button type="button" onClick={() => setRole(null)} className="mt-3 text-xs font-semibold text-emerald-700 hover:underline">Close</button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Full name *</span>
                    <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Cooper" required />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Email *</span>
                    <input type="email" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" required />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">LinkedIn / GitHub / Portfolio</span>
                  <input className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Cover note / experience summary *</span>
                  <textarea className="min-h-[130px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-quantum-400 focus:ring-2 focus:ring-quantum-100" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us about the systems you have built and why this role fits." required />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                    <span className="block text-xs font-medium text-slate-700">CV / Resume</span>
                    <span className="mt-0.5 block text-[10.5px] text-slate-500">PDF, DOC or DOCX · up to 4 MB</span>
                    <input
                      data-testid="career-cv-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="mt-2 block w-full text-[11px] text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-quantum-600 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white"
                      onChange={(e) => void chooseAttachment(e.target.files?.[0], setCvFile, e.currentTarget)}
                    />
                    {cvFile && <span className="mt-1 block truncate text-[10.5px] font-medium text-emerald-700">{cvFile.fileName}</span>}
                  </label>
                  <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                    <span className="block text-xs font-medium text-slate-700">Cover Letter Document</span>
                    <span className="mt-0.5 block text-[10.5px] text-slate-500">Optional · PDF, DOC or DOCX · up to 4 MB</span>
                    <input
                      data-testid="career-cover-letter-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="mt-2 block w-full text-[11px] text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-quantum-600 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white"
                      onChange={(e) => void chooseAttachment(e.target.files?.[0], setCoverLetterFile, e.currentTarget)}
                    />
                    {coverLetterFile && <span className="mt-1 block truncate text-[10.5px] font-medium text-emerald-700">{coverLetterFile.fileName}</span>}
                  </label>
                </div>
                {attachmentError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{attachmentError}</p>}
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">Application is sent securely to the QASyn hiring team.</p>
                  <button type="submit" data-testid="career-application-submit" disabled={pending} className="inline-flex h-10 items-center justify-center rounded-lg bg-quantum-600 px-4 text-sm font-semibold text-white hover:bg-quantum-500 disabled:opacity-50">
                    {pending ? "Sending…" : "Submit application"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
