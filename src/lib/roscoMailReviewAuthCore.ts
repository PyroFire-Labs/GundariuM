const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export interface RoscoOwnerAuthorizerDependencies {
  getOwnerAddress(): string | undefined;
  getSessionAddress(sessionId: string): Promise<string | null>;
  sessionCookieName: string;
}

function getCookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;

  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key !== name || value.length === 0) continue;
    try {
      return decodeURIComponent(value.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function createRoscoOwnerAuthorizer({
  getOwnerAddress,
  getSessionAddress,
  sessionCookieName,
}: RoscoOwnerAuthorizerDependencies) {
  return async function authorizeRoscoOwner(request: Request): Promise<Response | null> {
    const ownerAddress = getOwnerAddress()?.trim().toLowerCase();
    if (!ownerAddress || !ADDRESS_PATTERN.test(ownerAddress)) {
      return Response.json(
        { error: "Rosco review access is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const sessionId = getCookieValue(request, sessionCookieName);
    if (!sessionId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const sessionAddress = await getSessionAddress(sessionId);
    if (!sessionAddress || sessionAddress.toLowerCase() !== ownerAddress) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    return null;
  };
}
