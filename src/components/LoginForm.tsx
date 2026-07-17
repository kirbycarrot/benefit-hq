"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export function LoginForm({ showSignUp }: { showSignUp: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <AuthShell
      heading="From census data to a client-ready proposal."
      description="Manage clients, plan years, and census data, then generate a branded benefits deck in minutes."
      statusNote="Every client is tenant-isolated end to end."
      cardEyebrow="Welcome back"
      cardTitle="Sign in"
    >
      <form onSubmit={handleSubmit}>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-900">
          Work email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-[18px] w-full rounded-[10px] border border-input-border px-3.5 py-3 text-sm focus:border-teal-deep focus:outline-none"
        />
        <label className="mb-1.5 block text-[13px] font-semibold text-text-900">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-[22px] w-full rounded-[10px] border border-input-border px-3.5 py-3 text-sm focus:border-teal-deep focus:outline-none"
        />
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink-900 py-[15px] text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {showSignUp && (
          <p className="mt-[18px] text-center text-[13px] text-text-600">
            Need an account?{" "}
            <Link href="/register" className="font-semibold text-link hover:text-link-hover">
              Sign up
            </Link>
          </p>
        )}
      </form>
    </AuthShell>
  );
}
