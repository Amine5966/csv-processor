import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google"
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const bricolage_Grotesque = Bricolage_Grotesque({
  subsets: ["latin"],
})


export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
         className={bricolage_Grotesque.className}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
