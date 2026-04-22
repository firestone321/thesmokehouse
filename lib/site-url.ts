function normalizeConfiguredSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Site URL configuration cannot be blank.");
  }

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(`Invalid site URL configuration: ${value}`);
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error(`Site URL must use https outside local development: ${value}`);
  }

  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/$/, "");
}

function getConfiguredSiteUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) {
      continue;
    }

    return normalizeConfiguredSiteUrl(candidate);
  }

  return null;
}

export function resolveSiteOrigin(requestUrl?: string): string {
  const configured = getConfiguredSiteUrl();
  if (configured) {
    return configured;
  }

  if (!requestUrl) {
    throw new Error(
      "Missing site URL configuration. Set NEXT_PUBLIC_SITE_URL or SITE_URL for payment callbacks."
    );
  }

  return normalizeConfiguredSiteUrl(new URL(requestUrl).origin);
}
