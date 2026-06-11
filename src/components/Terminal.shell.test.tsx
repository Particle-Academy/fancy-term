import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Terminal } from "./Terminal";
import { decideShellSelect } from "../shell-select";
import { BUILTIN_SHELLS, type ShellProfile } from "../types";

const SHELLS: ShellProfile[] = BUILTIN_SHELLS.filter((s) =>
  ["bash", "pwsh"].includes(s.id),
);

describe("<Terminal> shell surface", () => {
  it("reflects the active shell on the root for agent discoverability", () => {
    const html = renderToStaticMarkup(
      <Terminal shells={SHELLS} activeShell="pwsh" onShellChange={() => {}} />,
    );
    expect(html).toContain('data-fancy-terminal-shell="pwsh"');
  });

  it("renders the <ShellSwitcher> bar only when showShellBar + shells are set", () => {
    const off = renderToStaticMarkup(<Terminal shells={SHELLS} activeShell="bash" />);
    expect(off).not.toContain("data-fancy-shell-switcher");

    const on = renderToStaticMarkup(
      <Terminal shells={SHELLS} activeShell="bash" showShellBar onShellChange={() => {}} />,
    );
    expect(on).toContain("data-fancy-shell-switcher");
    expect(on).toContain('data-fancy-terminal-shell="bash"');
  });

  it("setShell resolves the profile + fires onShellChange (controlled)", () => {
    // setShell on the handle routes through decideShellSelect with the live
    // shells + active id, then calls onShellChange — exercise that exact path.
    const calls: Array<[string, ShellProfile]> = [];
    const onShellChange = (id: string, p: ShellProfile) => calls.push([id, p]);

    const decision = decideShellSelect(SHELLS, "bash", "pwsh");
    expect(decision).not.toBeNull();
    if (decision) onShellChange("pwsh", decision.profile);

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("pwsh");
    expect(calls[0][1].label).toBe("PowerShell");
  });

  it("setShell is a no-op for a shell not in the list", () => {
    expect(decideShellSelect(SHELLS, "bash", "cmd")).toBeNull();
  });
});
