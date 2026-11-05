/** "Chrome on Android" from a user agent. Good enough to recognise your own phone. */
export function describeDevice(ua?: string | null): { label: string; emoji: string } {
  const u = ua ?? "";
  const os = /android/i.test(u)
    ? "Android"
    : /iphone|ipad|ipod/i.test(u)
      ? "iPhone"
      : /windows/i.test(u)
        ? "Windows"
        : /mac os x|macintosh/i.test(u)
          ? "Mac"
          : /linux/i.test(u)
            ? "Linux"
            : "Unknown device";
  const browser = /edg\//i.test(u)
    ? "Edge"
    : /samsungbrowser/i.test(u)
      ? "Samsung Internet"
      : /firefox|fxios/i.test(u)
        ? "Firefox"
        : /chrome|crios/i.test(u)
          ? "Chrome"
          : /safari/i.test(u)
            ? "Safari"
            : "Browser";
  const emoji = os === "Android" || os === "iPhone" ? "📱" : "💻";
  return { label: u ? `${browser} on ${os}` : "Unknown device", emoji };
}

/** Hide most of an IP address: 203.106.x.x */
export function maskIp(ip?: string | null) {
  if (!ip) return "";
  if (ip.includes(".")) return ip.split(".").slice(0, 2).join(".") + ".x.x";
  return ip.split(":").slice(0, 3).join(":") + ":x";
}
