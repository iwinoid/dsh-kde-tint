// dsh-tinted-theme —— 客户端主题 bundle（ModuleLoader 注册格式）。
//
// v0.2.0：从 KDE 系统配色动态生成主题。服务端（lib/index.js）通过 webServer
// 暴露 GET /api/tinted-theme/kde-colors，本客户端 fetch 读取后调用
// ctx.theme.overrideTokens() 覆盖 token。
// 注意：静态 client bundle 没有 host 桥服务（那是动态包协议），通信走 HTTP。
window.__ModuleLoader__.load({
  id: "dsh-tinted-theme",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    function hexToRgb(hex) {
      hex = hex.replace('#','');
      return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
    }
    function rgbToHex(r,g,b) {
      return '#' + [r,g,b].map(x=> Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
    }
    function blend(hex1, hex2, t) {
      const a = hexToRgb(hex1), b = hexToRgb(hex2);
      return rgbToHex(a.r*(1-t)+b.r*t, a.g*(1-t)+b.g*t, a.b*(1-t)+b.b*t);
    }

    // 依赖客户端 theme 服务（由 @deepseek-ai/dsh-client-ui-theme 提供）
    const inject = ['theme'];

    function apply(ctx) {
      const theme = ctx.get('theme');
      if (!theme) return;

      // 从服务端读取 KDE 配色（GET /api/tinted-theme/kde-colors）
      fetch('/api/tinted-theme/kde-colors')
        .then((r) => r.json())
        .then((kde) => {
          const accent = (kde && kde.accent) || '#386798';
          // Slight tint: mix white with accent at low opacity (white base slightly colored)
          // Light: white tinted 6-8% with accent
          const tintLight = blend('#ffffff', accent, 0.06);
          const tintLayer1 = blend('#ffffff', accent, 0.08);
          const tintLayer2 = blend('#ffffff', accent, 0.11);
          // Dark: dark base tinted
          const tintDark = blend('#0a0f14', accent, 0.08);
          const tintDark1 = blend('#11161c', accent, 0.07);

          const tokens = {
            '--dsw-alias-bg-base': { light: tintLight, dark: tintDark },
            '--dsw-alias-bg-layer-1': { light: tintLayer1, dark: tintDark1 },
            '--dsw-alias-bg-layer-2': { light: tintLayer2, dark: blend('#1a2028', accent, 0.06) },
            '--dsw-alias-bg-layer-3': { light: blend('#ffffff', accent, 0.14), dark: '#232d37' },
            '--dsw-specific-sidebar-fill': { light: tintLayer1, dark: tintDark1 },
            '--dsw-alias-border-l1': { light: blend('#ffffff', accent, 0.12), dark: '#2a323d' },
            '--dsw-alias-border-l2': { light: blend('#ffffff', accent, 0.16), dark: '#303a47' },
            '--dsw-alias-label-primary': { light: '#1a1d22', dark: '#e6e8eb' },
            '--dsw-alias-label-secondary': { light: '#424652', dark: '#c2c7d0' },
            '--dsw-alias-brand-primary': { light: accent, dark: accent }
          };

          // Use effect so it auto-cleans on plugin stop
          ctx.effect(() => theme.overrideTokens('tinted-kde', tokens));
          console.log('[tinted-theme] KDE accent', accent, '-> tint', tintLight);
        })
        .catch((e) => console.error('[tinted-theme] getKdeColors failed', e));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
