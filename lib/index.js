// dsh-tinted-theme —— 服务端入口：读取 KDE 系统配色，经 HTTP 暴露给客户端。
//
// v0.2.0 说明：早期版本误用了 dsh-cordis-client-runner 的"动态包"协议
// （服务端 inject ['harness'] + ctx.harness.handle()），但 dsh 核心并不提供
// harness/host 服务，静态 client bundle 也没有 host 桥，导致两边都
// "waiting for service" 而启动失败。正确做法（与 dsh-undo-savepoint 一致）：
// 服务端通过 webServer 服务注册 HTTP 路由，客户端用 fetch 读取。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// webServer 在 LOADER 级别注入，保证冷启动时路由也能注册
// （参考 dsh-undo-savepoint 的注释与写法）。
export const inject = ['webServer'];

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

function readKdeColors() {
  try {
    const home = os.homedir();
    const kdeglobals = path.join(home, '.config', 'kdeglobals');
    let accent = '#386798';
    let scheme = 'KlassyDark';
    if (fs.existsSync(kdeglobals)) {
      const ini = parseIni(fs.readFileSync(kdeglobals, 'utf8'));
      if (ini.General?.AccentColor) {
        const v = ini.General.AccentColor.split(',').map(s => parseInt(s.trim()));
        if (v.length >= 3) accent = `#${v[0].toString(16).padStart(2, '0')}${v[1].toString(16).padStart(2, '0')}${v[2].toString(16).padStart(2, '0')}`;
        else if (ini.General.AccentColor.startsWith('#')) accent = ini.General.AccentColor;
      }
      if (ini.General?.ColorScheme) scheme = ini.General.ColorScheme;
    }
    // Try to read scheme file for background
    let bg = '#ffffff';
    const candidates = [
      path.join(home, '.local/share/color-schemes', scheme + '.colors'),
      path.join(home, '.local/share/color-schemes', scheme),
      `/usr/share/color-schemes/${scheme}.colors`,
      `/usr/share/color-schemes/${scheme}`,
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const ini = parseIni(fs.readFileSync(p, 'utf8'));
        const bgVal = ini['Colors:Window']?.BackgroundNormal || ini['Colors:View']?.BackgroundNormal;
        if (bgVal) {
          if (bgVal.includes(',')) {
            const [r, g, b] = bgVal.split(',').map(s => parseInt(s.trim()));
            bg = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          } else bg = bgVal;
          break;
        }
      }
    }
    return { accent, background: bg, scheme };
  } catch (e) {
    return { accent: '#386798', background: '#ffffff', scheme: 'KlassyDark', error: String(e) };
  }
}

export function apply(ctx, config = {}) {
  const webServer = ctx.get('webServer');
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: '/api/tinted-theme',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.local');
        const method = (req.method ?? 'GET').toUpperCase();
        if (method === 'GET' && url.pathname === '/api/tinted-theme/kde-colors') {
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
  }), 'dsh-tinted-theme.api');
}
