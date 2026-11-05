import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Danchi", template: "%s | Danchi" },
  description: "A little home for everything.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Danchi", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FFE1CF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        {/* Catch Chrome's "you can install this" moment early, so the Install button can use it later. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("danchi-theme")||"light";var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){document.documentElement.dataset.theme=t==="auto"?(m.matches?"dark":"light"):t};a();m.addEventListener("change",a)}catch(e){}})();window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__danchiInstall=e;window.dispatchEvent(new Event("danchi-installable"))});`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
