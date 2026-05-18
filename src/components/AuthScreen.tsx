import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

export function AuthScreen() {
  const { login, register, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    clearError();

    try {
      const ok =
        mode === "login"
          ? await login(username, password)
          : await register(username, password, displayName || undefined);

      if (ok) {
        setUsername("");
        setPassword("");
        setDisplayName("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-0)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "48px 40px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img
            src="/logo.png"
            alt="ArtMusic"
            style={{
              width: 88,
              height: 88,
              objectFit: "contain",
              marginBottom: 16,
            }}
          />
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 6,
              color: "var(--text-primary)",
            }}
          >
            ArtMusic
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            Deine private Musik-Node. Ein fester öffentlicher Link pro Account.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            background: "var(--surface-2)",
            borderRadius: 10,
            marginBottom: 24,
          }}
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                clearError();
              }}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 12,
                cursor: "pointer",
                background: mode === m ? "var(--accent)" : "transparent",
                color:
                  mode === m ? "var(--surface-0)" : "var(--text-secondary)",
                fontWeight: mode === m ? 700 : 600,
                transition: "all 0.15s",
              }}
            >
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {mode === "register" && (
            <Field
              label="Anzeigename"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Optional"
            />
          )}
          <Field
            label="Benutzername"
            value={username}
            onChange={setUsername}
            placeholder="min. 3 Zeichen"
            required
            autoComplete="username"
          />
          <Field
            label="Passwort"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === "register" ? "min. 8 Zeichen" : "••••••••"}
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />

          {error && (
            <p
              style={{
                fontSize: 12,
                color: "var(--red)",
                padding: "10px 12px",
                background: "var(--red-dim)",
                borderRadius: 10,
                border: "1px solid var(--red-border)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              border: "none",
              background:
                "linear-gradient(135deg, var(--accent-deep) 0%, var(--accent) 100%)",
              color: "var(--surface-0)",
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
              boxShadow: "0 4px 20px var(--accent-glow)",
              transition: "filter 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!submitting)
                (e.currentTarget as HTMLElement).style.filter =
                  "brightness(1.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.filter = "brightness(1)";
            }}
          >
            {submitting
              ? "Bitte warten…"
              : mode === "login"
                ? "Anmelden"
                : "Konto erstellen"}
          </button>
        </form>

        {mode === "register" && (
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 16,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Dein öffentlicher Link wird automatisch über eine sichere Verbindung
            (SSH) erzeugt.
            <br />
            (Dank deines einzigartigen Schlüssels bleibt er immer gleich!)
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="input-field"
      />
    </div>
  );
}
