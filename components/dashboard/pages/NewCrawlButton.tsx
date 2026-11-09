"use client";

import { useState } from "react";
import { CrawlForm } from "@/components/dashboard/pages/Forms";
import { cqaBtnPrimary, CqaIcon, Modal } from "@/components/dashboard/ui";

export function NewCrawlButton({ defaultUrl, readOnly }: { defaultUrl: string; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cqaBtnPrimary}>
        <CqaIcon name="add" className="text-[17px]" />
        New Crawl
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Crawl" size="lg">
        <CrawlForm defaultUrl={defaultUrl} readOnly={readOnly} onCancel={() => setOpen(false)} />
      </Modal>
    </>
  );
}
