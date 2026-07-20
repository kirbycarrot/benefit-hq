import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/UsersManager";

export default async function UserManagementPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, isAdmin: true },
  });

  return (
    <section>
      <h2 className="text-[19px] font-extrabold text-text-900">User management</h2>
      <p className="mt-1 mb-[18px] max-w-[760px] text-sm text-text-600">
        Create and remove workspace accounts. Everyone in the workspace shares the same clients and data.
      </p>
      <UsersManager users={users} currentUserId={session.user.id} />
    </section>
  );
}
