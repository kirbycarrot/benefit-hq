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
      <Header
        userEmail={session.user?.email ?? ""}
        isAdmin={session.user?.isAdmin ?? false}
        signOutAction={signOutAction}
      />
      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-11 lg:py-10">
        {children}
      </main>
    </div>
  );
}
