import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  // Required when the app is reached via more than one host (bare IP during
  // setup, the real domain through Caddy afterward) — Auth.js otherwise
  // rejects any request whose Host header doesn't match a single configured
  // AUTH_URL. Safe here since Caddy/the network boundary is the actual
  // trust boundary, not this header.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin: boolean }).isAdmin;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
};
