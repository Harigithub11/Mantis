"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LandingPage, { type Product as LPProduct } from "@/components/LandingPage";
import { assetUrl, isLoggedIn, listProducts, logoutAll } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<LPProduct[]>([]);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isLoggedIn());
    listProducts()
      .then((ps) =>
        setProducts(
          ps.slice(0, 3).map((p) => ({
            id: String(p.id),
            brand: p.company_name ?? "",
            name: p.name,
            imageSrc: assetUrl(p.image_path),
          }))
        )
      )
      .catch(() => {});
  }, []);

  return (
    <LandingPage
      products={products.length ? products : undefined}
      appScreenshotSrc="/hero-image.png"
      onGetStarted={() => router.push("/login")}
      onLogIn={() => router.push("/login")}
      authed={authed}
      onLogout={() => {
        logoutAll();
        setAuthed(false);
        router.refresh();
      }}
      onViewProduct={(id) => router.push(`/products/${id}`)}
      onViewAll={() => router.push("/products")}
    />
  );
}
