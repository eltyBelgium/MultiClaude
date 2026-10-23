# Code signing policy

Free code signing for Windows provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## What is signed

Only the Windows installers (`ClaudeProfiles-Setup-*.exe`) published on the [Releases page](https://github.com/eltyBelgium/MultiClaude/releases) are signed. They are built automatically by GitHub Actions from the source code in this repository. No binary is built or signed on a personal machine.

## Team roles

| Role | Members |
|---|---|
| Committers and reviewers | [Tyas](https://github.com/eltyBelgium) |
| Approvers | [Tyas](https://github.com/eltyBelgium) |

Every release is approved manually by an approver before it is signed. Changes from people outside the committer list are reviewed before they are merged.

All team members use multi-factor authentication for GitHub and SignPath.

## Privacy policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

MultiClaude starts Claude Desktop and Claude Code on your computer with a separate data folder per profile. It contains no telemetry, analytics or update checks. The Support menu only opens a web page or your email client when you click it.

## macOS and Linux

macOS builds are ad-hoc signed until an Apple Developer ID is available. Linux packages are not signed.
