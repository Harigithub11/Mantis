"use client";

// ─── SVG path data ───────────────────────────────────────────────────────────
const MANTIS_ICON_PATH =
  "M20.4306 0.0191502C20.5179 0.00955237 20.6104 0.000941842 20.6979 0C21.5522 0.00130064 22.3722 0.451501 22.9819 1.254C23.7378 2.2676 23.9343 3.44382 23.9082 4.82542C23.8938 5.58894 23.9084 6.39049 23.9077 7.15715L23.9068 13.7865C24.3304 13.2149 24.8927 12.5968 25.3525 12.0612L27.6638 9.35886L34.6217 1.22928C35.3401 0.403647 36.0668 -0.0867394 37.0446 0.0171772C37.9104 0.103513 38.7144 0.649512 39.2789 1.53404C39.824 2.3978 39.9936 3.39117 39.9946 4.50609C39.9952 5.37648 39.9952 6.24796 39.9949 7.11849L39.9922 13.6722L39.9949 21.9732C39.9959 23.391 40.0143 24.8764 39.9745 26.2877C39.94 27.5224 39.4652 28.6657 38.7555 29.4645C37.9415 30.3741 36.8911 30.8113 35.836 30.6793C34.7816 30.5472 33.7576 29.7891 33.0861 28.693C32.4229 27.5907 32.1122 26.1811 32.2223 24.7726C32.4423 21.9209 34.2171 20.565 35.6902 18.7957C36.6982 17.5851 37.7666 16.3 38.8137 15.1582C38.2392 14.6698 37.7496 14.3422 37.0577 14.2753C36.4326 14.2085 35.8076 14.403 35.2685 14.832C34.8742 15.14 34.3565 15.7816 33.9984 16.202L32.3132 18.1768L26.0277 25.5243C24.0922 27.5028 22.2372 31.1713 19.5831 30.6519C18.5053 30.4482 17.5324 29.677 16.8797 28.5088C16.2156 27.3119 16.0111 25.976 16.1556 24.5061C16.3576 22.4509 17.2984 21.4661 18.3887 20.1957L20.0051 18.3111L21.6613 16.3742C21.9914 15.9883 22.3702 15.5214 22.717 15.1772C20.1062 12.7887 18.5792 15.4326 16.702 17.6056L9.46198 26.0644L7.60487 28.2377C7.19233 28.7246 6.66535 29.3818 6.22257 29.785C5.75458 30.2175 5.22131 30.5064 4.66066 30.6313C3.58867 30.8534 2.49478 30.4951 1.61983 29.6352C0.772472 28.8007 0.206464 27.5496 0.0459081 26.1562C-0.115082 24.7415 0.152053 23.3105 0.773275 22.1414C1.10439 21.5183 1.71765 20.8636 2.16253 20.3409L3.94025 18.263L9.78386 11.4394L15.8633 4.3336L17.7346 2.14978C18.6765 1.0441 19.1346 0.2743 20.4306 0.0191502Z";

const SEARCH_ICON_PATH =
  "M17.5001 17.5001L13.8835 13.8835M15.8333 9.16667C15.8333 12.8486 12.8486 15.8333 9.16667 15.8333C5.48477 15.8333 2.5 12.8486 2.5 9.16667C2.5 5.48477 5.48477 2.5 9.16667 2.5C12.8486 2.5 15.8333 5.48477 15.8333 9.16667Z";

export interface Product {
  id: string;
  brand: string;
  name: string;
  imageSrc?: string;
}

export interface LandingPageProps {
  onGetStarted?: () => void;
  onLogIn?: () => void;
  onLogout?: () => void;
  authed?: boolean;
  onViewProduct?: (id: string) => void;
  onViewAll?: () => void;
  appScreenshotSrc?: string;
  products?: Product[];
}

const DEFAULT_PRODUCTS: Product[] = [
  { id: "1", brand: "NetOrbit Systems", name: "Orbit-5 Mesh Router" },
  { id: "2", brand: "BrewMaster Tech", name: "ProLine-X Coffee Maker" },
  { id: "3", brand: "BrewMaster Tech", name: "ProLine-X Coffee Maker" },
];

function Navbar({ onLogIn, onLogout, authed }: { onLogIn?: () => void; onLogout?: () => void; authed?: boolean }) {
  return (
    <header className="sticky top-0 z-50 bg-[#181818] h-[61px] flex items-center px-6 md:px-[90px] justify-between">
      <div className="flex items-center gap-3">
        <svg width="40" height="31" viewBox="0 0 40 30.7024" fill="none" aria-hidden>
          <path d={MANTIS_ICON_PATH} fill="#F98613" />
        </svg>
        <span className="text-white text-[24px] leading-normal whitespace-nowrap" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontStyle: "italic" }}>
          MANTIS
        </span>
      </div>

      <button
        type="button"
        onClick={authed ? onLogout : onLogIn}
        className="rounded-[10px] border border-[#ffa33c] bg-transparent px-[26px] py-[9px] text-[#ffa33c] text-[14px] leading-[1.5] whitespace-nowrap hover:bg-[rgba(255,163,60,0.07)] transition-colors"
        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}
        aria-label={authed ? "Log out of Mantis" : "Log in to Mantis"}
      >
        {authed ? "Log Out" : "Log In"}
      </button>
    </header>
  );
}

