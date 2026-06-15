"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  assetUrl,
  getUser,
  getUserNotifications,
  getUserToken,
  listInventory,
  removeFromInventory,
} from "@/lib/api";
import type { NotificationFeedItem, Product, User } from "@/lib/types";

const NOTIF_DOT: Record<string, string> = {
  recall: "bg-red-500",
  safety: "bg-amber-500",
  maintenance: "bg-blue-500",
  warranty: "bg-blue-400",
  service: "bg-gray-400",
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notifs, setNotifs] = useState<NotificationFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([listInventory(), getUserNotifications()])
      .then(([ps, ns]) => {
        setProducts(ps);
        setNotifs(ns);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!getUserToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(pid: number) {
    await removeFromInventory(pid).catch(() => {});
    load();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          {user && <p className="text-sm text-gray-500">Signed in as {user.email}</p>}
        </div>
        <Link
          href="/products"
          className="rounded-lg bg-[#F5921E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e07d0a]"
        >
          Browse marketplace
        </Link>
      </div>

      {/* Notifications */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Alerts &amp; reminders</h2>
        {notifs.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            You&apos;re all caught up. Alerts for products you own appear here.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {notifs.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NOTIF_DOT[n.type ?? ""] ?? "bg-gray-300"}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                    <span className="text-xs text-gray-400">{n.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Owned products */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Inventory</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : products.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            No products yet. Open a product and tap “Add to my products”.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const img = assetUrl(p.image_path);
              return (
                <div key={p.id} className="overflow-hidden rounded-2xl border border-gray-200">
                  <Link href={`/products/${p.id}`} className="block">
                    <div className="flex h-36 items-center justify-center bg-gray-50">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl text-gray-300">📦</span>
                      )}
                    </div>
                    <div className="px-4 pt-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">{p.company_name}</p>
                      <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between px-4 py-3">
                    <Link
                      href={`/products/${p.id}/diagnose`}
                      className="text-sm font-medium text-[#F5921E] hover:underline"
                    >
                      Diagnose →
                    </Link>
                    <button
                      onClick={() => remove(p.id)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
