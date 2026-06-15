"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAiInsights, getInsights, getProduct } from "@/lib/api";
import type { Product, ProductInsights } from "@/lib/types";

function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

const ICONS: Record<string, React.ReactNode> = {
  check: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>),
  chat: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>),
  file: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>),
};

const AlertTri = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFA33C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
);

function MetricCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex-1 rounded-[14px] border border-[#eef1f6] bg-white p-5 shadow-[0px_4px_7.5px_rgba(0,0,0,0.05)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#f8f9fc]">{icon}</span>
      <div className="mt-3 text-[28px] font-bold leading-tight text-[#0a1628]" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {value}
      </div>
      <div className="text-[12px] font-medium text-[#64748b]">{label}</div>
    </div>
  );
}

export default function ProductInsightsPage() {
  const params = useParams();
  const id = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [insights, setInsights] = useState<ProductInsights | null>(null);
  const [ai, setAi] = useState<{ behaviour_trends: string; growth_suggestion: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getProduct(id).then(setProduct).catch(() => {});
    getInsights(id).then(setInsights).catch(() => {});
    getAiInsights(id)
      .then((r) => setAi({ behaviour_trends: r.behaviour_trends, growth_suggestion: r.growth_suggestion }))
      .catch(() => setAi({ behaviour_trends: "", growth_suggestion: "" }))
      .finally(() => setAiLoading(false));
  }, [id]);

  const issues = insights?.top_issues ?? [];

  return (
    <div>
      <Link href="/dashboard/products" className="text-sm text-[#64748b] hover:text-[#0a1628]">
        ← Products
      </Link>

      {/* Product header */}
      <div className="mt-3 rounded-t-[15px] border border-[#eef1f6] bg-white px-6 py-4 shadow-[0px_4px_16px_rgba(0,0,0,0.02)]">
        <h2 className="text-[18px] font-bold text-[#0a1628]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {product?.name ?? "…"}
        </h2>
      </div>

      {/* Metric cards */}
      <div className="mt-5 flex flex-col gap-4 sm:flex-row">
        <MetricCard icon={ICONS.check} value={pct(insights?.resolution_rate ?? null)} label="Resolution Rate" />
        <MetricCard icon={ICONS.chat} value={(insights?.session_count ?? 0).toLocaleString()} label="Total Sessions" />
        <MetricCard icon={ICONS.file} value={insights?.indexed_chunks ?? 0} label="Documents Indexed" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Common issues */}
        <div>
          <h3 className="mb-3 text-base font-bold uppercase tracking-wide text-[#64748b]">Common Issues</h3>
          {issues.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-5 text-sm text-[#94a3b8] shadow-[0px_4px_8px_rgba(0,0,0,0.04)]">
              No diagnostic history yet.
            </p>
          ) : (
            <div className="space-y-3">
              {issues.map((iss, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[12px] bg-white p-4 shadow-[0px_4px_8px_rgba(0,0,0,0.04)]">
                  {AlertTri}
                  <p className="flex-1 text-sm font-semibold text-[#111827]">{iss.label}</p>
                  <p className="whitespace-nowrap text-[13px] text-[#64748b]">
                    {iss.count} session{iss.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI insights */}
        <div>
          <h3 className="mb-3 text-base font-bold uppercase tracking-wide text-[#64748b]">AI Insights</h3>
          {aiLoading ? (
            <p className="rounded-[15px] bg-white px-5 py-6 text-sm text-[#94a3b8] shadow-[0px_4px_16px_rgba(0,0,0,0.05)]">
              Analyzing diagnostic patterns…
            </p>
          ) : !ai?.behaviour_trends && !ai?.growth_suggestion ? (
            <p className="rounded-[15px] bg-white px-5 py-6 text-sm text-[#94a3b8] shadow-[0px_4px_16px_rgba(0,0,0,0.05)]">
              Not enough diagnostic data yet to generate insights.
            </p>
          ) : (
            <div className="space-y-4">
              {ai?.behaviour_trends && (
                <div className="rounded-[15px] bg-white p-5 shadow-[0px_4px_16px_rgba(0,0,0,0.05)]">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#dbeafe]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0069FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></svg>
                    </span>
                    <h4 className="text-sm font-semibold text-[#111827]">Behaviour Trends</h4>
                  </div>
                  <p className="text-sm leading-[1.6] text-[#64748b]">{ai.behaviour_trends}</p>
                </div>
              )}
              {ai?.growth_suggestion && (
                <div className="rounded-[15px] bg-white p-5 shadow-[0px_4px_16px_rgba(0,0,0,0.05)]">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#ccffd8]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ECB82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" /><circle cx="12" cy="12" r="3" /></svg>
                    </span>
                    <h4 className="text-sm font-semibold text-[#111827]">Growth Suggestion</h4>
                  </div>
                  <p className="text-sm leading-[1.6] text-[#64748b]">{ai.growth_suggestion}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
