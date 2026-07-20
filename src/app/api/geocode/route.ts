import { NextResponse } from "next/server";
import { auth } from "@/auth";

export type AddressSuggestion = {
  id: string;
  label: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};

type MapboxFeature = {
  properties: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
    context?: {
      postcode?: { name?: string };
      place?: { name?: string };
      region?: { region_code?: string };
    };
  };
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ suggestions: [] });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const mapboxUrl = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  mapboxUrl.searchParams.set("q", query);
  mapboxUrl.searchParams.set("autocomplete", "true");
  mapboxUrl.searchParams.set("types", "address");
  mapboxUrl.searchParams.set("country", "us");
  mapboxUrl.searchParams.set("limit", "5");
  mapboxUrl.searchParams.set("access_token", token);

  let response: Response;
  try {
    response = await fetch(mapboxUrl, { signal: AbortSignal.timeout(5000) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
  if (!response.ok) {
    return NextResponse.json({ suggestions: [] });
  }

  const data = (await response.json()) as { features?: MapboxFeature[] };
  const suggestions: AddressSuggestion[] = (data.features ?? [])
    .map((feature) => {
      const props = feature.properties;
      return {
        id: props.mapbox_id ?? `${props.name}-${props.full_address}`,
        label: props.full_address ?? [props.name, props.place_formatted].filter(Boolean).join(", "),
        line1: props.name ?? "",
        city: props.context?.place?.name ?? "",
        state: props.context?.region?.region_code ?? "",
        postalCode: props.context?.postcode?.name ?? "",
      };
    })
    .filter((suggestion) => suggestion.line1 && suggestion.city && suggestion.state);

  return NextResponse.json({ suggestions });
}
