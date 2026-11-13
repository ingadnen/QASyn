"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CqaIcon } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  icon?: string;
  href?: string;
  onSelect?: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
}

const MENU_WIDTH = 208;
const VIEWPORT_GAP = 8;

/**
 * Row action menu rendered in a body-level portal so table wrappers with
 * overflow (horizontal scrolling, rounded cards) can never clip it.
 *
 * Position is computed from the trigger's viewport rect, flips upwards when
 * there is not enough room below, and stays fixed while the page scrolls
 * (scroll closes the menu, matching the live product).
 */
export function RowMenu({
  items,
  align = "right",
  label = "More actions",
  triggerLabel,
  triggerIcon = "expand_more",
  triggerClassName,
}: {
  items: RowMenuItem[];
  align?: "left" | "right";
  label?: string;
  /** Optional visible label; when set the trigger renders as a bordered "More ▾" button. */
  triggerLabel?: string;
  triggerIcon?: string;
  triggerClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 37 + 10;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + VIEWPORT_GAP;
    const rawLeft = align === "right" ? rect.right - MENU_WIDTH : rect.left;
    const left = Math.max(VIEWPORT_GAP, Math.min(rawLeft, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP));
    const top = openUp
      ? Math.max(VIEWPORT_GAP, rect.top - menuHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - VIEWPORT_GAP);
    setPosition({ top, left, maxHeight: window.innerHeight - VIEWPORT_GAP * 2 });
  }, [align, items.length]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
    const frame = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(frame);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onClose = () => {
      // Ignore scroll/resize jitter fired by the programmatic scroll that
      // brought the trigger into view: without this guard the menu can open and
      // immediately close under Playwright (and on trackpads).
      if (Date.now() - openedAtRef.current < 250) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("touchstart", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("touchstart", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [open]);

  function choose(item: RowMenuItem) {
    if (item.disabled) return;
    setOpen(false);
    if (item.onSelect) void item.onSelect();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          openedAtRef.current = Date.now();
          setOpen((value) => !value);
        }}
        className={cn(
          triggerLabel
            ? "inline-flex h-9 items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
            : "flex size-8 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#111827]",
          triggerClassName,
        )}
      >
        {triggerLabel ? (
          <>
            {triggerLabel} <CqaIcon name={triggerIcon} className="text-[16px]" />
          </>
        ) : (
          <CqaIcon name="more_horiz" className="text-[20px]" />
        )}
      </button>
      {mounted && open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-row-menu=""
          style={{
            position: "fixed",
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            width: MENU_WIDTH,
            maxHeight: position?.maxHeight,
            overflowY: "auto",
            visibility: position ? "visible" : "hidden",
            zIndex: 9999,
          }}
          className="rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-[0_16px_40px_rgba(15,23,42,0.18)]"
        >
          {items.map((item) => {
            const classes = cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition",
              item.danger ? "text-[#dc2626] hover:bg-[#fef2f2]" : "text-[#374151] hover:bg-[#f9fafb]",
              item.disabled && "cursor-not-allowed opacity-40",
            );
            const content = (
              <>
                {item.icon && <CqaIcon name={item.icon} className="text-[17px]" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </>
            );
            return item.href && !item.disabled ? (
              <Link key={item.label} href={item.href} role="menuitem" className={classes} onClick={() => setOpen(false)}>
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => choose(item)}
                className={classes}
              >
                {content}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
