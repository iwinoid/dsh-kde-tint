// dsh-kde-tint —— 服务端入口：读取 KDE 系统配色，经 HTTP 暴露给客户端。
//
// v0.3.0：读取"当前已经应用的"配色，而不是磁盘上可能过时的方案文件。
//   - 首选 ~/.config/kdeglobals 里 Plasma 实际写入的 Colors:* 段
//     （Material You / 动态配色只更新这里，.colors 文件会停留在旧值）；
//   - 缺失时回退到 ~/.local/share/color-schemes/<scheme>.colors 或系统目录；
//   - 都没有时返回默认值，HTTP 永远 200。
// 注意：静态 client bundle 没有 host 桥服务（那是动态包协议），通信走 HTTP。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// webServer 在 LOADER 级别注入，保证冷启动时路由也能注册
// （参考 dsh-undo-savepoint 的注释与写法）。
export const inject = ['webServer'];

const DEFAULT_ACCENT = '#386798';
const DEFAULT_BACKGROUND = '#ffffff';

function parseIni(text) {
  const out = {};
  let cur = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith(';')) continue;
    const m = t.match(/^\[(.+)\]$/);
    if (m) { cur = m[1]; out[cur] = out[cur] || {}; }
    else if (cur && t.includes('=')) {
      const i = t.indexOf('=');
      out[cur][t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return out;
}

// "#rrggbb" / "#rrggbbaa" / "r,g,b" → "#rrggbb"（解析失败返回 null）。
function colorToHex(value) {
  if (!value) return null;
  const hex = value.trim();
  const m = hex.match(/^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/);
  if (m) return '#' + m[1].toLowerCase();
  const parts = hex.split(',').map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
    return '#' + parts.slice(0, 3)
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0'))
      .join('');
  }
  return null;
}

function readIni(file) {
  try {
    return fs.existsSync(file) ? parseIni(fs.readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
}

function sectionColor(ini, section, key = 'BackgroundNormal') {
  const sec = ini && ini[section];
  return sec ? colorToHex(sec[key]) : null;
}

function schemeFileCandidates(home, scheme) {
  const names = scheme ? [scheme, scheme + '.colors'] : [];
  const dirs = [
    path.join(home, '.local/share/color-schemes'),
    '/usr/share/color-schemes',
    '/usr/local/share/color-schemes',
  ];
  const out = [];
  for (const dir of dirs) for (const name of names) out.push(path.join(dir, name));
  return out;
}

/**
 * Read the currently applied KDE colors.
 * @returns {{accent:string, background:string, view:string|null, button:string|null,
 *   tooltip:string|null, header:string|null, scheme:string, source:string, error?:string}}
 */
export function readKdeColors() {
  const home = os.homedir();
  try {
    const kdeglobals = readIni(path.join(home, '.config/kdeglobals')) || {};
    const general = kdeglobals.General || {};
    const scheme = general.ColorScheme || 'MaterialYouDark';

    // Plasma 实际应用的配色（Material You 会写在这里，方案文件反而可能是旧的）
    let source = 'kdeglobals';
    let accent = sectionColor(kdeglobals, 'Colors:Selection');
    let background = sectionColor(kdeglobals, 'Colors:Window');
    let view = sectionColor(kdeglobals, 'Colors:View');
    let button = sectionColor(kdeglobals, 'Colors:Button');
    let tooltip = sectionColor(kdeglobals, 'Colors:Tooltip');
    let header = sectionColor(kdeglobals, 'Colors:Header');

    // 回退到 .colors 方案文件（旧系统，或 kdeglobals 不带颜色段的情况）
    if (!accent || !background) {
      for (const candidate of schemeFileCandidates(home, scheme)) {
        const ini = readIni(candidate);
        if (!ini) continue;
        accent ??= sectionColor(ini, 'Colors:Selection');
        background ??= sectionColor(ini, 'Colors:Window') || sectionColor(ini, 'Colors:View');
        view ??= sectionColor(ini, 'Colors:View');
        button ??= sectionColor(ini, 'Colors:Button');
        tooltip ??= sectionColor(ini, 'Colors:Tooltip');
        header ??= sectionColor(ini, 'Colors:Header');
        if (accent && background) { source = 'scheme-file'; break; }
      }
    }

    // 最后才用 General.AccentColor：它常常是过时的手动 accent（例如 Material You
    // 只更新 Selection 的时候），只作为兜底。
    accent ??= colorToHex(general.AccentColor);
    if (!accent && !background) source = 'defaults';

    return {
      accent: accent || DEFAULT_ACCENT,
      background: background || DEFAULT_BACKGROUND,
      view: view || null,
      button: button || null,
      tooltip: tooltip || null,
      header: header || null,
      scheme,
      source,
    };
  } catch (error) {
    return {
      accent: DEFAULT_ACCENT,
      background: DEFAULT_BACKGROUND,
      view: null,
      button: null,
      tooltip: null,
      header: null,
      scheme: 'unknown',
      source: 'defaults',
      error: String((error && error.message) || error),
    };
  }
}

export function apply(ctx) {
  const webServer = ctx.get('webServer');
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/api/kde-tint',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.local');
        const method = (req.method ?? 'GET').toUpperCase();
        if (method === 'GET' && url.pathname === '/api/kde-tint/kde-colors') {
          const colors = readKdeColors();
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(colors));
          return;
        }
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: { message: `unknown route ${url.pathname}` } }));
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: { message: String(error?.message ?? error) } }));
      }
    },
  }), 'dsh-kde-tint.api');
}
