import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, saveLogo, storedLogoPathFromUrl } from "@/lib/storage";
import { detectLogoType } from "@/lib/uploads";
import { newClientIntakeSchema } from "@/lib/client-onboarding";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = newClientIntakeSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    primaryIndustry: formData.get("primaryIndustry"),
    primaryRenewalMonth: formData.get("primaryRenewalMonth"),
    primaryRenewalDay: formData.get("primaryRenewalDay"),
    headquartersLine1: formData.get("headquartersLine1"),
    headquartersLine2: formData.get("headquartersLine2") || undefined,
    headquartersCity: formData.get("headquartersCity"),
    headquartersState: formData.get("headquartersState"),
    headquartersPostalCode: formData.get("headquartersPostalCode"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  let logoPath: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be under 5MB" }, { status: 400 });
    }
    const buffer = Buffer.from(await logo.arrayBuffer());
    const logoType = detectLogoType(buffer);
    if (!logoType) {
      return NextResponse.json(
        { error: "Logo must be a valid PNG, JPEG, or WebP image" },
        { status: 400 }
      );
    }
    logoPath = await saveLogo(logoType.extension, buffer);
  }

  let client;
  try {
    client = await prisma.$transaction(async (tx) => {
      return tx.client.create({
        data: {
          name: parsed.data.displayName,
          primaryColor: parsed.data.primaryColor,
          secondaryColor: parsed.data.secondaryColor,
          logoPath,
          createdById: session.user.id,
          profile: {
            create: {
              legalName: parsed.data.legalName,
              primaryIndustry: parsed.data.primaryIndustry,
              primaryRenewalMonth: parsed.data.primaryRenewalMonth,
              primaryRenewalDay: parsed.data.primaryRenewalDay,
              statesWithEmployees: [parsed.data.headquartersState],
            },
          },
          locations: {
            create: {
              name: "Headquarters",
              line1: parsed.data.headquartersLine1,
              line2: parsed.data.headquartersLine2 || null,
              city: parsed.data.headquartersCity,
              state: parsed.data.headquartersState,
              postalCode: parsed.data.headquartersPostalCode,
              country: "United States",
              isHeadquarters: true,
              sortOrder: 0,
            },
          },
        },
      });
    });
  } catch (error) {
    const storedLogo = storedLogoPathFromUrl(logoPath);
    if (storedLogo) await deleteStoredFile(storedLogo);
    throw error;
  }

  return NextResponse.json({ id: client.id, onboarding: true });
}
