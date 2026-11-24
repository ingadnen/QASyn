import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Downloads — QASyn",
  description: "Get the QASyn Chrome extension and the Windows desktop agents (x64 & x86).",
};

const DOWNLOADS = [
  {
    name: "QASyn Chrome Extension",
    file: "/downloads/qasyn-chrome-extension.zip",
    kind: "Chrome MV3",
    description:
      "One-click live step recorder, AI test generation from any page, cqa_ token pairing and live notification badges.",
    steps: ["Unzip, then open chrome://extensions", "Enable Developer mode → Load unpacked", "Pick the unzipped folder", "Click the QASyn icon and pair with your cqa_ token"],
  },
  {
    name: "QASyn Agent — Windows x64",
    file: "/downloads/qasyn-agent-win-x64.zip",
    kind: "Windows 10/11 · 64-bit",
    description: "Desktop runner: pairs your workspace with local browsers over an outbound-only tnl_ tunnel.",
    steps: ["Unzip and run qasyn-agent-win-x64.exe", "Run: qasyn-agent connect cqa_… https://qasyn.com", "Run: qasyn-agent run --suite <id>"],
  },
  {
    name: "QASyn Agent — Windows x86",
    file: "/downloads/qasyn-agent-win-x86.zip",
    kind: "Windows 10/11 · 32-bit",
    description: "Same agent for 32-bit Windows installs.",
    steps: ["Unzip and run qasyn-agent-win-x86.exe", "Run: qasyn-agent connect cqa_… https://qasyn.com"],
  },
];

export default function DownloadsPage() {
  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-[#15151c]">
          Downloads
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] text-[#6f7280]">
          Extend QASyn beyond the browser tab: record steps anywhere with the Chrome extension, or run suites on
          Windows machines with the desktop agent. Every artifact ships with a SHA-256 checksum.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {DOWNLOADS.map((item) => (
            <section
              key={item.file}
              data-testid="download-card"
              className="flex flex-col rounded-[10px] border border-[#e8e8ef] bg-white p-5"
            >
              <span className="inline-flex w-fit rounded-full bg-[#f0fdf9] px-2.5 py-0.5 text-[11px] font-medium text-[#0F6B5C]">
                {item.kind}
              </span>
              <h2 className="mt-3 text-[17px] font-semibold text-[#15151c]">{item.name}</h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#6f7280]">{item.description}</p>
              <ol className="mt-4 list-decimal space-y-1 pl-4 text-[12px] text-[#6f7280]">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <a
                href={item.file}
                download
                data-testid="download-link"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[#3D2EE0] px-4 text-[13px] font-medium text-white transition hover:bg-[#5B4EE8]"
              >
                Download
              </a>
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-[10px] border border-[#e8e8ef] bg-[#fafafa] p-5">
          <h2 className="text-[15px] font-semibold text-[#15151c]">Checksums (SHA-256)</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0e1218] p-4 text-[12px] leading-relaxed text-[#86dda8]">
{`cd96a4a40b2211e07baa3642fdd57eaf8786a2da3fc1b860d60eff4e160a3c46  qasyn-chrome-extension.zip
b910ff2ab8f51514d9af6ce02316edaa6a6a6c935a5081657578f76919f56e0a  qasyn-agent-win-x64.zip
3c4da9602c86dae2d9f602054a9db69e1465624856e13fb6150da151c3d2268c  qasyn-agent-win-x86.zip`}
          </pre>
          <p className="mt-3 text-[12px] text-[#6f7280]">
            Verify with <code className="rounded bg-[#e4e4e7] px-1 text-[#1f2937]">sha256sum -c SHA256SUMS.txt</code>{" "}
            (or <code className="rounded bg-[#e4e4e7] px-1 text-[#1f2937]">Get-FileHash</code> on Windows). Canonical
            list:{" "}
            <a className="font-medium text-[#3D2EE0] underline" href="/downloads/SHA256SUMS.txt">
              /downloads/SHA256SUMS.txt
            </a>
            .
          </p>
        </section>
      </main>
    </>
  );
}
