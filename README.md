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

## Support

The Support panel in the app links to GitHub issues, `sales@elty.be`, the latest release and Buy Me a Coffee. The tray Support menu has the same links without the coffee button. Links live in `src/config.js`.

## Requirements

- Node.js 18 or newer
- Claude Desktop installed
- Claude Code CLI (`claude`) in PATH for the Code button
- Linux tray icon: GNOME needs the AppIndicator extension (installed by default on Ubuntu)

## Releasing

| Branch | What happens on push |
|---|---|
| `dev` | Tests and builds all installers. Nothing is published. |
| `main` | Publishes GitHub Release `v<version>` if that release does not exist yet. |

To ship a new version: bump `version` in `package.json` on `dev`, open a pull request from `dev` to `main`, and merge it.

Download the latest installers from the [Releases page](https://github.com/eltyBelgium/MultiClaude/releases/latest).

## License

[MIT](LICENSE). Independent tool. Not affiliated with or endorsed by Anthropic.
