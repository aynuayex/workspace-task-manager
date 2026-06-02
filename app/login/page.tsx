"use client";

import React, { useState } from "react";
import Link from "next/link";
import { login } from "@/app/auth/actions";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-radial from-[#111] to-[#000] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 relative">
        {/* Decorative background glow */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl" />

        <div className="text-center relative">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 ring-1 ring-purple-500/30 mb-4">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Welcome to Synapse
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to access your workspaces & projects
          </p>
        </div>

        <div className="mt-8 relative backdrop-blur-xl bg-zinc-900/50 border border-zinc-800/80 p-8 rounded-2xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                className="w-full px-4 py-3 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 text-white placeholder-zinc-600 outline-none transition duration-200 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-4 pr-10 py-3 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 text-white placeholder-zinc-600 outline-none transition duration-200 focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 transition duration-200 cursor-pointer shadow-lg shadow-purple-600/20 hover:scale-[1.01]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center border-t border-zinc-800/80 pt-6">
            <p className="text-sm text-zinc-400">
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold text-purple-400 hover:text-purple-300 hover:underline">
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
