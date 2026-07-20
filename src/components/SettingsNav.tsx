"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/settings/users", label: "User management" },
  { href: "/settings/clients", label: "Client management" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex flex-wrap gap-2 border-b border-border-light pb-4">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-ink-900 px-4 py-2.5 text-[13px] font-semibold text-white"
                : "rounded-full border border-input-border bg-white px-4 py-2.5 text-[13px] font-semibold text-text-600 hover:border-text-300 hover:text-text-900"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
