"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProductAlertsManager from "@/components/ProductAlertsManager";
import {
  addLinkResource,
  deleteResource,
  getProduct,
  getToken,
  listResources,
  updateProduct,
  uploadProductImage,
  uploadResource,
} from "@/lib/api";
import type { Product, Resource } from "@/lib/types";

export default function ManageProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  // Editable product details
  const [eName, setEName] = useState("");
  const [eCategory, setECategory] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function refresh() {
    listResources(id).then(setResources).catch(() => {});
  }

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    getProduct(id)
      .then((p) => {
        setProduct(p);
        setEName(p.name);
        setECategory(p.category);
        setEDesc(p.description);
      })
      .catch(() => {});
    refresh();
  }, [id, router]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(null);
    try {
      const p = await updateProduct(id, { name: eName, category: eCategory, description: eDesc });
      setProduct(p);
      setSavedMsg("Saved ✓");
    } catch (err) {
      setSavedMsg((err as Error).message);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setStatus(`Uploading & indexing ${file.name}…`);
    try {
      const r = await uploadResource(id, file);
      setStatus(r.indexed ? `Indexed ✓ (${r.chunk_count} chunks)` : "Uploaded (not indexed — no extractable text)");
      refresh();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl) return;
    await addLinkResource(id, { title: linkTitle || linkUrl, url: linkUrl, type: "link" });
    setLinkTitle("");
    setLinkUrl("");
    refresh();
  }

  async function onImage(file: File) {
    const p = await uploadProductImage(id, file);
    setProduct(p);
  }

  async function remove(rid: number) {
    await deleteResource(rid);
    refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{product ? product.name : "Manage product"}</h1>

      <form onSubmit={saveDetails} className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-semibold">Edit product details</h2>
        <input
          value={eName}
          onChange={(e) => setEName(e.target.value)}
          placeholder="Product name"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
        <input
          value={eCategory}
          onChange={(e) => setECategory(e.target.value)}
          placeholder="Category"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
        <textarea
          value={eDesc}
          onChange={(e) => setEDesc(e.target.value)}
          placeholder="Description"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">Save changes</button>
          {savedMsg && <span className="text-sm text-gray-500">{savedMsg}</span>}
        </div>
      </form>

      <section className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Upload a manual / document / image</h2>
          <input
            type="file"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            className="block w-full text-sm"
          />
          {status && <p className="mt-2 text-xs text-gray-500">{status}</p>}

          <h2 className="mb-2 mt-5 font-semibold">Product image</h2>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])}
            className="block w-full text-sm"
          />
        </div>

        <form onSubmit={onAddLink} className="space-y-2 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">Add an external link</h2>
          <input
            placeholder="Title"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          <input
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">Add link</button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Resources</h2>
        {resources.length === 0 ? (
          <p className="text-sm text-gray-400">No resources yet.</p>
        ) : (
          <ul className="space-y-2">
            {resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-2 text-xs text-gray-400">{r.type}</span>
                  {r.indexed && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      indexed ✓
                    </span>
                  )}
                </div>
                <button onClick={() => remove(r.id)} className="text-sm text-red-500 hover:underline">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProductAlertsManager productId={id} />
    </main>
  );
}
