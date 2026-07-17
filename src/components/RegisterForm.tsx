"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, setupToken }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created, but sign-in failed. Try logging in.");
      return;
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <AuthShell
      heading="Set up your firm's workspace."
      description="One account per broker — invite teammates once you're in."
      cardEyebrow="Get started"
      cardTitle="Create account"
    >
      <form onSubmit={handleSubmit}>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-900">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-[10px] border border-input-border px-3.5 py-3 text-sm focus:border-teal-deep focus:outline-none"
        />
        <label className="mb-1.5 block text-[13px] font-semibold text-text-900">
          Work email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-[10px] border border-input-border px-3.5 py-3 text-sm focus:border-teal-deep focus:outline-none"
        />
        <label className="mb-1.5 block text-[13px] font-semibold text-text-900">
          Password
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-1.5 w-full rounded-[10px] border border-input-border px-3.5 py-3 text-sm focus:border-teal-deep focus:outline-none"
        />
        <p className="mb-[18px] text-[11px] text-text-400">Minimum 8 characters</p>
        <label className="mb-1.5 block text-[13px] font-semibold text-text-900">
          Workspace setup token
        </label>
        <input
          type="password"
          required
          autoComplete="off"
          value={setupToken}
          onChange={(e) => setSetupToken(e.target.value)}
          className="mb-1.5 w-full rounded-[10px] border border-input-border px-3.5 py-3 text-sm focus:border-teal-deep focus:outline-none"
        />
        <p className="mb-[18px] text-[11px] text-text-400">
          Provided by the person deploying Benefit HQ
        </p>
        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink-900 py-[15px] text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
        <p className="mt-[18px] text-center text-[13px] text-text-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-link hover:text-link-hover">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
