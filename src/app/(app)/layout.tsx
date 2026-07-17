import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Header } from "@/components/Header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen bg-bg-light">
      <Header userEmail={session.user?.email ?? ""} signOutAction={signOutAction} />
      <main className="px-11 py-10">{children}</main>
    </div>
  );
}
