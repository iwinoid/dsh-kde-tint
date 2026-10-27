// dsh-kde-tint —— 客户端主题 bundle（ModuleLoader 注册格式）。
//
// v0.3.0：从 KDE 系统配色动态生成主题。服务端（lib/index.js）通过 webServer
// 暴露 GET /api/kde-tint/kde-colors，本客户端 fetch 读取后调用
// ctx.theme.overrideTokens() 覆盖 token。
// 注意：静态 client bundle 没有 host 桥服务（那是动态包协议），通信走 HTTP。
//
// 配色来源：服务端返回"当前已经应用"的 Plasma 配色（kdeglobals 的 Colors:* 段，
// Material You 动态配色只更新这里）：
//   - accent = Colors:Selection.BackgroundNormal（不是可能过时的 General.AccentColor）
//   - background = Colors:Window.BackgroundNormal
//   - view / button = 方案里自带的深浅层级，用来铺深色/浅色底
// 染色范围：基础面/层级/浮层、菜单、输入卡片、代码块、消息气泡、交付文件卡、
// 中性控件填充、交互态、边框、滚动条、开关。文字保持中性；DSH 强调色控件
// （state-business-*、button-info-*、link 等）不覆盖。
//
// 少数 DSH 组件把颜色写死在组件 CSS 的局部变量里（悬停气泡、交付文件卡），
// token 覆盖不到，这里额外注入一条同源 CSS 覆盖（见 LOCAL_CSS）。
window.__ModuleLoader__.load({
  id: "dsh-kde-tint",
  factory: () => {
    var module = { exports: {} };
    var exports = module.exports;

    // ---------- 颜色工具 ----------
    function normalizeHex(value, fallback) {
      if (typeof value !== 'string') return fallback;
      var hex = value.trim();
      if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
        hex = '#' + hex.slice(1).split('').map(function (c) { return c + c; }).join('');
      }
      return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
    }
    function hexToRgb(hex) {
      var h = normalizeHex(hex, '#ffffff').slice(1);
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
      };
    }
    function channel(x) {
      return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
    }
    function rgbToHex(r, g, b) {
      return '#' + channel(r) + channel(g) + channel(b);
    }
    // 把 tint 颜色按 ratio 混进 base 颜色。
    function blend(baseHex, tintHex, ratio) {
      var a = hexToRgb(baseHex);
      var b = hexToRgb(tintHex);
      var t = Math.max(0, Math.min(1, ratio));
      return rgbToHex(
        a.r * (1 - t) + b.r * t,
        a.g * (1 - t) + b.g * t,
        a.b * (1 - t) + b.b * t
      );
    }
    // 半透明叠色（hover、骨架屏这类叠在任意面上）。
    function withAlpha(hex, alpha) {
      var c = hexToRgb(hex);
      var a = Math.round(Math.max(0, Math.min(1, alpha)) * 1000) / 1000;
      return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + a + ')';
    }
    function channelLuminance(value) {
      var x = value / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }
    function luminance(hex) {
      var c = hexToRgb(hex);
      return 0.2126 * channelLuminance(c.r) + 0.7152 * channelLuminance(c.g) + 0.0722 * channelLuminance(c.b);
    }
    function contrastRatio(a, b) {
      var la = luminance(a);
      var lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }
    // 主按钮上的字：纯白/纯黑里取对比度更高的一方。任意 accent 下都 >= 4.58:1。
    function foregroundOn(bgHex) {
      return contrastRatio('#ffffff', bgHex) >= contrastRatio('#000000', bgHex) ? '#ffffff' : '#000000';
    }
    function isLight(hex) {
      return luminance(hex) > 0.5;
    }
    function pair(light, dark) {
      return { light: light, dark: dark };
    }

    var DEFAULT_ACCENT = '#386798';
    var DEFAULT_LIGHT_BG = '#ffffff';
    var DEFAULT_DARK_BG = '#0a0f14';
    // 方案缺少 Colors:View / Colors:Button 时的中性兜底层级。
    var NEUTRAL_LIGHT_REFS = Object.freeze({ base: '#ffffff', win: '#f4f6f8', btn: '#fafbfc' });
    var NEUTRAL_DARK_REFS = Object.freeze({ base: '#0a0f14', win: '#11161c', btn: '#1a2028' });

    // 浅色模式：基底来自方案里的 View（或中性白），Window/Button 负责浅灰层。
    function rampLight(accent, refs) {
      return {
        base: blend(refs.base, accent, 0.10),
        layer1: blend(refs.win, accent, 0.14),
        layer2: blend(refs.btn, accent, 0.16),
        layer3: blend(refs.btn, accent, 0.24),
        layer4: blend(refs.base, accent, 0.20),
        input: blend(refs.base, accent, 0.06),
        raised: blend(refs.btn, accent, 0.16),
        menu: blend(refs.win, accent, 0.10),
        code: blend(refs.win, accent, 0.12),
        codeBanner: blend(refs.btn, accent, 0.18),
        inlineCode: blend(refs.btn, accent, 0.20),
        tag: blend(refs.win, accent, 0.24),
        border1: blend(refs.win, accent, 0.28),
        border2: blend(refs.win, accent, 0.34),
        border3: blend(refs.win, accent, 0.40),
        border4: blend(refs.win, accent, 0.46),
        borderThin: blend(refs.win, accent, 0.24),
        overlay: blend(refs.btn, accent, 0.30),
        documentPreview: blend(refs.base, accent, 0.20),
        hoverSolid: blend(refs.win, accent, 0.16),
        ghostFill: blend(refs.btn, accent, 0.22),
        ghostBorder: blend(accent, '#000000', 0.25),
        contrast: blend('#61666b', accent, 0.35),
        tooltip: blend('#2c2c2e', accent, 0.25),
        toast: blend('#353638', accent, 0.25),
        switchThumb: blend('#ffffff', accent, 0.20),
        scrollbar1: blend(refs.win, accent, 0.55),
        scrollbar2: blend(refs.win, accent, 0.65),
        scrollbarHover1: blend(refs.win, accent, 0.75),
        scrollbarHover2: blend(refs.win, accent, 0.85),
        navHover: blend(refs.win, accent, 0.18),
        navActive: blend(refs.btn, accent, 0.28),
        onboardingSecondary: blend(refs.btn, accent, 0.20)
      };
    }

    // 深色模式：View 是最深的画布，Window 是面板，Button 是抬升层。
    function rampDark(accent, refs, tooltipRef) {
      return {
        base: blend(refs.base, accent, 0.10),
        layer1: blend(refs.win, accent, 0.14),
        layer2: blend(refs.btn, accent, 0.12),
        layer3: blend(refs.btn, accent, 0.22),
        layer4: blend(refs.btn, accent, 0.16),
        input: blend(refs.btn, accent, 0.10),
        raised: blend(refs.btn, accent, 0.16),
        menu: blend(refs.btn, accent, 0.20),
        code: blend(refs.base, accent, 0.14),
        codeBanner: blend(refs.btn, accent, 0.18),
        inlineCode: blend(refs.btn, accent, 0.22),
        tag: blend(refs.win, accent, 0.24),
        border1: blend(refs.win, accent, 0.30),
        border2: blend(refs.win, accent, 0.38),
        border3: blend(refs.win, accent, 0.46),
        border4: blend(refs.win, accent, 0.54),
        borderThin: blend(refs.win, accent, 0.26),
        overlay: blend(refs.btn, accent, 0.30),
        documentPreview: blend(refs.base, accent, 0.08),
        hoverSolid: blend(refs.btn, accent, 0.20),
        ghostFill: blend(refs.btn, accent, 0.26),
        ghostBorder: blend(accent, '#ffffff', 0.45),
        contrast: blend('#f9fafb', accent, 0.15),
        tooltip: blend(tooltipRef, accent, 0.30),
        toast: blend(tooltipRef, accent, 0.30),
        switchThumb: blend(accent, '#ffffff', 0.55),
        scrollbar1: blend(refs.win, accent, 0.50),
        scrollbar2: blend(refs.win, accent, 0.60),
        scrollbarHover1: blend(refs.win, accent, 0.68),
        scrollbarHover2: blend(refs.win, accent, 0.76),
        navHover: blend(refs.btn, accent, 0.18),
        navActive: blend(refs.btn, accent, 0.28),
        onboardingSecondary: blend(refs.btn, accent, 0.30)
      };
    }

    // 生成一整套 token 和组件局部 CSS 变量。kde 允许为空（首屏、接口失败）。
    function buildTheme(kde) {
      var accent = normalizeHex(kde && kde.accent, DEFAULT_ACCENT);
      var windowBg = normalizeHex(kde && kde.background, null) ||
        (isLight(accent) ? DEFAULT_LIGHT_BG : DEFAULT_DARK_BG);
      var schemeDark = !isLight(windowBg);
      var viewBg = normalizeHex(kde && kde.view, null) ||
        (schemeDark ? blend(windowBg, '#000000', 0.18) : blend(windowBg, '#ffffff', 0.30));
      var buttonBg = normalizeHex(kde && kde.button, null) ||
        (schemeDark ? blend(windowBg, '#ffffff', 0.10) : blend(windowBg, '#ffffff', 0.30));
      var tooltipBg = normalizeHex(kde && kde.tooltip, null) ||
        (schemeDark ? windowBg : '#2c2c2e');

      // 半透明叠色用的 accent：浅 accent 在浅色面上压暗，深 accent 在深色面上提亮，
      // 否则 hover 会几乎看不见。
      var accentOnLight = isLight(accent) ? blend(accent, '#000000', 0.20) : accent;
      var accentOnDark = isLight(accent) ? accent : blend(accent, '#ffffff', 0.30);

      // 方案与 DSH 模式不一定同色：对不上的那一侧退回中性 base + accent 染色。
      var light = schemeDark
        ? rampLight(accent, NEUTRAL_LIGHT_REFS)
        : rampLight(accent, { base: viewBg, win: windowBg, btn: buttonBg });
      var dark = schemeDark
        ? rampDark(accent, { base: viewBg, win: windowBg, btn: buttonBg }, tooltipBg)
        : rampDark(accent, NEUTRAL_DARK_REFS, '#2c2c2e');

      var foreground = foregroundOn(accent);
      var menuLight = withAlpha(light.menu, 0.90);
      var menuDark = withAlpha(dark.menu, 0.92);

      var tokens = {
        // ---- 基础面 ----
        '--dsw-alias-bg-base': pair(light.base, dark.base),
        '--dsw-alias-bg-layer-1': pair(light.layer1, dark.layer1),
        '--dsw-alias-bg-layer-2': pair(light.layer2, dark.layer2),
        '--dsw-alias-bg-layer-3': pair(light.layer3, dark.layer3),
        '--dsw-specific-sidebar-fill': pair(light.layer1, dark.layer1),
        '--dsw-alias-bg-overlay': pair(light.overlay, dark.overlay),
        '--dsw-alias-bg-document-preview': pair(light.documentPreview, dark.documentPreview),
        '--dsw-alias-bg-skeleton': pair(withAlpha(accentOnLight, 0.14), withAlpha(accentOnDark, 0.18)),

        // ---- 消息气泡 ----
        '--dsw-specific-bubble': pair(blend('#ffffff', accent, 0.18), dark.layer3),
        '--dsw-specific-bubble-highlight': pair(blend('#ffffff', accent, 0.30), blend(dark.layer3, accent, 0.30)),

        // ---- 边框 ----
        '--dsw-alias-border-l1': pair(light.border1, dark.border1),
        '--dsw-alias-border-l2': pair(light.border2, dark.border2),
        '--dsw-alias-border-l3': pair(light.border3, dark.border3),
        '--dsw-alias-border-l4': pair(light.border4, dark.border4),
        '--dsw-alias-border-l2-darkmode-thin': pair(light.borderThin, dark.borderThin),

        // ---- 文本：保持中性，不跟 accent ----
        '--dsw-alias-label-primary': pair('#1a1d22', '#e6e8eb'),
        '--dsw-alias-label-secondary': pair('#424652', '#c2c7d0'),
        // 主按钮上的字属于"控件染色"的配套：按 accent 亮度选白/黑。
        '--dsw-alias-label-primary-foreground': pair(foreground, foreground),

        // ---- 品牌色与主按钮 ----
        '--dsw-alias-brand-primary': pair(accent, accent),
        '--dsw-alias-button-primary-hover': pair(blend(accent, '#000000', 0.12), blend(accent, '#ffffff', 0.12)),
        '--dsw-alias-button-primary-dimmed': pair(blend(accent, light.base, 0.55), blend(accent, dark.base, 0.55)),

        // ---- 交互态（半透明，叠在任意面上）----
        '--dsw-alias-interactive-bg-hover': pair(withAlpha(accentOnLight, 0.12), withAlpha(accentOnDark, 0.16)),
        '--dsw-alias-interactive-bg-active': pair(withAlpha(accentOnLight, 0.18), withAlpha(accentOnDark, 0.22)),
        '--dsw-alias-interactive-bg-hover-solid': pair(light.hoverSolid, dark.hoverSolid),

        // ---- 大块面板 ----
        '--dsw-specific-input-major': pair(light.input, dark.input),
        '--dsw-menu-surface-fill': pair(menuLight, menuDark),
        '--dsw-specific-menu': pair(menuLight, menuDark),
        '--dsw-alias-menu-group-header-fill': pair(withAlpha(light.menu, 0.98), withAlpha(dark.menu, 0.98)),
        '--dsw-alias-bg-module-platform': pair(light.raised, dark.raised),
        '--dsw-alias-markdown-code-block': pair(light.code, dark.code),
        '--dsw-alias-markdown-code-block-banner': pair(light.codeBanner, dark.codeBanner),
        '--dsw-alias-markdown-inline-code': pair(light.inlineCode, dark.inlineCode),
        '--dsw-alias-markdown-tag': pair(light.tag, dark.tag),

        // ---- 中性控件填充 ----
        '--dsw-alias-button-elevated-fill': pair(light.layer1, dark.layer2),
        '--dsw-alias-button-floating-fill': pair(light.base, dark.layer2),
        '--dsw-alias-button-floating-hover': pair(light.layer3, dark.layer3),
        '--dsw-alias-button-ghost-active-fill': pair(light.ghostFill, dark.ghostFill),
        '--dsw-alias-button-ghost-active-border': pair(light.ghostBorder, dark.ghostBorder),
        '--dsw-alias-button-contrast-fill': pair(light.contrast, dark.contrast),
        '--dsw-alias-button-tool-bar-fill': pair(
          withAlpha(blend('#545557', accentOnLight, 0.35), 0.50),
          withAlpha(blend('#545557', accentOnDark, 0.35), 0.50)
        ),
        '--dsw-alias-button-tool-bar-hover': pair(
          withAlpha(blend('#545557', accentOnLight, 0.35), 0.60),
          withAlpha(blend('#545557', accentOnDark, 0.35), 0.60)
        ),
        '--dsw-specific-selector': pair(light.raised, dark.raised),
        '--dsw-specific-sidebar-nav-item-hover': pair(light.navHover, dark.navHover),
        '--dsw-specific-sidebar-nav-item-active': pair(light.navActive, dark.navActive),
        '--dsw-alias-switch-thumb': pair(light.switchThumb, dark.switchThumb),
        '--dsw-alias-tooltip-bg': pair(light.tooltip, dark.tooltip),
        '--dsw-alias-toast-bg': pair(light.toast, dark.toast),

        // ---- 滚动条 ----
        '--dsw-alias-scrollbar-bg-l1': pair(light.scrollbar1, dark.scrollbar1),
        '--dsw-alias-scrollbar-bg-l2': pair(light.scrollbar2, dark.scrollbar2),
        '--dsw-alias-scrollbar-hover-l1': pair(light.scrollbarHover1, dark.scrollbarHover1),
        '--dsw-alias-scrollbar-hover-l2': pair(light.scrollbarHover2, dark.scrollbarHover2),

        // ---- 首次引导页（普通面）----
        '--dsw-alias-onboarding-card-fill': pair(withAlpha(light.raised, 0.82), withAlpha(dark.layer2, 0.82)),
        '--dsw-alias-onboarding-secondary-fill': pair(light.onboardingSecondary, dark.onboardingSecondary),
        '--dsw-alias-onboarding-checkbox-border': pair(
          withAlpha(blend(accentOnLight, '#000000', 0.45), 0.30),
          withAlpha(accentOnDark, 0.40)
        ),

        // ---- 上游缺失 token ----
        // DSH 0.2.1-rc.2 有组件引用了但主题里没定义的变量；补上避免背景失效。
        '--dsw-alias-bg-layer-4': pair(light.layer4, dark.layer4),
        '--dsw-alias-bg-l1': pair(light.layer1, dark.layer1),
        '--dsw-alias-bg-l2': pair(light.layer2, dark.layer2)
      };

      // 组件 CSS 里写死的局部变量（token 覆盖不到），只能注入 CSS 覆盖。
      var local = {
        hovercard: pair(light.tooltip, dark.tooltip),
        deliverableFill: pair(light.layer2, dark.layer2),
        deliverableHover: pair(light.layer3, dark.layer3),
        changesFill: pair(light.layer2, dark.layer2),
        changesHover: pair(light.layer3, dark.layer3)
      };

      return { tokens: tokens, local: local };
    }

    // DSH 写死在组件 CSS 里的局部变量：
    //   --dsw-hovercard-bg                         悬停预览气泡（写死 #2C2C2E）
    //   --deliverable-fill / --deliverable-hover   交付文件卡片（写死 static neutral-50/850）
    //   --changes-fill / --changes-hover           变更文件卡片头（同上）
    var LOCAL_CSS = [
      { key: 'hovercard', cssVar: '--dsh-kde-tint-hovercard', target: '--dsw-hovercard-bg' },
      { key: 'deliverableFill', cssVar: '--dsh-kde-tint-deliverable-fill', target: '--deliverable-fill' },
      { key: 'deliverableHover', cssVar: '--dsh-kde-tint-deliverable-hover', target: '--deliverable-hover' },
      { key: 'changesFill', cssVar: '--dsh-kde-tint-changes-fill', target: '--changes-fill' },
      { key: 'changesHover', cssVar: '--dsh-kde-tint-changes-hover', target: '--changes-hover' }
    ];

    function buildLocalCss(local) {
      var declarations = function (mode) {
        return LOCAL_CSS.map(function (entry) {
          return entry.cssVar + ':' + local[entry.key][mode] + ';';
        }).join('');
      };
      var overrides = LOCAL_CSS.map(function (entry) {
        return entry.target + ':var(' + entry.cssVar + ')!important;';
      }).join('');
      return 'body{' + declarations('light') + '}\n' +
        'body[data-ds-dark-theme]{' + declarations('dark') + '}\n' +
        'body *{' + overrides + '}\n';
    }

    // 依赖客户端 theme 服务（由 @deepseek-ai/dsh-client-ui-theme 提供）
    const inject = ['theme'];

    function apply(ctx) {
      const theme = ctx.get('theme');
      if (!theme) return;

      // 组件局部变量的覆盖层（没有 DOM 时跳过，例如测试/SSR）。
      let styleTag = null;
      if (typeof document !== 'undefined' && document.head) {
        ctx.effect(() => {
          styleTag = document.createElement('style');
          styleTag.dataset.plugin = 'dsh-kde-tint';
          styleTag.dataset.kdeTint = 'local-vars';
          document.head.appendChild(styleTag);
          return () => {
            styleTag.remove();
            styleTag = null;
          };
        }, 'dsh-kde-tint: local variable overrides');
      }

      const paint = (kde) => {
        const built = buildTheme(kde);
        ctx.effect(() => theme.overrideTokens('kde-tint', built.tokens));
        if (styleTag) styleTag.textContent = buildLocalCss(built.local);
      };

      // 先用默认 accent 同步覆盖：HTTP 往返期间也不会闪回原生配色。
      paint(null);

      // 再用当前应用的 KDE 配色替换同一个 layer（同 source 会整体替换，不会叠加）。
      fetch('/api/kde-tint/kde-colors')
        .then((r) => r.json())
        .then((kde) => paint(kde))
        .catch((e) => console.error('[kde-tint] getKdeColors failed; using default accent', e));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
