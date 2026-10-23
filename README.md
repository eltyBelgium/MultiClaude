# MultiClaude

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-%E2%98%95-ffdd00?style=flat&labelColor=1a1a1a)](https://buymeacoffee.com/elty.belgium)
[![Latest release](https://img.shields.io/github/v/release/eltyBelgium/MultiClaude)](https://github.com/eltyBelgium/MultiClaude/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**[Download](https://github.com/eltyBelgium/MultiClaude/releases/latest)** · [Code signing policy](CODE_SIGNING_POLICY.md)

Tray app that runs several isolated Claude Desktop accounts side by side. Built with Electron. Runs on macOS, Windows and Linux.

## Features

- Profiles with a name, colour and optional global hotkey
- Each profile gets its own data folder under `~/ClaudeProfiles/<name>`
- Finds Claude Desktop in the default install locations automatically
- Tray menu: open Claude Desktop, open a Claude Code terminal, show data folder
- Claude Code per profile through `CLAUDE_CONFIG_DIR`
- Start at login
- Removing a profile keeps its data folder, so the login can be restored

## Where it looks for Claude Desktop

| Platform | Locations, in order |
|---|---|
| macOS | `/Applications/Claude.app`, `~/Applications/Claude.app`, `/Applications/Setapp/Claude.app`, then Spotlight by bundle ID |
| Windows | `%LOCALAPPDATA%\AnthropicClaude\claude.exe`, `%LOCALAPPDATA%\Programs\Claude`, `Program Files` and `Program Files (x86)`, newest Squirrel `app-x.y.z` folder, Microsoft Store / MSIX package, then PATH |
| Linux | `/usr/bin/claude-desktop` (official apt package), `/usr/local/bin`, `/opt/Claude`, `/opt/claude-desktop`, `/usr/lib/claude-desktop`, `~/.local/bin`, PATH, then a `claude*.AppImage` in `~/Applications` or `~/Downloads` |

Settings has a "Search again" button and a "Change" button to set the path by hand.

MSIX installs cannot be started by file path. The app first tries the executable inside the package, then starts Claude through its AppUserModelID with the profile argument.

## Run in development

```bash
npm install
npm start
npm test        # detection unit tests
```

## Build an installer

```bash
npm run dist:mac     # .dmg, build on a Mac
npm run dist:win     # .exe, build on Windows
npm run dist:linux   # .AppImage and .deb, build on Linux
```

Output lands in `dist/`.

## Code signing

Signing switches on in CI once the GitHub secrets exist. Without them, macOS builds are ad-hoc signed and Windows builds are unsigned. See the [Code signing policy](CODE_SIGNING_POLICY.md).

Windows signing through SignPath Foundation (free for open source) needs secret `SIGNPATH_API_TOKEN` and variables `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG` and optionally `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG`. Each release then waits for manual approval in SignPath before it is published.

Alternatively, Windows can be signed with Azure Artifact Signing:

| Platform | Secret or variable | Value |
|---|---|---|
| macOS | secret `CSC_LINK` | Developer ID Application certificate as base64 `.p12` |
| macOS | secret `CSC_KEY_PASSWORD` | Password of that `.p12` |
| macOS | secret `APPLE_ID` | Apple ID email |
| macOS | secret `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| macOS | secret `APPLE_TEAM_ID` | 10-character Team ID |
| Windows | secret `AZURE_TENANT_ID` | Entra tenant ID |
| Windows | secret `AZURE_CLIENT_ID` | App registration client ID |
| Windows | secret `AZURE_CLIENT_SECRET` | App registration client secret |
| Windows | variable `AZURE_SIGNING_ENDPOINT` | Region endpoint, e.g. `https://weu.codesigning.azure.net` |
| Windows | variable `AZURE_SIGNING_ACCOUNT` | Artifact Signing account name |
| Windows | variable `AZURE_CERT_PROFILE` | Certificate profile name |

The app registration needs the role "Artifact Signing Certificate Profile Signer" on the signing account.

## Support

The Support panel in the app links to GitHub issues, `sales@elty.be`, the latest release and Buy Me a Coffee. The tray Support menu has the same links without the coffee button. Links live in `src/config.js`.

## Requirements

- Node.js 18 or newer
- Claude Desktop installed
- Claude Code CLI (`claude`) in PATH for the Code button
- Linux tray icon: GNOME needs the AppIndicator extension (installed by default on Ubuntu)

## Releasing

Every push to `main` builds all installers. When the `version` in `package.json` has no GitHub Release yet, the workflow publishes release `v<version>` with the installers and a `SHA256SUMS.txt` attached. To ship a new version, bump `version` and push.

Download the latest installers from the [Releases page](https://github.com/eltyBelgium/MultiClaude/releases/latest).

## License

[MIT](LICENSE). Independent tool. Not affiliated with or endorsed by Anthropic.
