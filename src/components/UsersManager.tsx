"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

const inputClass =
  "rounded-[10px] border border-input-border bg-white px-3 py-2.5 text-[13px] focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-xs font-semibold text-text-900";

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, isAdmin }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setIsAdmin(false);
    router.refresh();
  }

  async function handleRemove(id: string) {
    setError(null);
    setRemovingId(id);

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });

    setRemovingId(null);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <div className="mb-3.5 overflow-x-auto rounded-[14px] border border-border-light bg-white shadow-[0_1px_2px_rgba(20,24,26,0.04)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel-tint">
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-600">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-600">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-600">Role</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border-lighter">
                <td className="px-5 py-3 text-text-900">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-2 rounded-full bg-panel-tint px-2 py-0.5 text-[11px] font-semibold text-text-600">
                      You
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-text-900">{user.email}</td>
                <td className="px-5 py-3 text-text-900">
                  {user.isAdmin ? "Admin" : "Member"}
                </td>
                <td className="px-5 py-3 text-right">
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleRemove(user.id)}
                      disabled={removingId === user.id}
                      className="text-xs font-semibold text-destructive hover:text-red-800 disabled:opacity-50"
                    >
                      {removingId === user.id ? "Removing..." : "Remove"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-[14px] rounded-[14px] border border-dashed border-input-border p-5"
      >
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} w-[160px]`}
          />
        </div>
        <div>
          <label className={labelClass}>Work email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} w-[220px]`}
          />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} w-[160px]`}
          />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-[13px] font-semibold text-text-900">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="h-4 w-4 rounded border-input-border accent-ink-900"
          />
          Admin
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-ink-900 px-5 py-2.5 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-black disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add user"}
        </button>
        {error && <p className="w-full text-sm text-destructive">{error}</p>}
      </form>
    </div>
  );
}
