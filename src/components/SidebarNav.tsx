"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsSubItems = [
  { href: "/settings/users", label: "User management" },
  { href: "/settings/clients", label: "Client management" },
];

function navItemClass(active: boolean): string {
  return active
    ? "block rounded-[10px] bg-white/10 px-3 py-2.5 text-[13px] font-semibold text-white"
    : "block rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[#c7d0cd] hover:bg-white/5 hover:text-white";
}

function subNavItemClass(active: boolean): string {
  return active
    ? "block rounded-[8px] bg-white/10 px-3 py-2 text-xs font-medium text-white"
    : "block rounded-[8px] px-3 py-2 text-xs font-medium text-[#9fb0ac] hover:bg-white/5 hover:text-white";
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const inSettings = pathname.startsWith("/settings");

  return (
    <nav aria-label="Primary" className="space-y-1">
      <Link href="/clients" className={navItemClass(!inSettings)}>
        Clients
      </Link>
      <Link
        href={isAdmin ? "/settings/users" : "/settings"}
        className={navItemClass(inSettings)}
      >
        {isAdmin ? "Settings" : "Account"}
      </Link>
      {isAdmin && inSettings && (
        <div className="ml-3 space-y-1 border-l border-[#1c2825] pl-2">
          {settingsSubItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={subNavItemClass(pathname === item.href)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
