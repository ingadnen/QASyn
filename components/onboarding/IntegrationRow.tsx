"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PROVIDER_META } from "@/lib/constants";
import type { IntegrationDTO, Provider } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One provider row: tile, description, status and "Connect ->" / "Disconnect". */
export function IntegrationRow({
  provider,
  integration,
  busy,
  onConnect,
  onDisconnect,
  disabled,
}: {
  provider: Provider;
  integration: IntegrationDTO | undefined;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
}) {
  const meta = PROVIDER_META[provider];
  return (
    <div className={cn("flex items-center gap-4 rounded-xl border bg-white p-4 transition", integration ? "border-brand-200" : "border-slate-200")}>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold", meta.tile)}>{meta.short}</div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {meta.name}
          {integration?.status === "INDEXING" && (
            <Badge tone="warning" dot pulse>
              Indexing
            </Badge>
          )}
          {integration?.status === "CONNECTED" && (
            <Badge tone="success" dot>
              Connected
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-slate-500">{integration?.detail ?? meta.description}</p>
      </div>
      {integration ? (
        <Button variant="ghost" size="sm" onClick={onDisconnect} loading={busy} disabled={disabled}>
          Disconnect
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={onConnect} loading={busy} loadingText="Connecting…" disabled={disabled}>
          Connect →
        </Button>
      )}
    </div>
  );
}
