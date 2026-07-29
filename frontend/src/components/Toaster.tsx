import { dismissToast, useToasts, type ToastKind } from "../lib/toast";

const STYLES: Record<ToastKind, { ring: string; icon: string }> = {
  info: { ring: "border-accent/40", icon: "ℹ" },
  success: { ring: "border-emerald-400/40", icon: "✓" },
  error: { ring: "border-rose-400/40", icon: "!" },
};

export default function Toaster() {
  const toasts = useToasts();

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-2 items-center">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`panel ${STYLES[t.kind].ring} animate-fade-up flex items-center gap-2.5
                      px-4 py-2.5 text-sm text-slate-200 shadow-pop bg-ink-800/95 backdrop-blur
                      hover:bg-ink-700 transition-colors`}
        >
          <span className="text-accent-soft">{STYLES[t.kind].icon}</span>
          {t.message}
        </button>
      ))}
    </div>
  );
}
