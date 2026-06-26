import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { LazyMotion, domAnimation } from "framer-motion";

export const metadata: Metadata = {
  metadataBase: new URL("https://craftastudio.ai"),
  title: "CraftaStudio — Architecture First. Code Second.",
  description:
    "Describe your system. CraftaStudio plans the full architecture visually, then generates every block — frontend, backend, database — in parallel. Join the waitlist for early access.",
  icons: {
    icon: "/logocrafta.png",
    shortcut: "/logocrafta.png",
    apple: "/logocrafta.png",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://craftastudio.ai" },
  openGraph: {
    title: "CraftaStudio — Architecture First. Code Second.",
    description:
      "Describe your system. CraftaStudio plans the full architecture visually, then generates every block — frontend, backend, database — in parallel.",
    url: "https://craftastudio.ai",
    siteName: "CraftaStudio",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CraftaStudio — Architecture First. Code Second.",
    description:
      "Describe your system. CraftaStudio plans the full architecture visually, then generates every block — frontend, backend, database — in parallel.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: { colorPrimary: '#9333ea' },
        elements: {
          card: "bg-surface/50 border border-border backdrop-blur-xl",
          headerTitle: "text-foreground font-bold",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "border-border hover:bg-surface-hover/50 text-foreground",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
          formFieldLabel: "text-foreground",
          formFieldInput: "bg-background border-border text-foreground focus:ring-purple-600",
          footerActionText: "text-muted-foreground",
          footerActionLink: "text-purple-500 hover:text-purple-400"
        }
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          suppressHydrationWarning
          className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <LazyMotion features={domAnimation}>
              {children}
            </LazyMotion>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}