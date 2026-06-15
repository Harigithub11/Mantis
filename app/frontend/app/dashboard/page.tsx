"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { assetUrl, getAnalytics } from "@/lib/api";
import type { Analytics } from "@/lib/types";

function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

const ICONS: Record<string, React.ReactNode> = {
  box: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>),
  chat: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>),
  check: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>),
  file: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>),
};

function MetricCard({ icon, value, label, sub }: { icon: React.ReactNode; value: string | number; label: string; sub: string }) {
  return (
    <div className="rounded-[15px] border border-[#eef1f6] bg-white p-5 shadow-[0px_4px_6px_rgba(0,0,0,0.03)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f8f9fc]">{icon}</span>
      <div className="mt-3 text-[30px] font-bold leading-tight text-[#0a1628]" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {value}
      </div>
      <div className="text-[13px] font-medium text-[#64748b]">{label}</div>
      <div className="mt-0.5 text-[12px] text-[#94a3b8]">{sub}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalytics().then(setA).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!a) return <p className="text-gray-400">Loading…</p>;

  const concern = a.top_concern
    ? a.top_concern.length > 24
      ? a.top_concern.slice(0, 24) + "…"
      : a.top_concern
    : "diagnostic chats";

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={ICONS.box} value={a.products_count} label="Products" sub={`${a.active_products} active`} />
        <MetricCard icon={ICONS.chat} value={a.total_sessions.toLocaleString()} label="Total Sessions" sub={`top: ${concern}`} />
        <MetricCard icon={ICONS.check} value={pct(a.resolution_rate)} label="Resolution Rate" sub={`${a.feedback_count} ratings`} />
        <MetricCard icon={ICONS.file} value={a.indexed_chunks} label="Documents Indexed" sub={`${a.docs_total} manuals`} />
      </div>

      <div className="mt-6 overflow-hidden rounded-[15px] border border-[#eef1f6] bg-white shadow-[0px_4px_15px_rgba(0,0,0,0.02)]">
        <h2 className="border-b border-[#e2e8f0] px-6 py-5 text-[18px] font-bold text-[#0a1628]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Most Diagnosed Products
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f8f9fc] text-left text-[11px] uppercase tracking-wide text-[#64748b]">
              <th className="px-6 py-3 font-bold">Product Name</th>
              <th className="px-6 py-3 font-bold">Documents</th>
              <th className="px-6 py-3 font-bold">Sessions</th>
              <th className="px-6 py-3 font-bold">Insights</th>
            </tr>
          </thead>
          <tbody>
            {a.products.map((p) => (
              <tr key={p.id} className="border-b border-[#e2e8f0] last:border-0">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-[38px] w-[38px] overflow-hidden rounded-[8px] bg-gray-100">
                      {p.image_path && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetUrl(p.image_path)} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <span className="font-semibold text-[#0a1628]">{p.name}</span>
                  </div>
                </td>
                <td className="px-6 py-3.5 text-[#64748b]">{p.doc_count} files</td>
                <td className="px-6 py-3.5 text-[#64748b]">{p.session_count}</td>
                <td className="px-6 py-3.5">
                  <Link href={`/dashboard/products/${p.id}/insights`} className="font-medium text-[#64748b] hover:text-[#0a1628]">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.products.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No products yet.</p>}
      </div>
    </>
  );
}
