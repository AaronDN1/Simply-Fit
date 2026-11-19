"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { markAdminReturn } from "@/lib/impersonation";

export function ImpersonationBar() {
  const { user, endImpersonation } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const label = user?.name?.trim() || user?.email || "this account";

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between gap-3 border-b border-iron-line bg-iron px-4 text-chalk">
      <p className="min-w-0 truncate text-[13px]">
        Viewing as <span className="font-medium">{label}</span>
        {user?.email ? <span className="text-chalk-dim"> · {user.email}</span> : null}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            markAdminReturn();
            await endImpersonation();
            router.replace("/admin");
          } finally {
            setBusy(false);
          }
        }}
        className="shrink-0 rounded-full bg-chalk px-3 py-1.5 text-[13px] font-medium text-iron disabled:opacity-60"
      >
        {busy ? "Ending…" : "End impersonation"}
      </button>
    </div>
  );
}
