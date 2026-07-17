import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { BootstrapClosedError, bootstrapAdmin, bootstrapTokenMatches } from "@/lib/bootstrap";
import { bootstrapLimiter, clientIp, rateLimitKey } from "@/lib/rateLimit";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  setupToken: z.string().min(1, "Setup token is required"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const ipKey = rateLimitKey("bootstrap", clientIp(request));
  const rateLimit = bootstrapLimiter.check(ipKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many setup attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const expectedToken = process.env.BOOTSTRAP_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "Workspace setup is unavailable until BOOTSTRAP_TOKEN is configured." },
      { status: 503 }
    );
  }

  const { name, email, password, setupToken } = parsed.data;
  if (!bootstrapTokenMatches(setupToken, expectedToken)) {
    bootstrapLimiter.recordFailure(ipKey);
    return NextResponse.json({ error: "Invalid setup token" }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await bootstrapAdmin({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });
  } catch (error) {
    if (error instanceof BootstrapClosedError) {
      return NextResponse.json(
        { error: "Registration is closed. Ask an admin to create your account." },
        { status: 403 }
      );
    }
    throw error;
  }

  bootstrapLimiter.reset(ipKey);

  return NextResponse.json({ ok: true });
}
