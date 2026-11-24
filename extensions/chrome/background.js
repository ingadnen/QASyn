/* QASyn MV3 service worker: relays recorder steps, refreshes the notification
 * badge and syncs recorded sessions to the connected QASyn workspace. */

const DEFAULT_SERVER = "https://qasyn.com";
const BADGE_KEY = "qasyn_unread";

async function serverUrl() {
  const { server } = await chrome.storage.local.get("server");
  return (server || DEFAULT_SERVER).replace(/\/+$/, "");
}

async function token() {
  const { token } = await chrome.storage.local.get("token");
  return token || "";
}

async function authedFetch(path, options = {}) {
  const t = await token();
  if (!t) throw new Error("Not paired — save a cqa_ token in the QASyn popup first.");
  const response = await fetch((await serverUrl()) + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`QASyn API ${response.status} for ${path}`);
  return response.json();
}

async function refreshBadge() {
  try {
    const data = await authedFetch("/api/dashboard/notifications?unread=1");
    const unread = Number(data.unread ?? (data.notifications || []).length ?? 0);
    await chrome.storage.local.set({ [BADGE_KEY]: unread });
    await chrome.action.setBadgeBackgroundColor({ color: "#0F6B5C" });
    await chrome.action.setBadgeText({ text: unread > 0 ? String(unread) : "" });
  } catch {
    await chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "session-recording-stopped") {
        const payload = { title: message.title || `Recorded ${new Date().toISOString()}`, steps: message.steps || [] };
        const result = await authedFetch("/api/dashboard/recorder", { method: "POST", body: JSON.stringify(payload) });
        sendResponse({ ok: true, result });
      } else if (message.type === "generate-test-from-page") {
        const payload = {
          url: message.url,
          domSummary: message.domSummary,
          screenshot: message.screenshot,
        };
        const result = await authedFetch("/api/dashboard/autopilot", { method: "POST", body: JSON.stringify(payload) });
        sendResponse({ ok: true, result });
      } else if (message.type === "refresh-badge") {
        await refreshBadge();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: "Unknown message" });
      }
    } catch (error) {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(refreshBadge);
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.alarms?.create("qasyn-badge", { periodInMinutes: 2 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === "qasyn-badge") refreshBadge();
});
