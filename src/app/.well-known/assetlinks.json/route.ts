/**
 * Lets the Android app (APK built with PWABuilder / Bubblewrap) open Danchi
 * full screen, without a browser bar. Put the app's signing certificate
 * fingerprint in .env:
 *   ANDROID_PACKAGE=com.rafiarsya.danchi
 *   ANDROID_CERT_SHA256=AA:BB:CC:...
 */
export function GET() {
  const pkg = process.env.ANDROID_PACKAGE;
  const sha = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const body =
    pkg && sha.length
      ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: sha } }]
      : [];
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
