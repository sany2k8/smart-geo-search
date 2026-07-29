import { useState } from "react";
import { api, auth } from "../lib/api";

const DEMO_ACCOUNTS = [
  { label: "Demo user", email: "demo@geosearch.dev", password: "demo1234" },
  { label: "Admin", email: "admin@geosearch.dev", password: "admin1234" },
];

export default function AuthDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "login"
          ? await api.login(email, password)
          : await api.register(email, password, name || email.split("@")[0]);
      auth.set(result.access_token);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[3000] bg-ink-950/70 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-sm p-5 space-y-3.5 shadow-pop animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === m ? "bg-accent/20 text-accent-soft" : "text-slate-500 hover:text-slate-300"
              }`}
              onClick={() => setMode(m)}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <input
            className="field"
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="field"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field"
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button className="btn w-full" disabled={busy} onClick={submit}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        {mode === "login" && (
          <div className="pt-1 border-t border-white/[0.06]">
            <p className="section-label mb-1.5 pt-2">Seeded accounts</p>
            <div className="flex gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  className="chip flex-1 justify-center"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
