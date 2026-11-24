/* QASyn popup logic: pairing (cqa_ token), recorder toggling, AI test generation. */

const $ = (id) => document.getElementById(id);

async function sendMessage(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tab.id, message);
}

async function paired() {
  const { token, server } = await chrome.storage.local.get(["token", "server"]);
  return Boolean(token) && Boolean(server);
}

async function renderState() {
  const isPaired = await paired();
  $("pair-section").hidden = isPaired;
  $("actions-section").hidden = !isPaired;
  if (!isPaired) return;
  const { unread } = await chrome.storage.local.get("unread");
  const badge = $("badge");
  if (unread > 0) {
    badge.textContent = String(unread);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
  const { recording } = await chrome.storage.local.get("recording");
  $("toggle-record").textContent = recording ? "■ Stop recording & save" : "● Start recording";
}

$("save-pair").addEventListener("click", async () => {
  const server = ($("server").value || "https://qasyn.com").replace(/\/+$/, "");
  const token = $("token").value.trim();
  try {
    const response = await fetch(`${server}/api/dashboard/api-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ verify: true }),
    });
    if (!response.ok) throw new Error(`QASyn rejected the token (${response.status})`);
    await chrome.storage.local.set({ server, token });
    chrome.runtime.sendMessage({ type: "refresh-badge" });
    $("pair-state").textContent = "Connected ✓";
    await renderState();
  } catch (error) {
    $("pair-state").textContent = error.message;
  }
});

$("toggle-record").addEventListener("click", async () => {
  const { recording } = await chrome.storage.local.get("recording");
  try {
    if (!recording) {
      await sendMessage({ type: "start-recording" });
      await chrome.storage.local.set({ recording: true });
      $("record-state").textContent = "Recording clicks, inputs and navigations…";
    } else {
      const result = await sendMessage({ type: "stop-recording" });
      await chrome.storage.local.set({ recording: false });
      $("record-state").textContent = "Saving to QASyn…";
      const response = await chrome.runtime.sendMessage({
        type: "session-recording-stopped",
        steps: result.steps,
        url: result.url,
        title: result.title,
      });
      if (!response.ok) throw new Error(response.error);
      $("record-state").textContent = `Saved ${result.steps.length} step(s) to QASyn ✓`;
    }
    await renderState();
  } catch (error) {
    $("record-state").textContent = error.message;
  }
});

$("generate-ai").addEventListener("click", async () => {
  try {
    const summary = await sendMessage({ type: "page-summary" });
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    const response = await chrome.runtime.sendMessage({
      type: "generate-test-from-page",
      url: summary.url,
      domSummary: summary.domSummary,
      screenshot,
    });
    if (!response.ok) throw new Error(response.error);
    $("record-state").textContent = "AI test case saved to your project ✓";
  } catch (error) {
    $("record-state").textContent = error.message;
  }
});

$("open-workspace").addEventListener("click", async () => {
  const { server } = await chrome.storage.local.get("server");
  chrome.tabs.create({ url: server || "https://qasyn.com" });
});

chrome.runtime.sendMessage({ type: "refresh-badge" });
renderState();
