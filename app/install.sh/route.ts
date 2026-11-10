import { NextResponse } from "next/server";

/**
 * GET /install.sh — real macOS/Linux tunnel-agent installer.
 *
 * Serves a POSIX shell script that installs a `qasyn` launcher in
 * ~/.local/bin and defines a `qasyn` shell function. The origin is generated
 * from the request so downloaded commands always point at this deployment.
 */
export const dynamic = "force-dynamic";

function buildScript(origin: string): string {
  return `#!/usr/bin/env bash
# QASyn Tunnel Agent - macOS / Linux installer
# Origin: ${origin}
# Usage:  curl -fsSL ${origin}/install.sh | bash
#         qasyn connect --name <machine> --token <token>

QASYN_ORIGIN="${origin}"
QASYN_BIN_DIR="$HOME/.local/bin"
QASYN_LAUNCHER="$QASYN_BIN_DIR/qasyn"

mkdir -p "$QASYN_BIN_DIR"

cat > "$QASYN_LAUNCHER.tmp" <<'QASYN_LAUNCHER_EOF'
#!/usr/bin/env bash
QASYN_ORIGIN="__QASYN_ORIGIN__"

command="$1"
if [ "$#" -gt 0 ]; then shift; fi

case "$command" in
  connect)
    name=""
    token=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --name)
          name="$2"
          shift 2
          ;;
        --token)
          token="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done

    if [ -z "$name" ] || [ -z "$token" ]; then
      printf 'Usage: qasyn connect --name <machine> --token <token>\\n'
      exit 1
    fi

    hostname="$(hostname 2>/dev/null || uname -n)"
    os_name="$(uname -s 2>/dev/null || echo Linux)"
    payload=$(printf '{"action":"connect","name":"%s","token":"%s","os":"%s","hostname":"%s"}' "$name" "$token" "$os_name" "$hostname")

    if curl -fsS -X POST "$QASYN_ORIGIN/api/onboarding/tunnel" -H "Content-Type: application/json" -d "$payload" >/dev/null; then
      printf "\\n✔ QASyn Tunnel Agent connected! Machine '%s' is now ONLINE on %s\\n\\n" "$name" "$QASYN_ORIGIN"
    else
      printf "✕ Could not connect the QASyn Tunnel Agent. Check the token and try again.\\n" >&2
      exit 1
    fi
    ;;
  status)
    printf "\\nQASyn Tunnel Agent\\n  Origin : %s\\n  Host   : %s\\n  Status : ready (qasyn connect --name <machine> --token <token>)\\n\\n" "$QASYN_ORIGIN" "$(hostname 2>/dev/null || uname -n)"
    ;;
  doctor)
    printf "\\nQASyn Tunnel Agent diagnostics\\n"
    printf "  [ok] Origin %s\\n" "$QASYN_ORIGIN"
    if curl -fsS "$QASYN_ORIGIN/api/health" >/dev/null 2>&1; then
      printf "  [ok] Reachability: origin answered\\n\\n"
    else
      printf "  [!!] Reachability: origin did not answer\\n\\n"
    fi
    ;;
  uninstall)
    rm -f "$QASYN_LAUNCHER"
    printf "QASyn Tunnel Agent removed. Delete the qasyn function in your shell profile if present.\\n"
    ;;
  *)
    printf "QASyn Tunnel Agent\\n"
    printf "  qasyn connect --name <machine> --token <token>   Connect this machine\\n"
    printf "  qasyn status                                     Show agent state\\n"
    printf "  qasyn doctor                                     Run diagnostics\\n"
    printf "  qasyn uninstall                                  Remove the agent\\n"
    ;;
esac
QASYN_LAUNCHER_EOF

sed "s|__QASYN_ORIGIN__|$QASYN_ORIGIN|g" "$QASYN_LAUNCHER.tmp" > "$QASYN_LAUNCHER"
rm -f "$QASYN_LAUNCHER.tmp"
chmod +x "$QASYN_LAUNCHER"

qasyn() {
  "$QASYN_LAUNCHER" "$@"
}

export -f qasyn 2>/dev/null || true

case ":$PATH:" in
  *":$QASYN_BIN_DIR:"*) ;;
  *)
    printf 'Note: add %s to your PATH to run qasyn from any shell.\\n' "$QASYN_BIN_DIR"
    ;;
esac

if [ "$#" -gt 0 ]; then
  qasyn "$@"
else
  printf '\\nInstalled. Next: qasyn connect --name <machine> --token <token>\\n\\n'
fi
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
