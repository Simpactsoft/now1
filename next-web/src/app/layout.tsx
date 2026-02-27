import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Geist, Geist_Mono } from "next/font/google";
import { Heebo } from "next/font/google";
import "./globals.css";
import AgGridRegistry from "@/lib/ag-grid-registry";
import DashboardShell from "@/components/DashboardShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/context/LanguageContext";
import { SessionProvider } from "@/context/SessionContext";
import { cookies } from "next/headers";
import { getPeopleCount } from "@/app/actions/getPeopleCount";
import { getCurrentUser } from "@/app/actions/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { activateUser } from "@/app/actions/activateUser";
import { QueryProvider } from "@/components/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NOW System",
  description: "NOW System — CRM & Business Management Platform",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "any" },
    ],
    apple: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const tenantId = cookieStore.get("tenant_id")?.value;

  // [Fix] Check auth FIRST before making any DB calls
  const userResult = await getCurrentUser();
  let userProfile = null;
  const isAuthenticated = userResult.success && userResult.data;

  let peopleCount = 0;
  if (tenantId && isAuthenticated) {
    const res = await getPeopleCount(tenantId);
    if (typeof res === "number") {
      peopleCount = res;
    } else if (res && res.success) {
      peopleCount = res.data;
    }
  }

  // Fetch tenant RTL setting
  let isRtl = false;
  if (tenantId && isAuthenticated) {
    try {
      const supabaseTenant = await createClient();
      const { data: tenantSettings } = await supabaseTenant
        .from("tenants")
        .select("rtl_enabled")
        .eq("id", tenantId)
        .maybeSingle();
      isRtl = tenantSettings?.rtl_enabled ?? false;
    } catch {
      // Gracefully fall back to LTR
    }
  }

  // Fetch User Profile Server-Side (Zero Latency)
  if (isAuthenticated) {
    const user = userResult.data;
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      // Auto-Activate if invited
      if (data.status === 'invited') {
        await activateUser(user.id);
        data.status = 'active'; // Reflect immediately
      }

      userProfile = {
        name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || user.email || "User",
        role: data.role || "User",
        email: user.email || "",
      };
    } else {
      console.warn('[RootLayout] Profile query returned no data for user:', user.email);
      userProfile = {
        name: user.email?.split('@')[0] || "User",
        role: "User",
        email: user.email || "",
      };
    }
    console.log('[RootLayout] Constructed Profile:', userProfile);
  }

  const fontClasses = isRtl
    ? `${heebo.variable} ${geistMono.variable}`
    : `${geistSans.variable} ${geistMono.variable}`;

  return (
    <html lang={isRtl ? "he" : "en"} dir={isRtl ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={`${fontClasses} antialiased`}
        style={isRtl ? { fontFamily: 'var(--font-heebo), sans-serif' } : undefined}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <LanguageProvider>
              <SessionProvider user={userProfile}>
                <AgGridRegistry />
                <DashboardShell
                  currentTenantId={tenantId}
                  peopleCount={peopleCount}
                  userProfile={userProfile}
                >
                  {children}
                </DashboardShell>
                <Toaster position="top-right" theme="system" />
              </SessionProvider>
            </LanguageProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
