import Link from "next/link";
import { CqaIcon, cqaBtnGhost, cqaBtnPrimary, cqaBtnSecondary, cqaCard } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export function Toolbar({
  searchPlaceholder = "Search",
  actions,
  children,
}: {
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <CqaIcon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#9ca3af]" />
        <input
          type="search"
          placeholder={searchPlaceholder}
          aria-label="Search"
          className="h-9 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#a9a1f7] focus:ring-2 focus:ring-[#e4e1fd]"
        />
      </div>
      {children}
      {actions}
    </div>
  );
}

export function ToolbarButton({ icon, children, className }: { icon?: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" className={cn(cqaBtnSecondary, className)}>
      {icon && <CqaIcon name={icon} className="text-[17px]" />}
      {children}
    </button>
  );
}

export function TableShell({
  headers,
  children,
  footer,
  className,
}: {
  headers: React.ReactNode[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(cqaCard, "overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f0f1f3] bg-white">
              {headers.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-4 py-3 text-[12px] font-medium text-[#6b7280]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#374151]">{children}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f3] px-4 py-2.5 text-[12px] text-[#6b7280]">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select aria-label="Rows per page" className="h-7 rounded border border-[#e5e7eb] bg-white px-1.5 text-[12px]" defaultValue="10">
            <option>10</option>
            <option>20</option>
            <option>50</option>
          </select>
        </div>
        {footer ?? <span className="tabular-nums">1–10 of 10</span>}
      </div>
    </div>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-[#f3f4f6] px-4 py-3 align-middle", className)}>{children}</td>;
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("bg-white transition hover:bg-[#fafafa]", className)}>{children}</tr>;
}

export function CqaTabs({
  tabs,
  active,
  className,
}: {
  tabs: Array<{ label: React.ReactNode; href?: string; value?: string }>;
  active: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-5 border-b border-[#e5e7eb]", className)} role="tablist">
      {tabs.map((t) => {
        const isActive = (t.value ?? (typeof t.label === "string" ? t.label : "")) === active;
        const inner = (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] transition",
              isActive ? "border-[#5b4ee8] font-medium text-[#5b4ee8]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {t.label}
          </span>
        );
        return t.href ? (
          <Link key={String(t.value ?? t.label)} href={t.href} role="tab" aria-selected={isActive}>
            {inner}
          </Link>
        ) : (
          <span key={String(t.value ?? t.label)} role="tab" aria-selected={isActive}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}

/** Menu that works without client JavaScript: native <details>. */
export function RowMenu({
  items,
  align = "right",
}: {
  items: Array<{ label: string; icon?: string; href?: string; danger?: boolean }>;
  align?: "left" | "right";
}) {
  return (
    <details className="relative inline-block">
      <summary
        aria-label="More actions"
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] [&::-webkit-details-marker]:hidden"
      >
        <CqaIcon name="more_horiz" className="text-[20px]" />
      </summary>
      <div
        className={cn(
          "absolute z-30 mt-1 w-52 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]",
          align === "right" ? "right-0" : "left-0",
        )}
        role="menu"
      >
        {items.map((item) => {
          const cls = cn(
            "flex items-center gap-2.5 px-3 py-2 text-[12.5px] hover:bg-[#f9fafb]",
            item.danger ? "text-[#dc2626]" : "text-[#374151]",
          );
          return item.href ? (
            <Link key={item.label} href={item.href} className={cls} role="menuitem">
              {item.icon && <CqaIcon name={item.icon} className="text-[17px]" />}
              {item.label}
            </Link>
          ) : (
            <button key={item.label} type="button" className={cn(cls, "w-full text-left")} role="menuitem">
              {item.icon && <CqaIcon name={item.icon} className="text-[17px]" />}
              {item.label}
            </button>
          );
        })}
      </div>
    </details>
  );
}

export function PageActions({ filter, primary }: { filter?: boolean; primary?: React.ReactNode }) {
  return (
    <>
      {filter && (
        <button type="button" className={cqaBtnSecondary}>
          <CqaIcon name="add" className="text-[16px]" /> Filter
        </button>
      )}
      <button type="button" aria-label="Refresh" className={cn(cqaBtnGhost, "size-9 border border-[#e5e7eb] bg-white p-0")}>
        <CqaIcon name="refresh" className="text-[18px]" />
      </button>
      <button type="button" aria-label="Table settings" className={cn(cqaBtnGhost, "size-9 border border-[#e5e7eb] bg-white p-0")}>
        <CqaIcon name="settings" className="text-[18px]" />
      </button>
      {primary}
    </>
  );
}

export function PrimaryLink({ href, icon = "add", children }: { href: string; icon?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cqaBtnPrimary}>
      <CqaIcon name={icon} className="text-[17px]" />
      {children}
    </Link>
  );
}

export function MetaRow({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#6b7280]">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-3">
          {i > 0 && <span className="text-[#d1d5db]">|</span>}
          {item}
        </span>
      ))}
    </div>
  );
}
