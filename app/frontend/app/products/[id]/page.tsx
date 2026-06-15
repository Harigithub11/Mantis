"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  API_BASE,
  addToInventory,
  assetUrl,
  getInsights,
  getProduct,
  getUserToken,
  listAlerts,
  listInventory,
  listResources,
  removeFromInventory,
} from "@/lib/api";
import type { Product, ProductAlert, ProductInsights, Resource } from "@/lib/types";

const ALERT_STYLES: Record<string, string> = {
  recall: "border-red-200 bg-red-50 text-red-800",
  safety: "border-amber-200 bg-amber-50 text-amber-800",
  warranty: "border-blue-200 bg-blue-50 text-blue-800",
  service: "border-gray-200 bg-gray-50 text-gray-700",
};

function StatBox({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl bg-[#f8fafc] p-5">
      <span className="text-[#FFA33C]">{icon}</span>
      <div>
        <div className="font-['Outfit'] text-lg font-bold text-[#111827]">{value}</div>
        <div className="text-xs text-[#64748b]">{label}</div>
      </div>
    </div>
  );
}

const IconDocs = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const IconActivity = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);
const IconCheck = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);
const IconAlert = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export default function ProductPage() {
  const params = useParams();
  const id = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const [insights, setInsights] = useState<ProductInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUser, setIsUser] = useState(false);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeImg, setActiveImg] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => {
        setProduct(p);
        setActiveImg(assetUrl(p.image_path));
      })
      .catch((e) => setError(e.message));
    listResources(id).then(setResources).catch(() => {});
    listAlerts(id).then(setAlerts).catch(() => {});
    getInsights(id).then(setInsights).catch(() => {});
    if (getUserToken()) {
      setIsUser(true);
      listInventory()
        .then((ps) => setOwned(ps.some((p) => p.id === id)))
        .catch(() => {});
    }
  }, [id]);

  async function toggleOwned() {
    setBusy(true);
    try {
      if (owned) {
        await removeFromInventory(id);
        setOwned(false);
      } else {
        await addToInventory(id);
        setOwned(true);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  if (error) return <main className="mx-auto max-w-6xl px-6 py-8 text-red-600">{error}</main>;
  if (!product) return <main className="mx-auto max-w-6xl px-6 py-8 text-gray-400">Loading…</main>;

  const img = assetUrl(product.image_path);
  const indexedDocs = insights?.indexed_docs ?? resources.filter((r) => r.indexed).length;
  const resolutionPct =
    insights?.resolution_rate != null ? `${Math.round(insights.resolution_rate * 100)}%` : "—";
  const sessions = insights?.session_count ?? 0;
  const topIssues = insights?.top_issues ?? [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/products" className="text-sm text-[#64748b] hover:text-[#111827]">
        ← All products
      </Link>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`rounded-xl border px-4 py-3 text-sm ${ALERT_STYLES[a.type] ?? ALERT_STYLES.service}`}>
              <span className="font-semibold">{a.type.toUpperCase()}: {a.title}</span>
              {a.body && <span className="ml-1">— {a.body}</span>}
              {a.date && <span className="ml-1 opacity-70">({a.date})</span>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* LEFT column: gallery, stats, common issues */}
        <div className="flex flex-col gap-8">
          {/* Gallery */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => img && setActiveImg(img)}
                  className={`h-[72px] w-[72px] overflow-hidden rounded-[10px] border bg-[#d9d9d9] ${
                    activeImg === img ? "border-[#FFA33C]" : "border-[#94a3b8]/40"
                  }`}
                >
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[10px] border border-[#94a3b8] bg-[#f8fafc]">
              {activeImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeImg} alt={product.name} className="h-full max-h-[460px] w-full object-cover" />
              ) : (
                <span className="py-32 text-6xl text-gray-300">📦</span>
              )}
            </div>
          </div>

          {/* Stat boxes */}
          <div className="flex gap-4">
            <StatBox icon={IconDocs} value={String(indexedDocs)} label="Indexed docs" />
            <StatBox icon={IconActivity} value={resolutionPct} label="Resolution rate" />
            <StatBox icon={IconCheck} value={indexedDocs > 0 ? "Verified" : "—"} label="Knowledge set" />
          </div>

          {/* Common issues */}
          <div>
            <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-[#64748b]">Common Issues</h2>
            {topIssues.length === 0 ? (
              <p className="rounded-xl bg-[#f8fafc] px-4 py-5 text-sm text-[#94a3b8]">
                No diagnostic history yet — be the first to run a diagnosis.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {topIssues.map((iss, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-[#f8fafc] p-4">
                    <span className="text-[#FFA33C]">{IconAlert}</span>
                    <p className="flex-1 text-sm font-semibold text-[#111827]">{iss.label}</p>
                    <p className="whitespace-nowrap text-[13px] text-[#64748b]">
                      {iss.count} session{iss.count === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT column: info + documentation */}
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-base font-bold uppercase tracking-wide text-[#64748b]">{product.company_name}</p>
              <h1 className="mt-2 font-['Outfit'] text-[40px] font-extrabold leading-tight text-[#0a1628]">
                {product.name}
              </h1>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-[#FACC15]">★★★★★</span>
                <span className="font-medium text-[#64748b]">
                  4.9 ({sessions} diagnostic session{sessions === 1 ? "" : "s"})
                </span>
              </div>
            </div>

            <p className="text-[18px] leading-[1.6] text-[#64748b]">{product.description}</p>

            <Link
              href={`/products/${product.id}/diagnose`}
              className="block rounded-[15px] bg-[#ffa33c] px-8 py-4 text-center text-base font-semibold text-white hover:bg-[#f5921e]"
            >
              Start Diagnosis
            </Link>

            {isUser ? (
              <button
                onClick={toggleOwned}
                disabled={busy}
                className={`block w-full rounded-[12px] border py-3 text-center text-sm font-medium transition-colors disabled:opacity-50 ${
                  owned
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {owned ? "✓ In my products — remove" : "+ Add to my products"}
              </button>
            ) : (
              <Link
                href="/login"
                className="block w-full rounded-[12px] border border-gray-300 py-3 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Sign in to track this product
              </Link>
            )}
          </div>

          {/* Documentation card */}
          <div className="rounded-[20px] border border-[#e2e8f0] bg-white p-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[#64748b]">Knowledge Base</p>
                <p className="text-2xl font-semibold text-[#111827]">Documentation</p>
              </div>
              {indexedDocs > 0 && (
                <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-xs font-bold text-[#111827]">
                  {indexedDocs} indexed
                </span>
              )}
            </div>

            {resources.length === 0 ? (
              <p className="mt-5 text-sm text-[#94a3b8]">No documents uploaded yet.</p>
            ) : (
              <div className="mt-2 flex flex-col">
                {resources.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 border-t border-[#e2e8f0] py-4 first:border-t-0">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold ${
                        r.type === "link" ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-[#fee2e2] text-[#991b1b]"
                      }`}
                    >
                      {r.type === "link" ? "↗" : "PDF"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111827]">{r.title}</p>
                      <p className="text-xs text-[#94a3b8]">
                        {r.type.toUpperCase()}
                        {r.indexed ? ` · ${r.chunk_count} chunks` : ""}
                      </p>
                    </div>
                    {r.file_path ? (
                      <a
                        href={`${API_BASE}/resources/${r.id}/download`}
                        className="text-[#64748b] hover:text-[#111827]"
                        aria-label={`Download ${r.title}`}
                        title="Download"
                      >
                        ⬇
                      </a>
                    ) : r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-[#64748b] hover:text-[#111827]" title="Open">
                        ↗
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
