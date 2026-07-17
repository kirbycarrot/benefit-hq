import Link from "next/link";
import { Logo } from "./Logo";

export function Header({
  userEmail,
  signOutAction,
}: {
  userEmail: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border-light bg-white px-11 py-[18px]">
      <Link href="/clients" className="flex items-center gap-2.5">
        <Logo variant="header" />
        <span className="text-[15px] font-extrabold text-text-900">Benefit HQ</span>
      </Link>
      <div className="flex items-center gap-[22px]">
        <span className="text-[13px] text-text-600">{userEmail}</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[13px] font-semibold text-link hover:text-link-hover"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
