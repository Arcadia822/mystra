import type { Metadata } from "next";

export const SITE_DESCRIPTION = "Mystra is an open-source platform for autonomous software delivery. Describe what you want built; agents plan, implement, test, and deliver pull requests.";

export const siteMetadata: Metadata = {
  title: "Mystra",
  applicationName: "Mystra",
  description: SITE_DESCRIPTION,
  authors: [{ name: "Mystra" }],
  creator: "Mystra",
  publisher: "Mystra",
  category: "technology",
  keywords: [
    "autonomous software delivery",
    "coding agents",
    "self-hosted agent infrastructure",
    "software development lifecycle",
    "AI software engineering",
    "open-source developer tools",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Mystra",
    siteName: "Mystra",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Mystra",
    description: SITE_DESCRIPTION,
  },
};
