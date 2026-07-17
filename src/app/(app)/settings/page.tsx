import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/UsersManager";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, isAdmin: true },
  });

  return (
    <div>
      <h1 className="text-[26px] font-extrabold text-text-900">Settings</h1>

      <div className="mt-8">
        <h2 className="mb-1 text-[19px] font-extrabold text-text-900">Users</h2>
        <p className="mb-[18px] text-sm text-text-600">
          Admins can create and remove accounts. Everyone in the workspace shares the same
          clients and data.
        </p>
        <UsersManager users={users} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
