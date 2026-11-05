"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { OS_OPTIONS } from "@/lib/constants";
import { buildTunnelCommand } from "@/lib/tunnel";
import type { OsKey } from "@/lib/types";
import { maskToken } from "@/lib/utils";

/** Module "Localhost, right now" : onglets OS, port, commande et jeton masqué. */
export function LocalhostInstaller({
  os,
  onOsChange,
  port,
  onPortChange,
  token,
  onRotate,
  rotating,
}: {
  os: OsKey;
  onOsChange: (os: OsKey) => void;
  port: number;
  onPortChange: (port: number) => void;
  token: string | null;
  onRotate: () => void;
  rotating: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const displayToken = token ? (revealed ? token : maskToken(token)) : "generating…";

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">Your operating system</p>
          <div className="mt-2">
            <Tabs label="Operating system" value={os} onChange={onOsChange} options={OS_OPTIONS} />
          </div>
        </div>
        <Input
          label="Local port"
          type="number"
          min={1}
          max={65535}
          value={port}
          onChange={(e) => onPortChange(Math.min(65535, Math.max(1, Number(e.target.value) || 1)))}
          className="w-28"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Run this on your machine</p>
        <CodeBlock
          title={os === "WINDOWS" ? "PowerShell" : "Terminal"}
          code={buildTunnelCommand(os, displayToken, port)}
          copyText={token ? buildTunnelCommand(os, token, port) : undefined}
        />
        <p className="mt-2 text-xs text-slate-400">
          Demo command — the tunnel is simulated by this local prototype.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Auth token</p>
          <p className="truncate font-mono text-sm text-slate-800">{displayToken}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="brand">Single use</Badge>
          <Button variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)} disabled={!token}>
            {revealed ? "Hide" : "Reveal"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onRotate} loading={rotating} loadingText="Rotating…">
            Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
}
