import React, { useState } from "react";
import { Package, CheckCircle2, Coins, QrCode } from "lucide-react";

export default function SubscriptionPackages() {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<"selection" | "qr">(
    "selection",
  );

  const packages = [
    {
      id: "basic",
      name: "Basic POS",
      price: "500 Koin",
      features: [
        "Kasir POS Standard",
        "Manajemen Stok Dasar",
        "Laporan Harian",
        "Akses 1 Kasir",
      ],
    },
    {
      id: "pro",
      name: "Pro Business",
      price: "1000 Koin",
      features: [
        "Semua Fitur Basic",
        "Manajemen Resep",
        "Inventory Lanjutan",
        "Laporan Laba Rugi",
        "Akses 3 Kasir",
      ],
      isPopular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise All System Ladgerline",
      price: "1500 Koin",
      features: [
        "Semua Fitur Pro",
        "Digital Auditor AI",
        "Unlimited Kasir",
        "API Access",
        "Prioritas Support 24/7",
      ],
    },
  ];

  const handleSelectPackage = (pkgId: string) => {
    setSelectedPackage(pkgId);
  };

  const handleProceedPayment = () => {
    if (selectedPackage) {
      setPaymentStep("qr");
    }
  };

  if (paymentStep === "qr") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-6 animate-fade-in">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
          <div className="flex justify-center mb-6 mt-4">
            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600">
              <QrCode size={48} />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">
            Scan QRIS Midtrans
          </h2>
          <p className="text-sm text-slate-500 mb-8 px-4">
            Silakan scan QR Code di bawah ini menggunakan aplikasi e-wallet atau
            m-banking Anda untuk menyelesaikan pembayaran.
          </p>

          <div className="bg-white border-2 border-slate-200 p-4 rounded-2xl flex justify-center items-center mx-auto mb-6 w-64 h-64 shadow-inner">
            {/* Mock QR Code Image for Demo */}
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MIDTRANS_PAYMENT_DEMO_1500_KOIN"
              alt="QRIS"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="text-2xl font-black text-slate-800 mb-8 flex items-center justify-center gap-2">
            <Coins className="text-amber-500" />
            Total: {packages.find((p) => p.id === selectedPackage)?.price}
          </div>

          <button
            onClick={() => setPaymentStep("selection")}
            className="w-full py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50 p-6 md:p-12 overflow-y-auto animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 flex items-center justify-center gap-3">
            <Package className="text-indigo-600" size={36} />
            Paket Ladgerline
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Tingkatkan kapasitas bisnis Anda dengan berlangganan paket
            Ladgerline. Pilih paket yang sesuai dengan kebutuhan sistem
            operasional Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-3xl p-8 border-2 transition-all cursor-pointer relative flex flex-col ${selectedPackage === pkg.id ? "border-indigo-600 shadow-xl scale-105 z-10" : "border-slate-100 hover:border-slate-300 shadow-sm"}`}
              onClick={() => handleSelectPackage(pkg.id)}
            >
              {pkg.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-md tracking-widest">
                  PALING POPULER
                </div>
              )}

              <div className="mb-6 pb-6 border-b border-slate-100">
                <h3 className="text-xl font-bold text-slate-800 mb-3">
                  {pkg.name}
                </h3>
                <div className="flex items-center gap-2 text-3xl font-black text-indigo-600">
                  <Coins size={32} className="text-amber-500" />
                  {pkg.price}
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-8">
                {pkg.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2
                      size={20}
                      className="text-green-500 mt-0.5 shrink-0"
                    />
                    <span className="text-sm text-slate-600 font-bold">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <button
                className={`w-full py-4 rounded-xl font-black text-sm transition-colors ${selectedPackage === pkg.id ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {selectedPackage === pkg.id
                  ? "Paket Terpilih"
                  : "Pilih Paket Ini"}
              </button>
            </div>
          ))}
        </div>

        {selectedPackage && (
          <div className="mt-16 text-center animate-fade-in">
            <button
              onClick={handleProceedPayment}
              className="px-12 py-5 bg-[#4F46E5] hover:bg-[#4338ca] text-white font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 mx-auto text-lg"
            >
              <QrCode size={24} />
              Lanjut Pembayaran via QRIS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
