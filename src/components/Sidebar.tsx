import { Logo } from "./Logo";
import { SidebarNav } from "./SidebarNav";

export function Sidebar({
  userEmail,
  isAdmin,
  signOutAction,
}: {
  userEmail: string;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex h-full w-56 shrink-0 flex-col bg-ink-900 px-3 py-5">
      <div className="flex items-center gap-2.5 px-2">
        <Logo variant="header" />
        <span className="text-sm font-extrabold text-white">Benefit HQ</span>
      </div>

      <div className="mt-6">
        <SidebarNav isAdmin={isAdmin} />
      </div>

      <div className="flex-1" />

      <div className="border-t border-[#1c2825] px-2 pt-3">
        <p className="truncate text-xs font-semibold text-white">{userEmail}</p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-1 text-xs text-[#7c8b87] hover:text-[#c7d0cd]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
