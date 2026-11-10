import { NextResponse } from "next/server";

/**
 * GET /install.ps1 — real Windows tunnel-agent installer.
 *
 * The script is generated per request so the embedded origin always matches
 * the host the user is actually browsing (localhost, staging or production).
 * There is no fictitious download subdomain.
 */
export const dynamic = "force-dynamic";

function buildScript(origin: string): string {
  return `# QASyn Tunnel Agent - Windows installer
# Origin: ${origin}
# Usage:  irm ${origin}/install.ps1 | iex
#         qasyn connect --name <machine> --token <token>

$ErrorActionPreference = "Stop"
$global:QASynOrigin = "${origin}"
$global:QASynOs = "Windows"

Write-Host ""
Write-Host "  QASyn Tunnel Agent" -ForegroundColor Magenta
Write-Host "  Origin: $global:QASynOrigin" -ForegroundColor DarkGray
Write-Host ""

function global:qasyn {
    param(
        [Parameter(Position = 0)][string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
    )

    $rest = @()
    if ($null -ne $Rest) { $rest = @($Rest) }

    switch ($Command) {
        "connect" {
            $name = ""
            $token = ""
            $i = 0
            while ($i -lt $rest.Count) {
                $current = [string]$rest[$i]
                if ($current -eq "--name" -and ($i + 1) -lt $rest.Count) {
                    $name = [string]$rest[$i + 1]
                    $i += 2
                } elseif ($current -eq "--token" -and ($i + 1) -lt $rest.Count) {
                    $token = [string]$rest[$i + 1]
                    $i += 2
                } else {
                    $i += 1
                }
            }

            if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($token)) {
                Write-Host "Usage: qasyn connect --name <machine> --token <token>" -ForegroundColor Yellow
                return
            }

            $hostname = $env:COMPUTERNAME
            if ([string]::IsNullOrWhiteSpace($hostname)) {
                $hostname = [System.Net.Dns]::GetHostName()
            }

            $payload = @{
                action   = "connect"
                name     = $name
                token    = $token
                os       = "Windows"
                hostname = $hostname
            } | ConvertTo-Json -Compress

            try {
                Invoke-RestMethod -Uri "$global:QASynOrigin/api/onboarding/tunnel" -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 30 | Out-Null
                Write-Host ""
                Write-Host ("✔ QASyn Tunnel Agent connected! Machine '" + $name + "' is now ONLINE on " + $global:QASynOrigin) -ForegroundColor Green
                Write-Host "  This machine now shows as Connected in Tunnels." -ForegroundColor DarkGray
                Write-Host ""
            } catch {
                Write-Host ("✕ Could not connect the QASyn Tunnel Agent: " + $_.Exception.Message) -ForegroundColor Red
                throw
            }
        }
        "status" {
            Write-Host ""
            Write-Host "QASyn Tunnel Agent" -ForegroundColor Magenta
            Write-Host ("  Origin : " + $global:QASynOrigin)
            Write-Host ("  Host   : " + $env:COMPUTERNAME)
            Write-Host "  Status : ready (qasyn connect --name <machine> --token <token>)"
            Write-Host ""
        }
        "doctor" {
            Write-Host ""
            Write-Host "QASyn Tunnel Agent diagnostics" -ForegroundColor Magenta
            Write-Host ("  [ok] PowerShell " + $PSVersionTable.PSVersion.ToString())
            Write-Host ("  [ok] Origin " + $global:QASynOrigin)
            try {
                $health = Invoke-RestMethod -Uri "$global:QASynOrigin/api/health" -Method Get -TimeoutSec 10
                Write-Host "  [ok] Reachability: origin answered"
            } catch {
                Write-Host "  [!!] Reachability: origin did not answer" -ForegroundColor Red
            }
            Write-Host ""
        }
        "uninstall" {
            Remove-Item function:global:qasyn -ErrorAction SilentlyContinue
            Write-Host "QASyn Tunnel Agent removed from this PowerShell session." -ForegroundColor Green
        }
        default {
            Write-Host ""
            Write-Host "QASyn Tunnel Agent" -ForegroundColor Magenta
            Write-Host "  qasyn connect --name <machine> --token <token>   Connect this machine"
            Write-Host "  qasyn status                                     Show agent state"
            Write-Host "  qasyn doctor                                     Run diagnostics"
            Write-Host "  qasyn uninstall                                  Remove the agent"
            Write-Host ""
        }
    }
}

Write-Host "Installed. Next: qasyn connect --name <machine> --token <token>" -ForegroundColor Green
Write-Host ""
`;
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return new NextResponse(buildScript(origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
