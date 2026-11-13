"use client";

import { useEffect, useState } from "react";
import { CqaIcon, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";

interface CustomModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  role: string;
  hasApiKey?: boolean;
}

const PROVIDERS = ["OpenAI", "Anthropic Claude", "Google Gemini", "DeepSeek", "Azure OpenAI", "Custom OpenAI-Compatible"];
const ROLES = ["Execution", "Grounding", "PR Review"];

export function CustomModelsPanel({ readOnly }: { readOnly: boolean }) {
  const [models, setModels] = useState<CustomModel[]>([]);
  const [form, setForm] = useState({ name: "", provider: PROVIDERS[0], modelId: "", apiKey: "", role: ROLES[0] });
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ models: CustomModel[] }>("/api/dashboard/ai-models").then((result) => setModels(result.models)).catch((caught) => setError(errorMessage(caught)));
  }, []);

  async function save() {
    setPending(true);
    setError(null);
    try {
      if (editing) {
        const result = await apiFetch<{ model: CustomModel }>("/api/dashboard/ai-models", { method: "PATCH", json: { ...form, id: editing } });
        setModels((current) => current.map((model) => (model.id === editing ? result.model : model)));
        toast("Custom AI model updated.", "success");
      } else {
        const result = await apiFetch<{ model: CustomModel }>("/api/dashboard/ai-models", { method: "POST", json: form });
        setModels((current) => [...current, result.model]);
        toast("Custom AI model added.", "success");
      }
      setEditing(null);
      setForm({ name: "", provider: PROVIDERS[0], modelId: "", apiKey: "", role: ROLES[0] });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    try {
      await apiFetch("/api/dashboard/ai-models", { method: "DELETE", json: { id } });
      setModels((current) => current.filter((model) => model.id !== id));
      toast("Custom AI model removed.", "info");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 rounded-[12px] border border-[#dbdee5] bg-white p-[25px] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]" data-testid="custom-models-panel">
      <h3 className="text-[18px] font-semibold text-[#262626]">Custom AI Models &amp; Providers</h3>
      <p className="mt-1 text-[13.5px] text-[#6b7280]">Bring your own OpenAI, Claude, Gemini, DeepSeek, Azure OpenAI or compatible endpoint. Assign each model to execution, grounding or PR review.</p>

      {models.length > 0 && (
        <ul className="mt-4 divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb]">
          {models.map((model) => (
            <li key={model.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12.5px]">
              <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#4f46e5]">{model.role}</span>
              <span className="font-semibold text-[#111827]">{model.name}</span>
              <span className="text-[#6b7280]">{model.provider} · {model.modelId}</span>
              <span className="ml-auto text-[10.5px] text-[#9ca3af]">{model.hasApiKey ? "key stored" : "workspace key"}</span>
              <button type="button" disabled={readOnly || pending} onClick={() => { setEditing(model.id); setForm({ name: model.name, provider: model.provider, modelId: model.modelId, apiKey: "", role: model.role }); }} className="text-[11px] font-semibold text-[#5b4ee8] hover:underline">Edit</button>
              <button type="button" disabled={readOnly || pending} onClick={() => void remove(model.id)} className="text-[11px] font-semibold text-[#b42318] hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block"><span className={cqaLabel}>Model name</span><input className={cqaInput} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Claude Sonnet · QA" /></label>
        <label className="block"><span className={cqaLabel}>Provider</span><select className={cqaInput} value={form.provider} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}>{PROVIDERS.map((provider) => <option key={provider}>{provider}</option>)}</select></label>
        <label className="block"><span className={cqaLabel}>Model ID</span><input className={cqaInput} value={form.modelId} onChange={(e) => setForm((prev) => ({ ...prev, modelId: e.target.value }))} placeholder="claude-sonnet-4" /></label>
        <label className="block"><span className={cqaLabel}>API key {editing && "(leave blank to keep)"}</span><input type="password" className={cqaInput} value={form.apiKey} onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="sk-…" autoComplete="new-password" /></label>
        <label className="block"><span className={cqaLabel}>Role</span><select className={cqaInput} value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
        <div className="flex items-end gap-2">
          <button type="button" data-testid="custom-model-save" className={cqaBtnPrimary} disabled={readOnly || pending || !form.name.trim() || !form.modelId.trim()} onClick={() => void save()}>
            <CqaIcon name={editing ? "save" : "add"} className="text-[16px]" /> {editing ? "Save model" : "Add model"}
          </button>
          {editing && <button type="button" className={cqaBtnSecondary} onClick={() => { setEditing(null); setForm({ name: "", provider: PROVIDERS[0], modelId: "", apiKey: "", role: ROLES[0] }); }}>Cancel</button>}
        </div>
      </div>
      {error && <p className="mt-3 text-[12.5px] text-red-600">{error}</p>}
    </div>
  );
}
