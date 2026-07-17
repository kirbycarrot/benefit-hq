"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

type NavItem = { label: string; href: string; active: boolean };

function useNavItems(): NavItem[] {
  const pathname = usePathname();

  const planYearMatch = pathname.match(/^\/clients\/([^/]+)\/plan-years\/([^/]+)/);
  if (planYearMatch) {
    const [, clientId, planYearId] = planYearMatch;
    const base = `/clients/${clientId}/plan-years/${planYearId}`;
    const isDeckBuilder = pathname.startsWith(`${base}/charts`);
    return [
      { label: "Workspace", href: base, active: !isDeckBuilder },
      { label: "Policy details", href: `${base}#policy-details`, active: false },
      { label: "Census", href: `${base}#census`, active: false },
      { label: "Deck builder", href: `${base}/charts`, active: isDeckBuilder },
    ];
  }

  return [{ label: "Clients", href: "/clients", active: pathname.startsWith("/clients") }];
}

export function Sidebar({
  userEmail,
  signOutAction,
}: {
  userEmail: string;
  signOutAction: () => Promise<void>;
}) {
  const navItems = useNavItems();

  return (
    <div className="flex h-full w-[232px] shrink-0 flex-col bg-ink-900 px-4 py-6">
      <Link href="/clients" className="mb-6 flex items-center gap-2.5 px-2">
        <Logo variant="sidebar" />
        <span className="text-[15px] font-extrabold text-white">Benefit HQ</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={
              item.active
                ? "rounded-[10px] bg-sidebar-active px-3.5 py-2.5 text-sm font-semibold text-white"
                : "rounded-[10px] px-3.5 py-2.5 text-sm text-warm-hero-mid hover:text-white"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="border-t border-ink-700 pt-3.5">
        <div className="mb-1.5 truncate text-xs text-text-500">{userEmail}</div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-xs font-semibold text-teal-bright hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
