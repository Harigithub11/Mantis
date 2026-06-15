"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { assetUrl, deleteProduct, getAnalytics } from "@/lib/api";
import type { ProductAnalytics } from "@/lib/types";

export default function DashboardProductsPage() {
  const [rows, setRows] = useState<ProductAnalytics[]>([]);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    getAnalytics()
      .then((a) => setRows([...a.products].sort((x, y) => x.id - y.id)))
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function remove(id: number) {
    if (!confirm("Delete this product?")) return;
    await deleteProduct(id);
    refresh();
  }

  return (
    <div className="overflow-hidden rounded-[15px] border border-[#eef1f6] bg-white shadow-[0px_4px_15px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-5">
        <h2 className="text-[18px] font-bold text-[#0a1628]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Your Products
        </h2>
        <Link
          href="/dashboard/new"
          className="rounded-full bg-[#FFA33C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#f5921e]"
        >
          + New listing
        </Link>
      </div>
      {error && <p className="px-6 py-3 text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#f8f9fc] text-left text-[11px] uppercase tracking-wide text-[#64748b]">
            <th className="px-6 py-3 font-bold">Product Name</th>
            <th className="px-6 py-3 font-bold">Documents</th>
            <th className="px-6 py-3 font-bold">Details</th>
            <th className="px-6 py-3 font-bold">Insights</th>
            <th className="px-6 py-3 text-right font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
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
              <td className="px-6 py-3.5">
                <Link href={`/dashboard/products/${p.id}`} className="font-medium text-[#64748b] hover:text-[#0a1628]">
                  Manage
                </Link>
              </td>
              <td className="px-6 py-3.5">
                <Link href={`/dashboard/products/${p.id}/insights`} className="font-medium text-[#64748b] hover:text-[#0a1628]">
                  View
                </Link>
              </td>
              <td className="px-6 py-3.5">
                <div className="flex items-center justify-end gap-3">
                  <Link href={`/products/${p.id}`} title="View public page" className="text-[#64748b] hover:text-[#0a1628]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </Link>
                  <button onClick={() => remove(p.id)} title="Delete" className="text-[#ED2326] hover:opacity-70">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No products yet.</p>}
    </div>
  );
}
