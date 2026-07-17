import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import {
  clientIp,
  loginAccountLimiter,
  loginIpLimiter,
  rateLimitKey,
} from "@/lib/rateLimit";

// Comparing a password for unknown users reduces the timing difference between
// unknown-email and wrong-password failures.
const DUMMY_PASSWORD_HASH =
  "$2b$12$LQv3c1yqBW/VErWbfXc1ueW2ZJfN4Jp6iYwT5S.jQx5YgHhD1QWmK";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const ipKey = rateLimitKey("login-ip", clientIp(request));
        const accountKey = rateLimitKey("login-account", clientIp(request), email);
        if (!loginIpLimiter.check(ipKey).allowed || !loginAccountLimiter.check(accountKey).allowed) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

        if (!user || !valid) {
          loginIpLimiter.recordFailure(ipKey);
          loginAccountLimiter.recordFailure(accountKey);
          return null;
        }

        loginAccountLimiter.reset(accountKey);

        return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
      },
    }),
  ],
});
