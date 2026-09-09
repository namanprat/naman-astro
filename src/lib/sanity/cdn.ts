export function isSanityCdnUrl(url: string): boolean {
  return url.includes("cdn.sanity.io");
}

export function withSanityWidth(url: string, width: number): string {
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}w=${width}&fit=max&auto=format`;
}
