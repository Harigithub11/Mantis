"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Marketplace, { type NotificationItem } from "@/components/Marketplace";
import { assetUrl, getUserToken, getUser, getCompany, getUserNotifications, listProducts, logoutAll } from "@/lib/api";
import type { Product } from "@/lib/types";

const PAGE_SIZE = 10;

const SIGNED_OUT_HINT: NotificationItem[] = [
  { id: "hint", title: "Sign in to see your alerts", body: "Log in and add products to your inventory to get warranty, recall and maintenance reminders here.", timestamp: "", unread: false },
];

export default function ProductsPage() {
  const router = useRouter();
  const [all, setAll] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    listProducts().then(setAll).catch(() => {});
    setAuthed(!!(getUser() || getCompany()));
    if (getUserToken()) {
      getUserNotifications()
        .then((ns) => setNotifications(ns as NotificationItem[]))
        .catch(() => {});
    } else {
      setNotifications(SIGNED_OUT_HINT);
    }
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    all.forEach((p) => p.category && s.add(p.category));
    return ["All", ...Array.from(s)];
  }, [all]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return all.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!n || p.name.toLowerCase().includes(n) || p.description.toLowerCase().includes(n))
    );
  }, [all, q, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map((p) => ({
    id: String(p.id),
    brand: p.company_name ?? "",
    name: p.name,
    imageSrc: assetUrl(p.image_path),
  }));

  return (
    <Marketplace
      products={pageItems}
      notifications={notifications}
      onMarkAllRead={() => setNotifications((ns) => ns.map((n) => ({ ...n, unread: false })))}
      categories={categories}
      activeCategory={category}
      currentPage={current}
      totalPages={totalPages}
      onCategoryChange={(c) => {
        setCategory(c);
        setPage(1);
      }}
      onSearch={(s) => {
        setQ(s);
        setPage(1);
      }}
      onViewProduct={(id) => router.push(`/products/${id}`)}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      onLogIn={() => router.push("/login")}
      authed={authed}
      onLogout={() => {
        logoutAll();
        setAuthed(false);
        setNotifications(SIGNED_OUT_HINT);
        router.refresh();
      }}
    />
  );
}
