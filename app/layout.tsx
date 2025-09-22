import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Sanity - AI-Powered Dataset Validation",
  description: "Automated data quality checks with AI insights and annotated outputs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}