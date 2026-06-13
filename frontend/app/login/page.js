"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth.js";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [nid, setNid] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("customer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nid, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setToken(data.token, data.user);
      router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nid, password, name: name || nid, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      setMode("login");
      setError("");
      alert("Account created! Please login.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] p-5">
      <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#7c3aed] m-0 mb-1">
          Land Registry
        </h1>
        <p className="text-sm text-[#888] mb-7">
          {mode === "login" ? "Sign in with your NID" : "Create a new account"}
        </p>

        {error && (
          <div className="bg-[#3b1111] border border-[#ef4444] rounded-md px-3 py-2 text-xs text-[#fca5a5] mb-3">
            {error}
          </div>
        )}

        <label className="text-xs text-[#aaa] block mb-1">
          National ID (NID)
        </label>
        <input
          className="w-full bg-[#0f0f1a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] mb-3.5"
          placeholder="e.g. admin, NID-001"
          value={nid}
          onChange={(e) => setNid(e.target.value)}
        />

        <label className="text-xs text-[#aaa] block mb-1">Password</label>
        <input
          className="w-full bg-[#0f0f1a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] mb-3.5"
          type="password"
          placeholder="e.g. admin123, pass123"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "signup" && (
          <>
            <label className="text-xs text-[#aaa] block mb-1">Full Name</label>
            <input
              className="w-full bg-[#0f0f1a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] mb-3.5"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <label className="text-xs text-[#aaa] block mb-1">Role</label>
            <select
              className="w-full bg-[#0f0f1a] border border-[#333] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] mb-3.5"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="customer">Customer (buy/sell)</option>
              <option value="admin">Admin (register & approve)</option>
            </select>
          </>
        )}

        <button
          className={`w-full py-2.5 rounded-lg text-sm font-semibold mt-1 ${
            loading || !nid || !password
              ? "bg-[#7c3aed] text-white opacity-40 cursor-not-allowed"
              : "bg-[#7c3aed] text-white cursor-pointer"
          }`}
          disabled={loading || !nid || !password}
          onClick={mode === "login" ? handleLogin : handleSignup}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Sign In"
              : "Create Account"}
        </button>

        <hr className="border-[#2a2a3e] my-5" />

        <p
          className="text-xs text-[#888] text-center cursor-pointer"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </p>
      </div>
    </div>
  );
}
