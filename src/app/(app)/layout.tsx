import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-bg-light">
      <div className="sticky top-0 h-screen">
        <Sidebar
          userEmail={session.user?.email ?? ""}
          isAdmin={session.user?.isAdmin ?? false}
          signOutAction={signOutAction}
        />
      </div>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-11 lg:py-9">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
