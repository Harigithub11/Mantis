"use client";

import Link from "next/link";
import { useState } from "react";
import { addLinkResource, createProduct, uploadProductImage, uploadResource } from "@/lib/api";

const CATEGORIES = ["vehicles", "appliance", "electronics", "tools", "medical", "consumer tech", "other"];

type ResStatus = { key: string; name: string; status: "indexing" | "indexed" | "uploaded" | "failed"; chunks?: number };

export default function NewListingPage() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [manuals, setManuals] = useState<File[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [resStatuses, setResStatuses] = useState<ResStatus[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || saving) return;
    setError(null);
    setSaving(true);
    setResStatuses([]);
    try {
      const product = await createProduct({ name, category: category, description });
      if (imageFile) await uploadProductImage(product.id, imageFile);

      for (const f of manuals) {
        const key = `${f.name}-${Math.random().toString(36).slice(2, 7)}`;
        setResStatuses((s) => [...s, { key, name: f.name, status: "indexing" }]);
        try {
          const r = await uploadResource(product.id, f);
          setResStatuses((s) =>
            s.map((x) =>
              x.key === key ? { ...x, status: r.indexed ? "indexed" : "uploaded", chunks: r.chunk_count } : x
            )
          );
        } catch {
          setResStatuses((s) => s.map((x) => (x.key === key ? { ...x, status: "failed" } : x)));
        }
      }

      if (linkUrl.trim()) {
        const r = await addLinkResource(product.id, { title: linkTitle || linkUrl, url: linkUrl, type: "link" });
        setResStatuses((s) => [...s, { key: `link-${r.id}`, name: r.title, status: "indexed" }]);
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-8 py-7">
      <h1 className="mb-7 text-3xl font-bold">Dashboard</h1>

      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="font-bold">Add new product</h2>
          <div className="flex items-center gap-3">
            {done && (
              <Link href="/dashboard/products" className="text-sm text-emerald-600">
                Saved ✓ — View products
              </Link>
            )}
            <button
              onClick={save}
              disabled={saving || !name.trim()}
              className="rounded-lg bg-[#F5921E] px-5 py-2 text-sm font-medium text-white hover:bg-[#e07d0a] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Product Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Orbit-5 Mesh Router"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm capitalize outline-none focus:border-gray-900"
            >
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your product"
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Product image</label>
            <label className="mt-1 flex h-[104px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 text-center text-xs text-gray-400 hover:border-[#F5921E]">
              {imageFile ? <span className="text-gray-700">{imageFile.name}</span> : <span>Drop your product image here<br />PNG / JPEG · browse</span>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Upload Manuals</label>
            <label className="mt-1 flex h-[104px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#F5921E]/60 text-center text-xs text-gray-400 hover:border-[#F5921E]">
              {manuals.length ? (
                <span className="text-gray-700">{manuals.length} file(s) selected</span>
              ) : (
                <span>Drop your manuals & support docs here<br />PDF, DOCX, TXT · browse</span>
              )}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setManuals(Array.from(e.target.files ?? []))}
              />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Add external link</label>
            <input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Title"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://support.example.com/docs"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
        </div>

        {resStatuses.length > 0 && (
          <div className="border-t border-gray-100 p-6">
            <h3 className="mb-3 font-semibold">Resources</h3>
            <ul className="space-y-2">
              {resStatuses.map((r) => (
                <li key={r.key} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-red-500">📄</span> {r.name}
                  </span>
                  {r.status === "indexing" ? (
                    <span className="text-xs text-[#b8650a]">Indexing…</span>
                  ) : r.status === "indexed" ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      Indexed{r.chunks ? ` · ${r.chunks} chunks` : ""}
                    </span>
                  ) : r.status === "uploaded" ? (
                    <span className="text-xs text-gray-400">Uploaded</span>
                  ) : (
                    <span className="text-xs text-red-500">Failed</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="px-6 pb-4 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
