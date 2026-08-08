import type { ShellIconName } from "./shell-icons";

export const PRIMARY_ITEMS: Array<{
  key: "new" | "search" | "inbox" | "issues" | "runtimes";
  icon: ShellIconName;
  href?: string;
}> = [
  { key: "new", icon: "new", href: "/new" },
  { key: "search", icon: "search" },
  { key: "inbox", icon: "inbox", href: "/inbox" },
  { key: "issues", icon: "issue", href: "/issues" },
  { key: "runtimes", icon: "repository", href: "/runners" },
];
