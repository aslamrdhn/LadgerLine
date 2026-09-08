import { useAppSync } from "./hooks/useAppSync";
import React, { useEffect, useState } from "react";
import { useDataStore } from "./store/dataStore";
import { useUiMode } from "./context/UiModeContext";
import { AppRouter } from "./app/AppRouter";
import { MainLayout } from "./layouts/MainLayout";
import StoreLoginPortal from "./components/StoreLoginPortal";

export default function App() {
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const { uiMode } = useUiMode();

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "kasir"
    | "stok"
    | "meja"
    | "laporan"
    | "pengaturan"
    | "intelligence"
    | "paket"
    | "suplierhub"
    | "auditor"
    | "migrasi"
  >(uiMode === "simple" ? "kasir" : "dashboard");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [currentStore, setCurrentStore] = useState<any>(() => {
    const saved = localStorage.getItem("aslam_ledger_current_store");
    return saved ? JSON.parse(saved) : null;
  });

  const { appConfig, setAppConfig, syncOfflineOrders } = useDataStore();

  const syncQuery = useAppSync(
    currentStore?.id,
    localStorage.getItem("ledgerline_jwt_token") || "",
  );

  const isKasir = React.useMemo(
    () => currentStore?.cashierRole === "Kasir",
    [currentStore],
  );

  useEffect(() => {
    if (isKasir && activeTab !== "kasir" && activeTab !== "meja") {
      setActiveTab("kasir");
    }
  }, [isKasir, activeTab]);

  useEffect(() => {
    // Attempt to sync immediately if online
    if (navigator.onLine) {
      syncOfflineOrders();
    }

    // Attempt to sync when back online
    const handleOnline = () => {
      syncOfflineOrders();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineOrders]);

  const executeLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (e) {
      // Ignored
    }
    setCurrentStore(null);
    localStorage.removeItem("aslam_ledger_current_store");
    localStorage.removeItem("ledgerline_jwt_token");
    localStorage.removeItem("aslam_ledger_token");
    setShowLogoutConfirm(false);
  };

  const handleUpdateConfig = async (updated: Partial<any>) => {
    // Config updating logic delegated to a hook or store later.
    // For now just pass it down.
  };

  if (visitorToken) {
    const VisitorMenu = React.lazy(() => import("./components/VisitorMenu"));
    return (
      <React.Suspense fallback={<div>Loading Visitor...</div>}>
        <VisitorMenu token={visitorToken} />
      </React.Suspense>
    );
  }

  if (!currentStore) {
    return (
      <div className="relative isolate min-h-screen">
        <StoreLoginPortal
          tenants={[]}
          onLogin={(t, tok) => {
            setCurrentStore(t);
            localStorage.setItem(
              "aslam_ledger_current_store",
              JSON.stringify(t),
            );
            if (tok) localStorage.setItem("ledgerline_jwt_token", tok);
          }}
          onRegister={() => {}}
        />
      </div>
    );
  }

  return (
    <MainLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      currentStore={currentStore}
      appConfig={appConfig || {}}
      demoTimeRemaining={""}
      handleLogoutStore={() => setShowLogoutConfirm(true)}
      isKasir={isKasir}
    >
      <AppRouter
        activeTab={activeTab}
        currentStore={currentStore}
        onRefresh={() => syncQuery.refetch()}
        executeLogout={executeLogout}
        handleUpdateConfig={handleUpdateConfig}
        activeSuperAdminMode={"audit"}
        selectedAuditTenant={null}
        setSelectedAuditTenant={() => {}}
        superadminEmail={""}
        superadminPassword={""}
        handleSuperadminDeleteTenant={() => {}}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold">Konfirmasi Keluar</h3>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-slate-500"
              >
                Batal
              </button>
              <button
                onClick={executeLogout}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl"
              >
                Keluar Sesi
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
