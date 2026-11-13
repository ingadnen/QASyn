"use client";

import { useEffect, useState } from "react";
import { cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel } from "@/components/dashboard/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { toast } from "@/lib/toast";

interface CustomSkill {
  id: string;
  name: string;
  trigger: string;
  systemPrompt: string;
  model: string;
  enabled: boolean;
}

const EMPTY = { name: "", trigger: "", systemPrompt: "", model: "QASyn Vision AI", enabled: true };

export function CustomSkillsPanel({ readOnly }: { readOnly: boolean }) {
  const [skills, setSkills] = useState<CustomSkill[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ skills: CustomSkill[] }>("/api/dashboard/custom-skills").then((result) => setSkills(result.skills)).catch((caught) => setError(errorMessage(caught)));
  }, []);

  async function save() {
    setPending(true);
    setError(null);
    try {
      if (editing) {
        const result = await apiFetch<{ skill: CustomSkill }>("/api/dashboard/custom-skills", { method: "PATCH", json: { ...form, id: editing } });
        setSkills((current) => current.map((skill) => (skill.id === editing ? result.skill : skill)));
        toast("Custom skill updated.", "success");
      } else {
        const result = await apiFetch<{ skill: CustomSkill }>("/api/dashboard/custom-skills", { method: "POST", json: form });
        setSkills((current) => [...current, result.skill]);
        toast("Custom skill created.", "success");
      }
      setEditing(null);
      setForm(EMPTY);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    try {
      await apiFetch("/api/dashboard/custom-skills", { method: "DELETE", json: { id } });
      setSkills((current) => current.filter((skill) => skill.id !== id));
      toast("Custom skill removed.", "info");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 px-5 py-4" data-testid="custom-skills-panel">
      <p className="text-[12px] leading-5 text-[#6b7280]">Create autonomous agents and reusable skills with a trigger, Markdown system prompt and assigned AI model.</p>
      {skills.length > 0 && (
        <ul className="divide-y divide-[#f0f1f3] rounded-lg border border-[#e5e7eb]">
          {skills.map((skill) => (
            <li key={skill.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]">
              <span className={skill.enabled ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-slate-300"} />
              <span className="font-semibold text-[#111827]">{skill.name}</span>
              <span className="truncate text-[#6b7280]">{skill.trigger || "manual trigger"} · {skill.model}</span>
              <button type="button" disabled={readOnly || pending} onClick={() => { setEditing(skill.id); setForm({ name: skill.name, trigger: skill.trigger, systemPrompt: skill.systemPrompt, model: skill.model, enabled: skill.enabled }); }} className="ml-auto text-[11px] font-semibold text-[#5b4ee8] hover:underline">Edit</button>
              <button type="button" disabled={readOnly || pending} onClick={() => void remove(skill.id)} className="text-[11px] font-semibold text-[#b42318] hover:underline">Delete</button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className={cqaLabel}>Skill / agent name</span><input className={cqaInput} value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Checkout recovery agent" /></label>
        <label className="block"><span className={cqaLabel}>Trigger</span><input className={cqaInput} value={form.trigger} onChange={(e) => setForm((prev) => ({ ...prev, trigger: e.target.value }))} placeholder="When a checkout test fails" /></label>
        <label className="block sm:col-span-2"><span className={cqaLabel}>System prompt / Markdown rules</span><textarea className={cqaInput} rows={4} value={form.systemPrompt} onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))} placeholder="You are the QASyn checkout recovery agent. Inspect the DOM, re-ground the payment button, run the failing step..." /></label>
        <label className="block"><span className={cqaLabel}>Assigned model</span><input className={cqaInput} value={form.model} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} placeholder="QASyn Vision AI" /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="custom-skill-save" className={cqaBtnPrimary} disabled={readOnly || pending || !form.name.trim() || form.systemPrompt.trim().length < 10} onClick={() => void save()}>{editing ? "Save skill" : "Create skill"}</button>
        {editing && <button type="button" className={cqaBtnSecondary} onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancel</button>}
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
