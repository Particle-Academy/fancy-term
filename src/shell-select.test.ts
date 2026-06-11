import { describe, it, expect } from "vitest";
import { decideShellSelect, decideShellSwitch } from "./shell-select";
import { BUILTIN_SHELLS, resolveShell, type ShellProfile } from "./types";

const SHELLS: ShellProfile[] = [
  { id: "bash", label: "Bash", icon: "$", command: "bash" },
  { id: "pwsh", label: "PowerShell", icon: "PS", command: "pwsh" },
];

describe("resolveShell + BUILTIN_SHELLS", () => {
  it("resolves an id to its profile", () => {
    expect(resolveShell(SHELLS, "pwsh")).toEqual(SHELLS[1]);
  });

  it("returns undefined for unknown ids / missing inputs", () => {
    expect(resolveShell(SHELLS, "zsh")).toBeUndefined();
    expect(resolveShell(undefined, "bash")).toBeUndefined();
    expect(resolveShell(SHELLS, undefined)).toBeUndefined();
  });

  it("ships JSON-friendly built-in presets (primitives only)", () => {
    const ids = BUILTIN_SHELLS.map((s) => s.id);
    expect(ids).toEqual(["cmd", "powershell", "pwsh", "git-bash", "bash", "zsh"]);
    // every preset is plain JSON (no functions / ReactNodes)
    expect(JSON.parse(JSON.stringify(BUILTIN_SHELLS))).toHaveLength(6);
  });
});

describe("decideShellSelect (the setShell / ShellSwitcher decision)", () => {
  it("resolves the profile and flags a real change", () => {
    expect(decideShellSelect(SHELLS, "bash", "pwsh")).toEqual({
      profile: SHELLS[1],
      changed: true,
    });
  });

  it("reports changed=false when re-selecting the active shell", () => {
    expect(decideShellSelect(SHELLS, "bash", "bash")).toEqual({
      profile: SHELLS[0],
      changed: false,
    });
  });

  it("is a no-op (null) for an unknown id", () => {
    expect(decideShellSelect(SHELLS, "bash", "nope")).toBeNull();
  });
});

describe("decideShellSwitch (the session reset-and-reconnect decision)", () => {
  it("signals a switch when the shell changes", () => {
    expect(decideShellSwitch("bash", "pwsh")).toEqual({ changed: true });
    expect(decideShellSwitch(undefined, "bash")).toEqual({ changed: true });
  });

  it("does not signal when the shell is unchanged", () => {
    expect(decideShellSwitch("bash", "bash")).toEqual({ changed: false });
    expect(decideShellSwitch(undefined, undefined)).toEqual({ changed: false });
  });
});
