import "server-only";

const localHostnames = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parseHostname(host: string | null | undefined) {
  if (!host) {
    return null;
  }

  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return host.toLowerCase();
  }
}

export function isLocalhostBypassEnabledForHost(host: string | null | undefined) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const hostname = parseHostname(host);

  return hostname ? localHostnames.has(hostname) : false;
}
