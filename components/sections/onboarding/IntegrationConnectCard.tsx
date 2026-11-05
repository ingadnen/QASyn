"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PROVIDER_META } from "@/lib/constants";
import type { IntegrationDTO, Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Carte de connexion tierce (GitHub, GitLab, Jira, Linear, Slack). */
export function IntegrationConnectCard({
  provider,
  integration,
  busy,
  defaultDetail = "",
  onConnect,
  onDisconnect,
}: {
  provider: Provider;
  integration?: IntegrationDTO;
  busy: boolean;
  defaultDetail?: string;
  onConnect: (detail: string) => void;
  onDisconnect: () => void;
}) {
  const meta = PROVIDER_META[provider];
  const [detail, setDetail] = useState(defaultDetail);
  const status = integration?.status;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition",
        status === "CONNECTED" && "border-emerald-200",
        status === "INDEXING" && "border-amber-200",
        status === "FAILED" && "border-red-200",
        !status && "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold", meta.tile)}>
          {meta.short}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{meta.name}</h3>
            {status === "CONNECTED" && <Badge tone="success" dot>Connected</Badge>}
            {status === "INDEXING" && <Badge tone="warning" dot pulse>Indexing…</Badge>}
            {status === "FAILED" && <Badge tone="danger">Failed</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {integration?.detail ? `${meta.detailLabel}: ${integration.detail}` : meta.description}
          </p>
        </div>
      </div>

      {status === "INDEXING" && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full w-full animate-shimmer rounded-full bg-gradient-to-r from-transparent via-amber-500 to-transparent bg-[length:200%_100%]" />
          </div>
          <p className="mt-2 text-xs text-amber-700">Reading the repository and mapping flows. This continues in the background.</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {!integration ? (
          <>
            {meta.detailLabel && (
              <input
                aria-label={meta.detailLabel}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={meta.detailPlaceholder}
                maxLength={100}
                className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            )}
            <Button size="sm" onClick={() => onConnect(detail.trim())} loading={busy} loadingText="Connecting…">
              Connect
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={onDisconnect} loading={busy} loadingText="Disconnecting…" className="ml-auto">
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}
