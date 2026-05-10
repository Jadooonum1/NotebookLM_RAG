import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotebookLM — Chat with Your Documents",
  description:
    "Upload any PDF or text document and have an intelligent, grounded conversation with it. Powered by RAG (Retrieval-Augmented Generation).",
  keywords: ["RAG", "NotebookLM", "document chat", "AI", "PDF", "vector search"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📓</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
