export interface SkillFileFixture {
  content?: string;
  mediaType: string;
  path: string;
  previewable: boolean;
  size: string;
}

export interface SkillRevisionFixture {
  contentDigest: string;
  createdAt: string;
  files: readonly SkillFileFixture[];
  sequence: number;
  zipSize: string;
}

export interface SkillFixture {
  description: string;
  name: string;
  revisions: readonly SkillRevisionFixture[];
  status: "active" | "archived";
  updatedAt: string;
}

export const skillFixtures: readonly SkillFixture[] = [
  {
    description: "Review an engineering plan before task decomposition.",
    name: "plan-eng-review",
    revisions: [
      {
        contentDigest: "sha256:6e0c…b192",
        createdAt: "17 Aug 2026 · 14:32",
        sequence: 3,
        zipSize: "42 KB",
        files: [
          { content: "---\nname: plan-eng-review\ndescription: Review engineering plans before task decomposition.\n---\n\n# Plan engineering review\n\nInspect architecture, data flow, failure modes, tests, security, and performance.", mediaType: "text/markdown", path: "SKILL.md", previewable: true, size: "6.4 KB" },
          { content: "# Failure review\n\nCheck publication consistency, retries, and partial failure recovery.", mediaType: "text/markdown", path: "references/failure-review.md", previewable: true, size: "12.8 KB" },
          { content: "#!/usr/bin/env bash\nset -euo pipefail\n\nprintf '%s\\n' 'run review checks'", mediaType: "text/x-shellscript", path: "scripts/check.sh", previewable: true, size: "2.1 KB" },
          { mediaType: "image/png", path: "assets/review-map.png", previewable: false, size: "20.7 KB" },
        ],
      },
      {
        contentDigest: "sha256:f071…83ad",
        createdAt: "11 Aug 2026 · 09:18",
        sequence: 2,
        zipSize: "38 KB",
        files: [
          { content: "---\nname: plan-eng-review\ndescription: Review engineering plans.\n---", mediaType: "text/markdown", path: "SKILL.md", previewable: true, size: "5.9 KB" },
          { content: "# Failure review", mediaType: "text/markdown", path: "references/failure-review.md", previewable: true, size: "11.4 KB" },
        ],
      },
    ],
    status: "active",
    updatedAt: "12 minutes ago",
  },
  {
    description: "Create and maintain precise API and interface contracts.",
    name: "api-and-interface-design",
    revisions: [{
      contentDigest: "sha256:913b…0f27",
      createdAt: "16 Aug 2026 · 17:08",
      sequence: 1,
      zipSize: "24 KB",
      files: [
        { content: "---\nname: api-and-interface-design\ndescription: Create stable interfaces.\n---", mediaType: "text/markdown", path: "SKILL.md", previewable: true, size: "8.2 KB" },
        { content: "# Error model", mediaType: "text/markdown", path: "references/errors.md", previewable: true, size: "15.8 KB" },
      ],
    }],
    status: "active",
    updatedAt: "Yesterday",
  },
  {
    description: "Legacy deployment checklist retained for audit.",
    name: "old-shipping-checklist",
    revisions: [{
      contentDigest: "sha256:1bc2…df04",
      createdAt: "03 Aug 2026 · 10:06",
      sequence: 1,
      zipSize: "9 KB",
      files: [{ content: "---\nname: old-shipping-checklist\ndescription: Legacy checklist.\n---", mediaType: "text/markdown", path: "SKILL.md", previewable: true, size: "9 KB" }],
    }],
    status: "archived",
    updatedAt: "Archived 2 weeks ago",
  },
] as const;
