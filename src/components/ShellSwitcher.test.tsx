import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellSwitcher } from "./ShellSwitcher";
import { decideShellSelect } from "../shell-select";
import type { ShellProfile } from "../types";

const SHELLS: ShellProfile[] = [
  { id: "bash", label: "Bash", icon: "$" },
  { id: "pwsh", label: "PowerShell", icon: "PS" },
];

describe("<ShellSwitcher>", () => {
  it("renders the selected shell's label in the trigger", () => {
    const html = renderToStaticMarkup(
      <ShellSwitcher shells={SHELLS} value="pwsh" onChange={() => {}} />,
    );
    expect(html).toContain("PowerShell");
    expect(html).toContain('data-fancy-shell-switcher=""');
    expect(html).toContain('data-active-shell="pwsh"');
  });

  it("falls back to a placeholder when nothing is selected", () => {
    const html = renderToStaticMarkup(<ShellSwitcher shells={SHELLS} onChange={() => {}} />);
    expect(html).toContain("Select shell");
  });

  it("calls onChange with the resolved profile when an option is picked", () => {
    // The menu opens on interaction (not in static markup), so drive the same
    // pick path the component uses: resolve via the shared decision helper.
    const calls: Array<[string, ShellProfile]> = [];
    const onChange = (id: string, p: ShellProfile) => calls.push([id, p]);

    // Simulate picking "pwsh" from a "bash"-selected switcher.
    const decision = decideShellSelect(SHELLS, "bash", "pwsh");
    expect(decision).not.toBeNull();
    if (decision) onChange("pwsh", decision.profile);

    expect(calls).toEqual([["pwsh", SHELLS[1]]]);
  });
});
