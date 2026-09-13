# dsh-tinted-theme
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen?style=for-the-badge)](https://github.com/RichardLitt/standard-readme)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://spdx.org/licenses/MIT.html)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-4D6BFE?style=for-the-badge)](https://github.com/topics/dsh-plugin)
[![powered by dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=for-the-badge&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://www.linux.org/)

Tint the DSH web UI with the KDE system accent color.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
  - [What gets tinted](#what-gets-tinted)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

The DSH web UI ships a neutral theme. On a KDE desktop the user already picks an accent color in System Settings. This plugin reads that color and tints the DSH interface with it. The harness then matches the desktop.

The plugin has two halves. The host half (`lib/index.js`) reads `~/.config/kdeglobals` and the active color-scheme file. It serves the result as JSON from the profile web server. The browser half (`lib/client.js`) fetches the JSON and applies the tint through the `theme` service. The two halves talk over plain HTTP. A static client bundle has no host bridge, so HTTP is the correct channel.

On systems without KDE configuration the plugin falls back to defaults (accent `#386798`, scheme `KlassyDark`). It never blocks startup because of a missing config file.

## Install

```sh
dsh plugin --profile web add link:/path/to/dsh-tinted-theme
# or, once published:
dsh plugin --profile web add dsh-tinted-theme
```

The package ships `cordis.patch.yml` through `dsh.bundle.patch`, so the loader mounts it with no manual patch step. Restart `dsh web` after install.

Check the install:

```sh
dsh --profile web --dump-config | grep -A3 tinted-theme
```

Then open the DSH web UI. The background and borders carry a tint of the KDE accent color.

## Usage

The plugin needs no clicks. It loads with `immediately: true` and tints the UI on every page load. Uninstall (or disable) restores the stock theme. The token override is effect-scoped, so it unwinds with the plugin.

### What gets tinted

The client mixes the KDE accent into the base surfaces. Light mode keeps a white base with 6–16% accent. Dark mode keeps a dark base with 6–8% accent. Brand primary uses the raw accent in both modes.

| Token | Light | Dark |
| --- | --- | --- |
| `--dsw-alias-bg-base` | white ＋ 6% accent | `#0a0f14` ＋ 8% accent |
| `--dsw-alias-bg-layer-1` / sidebar fill | white ＋ 8% accent | `#11161c` ＋ 7% accent |
| `--dsw-alias-bg-layer-2` | white ＋ 11% accent | `#1a2028` ＋ 6% accent |
| `--dsw-alias-bg-layer-3` | white ＋ 14% accent | `#232d37` |
| `--dsw-alias-border-l1` / `-l2` | white ＋ 12% / 16% accent | `#2a323d` / `#303a47` |
| `--dsw-alias-brand-primary` | raw accent | raw accent |

Text tokens stay neutral (`#1a1d22` / `#e6e8eb` primary). Only surfaces and brand follow the accent.

## API

Debug endpoint on the profile web server:

```sh
curl http://localhost:<dsh-port>/api/tinted-theme/kde-colors
```

`GET /api/tinted-theme/kde-colors` returns `200` with JSON:

```json
{ "accent": "#386798", "background": "#ffffff", "scheme": "KlassyDark" }
```

`accent` comes from `General.AccentColor` in `kdeglobals` (RGB triple or `#hex`). `scheme` comes from `General.ColorScheme`. `background` comes from `Colors:Window.BackgroundNormal` (or `Colors:View`) in the scheme file. When the read fails, the response still returns `200` with the default values plus an `error` string. Unknown routes return `404`.

## Maintainers

- [iwinoid](https://github.com/iwinoid) — iwinoid@outlook.com

## Contributing

Bug reports and questions are welcome on the [GitHub Issues](https://github.com/iwinoid/dsh-tinted-theme/issues) page. Pull requests are accepted. The client bundle is hand-written with no build step. Keep it that way.

## License

[MIT](LICENSE) © iwinoid
