import { auth } from "@/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.isAdmin ?? false;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[26px] font-extrabold text-text-900">
          {isAdmin ? "Settings" : "Account"}
        </h1>
        <p className="mt-1 max-w-[720px] text-sm text-text-600">
          {isAdmin
            ? "Manage workspace access, clients, and administrative tools."
            : "Your workspace access and account details."}
        </p>
      </div>
      {children}
    </div>
  );
}
