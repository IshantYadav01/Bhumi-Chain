// auth.js — JWT token management for the frontend.
//
// Usage:
//   import { getToken, setToken, clearToken, authHeaders } from "@/lib/auth.js";

const TOKEN_KEY = "landreg_token";
const USER_KEY = "landreg_user";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, userInfo) {
  localStorage.setItem(TOKEN_KEY, token);
  if (userInfo) setUserInfo(userInfo);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function setUserInfo(info) {
  if (info) localStorage.setItem(USER_KEY, JSON.stringify(info));
}

export function getUserInfo() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function getRoles() {
  const info = getUserInfo();
  return info?.roles || [];
}

export function hasRole(role) {
  return getRoles().includes(role);
}

export function hasAnyRole(...roles) {
  return roles.some((r) => getRoles().includes(r));
}

// Returns headers object with Authorization if a token exists.
export function authHeaders() {
  const token = getToken();
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// fetchWithAuth wraps fetch() and redirects to /login on 401.
export async function fetchWithAuth(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please login again.");
  }
  return res;
}
