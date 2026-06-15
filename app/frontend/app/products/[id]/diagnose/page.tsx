"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import { getProduct } from "@/lib/api";

export default function DiagnosePage() {
  const params = useParams();
  const id = Number(params.id);
  const [name, setName] = useState("");

  useEffect(() => {
    if (id) getProduct(id).then((p) => setName(p.name)).catch(() => {});
  }, [id]);

  return (
    <div>
      {/* Sub-header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href={`/products/${id}`} className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="text-gray-400">←</span> Diagnosis: {name || "Product"}
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-[#F5921E] px-3 py-1 text-xs font-medium text-[#b8650a]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F5921E]" /> Active
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <ChatPanel productId={id} />
      </main>
    </div>
  );
}
