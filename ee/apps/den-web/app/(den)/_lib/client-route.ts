export function getComparablePathname(target: string | null | undefined): string | null {
  const trimmed = target?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed;
    }
  }

  return trimmed.split(/[?#]/)[0] ?? trimmed;
}

export function isSamePathname(currentPathname: string, target: string | null | undefined) {
  const comparable = getComparablePathname(target);
  if (!comparable) {
    return false;
  }

  return comparable === currentPathname;
}

export function getSafeInternalReturnTo(target: string | null | undefined): string | null {
  const trimmed = target?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://renwork.invalid");
    if (parsed.origin !== "https://renwork.invalid" || parsed.pathname === "/sign-in") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function buildSignInRoute(returnTo?: string | null): string {
  const safeReturnTo = getSafeInternalReturnTo(returnTo);
  if (!safeReturnTo) {
    return "/sign-in";
  }

  return `/sign-in?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
