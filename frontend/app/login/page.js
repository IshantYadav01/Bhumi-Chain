"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth.js";
import { Fingerprint, Lock, User, ShieldCheck, Map, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen flex bg-white">
      {/* Left Panel: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-10 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-2 mb-6">
              {/* Fallback icon if logo.png is missing */}
               <img src='images/logo.png' className='h-10'/>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {mode === "login" ? "Welcome back" : "Create an account"}
            </h2>
            <p className="text-gray-500 text-sm">
              {mode === "login"
                ? "Enter your credentials."
                : "Join the tamper-proof land registry system today."}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                National ID (NID)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Fingerprint className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  className="block w-full pl-11 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]/20 focus:border-[#3B5BDB] transition-all bg-gray-50/50"
                  placeholder="Enter your NID"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  className="block w-full pl-11 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]/20 focus:border-[#3B5BDB] transition-all bg-gray-50/50"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {mode === "signup" && (
              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      className="block w-full pl-11 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]/20 focus:border-[#3B5BDB] transition-all bg-gray-50/50"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <ShieldCheck className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      className="block w-full pl-11 pr-10 py-2.5 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#3B5BDB]/20 focus:border-[#3B5BDB] transition-all bg-gray-50/50 appearance-none"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="customer">Customer (Buy/Sell)</option>
                      <option value="admin">Admin (Register & Approve)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 mt-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 ${
                loading || !nid || !password
                  ? "bg-gray-300 cursor-not-allowed shadow-none"
                  : "bg-[#3B5BDB] hover:bg-[#2F4AC4] hover:shadow-lg hover:shadow-[#3B5BDB]/30 active:scale-[0.98]"
              }`}
              disabled={loading || !nid || !password}
              onClick={mode === "login" ? handleLogin : handleSignup}
            >
              {loading
                ? "Processing..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center">
            <p className="text-sm text-gray-500">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                className="font-semibold text-[#3B5BDB] hover:text-[#2F4AC4] transition-colors"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? "Sign up here" : "Sign in instead"}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel: Visual/Brand Presentation */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center">
        {/* Abstract Background Design */}
        <div className="absolute inset-0">
          <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-[#3B5BDB]/30 to-purple-600/30 blur-3xl" />
          <div className="absolute bottom-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-blue-400/20 to-teal-400/20 blur-3xl" />
          {/* Subtle Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-12 max-w-lg text-white">

          <h2 className="text-4xl font-bold mb-6 leading-tight">
            The future of <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              land registration.
            </span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed mb-8">
            A tamper-proof system where every transfer, offer, and approval is permanently and transparently recorded on the blockchain. Eliminate fraud and streamline property ownership.
          </p>

          {/* UI decorative element */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">System Status</p>
              <p className="text-xs text-slate-400">All nodes operational</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
