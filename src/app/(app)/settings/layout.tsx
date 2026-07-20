import { auth } from "@/auth";
import { SettingsNav } from "@/components/SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin ?? false;

  return (
    <div className="max-w-[1180px]">
      <div className="mb-7">
        <h1 className="text-[26px] font-extrabold text-text-900">Settings</h1>
        <p className="mt-1 max-w-[720px] text-sm text-text-600">
          Manage workspace access, clients, and administrative tools.
        </p>
      </div>
      {isAdmin && <SettingsNav />}
      <div className={isAdmin ? "mt-7" : ""}>{children}</div>
    </div>
  );
}
