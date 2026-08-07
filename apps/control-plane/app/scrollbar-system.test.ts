import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readAppFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("global scrollbar system", () => {
  it("uses one theme-aware scrollbar rule for every native scroll container", () => {
    const css = readAppFile("./globals.css");

    expect(css).toMatch(/\*\s*\{[\s\S]*?scrollbar-width:\s*thin;[\s\S]*?scrollbar-color:\s*transparent transparent;[\s\S]*?\}/);
    expect(css).toMatch(/\*:hover,[\s\S]*?\*:focus-within,[\s\S]*?\[data-scrolling="true"\][\s\S]*?scrollbar-color:\s*var\(--border\) transparent;/);
    expect(css.match(/scrollbar-width\s*:/g)).toHaveLength(1);
    expect(css.match(/scrollbar-color\s*:/g)).toHaveLength(2);
    expect(css).not.toContain("::-webkit-scrollbar");
  });

  it("mounts one passive global activity listener at the application root", () => {
    const layout = readAppFile("./layout.tsx");
    const activity = readAppFile("./_components/scrollbar-activity.tsx");

    expect(layout).toMatch(/import \{ ScrollbarActivity \} from "\.\/_components\/scrollbar-activity";/);
    expect(layout.match(/<ScrollbarActivity \/>/g)).toHaveLength(1);
    expect(activity).toMatch(/document\.addEventListener\("scroll", handleScroll, \{ capture: true, passive: true \}\)/);
    expect(activity).toMatch(/setTimeout\(\(\) => clear\(target\), IDLE_DELAY_MS\)/);
    expect(activity).toMatch(/const IDLE_DELAY_MS = 700;/);
  });
});
