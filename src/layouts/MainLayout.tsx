import React from "react";
import { useUiStore } from "../store/uiStore";
import { CheckCircle, X } from "lucide-react";

import {
  Calculator,
  Layers,
  QrCode,
  FileBarChart2,
  Building2,
  LayoutDashboard,
  ShoppingCart,
  Network,
  Coins,
  LogOut,
} from "lucide-react";
import { useUiMode } from "../context/UiModeContext";

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  currentStore: any;
  appConfig: any;
  demoTimeRemaining: string;
  handleLogoutStore: () => void;
  isKasir: boolean;
}

export function MainLayout({
  children,
  activeTab,
  setActiveTab,
  currentStore,
  appConfig,
  demoTimeRemaining,
  handleLogoutStore,
  isKasir,
}: MainLayoutProps) {
  const { uiMode } = useUiMode();

  const currentTheme = appConfig.theme || "slate";
  const theme = {
    slate: {
      appBg: "bg-[#F8FAFC]",
      asideBg: "bg-[#1E293B]",
      border: "border-slate-800/80",
      activeTab:
        "bg-blue-600/20 text-blue-450 border border-blue-500/20 font-extrabold shadow-sm",
      inactiveTab: "text-slate-400 hover:bg-white/5 hover:text-white",
      headerBg: "bg-white border-slate-200",
      headerText: "text-slate-700",
      accentText: "text-amber-400",
      accentBtn: "bg-emerald-500 hover:bg-emerald-600",
    },
    // Add other themes as needed...
  }[currentTheme as any] || {
    appBg: "bg-[#F8FAFC]",
    asideBg: "bg-[#1E293B]",
    border: "border-slate-800/80",
    activeTab:
      "bg-blue-600/20 text-blue-400 border border-blue-500/20 font-extrabold shadow-sm",
    inactiveTab: "text-slate-400 hover:bg-white/5 hover:text-white",
    headerBg: "bg-white border-slate-200",
    headerText: "text-slate-700",
    accentText: "text-amber-400",
    accentBtn: "bg-emerald-500 hover:bg-emerald-600",
  };

  const menuItems =
    uiMode === "simple"
      ? [
          { id: "tab-kasir", tab: "kasir", name: "Kasir", icon: Calculator },
          { id: "tab-stok", tab: "stok", name: "Stok & Bahan", icon: Layers },
          ...(["TIER_2", "TIER_3"].includes(
            appConfig?.subscriptionTier || "TIER_1",
          )
            ? [
                {
                  id: "tab-meja",
                  tab: "meja",
                  name: "Order Meja",
                  icon: QrCode,
                },
              ]
            : []),
          {
            id: "tab-laporan",
            tab: "laporan",
            name: "Laporan",
            icon: FileBarChart2,
          },
          {
            id: "tab-pengaturan",
            tab: "pengaturan",
            name: "Pengaturan",
            icon: Building2,
          },
        ]
      : [
          {
            id: "tab-dashboard",
            tab: "dashboard",
            name: "Dashboard Overview",
            icon: LayoutDashboard,
          },
          {
            id: "tab-kasir",
            tab: "kasir",
            name: "Mesin Kasir POS",
            icon: Calculator,
          },
          {
            id: "tab-stok",
            tab: "stok",
            name: "Stok & Bahan Baku",
            icon: Layers,
          },
          ...(["TIER_2", "TIER_3"].includes(
            appConfig?.subscriptionTier || "TIER_1",
          )
            ? [
                {
                  id: "tab-meja",
                  tab: "meja",
                  name: "Barcode Meja QR",
                  icon: QrCode,
                },
              ]
            : []),
          {
            id: "tab-laporan",
            tab: "laporan",
            name: "Laporan Keuangan",
            icon: FileBarChart2,
          },
          {
            id: "tab-suplierhub",
            tab: "suplierhub",
            name: "Supplier Hub",
            icon: ShoppingCart,
          },
          {
            id: "tab-intelligence",
            tab: "intelligence",
            name: "Market Intelligence",
            icon: Network,
          },
          {
            id: "tab-auditor",
            tab: "auditor",
            name: "Business Auditor",
            icon: FileBarChart2,
          },
          {
            id: "tab-paket",
            tab: "paket",
            name: "Langganan & Lisensi",
            icon: Coins,
          },
          {
            id: "tab-migrasi",
            tab: "migrasi",
            name: "Pusat Migrasi",
            icon: Network,
          },
          {
            id: "tab-pengaturan",
            tab: "pengaturan",
            name: "Profil & Pengaturan",
            icon: Building2,
          },
        ];

  const userRole = isKasir
    ? "Kasir"
    : currentStore?.cashierRole === "Owner" ||
        currentStore?.cashierRole === "Manager"
      ? "Owner"
      : "Other";

  const filteredMenu = menuItems.filter(({ tab }) => {
    if (userRole === "Kasir") {
      return ["kasir", "meja"].includes(tab as string);
    } else if (userRole === "Owner") {
      return [
        "dashboard",
        "laporan",
        "stok",
        "suplierhub",
        "intelligence",
        "auditor",
        "paket",
        "migrasi",
        "pengaturan",
      ].includes(tab as string);
    }
    return true; // Superadmin or fallback
  });

  return (
    <div
      className={`min-h-screen ${theme.appBg} font-sans flex flex-col md:flex-row`}
      id="app-container"
    >
      <aside
        className={`hidden md:flex w-20 lg:w-64 shrink-0 ${theme.asideBg} text-slate-300 flex-col border-r ${theme.border}`}
        id="sidebar"
      >
        <div
          className={`p-4 lg:p-6 flex flex-col items-center text-center gap-3 lg:gap-4 border-b ${theme.border} bg-slate-950/20 relative overflow-hidden group`}
        >
          <div className="relative w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-xl shadow-amber-950/40 border border-amber-300/30 transform transition-transform duration-300 group-hover:scale-105">
            <span className="text-white font-bold text-2xl">L</span>
          </div>

          <div className="min-w-0 space-y-1 w-full hidden lg:block">
            <h1
              className="text-sm font-black tracking-wide text-white font-sans uppercase truncate max-w-[210px]"
              title={currentStore?.storeName}
            >
              {currentStore?.storeName || "Aslam's Ledger"}
            </h1>
            <p
              className={`text-[9px] font-extrabold ${theme.accentText} uppercase tracking-widest leading-none font-mono`}
            >
              {currentStore?.cashierName || "Owner"} •{" "}
              {currentStore?.cashierRole || "Operator"}
            </p>
          </div>
        </div>

        <div className="p-3 lg:p-4 flex-1 space-y-1.5 overflow-y-auto flex flex-col items-center lg:items-stretch">
          {demoTimeRemaining && (
            <div className="w-full p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-1 shadow-inner relative z-20">
              <p className="text-[9px] text-amber-500 font-extrabold uppercase tracking-widest leading-none">
                SESI DEMO AKTIF
              </p>
              <p className="text-[12px] text-white font-mono font-black animate-pulse leading-none">
                {demoTimeRemaining}
              </p>
            </div>
          )}

          <p className="text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 font-sans text-center lg:text-left truncate w-full">
            MENU
          </p>

          {filteredMenu.map(({ id, tab, name, icon: Icon }) => (
            <button
              key={tab}
              id={id}
              onClick={() => setActiveTab(tab)}
              className={`w-full px-2 lg:px-3 py-3 rounded-xl justify-center lg:justify-start text-xs font-bold font-sans flex items-center gap-3 transition-all cursor-pointer ${
                activeTab === tab
                  ? theme.activeTab
                  : `${theme.inactiveTab} border border-transparent`
              }`}
              title={name}
            >
              <Icon size={15} className={`shrink-0`} />
              <span className="hidden lg:inline truncate">{name}</span>
            </button>
          ))}

          <button
            id="logout-store-session-btn"
            onClick={handleLogoutStore}
            className="w-full px-2 lg:px-3 py-3 rounded-xl justify-center lg:justify-start text-xs font-bold font-sans flex items-center gap-3 transition-colors text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 border border-transparent cursor-pointer"
            title="Keluar Sesi Toko"
          >
            <LogOut size={15} className="shrink-0" />
            <span className="hidden lg:inline truncate">Keluar Sesi Toko</span>
          </button>
        </div>
      </aside>

      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 ${theme.asideBg} border-t ${theme.border} p-2 flex justify-around items-center z-40 pb-safe`}
      >
        {filteredMenu.slice(0, 5).map(({ tab, name, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`p-2 rounded-xl flex flex-col items-center gap-1 ${
              activeTab === tab ? theme.activeTab : theme.inactiveTab
            }`}
          >
            <Icon size={20} />
            <span className="text-[9px] font-bold">{name.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col relative h-screen overflow-hidden pb-[60px] md:pb-0">
        {children}

        {/* GLOBAL TOAST CONTAINER */}
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {useUiStore((s) => s.toasts).map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-fade-in pointer-events-auto"
            >
              <CheckCircle className="text-emerald-400 shrink-0" size={16} />
              <span className="text-xs font-bold font-sans">{t.message}</span>
              <button
                onClick={() => useUiStore.getState().removeToast(t.id)}
                className="ml-2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