function HeroSection({ onGetStarted, appScreenshotSrc }: { onGetStarted?: () => void; appScreenshotSrc?: string }) {
  return (
    <section className="relative bg-[#181818] overflow-hidden min-h-[1066px] flex flex-col items-center pt-[130px] pb-[60px]">
      {/* Background artwork (MOSS) */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/hero-bg.svg')" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <h1 className="text-white text-[clamp(40px,5.5vw,64px)] text-center leading-[0.9]" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>
          Expert diagnosis.
          <br />
          Every time.
        </h1>

        <p className="mt-8 text-[#90a4c0] text-[clamp(16px,1.4vw,20px)] leading-[1.5] text-center max-w-[633px]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
          Upload your product manuals. Empower your users with an AI that reasons through complex hardware and software faults instantly.
        </p>

        <button
          type="button"
          onClick={onGetStarted}
          className="mt-8 bg-[#f98613] rounded-[10px] px-[26px] py-[9px] text-black text-[14px] leading-[1.5] whitespace-nowrap hover:bg-[#e0770f] transition-colors"
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
        >
          Get Started now
        </button>

        <div className="mt-16 w-full max-w-[718px] rounded-[11px] overflow-hidden shadow-2xl">
          {appScreenshotSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={appScreenshotSrc} alt="Mantis app interface screenshot" className="w-full object-cover rounded-[11px]" />
          ) : (
            <div className="w-full aspect-[718/439] rounded-[11px] bg-[#1e1e2e] border border-[rgba(255,255,255,0.1)] flex items-center justify-center" role="img" aria-label="App screenshot placeholder">
              <span className="text-[#90a4c0] text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>App screenshot</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SearchBar({ onClick }: { onClick?: () => void }) {
  return (
    <div onClick={onClick} className="relative flex cursor-pointer items-center gap-3 bg-[#f0f5f9] border border-[#e2e8f0] rounded-full px-4 py-2 w-full max-w-[530px]">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
        <path d={SEARCH_ICON_PATH} stroke="#64748B" strokeLinecap="round" strokeWidth="2" />
      </svg>
      <input
        type="search"
        placeholder="Search products..."
        readOnly
        className="bg-transparent text-[#64748b] text-[14px] leading-normal outline-none w-full cursor-pointer"
        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}
        aria-label="Search products"
      />
    </div>
  );
}

function ProductCard({ product, onView }: { product: Product; onView?: () => void }) {
  return (
    <article className="flex flex-col gap-3">
      <div className="relative rounded-[10px] overflow-hidden aspect-square border border-[#94a3b8]">
        {product.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageSrc} alt={`${product.name} by ${product.brand}`} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-white flex items-center justify-center" role="img" aria-label={`${product.name} product image`}>
            <span className="text-[#94a3b8] text-xs text-center px-2" style={{ fontFamily: "'Inter', sans-serif" }}>{product.name}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[#64748b] text-[13px] leading-normal" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>{product.brand}</p>
        <p className="text-[#0a1628] text-[16px] leading-normal" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>{product.name}</p>
      </div>

      <button
        type="button"
        onClick={onView}
        className="rounded-[10px] border border-[#ffa33c] bg-[rgba(255,163,60,0.07)] px-[26px] py-[9px] text-[#ffa33c] text-[14px] leading-[1.5] whitespace-nowrap hover:bg-[rgba(255,163,60,0.15)] transition-colors text-center"
        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}
        aria-label={`View ${product.name}`}
      >
        View
      </button>
    </article>
  );
}

function ProductSection({
  products,
  onViewProduct,
  onViewAll,
}: {
  products: Product[];
  onViewProduct?: (id: string) => void;
  onViewAll?: () => void;
}) {
  return (
    <section className="bg-white py-[80px] px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-[#0a1628] text-[clamp(28px,3vw,40px)] leading-[0.9]" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>
            Find help for your product
          </h2>
          <p className="text-[#64748b] text-[14px] leading-[1.5] max-w-[563px]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400 }}>
            Browse products and get technician-grade troubleshooting from their official manuals.
          </p>
        </div>

        <SearchBar onClick={onViewAll} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onView={() => onViewProduct?.(product.id)} />
          ))}
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="text-[#64748b] text-[20px] underline underline-offset-2 hover:text-[#0a1628] transition-colors"
          style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}
        >
          View All →
        </button>
      </div>
    </section>
  );
}

export default function LandingPage({
  onGetStarted,
  onLogIn,
  onLogout,
  authed,
  onViewProduct,
  onViewAll,
  appScreenshotSrc,
  products = DEFAULT_PRODUCTS,
}: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLogIn={onLogIn} onLogout={onLogout} authed={authed} />
      <main>
        <HeroSection onGetStarted={onGetStarted} appScreenshotSrc={appScreenshotSrc} />
        <ProductSection products={products} onViewProduct={onViewProduct} onViewAll={onViewAll} />
      </main>
    </div>
  );
}
