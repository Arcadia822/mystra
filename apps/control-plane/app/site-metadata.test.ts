import { describe, expect, it } from "vitest";

import { SITE_DESCRIPTION, siteMetadata } from "./site-metadata";

describe("Mystra site metadata", () => {
  it("uses the owner-approved product title across site and social metadata", () => {
    expect(siteMetadata.title).toBe("Mystra");
    expect(siteMetadata.applicationName).toBe("Mystra");
    expect(siteMetadata.openGraph).toEqual(expect.objectContaining({
      title: "Mystra",
      siteName: "Mystra",
    }));
    expect(siteMetadata.twitter).toEqual(expect.objectContaining({ title: "Mystra" }));
  });

  it("derives its description and discoverability terms from the 5xP product contract", () => {
    expect(SITE_DESCRIPTION).toBe(
      "Mystra is an open-source platform for autonomous software delivery. Describe what you want built; agents plan, implement, test, and deliver pull requests.",
    );
    expect(siteMetadata.description).toBe(SITE_DESCRIPTION);
    expect(siteMetadata.openGraph).toEqual(expect.objectContaining({ description: SITE_DESCRIPTION }));
    expect(siteMetadata.twitter).toEqual(expect.objectContaining({ description: SITE_DESCRIPTION }));
    expect(siteMetadata.keywords).toEqual(expect.arrayContaining([
      "autonomous software delivery",
      "coding agents",
      "self-hosted agent infrastructure",
      "software development lifecycle",
    ]));
  });
});
