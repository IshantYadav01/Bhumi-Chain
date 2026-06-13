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

  return (<div className="min-h-screen flex items-center justify-center bg-[#F6F8FA] p-5">
    <div className="bg-[#FFFFFF] rounded-2xl border border-[#D0D7DE] p-10 w-full max-w-md shadow-sm">
      <div className="flex items-center justify-center flex-col">
        <img src="/images/logo.png" alt="Land Registry" className="h-10 mb-2" />
        <p className="text-xs text-[#57606A]  text-center mb-4">
          Tamper-proof land registry system where every transfer, offer, and approval is permanently recorded on-chain.
        </p>
      </div>
      {/* <p className="text-sm text-[#57606A] mb-7">
        {mode === "login" ? "Please sign in!" : "Create a new account"}
      </p> */}

      {error && (
        <div className="bg-[#FFEBEB] border border-[#FFC1C1] rounded-md px-3 py-2 text-xs text-[#CF222E] mb-3 font-medium">
          {error}
        </div>
      )}

      <label className="text-xs text-[#57606A] block mb-1 font-medium">
        National ID (NID)
      </label>
      <input
        className="w-full bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg px-3.5 py-2.5 text-sm text-[#24292F] placeholder-[#8C95A0] focus:outline-none focus:border-[#3B5BDB] transition-colors mb-3.5"
        placeholder="Enter your NID"
        value={nid}
        onChange={(e) => setNid(e.target.value)}
      />

      <label className="text-xs text-[#57606A] block mb-1 font-medium">Password</label>
      <input
        className="w-full bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg px-3.5 py-2.5 text-sm text-[#24292F] placeholder-[#8C95A0] focus:outline-none focus:border-[#3B5BDB] transition-colors mb-3.5"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {mode === "signup" && (
        <>
          <label className="text-xs text-[#57606A] block mb-1 font-medium">Full Name</label>
          <input
            className="w-full bg-[#FFFFFF] border border-[#D0D7DE] rounded-lg px-3.5 py-2.5 text-sm text-[#24292F] placeholder-[#8C95A0] focus:outline-none focus:border-[#3B5BDB] transition-colors mb-3.5"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="text-xs text-[#57606A] block mb-1 font-medium">Role</label>
          <select
            className="w-full bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg px-3.5 py-2.5 text-sm text-[#24292F] focus:outline-none focus:border-[#3B5BDB] focus:bg-[#FFFFFF] transition-colors mb-3.5"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="customer">Customer (buy/sell)</option>
            <option value="admin">Admin (register & approve)</option>
          </select>
        </>
      )}

      <button
        className={`w-full py-2.5 rounded-lg text-sm font-semibold mt-1 transition-colors ${loading || !nid || !password
          ? "bg-[#3B5BDB] text-white opacity-40 cursor-not-allowed"
          : "bg-[#3B5BDB] text-white hover:bg-[#2F4AC4] cursor-pointer"
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

      <hr className="border-[#F0F2F5] my-5" />

      <p
        className="text-xs text-[#57606A] text-center cursor-pointer hover:text-[#3B5BDB] font-medium transition-colors"
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
  </div>);
}
