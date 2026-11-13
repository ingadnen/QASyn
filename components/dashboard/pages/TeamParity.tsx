"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CqaIcon, Modal, cqaBtnPrimary, cqaBtnSecondary, cqaInput, cqaLabel, useAction } from "@/components/dashboard/ui";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ROLES = ["Admin", "Founder", "Eng manager", "Engineer", "QA", "BA / FA"] as const;

export function InviteUserButton({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesOpen, setRolesOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    const res = await run("invite", "/api/dashboard/team", { json: { name, email, phone, roles, role: roles[0] } });
    if (res) {
      setName("");
      setEmail("");
      setPhone("");
      setRoles([]);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className={cqaBtnPrimary} disabled={readOnly} onClick={() => setOpen(true)}>
        <CqaIcon name="person_add" className="text-[17px]" /> Invite user
      </button>
      <Modal
        open={open}
        onClose={() => {
          setError(null);
          setOpen(false);
        }}
        title="Create User"
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="invite-form" className={cqaBtnPrimary} disabled={readOnly || pending === "invite"}>
              {pending === "invite" ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="invite-form" onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className={cqaLabel}>Name *</span>
            <input className={cqaInput} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Cooper" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Email *</span>
            <input className={cqaInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jane@company.com" />
          </label>
          <label className="block">
            <span className={cqaLabel}>Phone Number</span>
            <input className={cqaInput} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 0100" />
          </label>
          <div>
            <span className={cqaLabel}>Roles *</span>
            <div className="relative">
              <button
                type="button"
                aria-expanded={rolesOpen}
                onClick={() => setRolesOpen((v) => !v)}
                className={cn(cqaInput, "flex items-center justify-between text-left", roles.length === 0 && "text-[#9ca3af]")}
              >
                <span className="truncate">{roles.length ? roles.join(", ") : "Select Roles"}</span>
                <CqaIcon name={rolesOpen ? "expand_less" : "expand_more"} className="text-[18px]" />
              </button>
              {rolesOpen && (
                <div className="absolute z-40 mt-1 w-full rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
                      <input
                        type="checkbox"
                        checked={roles.includes(r)}
                        onChange={(e) => setRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))}
                        className="size-3.5 accent-[#5b4ee8]"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-[#9ca3af]">Select one or more roles for the user</p>
          </div>
          {error && <p role="alert" className="text-[12px] text-red-600">{error}</p>}
        </form>
      </Modal>
    </>
  );
}

export function MemberActions({ memberId, memberName, role, invited, inviteToken, readOnly }: { memberId: string; memberName: string; role: string; invited: boolean; inviteToken?: string; readOnly: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [nextRole, setNextRole] = useState(role);

  async function copyInvite() {
    if (!inviteToken) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteToken}`);
      toast("Invite link copied.", "success");
      setOpen(false);
    } catch {
      toast("The invite link could not be copied. Use the Resend invite action.", "error");
    }
  }

  async function resendInvite() {
    const result = await run(`resend-${memberId}`, `/api/dashboard/team/${memberId}/resend`, { method: "POST" });
    if (result) {
      toast("Invitation re-sent and the invite link is refreshed.", "success");
      setOpen(false);
      router.refresh();
    }
  }

  async function changeRole() {
    await run(`role-${memberId}`, `/api/dashboard/team/${memberId}`, { method: "PATCH", json: { role: nextRole } });
    setRoleOpen(false);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Revoke ${memberName}'s invitation?`)) return;
    await run(`del-${memberId}`, `/api/dashboard/team/${memberId}`, { method: "DELETE" });
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex size-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6]">
        <CqaIcon name="more_horiz" className="text-[20px]" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          <button type="button" disabled={readOnly} onClick={() => setRoleOpen(true)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
            <CqaIcon name="manage_accounts" className="text-[17px]" /> Change role
          </button>
          {invited && inviteToken && (
            <button type="button" data-testid={`copy-invite-${memberId}`} onClick={() => void copyInvite()} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb]">
              <CqaIcon name="link" className="text-[17px]" /> Copy invite link
            </button>
          )}
          <button type="button" disabled={readOnly || !invited || pending === `resend-${memberId}`} onClick={() => void resendInvite()} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50">
            <CqaIcon name="forward_to_inbox" className="text-[17px]" /> Resend invite
          </button>
          <button type="button" disabled={readOnly || !invited || pending === `del-${memberId}`} onClick={remove} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50">
            <CqaIcon name="person_remove" className="text-[17px]" /> Remove user
          </button>
        </div>
      )}
      <Modal
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        title={`Change role · ${memberName}`}
        footer={
          <>
            <button type="button" className={cqaBtnSecondary} onClick={() => setRoleOpen(false)}>Cancel</button>
            <button type="button" className={cqaBtnPrimary} disabled={pending === `role-${memberId}`} onClick={changeRole}>
              {pending === `role-${memberId}` ? "Saving…" : "Save role"}
            </button>
          </>
        }
      >
        <label className="block">
          <span className={cqaLabel}>Role</span>
          <select className={cqaInput} value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      </Modal>
    </div>
  );
}
