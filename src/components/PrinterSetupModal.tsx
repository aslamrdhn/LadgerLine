import React, { useState } from "react";
import {
  Bluetooth,
  Usb,
  X,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { escposPrinter } from "../utils/escposPrinter";

export const PrinterSetupModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string | null>(
    escposPrinter.getStatus().deviceName,
  );
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >(escposPrinter.getStatus().isConnected ? "connected" : "idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [testNotice, setTestNotice] = useState<string | null>(null);

  const requestBluetooth = async () => {
    try {
      setStatus("connecting");
      setTestNotice(null);
      const info = await escposPrinter.connectBluetooth();
      setDeviceInfo(info);
      setStatus("connected");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Bluetooth connection failed");
    }
  };

  const requestUsb = async () => {
    try {
      setStatus("connecting");
      setTestNotice(null);
      const info = await escposPrinter.connectUsbSerial(9600);
      setDeviceInfo(info);
      setStatus("connected");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "USB Serial connection failed");
    }
  };

  const testPrint = async () => {
    try {
      setTestNotice(null);
      const res = await escposPrinter.printTestPage();
      setTestNotice(res.message);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage("Print failed: " + (err.message || "Unknown error"));
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
      >
        <Bluetooth size={14} /> Set Up Real Printer Connection
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                Printer Connection Setup (ESC/POS)
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={requestBluetooth}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-slate-150 hover:border-indigo-500 hover:bg-indigo-50 transition-colors bg-white text-slate-700 hover:text-indigo-700 group focus:outline-hidden"
                >
                  <Bluetooth
                    size={32}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    Web Bluetooth
                  </span>
                </button>
                <button
                  onClick={requestUsb}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-slate-150 hover:border-emerald-500 hover:bg-emerald-50 transition-colors bg-white text-slate-700 hover:text-emerald-700 group focus:outline-hidden"
                >
                  <Usb
                    size={32}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    USB Serial
                  </span>
                </button>
              </div>

              {status === "connecting" && (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <RefreshCw size={14} className="animate-spin" />
                  Connecting to device...
                </div>
              )}

              {status === "connected" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle
                    size={18}
                    className="text-emerald-600 shrink-0 mt-0.5"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-800">
                      Connection Established
                    </p>
                    <p className="text-[11px] text-emerald-650 font-mono break-all">
                      {deviceInfo}
                    </p>
                    {testNotice && (
                      <p className="text-[11px] text-emerald-700 font-bold pt-1">
                        {testNotice}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle
                    size={18}
                    className="text-red-600 shrink-0 mt-0.5"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-red-800">
                      Connection Failed
                    </p>
                    <p className="text-[11px] text-red-650 break-all">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {status === "connected" && (
                <button
                  onClick={testPrint}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition-colors shadow-sm focus:outline-hidden"
                >
                  Print ESC/POS Test Page
                </button>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 text-center leading-relaxed">
              Requires Chrome 89+ or Edge 89+ for Web Bluetooth/Serial
              capabilities. Supports standard 58mm & 80mm ESC/POS thermal
              printers.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
