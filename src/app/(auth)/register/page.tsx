import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegisterForm } from "@/components/RegisterForm";

export default async function RegisterPage() {
  await connection();
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  return <RegisterForm />;
}
