import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.isAdmin) redirect("/settings/users");

  return (
    <section className="max-w-[720px] rounded-[14px] border border-border-light bg-white p-5 shadow-[0_1px_2px_rgba(20,24,26,0.04)] sm:p-7">
      <h2 className="text-[19px] font-extrabold text-text-900">Account</h2>
      <p className="mt-2 text-sm leading-6 text-text-600">
        You are signed in as <span className="font-semibold text-text-900">{session?.user?.email}</span>.
        User and client administration is available to workspace administrators.
      </p>
    </section>
  );
}
