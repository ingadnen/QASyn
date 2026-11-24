/* QASyn Windows agent launcher (single-file C, no CRT dependencies beyond
 * shell32/user32/wininet). Spawns the bundled Node runtime with the agent
 * CLI, shows a tray balloon on start, and opens the configured tunnel.
 * Compile: x86_64-w64-mingw32-gcc (PE32+) / i686-w64-mingw32-gcc (PE32). */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>

static void run_agent_command(const char *args) {
    char cmdline[MAX_PATH * 2];
    char exe[MAX_PATH];
    GetModuleFileNameA(NULL, exe, MAX_PATH);
    /* agent CLI sits next to the launcher: qasyn-agent\agent-cli.cmd */
    char *slash = strrchr(exe, '\\');
    if (slash) *slash = 0;
    _snprintf(cmdline, sizeof(cmdline),
              "cmd.exe /c \"\"%s\\qasyn-agent\\agent-cli.cmd\" %s\"", exe, args);
    STARTUPINFOA si = { 0 };
    PROCESS_INFORMATION pi = { 0 };
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    if (CreateProcessA(NULL, cmdline, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        WaitForSingleObject(pi.hProcess, 15000);
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
    }
}

int APIENTRY WinMain(HINSTANCE hInst, HINSTANCE prev, LPSTR cmd, int show) {
    (void)hInst; (void)prev; (void)cmd; (void)show;
    /* CLI mode: qasyn-agent-win-x64.exe connect|run|status */
    if (cmd && cmd[0] == '-') {
        run_agent_command(cmd + 1);
        return 0;
    }
    if (cmd && cmd[0]) {
        run_agent_command(cmd);
        return 0;
    }
    /* Tray mode: default action = status, then balloon. */
    run_agent_command("status");
    NOTIFYICONDATAA nid = { 0 };
    nid.cbSize = sizeof(nid);
    nid.uID = 1;
    nid.hWnd = NULL;
    lstrcpynA(nid.szInfo, "QASyn agent is running. Use 'qasyn-agent status' or the tray menu.", 128);
    lstrcpynA(nid.szInfoTitle, "QASyn Agent", 64);
    nid.dwInfoFlags = NIIF_INFO;
    Shell_NotifyIconA(NIM_ADD, &nid);
    Shell_NotifyIconA(NIM_MODIFY, &nid);
    return 0;
}
