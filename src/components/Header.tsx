import Link from "next/link";
import { Logo } from "./Logo";

export function Header({
  userEmail,
  isAdmin,
  signOutAction,
}: {
  userEmail: string;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border-light bg-white px-4 py-4 sm:px-6 lg:px-11 lg:py-[18px]">
      <Link href="/clients" className="flex shrink-0 items-center gap-2.5">
        <Logo variant="header" />
        <span className="text-[15px] font-extrabold text-text-900">Benefit HQ</span>
      </Link>
      <div className="flex min-w-0 items-center gap-3 sm:gap-[22px]">
        <Link
          href={isAdmin ? "/settings/users" : "/settings"}
          className="rounded-full border border-input-border bg-white px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap text-text-900 hover:border-text-300"
        >
          Settings
        </Link>
        <span className="hidden max-w-[240px] truncate text-[13px] text-text-600 md:block">
          {userEmail}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[13px] font-semibold whitespace-nowrap text-link hover:text-link-hover"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
