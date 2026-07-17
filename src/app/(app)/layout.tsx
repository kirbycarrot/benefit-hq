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
    <div className="flex min-h-screen">
      <Sidebar userEmail={session.user?.email ?? ""} signOutAction={signOutAction} />
      <main className="min-w-0 flex-1 bg-bg-light px-11 py-9">{children}</main>
    </div>
  );
}
