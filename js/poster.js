/* =============================================================
 * DAVID TAO · 音乐人格测试
 * js/poster.js —— 分享海报生成（Canvas 绘制，纯本地，无外部资源）
 *
 * 输出：PNG（2 倍图），含人格名称、专辑名称、代表性描述与站点名称。
 * 配色与网页保持一致：深色底 + 专辑专属霓虹强调色（由 app.js 提亮后写入 album.__accent）。
 * 修改海报版式只需改 draw() 里的坐标与字号。
 * ============================================================= */

window.DT_POSTER = (function () {

  var W = 750, H = 1060, SCALE = 2;

  function wrap(ctx, text, maxWidth) {
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var test = cur + text[i];
      if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
        lines.push(cur); cur = text[i];
      } else { cur = test; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function grain(ctx, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < 2200; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#000' : '#fff';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.restore();
  }

  /**
   * @param {Object} album    DT_ALBUMS 中的一项
   * @param {Object} persona  DT_PERSONAS 中的一项
   * @param {Object} result   DT_SCORING.compute 的返回值（用于显示百分比）
   */
  function draw(album, persona, result) {
    var c = document.createElement('canvas');
    c.width = W * SCALE; c.height = H * SCALE;
    var ctx = c.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // 深色底 + 专辑专属霓虹强调色（与网页同一套值）
    var bg     = '#0a0a0c';
    var tx     = '#f4f2ee';
    var tx2    = 'rgba(244,242,238,.62)';
    var tx3    = 'rgba(244,242,238,.36)';
    var line   = 'rgba(255,255,255,.10)';
    var barBg  = 'rgba(255,255,255,.08)';
    var accent = album.__accent || album.palette.accent;

    var mono = 'SFMono-Regular, Consolas, "Courier New", monospace';
    var sans = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", Arial, sans-serif';

    // 底
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // 顶部光晕：用强调色做一层柔光，替代原来的实色块
    var g = ctx.createRadialGradient(W * .5, -60, 40, W * .5, -60, 620);
    g.addColorStop(0, accent);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = .30;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 460);
    ctx.restore();

    // 顶部标识
    ctx.fillStyle = accent;
    ctx.font = '600 13px ' + mono;
    letterSpace(ctx, 'DAVID TAO', 58, 64, 8);
    ctx.fillStyle = tx3;
    ctx.font = '11px ' + mono;
    letterSpace(ctx, 'MUSIC PERSONALITY TEST', 58, 88, 4);

    // 年份：大字号无衬线
    ctx.fillStyle = tx;
    ctx.font = '800 96px ' + sans;
    ctx.fillText(String(album.year), 54, 208);

    ctx.fillStyle = accent;
    ctx.font = '11px ' + mono;
    letterSpace(ctx, album.code, 58, 240, 3);

    ctx.textAlign = 'right';
    ctx.fillStyle = tx;
    ctx.font = '600 21px ' + sans;
    ctx.fillText(album.title, W - 56, 132);
    ctx.font = '13px ' + sans;
    ctx.fillStyle = tx2;
    ctx.fillText(album.kind, W - 56, 158);
    ctx.textAlign = 'left';

    // 分隔线
    ctx.fillStyle = line; ctx.fillRect(56, 272, W - 112, 1);

    // 人格名
    var y = 330;
    ctx.fillStyle = tx;
    ctx.font = '800 58px ' + sans;
    ctx.fillText(persona.name, 56, y + 22);

    ctx.fillStyle = tx3;
    ctx.font = '12px ' + mono;
    letterSpace(ctx, persona.en.toUpperCase(), 58, y + 50, 4);

    // 描述
    ctx.fillStyle = accent;
    ctx.fillRect(56, y + 76, 3, 104);
    ctx.fillStyle = tx2;
    ctx.font = '400 22px ' + sans;
    var lines = wrap(ctx, persona.tagline, W - 150);
    lines.slice(0, 4).forEach(function (l, i) {
      ctx.fillText(l, 76, y + 108 + i * 34);
    });

    // 关键词
    var kwy = y + 232;
    ctx.fillStyle = tx3;
    ctx.font = '10px ' + mono;
    letterSpace(ctx, 'KEYWORDS', 58, kwy, 3);
    ctx.fillStyle = tx;
    ctx.font = '600 22px ' + sans;
    ctx.fillText(album.keywords.join('  ·  '), 58, kwy + 36);

    // 前五名唱片配比
    var top = result.rank.slice(0, 5);
    var by = kwy + 74;
    ctx.font = '10px ' + mono;
    top.forEach(function (id, i) {
      var yy = by + i * 30;
      var isMain = id === result.main;
      var val = Number(result.shares[id]);
      ctx.fillStyle = barBg;
      ctx.fillRect(58, yy - 7, W - 116, 3);
      ctx.fillStyle = isMain ? accent : tx3;
      ctx.fillRect(58, yy - 7, (W - 116) * Math.min(1, val / 40), 3);
      ctx.fillStyle = isMain ? tx : tx3;
      ctx.font = isMain ? '600 10px ' + mono : '10px ' + mono;
      ctx.textAlign = 'right';
      ctx.fillText(albumYearLabel(id), W - 58, yy - 14);
      ctx.textAlign = 'left';
      ctx.font = '10px ' + mono;
    });

    // 建议聆听
    var sy = by + 5 * 30 + 14;
    ctx.fillStyle = tx3;
    ctx.font = '10px ' + mono;
    letterSpace(ctx, 'LISTEN TO', 58, sy, 3);
    ctx.fillStyle = tx;
    ctx.font = '600 20px ' + sans;
    persona.songs.slice(0, 3).forEach(function (s, i) {
      ctx.fillText('《' + s.name + '》', 58, sy + 36 + i * 32);
    });

    // 页脚
    ctx.fillStyle = line; ctx.fillRect(56, H - 124, W - 112, 1);
    ctx.fillStyle = tx;
    ctx.font = '600 16px ' + sans;
    ctx.fillText('DAVID TAO · 你是哪一种陶喆音乐人格？', 56, H - 84);
    ctx.fillStyle = tx3;
    ctx.font = '11px ' + mono;
    letterSpace(ctx, '1997—2013 · EIGHT ALBUMS · EIGHT SELVES', 58, H - 58, 2);

    grain(ctx, W, H, 0.035);
    return c;
  }

  function albumYearLabel(id) {
    try {
      var list = window.DT_ALBUMS || [];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return String(list[i].year);
    } catch (e) { /* 兜底 */ }
    return id;
  }

  function letterSpace(ctx, text, x, y, sp) {
    var cx = x;
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], cx, y);
      cx += ctx.measureText(text[i]).width + sp;
    }
  }

  function download(album, persona, result) {
    var c = draw(album, persona, result);
    var name = 'DAVID-TAO-' + persona.en.replace(/\s+/g, '-') + '.png';
    // 统一走 data: URL —— blob: URL 在 file:// 协议下会被部分浏览器拦截下载，
    // data: URL 在本地直接打开和部署到 Pages 后都可靠。
    triggerDownload(c.toDataURL('image/png'), name);
  }

  function triggerDownload(href, name) {
    var a = document.createElement('a');
    a.href = href; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return { draw: draw, download: download };
})();
