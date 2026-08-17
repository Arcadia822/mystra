import type { ShellIconName } from "./shell-icons";

export const PRIMARY_ITEMS: Array<{
  key: "overview" | "inbox" | "tasks" | "runtimes";
  icon: ShellIconName;
  href: string;
}> = [
  { key: "overview", icon: "overview", href: "/" },
  { key: "inbox", icon: "inbox", href: "/inbox" },
  { key: "tasks", icon: "list", href: "/tasks" },
  { key: "runtimes", icon: "repository", href: "/runners" },
];
