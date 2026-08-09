import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRuntime } from "@/components/pwa/pwa-runtime";
import { AuthRedirectListener } from "@/components/auth/auth-redirect-listener";
import { BiometricLockGate } from "@/components/auth/biometric-lock-gate";
import { RouteTransition } from "@/components/layout/route-transition";
import { OfflineRuntime } from "@/components/offline/offline-runtime";
import { DrawerInteractions } from "@/components/layout/drawer-interactions";
import { AppleDockNavigation } from "@/components/layout/apple-dock";

export const metadata: Metadata = {
  title: "Luna — personal finance",
  applicationName: "Luna",
  description: "A clear, calm view of your balance, cash flow, and recent activity.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico" },
  appleWebApp: {
    capable: true,
    title: "Luna",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#356b68",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-x-clip">
        <PwaRuntime />
        <OfflineRuntime />
        <AuthRedirectListener />
        <RouteTransition />
        <DrawerInteractions />
        <BiometricLockGate>{children}</BiometricLockGate>
        <AppleDockNavigation />
      </body>
    </html>
  );
}
