import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  await connection();
  const userCount = await prisma.user.count();
  return <LoginForm showSignUp={userCount === 0} />;
}
