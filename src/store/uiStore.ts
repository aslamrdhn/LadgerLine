import { create } from "zustand";

interface ToastMessage {
  id: string;
  message: string;
}

interface UiStoreState {
  toasts: ToastMessage[];
  triggerToast: (message: string) => void;
  removeToast: (id: string) => void;

  auditLogs: any[];
  logAuditActivity: (name: string, action: string, detail: string) => void;
  setAuditLogs: (logs: any[]) => void;
  clearAuditLogs: () => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  toasts: [],
  triggerToast: (message) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  auditLogs: (() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("aslam_ledger_audit_logs");
    return saved ? JSON.parse(saved) : [];
  })(),
  logAuditActivity: (name, action, detail) => {
    const log = {
      time: new Date().toLocaleTimeString("id-ID"),
      name,
      action,
      detail,
      ip: "192.168.1." + Math.floor(2 + Math.random() * 250),
    };
    set((state) => {
      const newLogs = [log, ...state.auditLogs].slice(0, 100);
      localStorage.setItem("aslam_ledger_audit_logs", JSON.stringify(newLogs));
      return { auditLogs: newLogs };
    });
  },
  setAuditLogs: (logs) => {
    localStorage.setItem("aslam_ledger_audit_logs", JSON.stringify(logs));
    set({ auditLogs: logs });
  },
  clearAuditLogs: () => {
    localStorage.removeItem("aslam_ledger_audit_logs");
    set({ auditLogs: [] });
  },
}));
