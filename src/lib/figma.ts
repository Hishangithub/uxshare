export function isFigmaUrl(u: string) {
  try {
    const url = new URL(u);
    return url.hostname.endsWith("figma.com");
  } catch { return false; }
}

export function toFigmaEmbed(u: string) {
  const enc = encodeURIComponent(u);
  return `https://www.figma.com/embed?embed_host=share&url=${enc}`;
}
