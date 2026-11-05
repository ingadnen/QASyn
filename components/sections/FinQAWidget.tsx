"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import type { FinqaReply } from "@/lib/finqa";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  code?: string;
  links?: FinqaReply["links"];
  error?: boolean;
}

const SUGGESTIONS = [
  "What's the quality score of release #284?",
  "How much test coverage do we have?",
  "How much defect cost did we avoid?",
  "How do I install the localhost tunnel?",
];

const GREETING: Message = {
  id: 0,
  from: "bot",
  text: "Hi! I'm FinQA. I can answer questions about QASyn or connect you with our team. What would you like to do?",
};

/** Assistant flottant (bas-droite) — réponses simulées servies par /api/finqa. */
export function FinQAWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [asking, setAsking] = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const push = (message: Omit<Message, "id">) => setMessages((m) => [...m, { ...message, id: nextId.current++ }]);

  const startAsking = () => {
    setAsking(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  async function send(text: string) {
    const message = text.trim().slice(0, 500);
    if (!message || pending) return;
    setAsking(true);
    setInput("");
    push({ from: "user", text: message });
    setPending(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { reply } = await apiFetch<{ reply: FinqaReply }>("/api/finqa", {
        method: "POST",
        json: { message },
        signal: controller.signal,
      });
      push({ from: "bot", text: reply.text, code: reply.code, links: reply.links });
    } catch (error) {
      if (controller.signal.aborted) return;
      push({ from: "bot", text: errorMessage(error), error: true });
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  const userHasAsked = messages.some((m) => m.from === "user");

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {open && (
        <section
          role="dialog"
          aria-label="FinQA assistant"
          className="animate-fade-in flex h-[min(600px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] bg-white shadow-2xl shadow-navy-950/25 ring-1 ring-line"
        >
          <header className="relative flex items-center gap-3 bg-navy-900 px-4 py-4 text-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_0%,rgba(61,46,224,0.55),transparent_60%)]"
            />
            <span className="relative flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold">
              Q
            </span>
            <div className="relative flex-1">
              <p className="text-sm font-semibold">FinQA</p>
              <p className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="size-1.5 rounded-full bg-emerald-400" /> AI assistant · replies instantly
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="relative rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.from === "user" && "rounded-br-md bg-brand-600 text-white",
                    m.from === "bot" && !m.error && "rounded-bl-md bg-white text-ink ring-1 ring-line",
                    m.error && "rounded-bl-md bg-red-50 text-red-700 ring-1 ring-red-200",
                  )}
                >
                  <p>{m.text}</p>
                  {m.code && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-term-950 p-2.5 font-mono text-[11px] leading-relaxed text-term-text">
                      {m.code}
                    </pre>
                  )}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!asking && !userHasAsked && (
              <div className="flex flex-col items-end gap-2 pt-1">
                <Link
                  href="/onboard/organisation"
                  className="rounded-full border border-brand-200 bg-white px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  Book a demo or contact us
                </Link>
                <button
                  type="button"
                  onClick={startAsking}
                  className="rounded-full border border-brand-200 bg-white px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  Ask FinQA a question
                </button>
              </div>
            )}

            {asking && !userHasAsked && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Suggested</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="block w-full rounded-xl bg-white px-3 py-2 text-left text-sm text-ink ring-1 ring-line transition hover:ring-brand-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {pending && (
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 ring-1 ring-line w-fit" aria-label="FinQA is typing">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
          </div>

          {userHasAsked && !pending && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-line bg-white px-3 pt-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-muted hover:bg-brand-50 hover:text-brand-700"
                >
                  {s.replace(/\?$/, "")}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-2 bg-white px-3 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="finqa-input" className="sr-only">
              Ask a question
            </label>
            <input
              ref={inputRef}
              id="finqa-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setAsking(true)}
              maxLength={500}
              placeholder="Ask about quality, coverage, tunnel…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="flex size-10 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close FinQA assistant" : "Open FinQA assistant"}
        className="relative flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition hover:scale-105 hover:bg-brand-700"
      >
        {!open && !userHasAsked && <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-ember-500 ring-2 ring-white" />}
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {open ? (
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4 5h16v11H8l-4 4V5Z" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
