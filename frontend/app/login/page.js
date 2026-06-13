"use client";

import { useState } from "react";
import { setToken, getToken } from "@/lib/auth.js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to home.
  useEffect(() => {
    if (getToken()) router.replace("/");
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      setToken(data.token, data.user);
      router.replace("/");
    } catch (err) {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h1 style={styles.title}>Land Registry</h1>
        <p style={styles.subtitle}>Private Blockchain</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
          {error && <div style={styles.error}>{error}</div>}
        </form>

        <div style={styles.creds}>
          <h4 style={styles.credsTitle}>Demo Credentials</h4>
          <table style={styles.credsTable}>
            <thead>
              <tr>
                <th style={styles.credsTh}>Username</th>
                <th style={styles.credsTh}>Password</th>
                <th style={styles.credsTh}>Role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.credsTd}>
                  <code>admin</code>
                </td>
                <td style={styles.credsTd}>
                  <code>admin123</code>
                </td>
                <td style={styles.credsTd}>Full access</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>malpot1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>malpot123</code>
                </td>
                <td style={styles.credsTd}>Register land, view all</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>official1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>official123</code>
                </td>
                <td style={styles.credsTd}>Register land, forced transfer</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>bank1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>bank123</code>
                </td>
                <td style={styles.credsTd}>Set/clear mortgages</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>court1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>court123</code>
                </td>
                <td style={styles.credsTd}>Resolve disputes</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>seller1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>seller123</code>
                </td>
                <td style={styles.credsTd}>Sell own land</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>buyer1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>buyer123</code>
                </td>
                <td style={styles.credsTd}>Buy land, file disputes</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>user1</code>
                </td>
                <td style={styles.credsTd}>
                  <code>land123</code>
                </td>
                <td style={styles.credsTd}>General user 1</td>
              </tr>
              <tr>
                <td style={styles.credsTd}>
                  <code>user2</code>
                </td>
                <td style={styles.credsTd}>
                  <code>land123</code>
                </td>
                <td style={styles.credsTd}>General user 2</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "#0f0f0f",
    padding: 20,
  },
  card: {
    background: "#1a1a1a",
    borderRadius: 12,
    border: "1px solid #333",
    padding: "32px 40px",
    maxWidth: 440,
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  input: {
    background: "#0f0f0f",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "12px 16px",
    color: "#e0e0e0",
    fontSize: 15,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  btn: {
    padding: "12px 24px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
    background: "#4caf50",
    color: "#fff",
    width: "100%",
  },
  error: {
    color: "#f44336",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  creds: {
    marginTop: 28,
    borderTop: "1px solid #333",
    paddingTop: 20,
  },
  credsTitle: {
    fontSize: 13,
    color: "#888",
    margin: "0 0 10px 0",
    textAlign: "center",
  },
  credsTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12,
  },
  credsTh: {
    textAlign: "left",
    padding: "4px 8px",
    borderBottom: "1px solid #333",
    color: "#666",
    fontWeight: 600,
    textTransform: "uppercase",
    fontSize: 10,
    letterSpacing: 1,
  },
  credsTd: {
    padding: "4px 8px",
    borderBottom: "1px solid #222",
    color: "#aaa",
  },
};
