# dsh-kde-tint
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen?style=for-the-badge)](https://github.com/RichardLitt/standard-readme)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://spdx.org/licenses/MIT.html)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-4D6BFE?style=for-the-badge)](https://github.com/topics/dsh-plugin)
[![powered by dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=for-the-badge&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://www.linux.org/)

> [!WARNING]
> Personal-use project. It is built and tested for my own machine and workflow only; I do not guarantee it works on other DSH versions, platforms or setups. Review the code first and use it at your own risk.

Tint the DSH web UI with the KDE system accent color.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
  - [What gets tinted](#what-gets-tinted)
  - [What is not tinted](#what-is-not-tinted)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

The DSH web UI ships a neutral theme. On a KDE desktop the user already picks a color scheme. This plugin reads the **currently applied** colors and tints the DSH interface with them. The harness then matches the desktop.

The plugin has two halves. The host half (`lib/index.js`) reads the `Colors:*` sections that Plasma writes to `~/.config/kdeglobals`; on Material You / dynamic-color setups those sections carry the live palette, while the `.colors` file on disk can be stale. It serves the result as JSON from the profile web server. The browser half (`lib/client.js`) fetches the JSON and applies the tint through the `theme` service. The two halves talk over plain HTTP. A static client bundle has no host bridge, so HTTP is the correct channel.

The tint accent is `Colors:Selection.BackgroundNormal` (the applied selection color), not `General.AccentColor`, which often stays at an old manual value. `Colors:Window`, `Colors:View` and `Colors:Button` seed the surface ramp: the deepest canvas, the panel layer and the raised layer.

On systems without KDE configuration the plugin falls back to the active color-scheme file, then to defaults (accent `#386798`, scheme `MaterialYouDark`). It never blocks startup because of a missing config file.

## Install

```sh
dsh plugin --profile web add github:iwinoid/dsh-kde-tint
```

Local development uses a link install instead:

```sh
dsh plugin --profile web add link:/path/to/dsh-kde-tint
```

The package has no build step, so a git install needs no `allowBuilds` exception. The package ships `cordis.patch.yml` through `dsh.bundle.patch`, so the loader mounts it with no manual patch step. Restart `dsh web` after install.

Check the install:

```sh
dsh --profile web --dump-config | grep -A3 kde-tint
```

Then open the DSH web UI. Surfaces, controls, borders and scrollbars carry the applied KDE palette.

## Usage

The plugin needs no clicks. It loads with `immediately: true` and tints the UI on every page load. Uninstall (or disable) restores the stock theme. The token override is effect-scoped, so it unwinds with the plugin.

Upgrading from 0.2.x changes the host half as well, so restart `dsh web` once; after that a page refresh is enough.

### What gets tinted

The client builds a light and a dark palette from the applied scheme and overrides 57 DSH tokens. Surfaces mix 10–24% of the accent into the scheme's own base colors, so the UI keeps the desktop's depth instead of washing out. When the scheme is dark, `Colors:View` becomes the canvas, `Colors:Window` the sidebar, and `Colors:Button` the raised layers; a light scheme seeds the light palette the same way, and the other mode falls back to a neutral base plus accent.

| Group | Tokens |
| --- | --- |
| Surfaces | `bg-base`, `bg-layer-1/2/3`, `sidebar-fill`, `bg-overlay`, `bg-document-preview`, `bg-skeleton` |
| Message bubbles | `specific-bubble`, `specific-bubble-highlight` |
| Raised panels | `bg-module-platform`, `specific-input-major`, menu surfaces, `markdown-code-block` (+ banner, inline code, tag) |
| State fills | `interactive-bg-hover` / `-active` / `-hover-solid` |
| Neutral controls | `button-elevated-fill`, `button-floating-fill` / `-hover`, `button-ghost-active-fill` / `-border`, `button-contrast-fill`, `button-tool-bar-fill` / `-hover`, `specific-selector`, `switch-thumb` |
| Navigation | `specific-sidebar-nav-item-hover` / `-active` |
| Borders | `border-l1` … `border-l4`, `border-l2-darkmode-thin` |
| Scrollbars | `scrollbar-bg-l1` / `-l2`, `scrollbar-hover-l1` / `-l2` |
| Brand | `brand-primary` (raw selection accent), `button-primary-hover`, `button-primary-dimmed` |
| Toast / tooltip | `tooltip-bg`, `toast-bg` |
| Onboarding | `onboarding-card-fill`, `onboarding-secondary-fill`, `onboarding-checkbox-border` |

`--dsw-alias-label-primary-foreground` (the label on primary buttons) is picked from black or white by the accent's contrast, so it stays above 4.5:1 for any accent. Text tokens stay neutral (`#1a1d22` / `#e6e8eb` primary).

The plugin also defines three tokens that the installed DSH 0.2.1-rc.3 still references but never declares (`--dsw-alias-bg-layer-4`, `--dsw-alias-bg-l1`, `--dsw-alias-bg-l2`), because the missing variables otherwise leave some backgrounds unresolved.

A few DSH components hardcode their background in a component-local CSS variable, so token overrides cannot reach them. The client injects one small stylesheet that overrides these variables from the same palette (light and dark values follow `body[data-ds-dark-theme]`):

| Local variable | Component |
| --- | --- |
| `--dsw-hovercard-bg` | hover preview bubble (hardcoded `#2C2C2E`) |
| `--deliverable-fill` / `--deliverable-hover` | delivered-file cards in the transcript (hardcoded neutral 50/850) |
| `--changes-fill` / `--changes-hover` | changed-file card header (hardcoded neutral 50/850) |

### What is not tinted

Controls that already carry the DSH emphasis color keep it: `state-business-*` (focus borders, active underlines, references), `button-info-*` (the send button), links, the dock drop indicator, and semantic success/warning/error and diff colors. Shiki syntax colors and the terminal ANSI palette also stay as shipped.

## API

Debug endpoint on the profile web server:

```sh
curl http://localhost:<dsh-port>/api/kde-tint/kde-colors
```

`GET /api/kde-tint/kde-colors` returns `200` with JSON:

```json
{
  "accent": "#7c8fa3",
  "background": "#122236",
  "view": "#081421",
  "button": "#182b41",
  "tooltip": "#122236",
  "header": "#122236",
  "scheme": "MaterialYouDark",
  "source": "kdeglobals"
}
```

`accent` is `Colors:Selection.BackgroundNormal` from the applied `kdeglobals` (the live scheme Material You writes), not `General.AccentColor`, which often stays at an old manual value. `background`, `view`, `button` and `tooltip` come from the matching `Colors:*` background entries and seed the surface ramp; they are `null` when the scheme does not define them. Values are normalized to `#rrggbb` (the sources may use `#hex` or `r,g,b`).

`source` is `kdeglobals`, `scheme-file` (fallback to `~/.local/share/color-schemes` or `/usr/share/color-schemes`) or `defaults`. `scheme` is `General.ColorScheme`. When the read fails, the response still returns `200` with the default values plus an `error` string. Unknown routes return `404`.

## Maintainers

- [iwinoid](https://github.com/iwinoid) — iwinoid@outlook.com

## Contributing

Bug reports and questions are welcome on the [GitHub Issues](https://github.com/iwinoid/dsh-kde-tint/issues) page. Pull requests are accepted. The client bundle is hand-written with no build step. Keep it that way.

## License

[MIT](LICENSE) © iwinoid
