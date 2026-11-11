import { NextResponse } from "next/server";

/**
 * GET /install.ps1 — real Windows tunnel-agent installer.
 *
 * The script is generated per request so the embedded origin always matches
 * the host the user is actually browsing (localhost, staging or production).
 * It can also be pre-armed with ?name=<machine>&token=<token>: in that case
 * the generated script connects immediately, even if a caller/pipeline strips
 * the leading "--" from the CLI options.
 *
 * IMPORTANT: the installed function deliberately has NO [CmdletBinding()] and
 * NO param() block. PowerShell's advanced-function binder treats leading "--"
 * as an end-of-parameters marker, which used to drop --name/--token and fall
 * through to "Usage:". A simple function receives the raw tokens in $args.
 */
export const dynamic = "force-dynamic";

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function machineFallback(): string {
  return "$env:COMPUTERNAME";
}

function buildScript(origin: string, defaultName: string, defaultToken: string): string {
  return `# QASyn Tunnel Agent - Windows installer
# Origin: ${origin}
# Usage:  irm ${origin}/install.ps1 | iex
#         qasyn connect --name <machine> --token <token>
# Or pre-armed: irm "${origin}/install.ps1?name=<machine>&token=<token>" | iex

$ErrorActionPreference = "Continue"
$global:QASynOrigin = ${psQuote(origin)}
$global:QASynOs = "Windows"
$global:QASynDefaultName = ${psQuote(defaultName)}
$global:QASynDefaultToken = ${psQuote(defaultToken)}

Write-Host ""
Write-Host "  QASyn Tunnel Agent" -ForegroundColor Magenta
Write-Host "  Origin: $global:QASynOrigin" -ForegroundColor DarkGray
Write-Host ""

function global:qasyn {
    # No param() block on purpose: raw tokens (including --name / --token) land in $args.
    $all = @()
    foreach ($entry in $args) { $all += [string]$entry }

    $command = ""
    $name = ""
    $token = ""
    $i = 0

    while ($i -lt $all.Count) {
        $raw = [string]$all[$i]
        $lower = $raw.ToLowerInvariant()

        if ($lower -eq "connect" -or $lower -eq "status" -or $lower -eq "doctor" -or $lower -eq "uninstall") {
            if ([string]::IsNullOrEmpty($command)) { $command = $lower }
            $i += 1
            continue
        }

        # Tokens are self-identifying: accept them even without an option name.
        if ($raw -match '^(cqa_tun_|tnl_)') {
            if ([string]::IsNullOrEmpty($token)) { $token = $raw }
            $i += 1
            continue
        }

        # key=value form: --name=x, name=x, --token=x.
        if ($raw -match '^[-]*(name|n|token|t)=(.*)$') {
            $key = $Matches[1].ToLowerInvariant()
            $value = $Matches[2]
            if ($key -eq "name" -or $key -eq "n") { $name = $value } else { $token = $value }
            $i += 1
            continue
        }

        # Strip any run of leading dashes. Covers --name, -name and the case
        # where PowerShell already consumed one of the two dashes.
        $key = $lower.TrimStart('-')
        if ($key -eq "name" -or $key -eq "n") {
            if (($i + 1) -lt $all.Count) {
                $name = [string]$all[$i + 1]
                $i += 2
            } else {
                $i += 1
            }
            continue
        }
        if ($key -eq "token" -or $key -eq "t") {
            if (($i + 1) -lt $all.Count) {
                $token = [string]$all[$i + 1]
                $i += 2
            } else {
                $i += 1
            }
            continue
        }

        # A bare positional value after connect is the machine name.
        if ([string]::IsNullOrEmpty($name) -and -not $raw.StartsWith("-")) {
            $name = $raw
        }
        $i += 1
    }

    if ([string]::IsNullOrEmpty($command) -and -not [string]::IsNullOrEmpty($token)) {
        $command = "connect"
    }

    switch ($command) {
        "connect" {
            if ([string]::IsNullOrWhiteSpace($name)) { $name = $global:QASynDefaultName }
            if ([string]::IsNullOrWhiteSpace($token)) { $token = $global:QASynDefaultToken }
            if ([string]::IsNullOrWhiteSpace($name)) {
                $fallback = ${machineFallback()}
                if (-not [string]::IsNullOrWhiteSpace($fallback)) {
                    $name = $fallback.ToLowerInvariant() -replace '[^a-z0-9-]', '-'
                    $name = ($name -replace '-+', '-').Trim('-')
                    if ($name -notmatch '^[a-z]') { $name = "qa-$name" }
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
                Write-Host ("Connected: " + $name + " -> " + $global:QASynOrigin) -ForegroundColor Green
                Write-Host "  This machine now shows as Connected in Tunnels." -ForegroundColor DarkGray
                Write-Host ""
            } catch {
                Write-Host ("Connect failed: " + $_.Exception.Message) -ForegroundColor Red
                Write-Host "  Create a new command in Tunnels and retry with a fresh token." -ForegroundColor DarkGray
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
                Invoke-RestMethod -Uri "$global:QASynOrigin/api/health" -Method Get -TimeoutSec 10 | Out-Null
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

if (-not [string]::IsNullOrWhiteSpace($global:QASynDefaultToken)) {
    Write-Host "  Token detected in install URL - connecting automatically..." -ForegroundColor DarkGray
    qasyn connect
} else {
    Write-Host "Installed. Next: qasyn connect --name <machine> --token <token>" -ForegroundColor Green
    Write-Host ""
}
`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const name = (url.searchParams.get("name") ?? "").trim().toLowerCase();
  const token = (url.searchParams.get("token") ?? "").trim();
  return new NextResponse(buildScript(origin, name, token), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
