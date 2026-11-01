/* =============================================================
 * DAVID TAO · 音乐人格测试
 * js/app.js —— 界面与交互（不含评分规则，评分在 js/scoring.js）
 *
 * 流程（对齐参考站）：
 *   intro（封面）→ quiz（20 题逐题）→ result（结果）
 *   弹窗：歌曲深度解读 / 单曲惊喜彩蛋 / 另外七张唱片
 *
 * 路由：#/ 封面 | #/quiz 答题 | #/result/<albumId>[?d=<secondId>]
 * ============================================================= */

(function () {
  'use strict';

  var ALBUMS   = window.DT_ALBUMS;
  var PERSONAS = window.DT_PERSONAS;
  var QUESTIONS= window.DT_QUESTIONS;
  var SCORING  = window.DT_SCORING;
  var POSTER   = window.DT_POSTER;
  var DEEP     = window.DT_DEEP;
  var BLIND    = window.DT_BLIND;
  var IDS      = ALBUMS.map(function (a) { return a.id; });

  var contentEl = document.getElementById('content-area');
  var noteEl    = document.getElementById('author-note-container');
  var modalRoot = document.getElementById('modal-root');

  var step = 'intro';
  var idx = 0;              // 当前题下标（0 基）
  var answers = {};         // { 题号: 选项下标 }
  var result = null;

  /* ---------------- 工具 ---------------- */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function albumOf(id) {
    for (var i = 0; i < ALBUMS.length; i++) if (ALBUMS[i].id === id) return ALBUMS[i];
    return ALBUMS[0];
  }
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t.__t);
    t.__t = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }
  /**
   * 专辑原色偏暗且多为低饱和，直接用在深色底上会"糊掉"。
   * 这里统一做一次提亮：饱和度拉高、亮度压到 60% 上下，得到一档霓虹强调色。
   */
  function neon(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#e2622a';
    var n = parseInt(m[1], 16);
    var r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else                h = ((r - g) / d + 4) / 6;
    }
    // 深色底上的黄金区间：饱和度够、亮度够，但不刺眼
    s = Math.min(.92, s * 1.35 + .12);
    l = Math.min(.70, Math.max(.58, l < .5 ? l + .22 : l + .06));
    return 'hsl(' + Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%)';
  }
  function setTheme(album) {
    var accent = neon(album.palette.accent);
    album.__accent = accent;   // 海报模块复用同一个提亮结果
    document.documentElement.style.setProperty('--album-ink', accent);
    document.documentElement.style.setProperty('--album-accent', accent);
  }

  /* ---------------- 解锁：人格名只在测过之后才显示 ----------------
   * 用 localStorage 记住用户已经拿到过的八个人格，未拿到的在封面和
   * 封面里一律显示为 ??? —— 不让答案提前出现在明面上。
   * file:// 下部分浏览器禁用存储，全部包 try/catch，失败就当作"全部未解锁"。
   */
  var UNLOCK_KEY = 'dt-persona-unlocked';
  var unlockedMem = {};   // 内存兜底：localStorage 不可用时，本次会话内照样生效

  function unlockedIds() {
    Object.keys(unlockedMem).forEach(function (k) {
      if (IDS.indexOf(k) === -1) delete unlockedMem[k];
    });
    var mem = Object.keys(unlockedMem);
    var stored = [];
    try {
      var raw = localStorage.getItem(UNLOCK_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        stored = arr.filter(function (x) { return IDS.indexOf(x) > -1; });
      }
    } catch (e) { /* file:// 下部分浏览器禁用存储，忽略 */ }
    return mem.concat(stored.filter(function (x) { return mem.indexOf(x) === -1; }));
  }

  /** 解锁一张唱片：先写内存（必定生效），再试着持久化 */
  function unlock(id) {
    if (!id || IDS.indexOf(id) === -1) return;
    if (unlockedIds().indexOf(id) > -1) return;   // 已解锁，不必重复写
    unlockedMem[id] = true;
    try {
      var stored = [];
      var raw = localStorage.getItem(UNLOCK_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        stored = arr.filter(function (x) { return IDS.indexOf(x) > -1; });
      }
      if (stored.indexOf(id) === -1) stored.push(id);
      localStorage.setItem(UNLOCK_KEY, JSON.stringify(stored));
    } catch (e) { /* 无存储权限时静默降级到内存 */ }
  }

  /* ---------------- 弹窗 ---------------- */
  function openModal(html) {
    closeModal();
    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = '<div class="modal">' + html + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    var btn = overlay.querySelector('.modal-close');
    if (btn) btn.addEventListener('click', closeModal);
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    var old = document.querySelector('.overlay');
    if (old) old.remove();
    document.body.style.overflow = '';
  }

  /** 歌曲深度解读弹窗（对应参考站 showSongModal） */
  function showSongModal(song) {
    var analysis = DEEP[song] || '';
    var html =
      '<div class="modal-head"><h3>《' + esc(song) + '》<span class="en">DEEP READING</span></h3>' +
      '<button class="modal-close">关闭 ✕</button></div>' +
      '<div class="body">' +
      (analysis
        ? '<p>' + esc(analysis) + '</p>'
        : '<p>暂无详细解读。</p>') +
      '</div>';
    openModal(html);
  }

  /** 人格速览弹窗（对应参考站 showModal） */
  function showPersonaModal(id) {
    var album = albumOf(id);
    var p = PERSONAS[id];
    if (!p) return;
    // 没测过的唱片不给看人格，只给看音乐本身
    if (unlockedIds().indexOf(id) === -1) { showAlbumCard(id); return; }
    setTheme(album);
    var html =
      '<div class="modal-head"><h3>' + esc(p.name) + '<span class="en">' + esc(p.en.toUpperCase()) + '</span></h3>' +
      '<button class="modal-close">关闭 ✕</button></div>' +
      '<div class="body">' +
        '<p style="font-size:17px;line-height:1.85;color:var(--tx)">' + esc(p.tagline) + '</p>' +
        '<p><b>核心性格</b><br>' + p.traits.map(function (t) { return esc(t.t) + '：' + esc(t.d); }).join('<br>') + '</p>' +
      '</div>' +
      '<div class="meta">' + esc(album.year) + '　' + esc(album.title) + '　' + esc(album.kind) + '　发行 ' + esc(album.release) + '</div>' +
      '<div class="foot"><a class="btn solid" href="#/result/' + id + '">查看完整结果 →</a></div>';
    openModal(html);
  }

  /**
   * 唱片本身的档案卡——只看得到音乐：听感、史料、曲目表。
   * 用于「还没测到过」的唱片：想看它对应哪种人格，得先测出来。
   */
  function showAlbumCard(id) {
    var a = albumOf(id);
    setTheme(a);
    var html =
      '<div class="modal-head"><h3>' + esc(a.title) +
        '<span class="en">' + esc(a.year) + '　' + esc(a.kind) + '　NO.' + esc(a.no) + '　' + esc(a.code) + '</span></h3>' +
      '<button class="modal-close">关闭 ✕</button></div>' +
      '<div class="body">' +
        '<div class="chips" style="margin-bottom:16px">' +
          a.keywords.map(function (k) { return '<span class="chip" style="cursor:default">' + esc(k) + '</span>'; }).join('') +
        '</div>' +
        '<div class="prose"><p>' + esc(a.sound) + '</p></div>' +
        '<div class="kicker" style="margin:20px 0 12px">史料 / FACTS</div>' +
        '<ul class="ticks">' + a.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        '<div class="kicker" style="margin:20px 0 12px">全 ' + a.lineup.length + ' 首 / TRACKLIST</div>' +
        '<div class="chips">' +
          a.lineup.map(function (t) { return '<span class="chip" style="cursor:default">' + esc(t) + '</span>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="meta">' + esc(a.release) + '　' + esc(a.label) + '　制作人 ' + esc(a.producer) + '</div>' +
      '<div class="foot"><a class="btn solid" href="#/quiz">去测这张 →</a></div>';
    openModal(html);
  }

  /* ---------------- 封面 / INTRO ---------------- */
  function renderIntro() {
    var got = unlockedIds();
    var cells = ALBUMS.map(function (a) {
      var known = got.indexOf(a.id) > -1;
      // 未解锁：点开只看到这张唱片的音乐本身；已解锁：亮起人格名，点开是它的完整结果页
      return '<div class="index-cell' + (known ? ' hit' : ' locked') + '"' +
        (known ? ' data-go="' + a.id + '"' : ' data-peek="' + a.id + '"') +
        ' style="--album-ink:' + neon(a.palette.accent) + '">' +
        '<span class="y">' + esc(a.year) + '</span>' +
        '<span class="n">' + (known ? esc(PERSONAS[a.id].name) : '? ? ?') + '</span>' +
        '</div>';
    }).join('');

    contentEl.innerHTML =
      '<div class="cover">' +
        '<div class="disc-wrap">' +
          '<div class="disc-groove"></div>' +
          '<div class="disc-label">' +
            '<b>DAVID TAO</b>' +
            '<i>33⅓ RPM · STEREO</i>' +
          '</div>' +
        '</div>' +
        '<h1>你是哪一种<br>陶喆音乐人格？</h1>' +
        '<p class="leadline">从1997—2013，陶喆的八张专辑里总有一张是属于你的镜子</p>' +
        '<div class="btn-row">' +
          '<button class="btn solid big" id="start-btn">开始测试 →</button>' +
        '</div>' +
        '<div class="index-grid">' + cells + '</div>' +
      '</div>';

    $('#start-btn').addEventListener('click', function () {
      resetQuiz();
      location.hash = '#/quiz';
    });
    contentEl.querySelectorAll('[data-peek]').forEach(function (el) {
      el.addEventListener('click', function () {
        showPersonaModal(el.getAttribute('data-peek'));
      });
    });
    contentEl.querySelectorAll('[data-go]').forEach(function (el) {
      el.addEventListener('click', function () {
        location.hash = '#/result/' + el.getAttribute('data-go');
      });
    });
  }

  function resetQuiz() {
    answers = {};
    idx = 0;
    result = null;
  }

  /* ---------------- 答题 / QUIZ ---------------- */
  function renderQuiz() {
    var q = QUESTIONS[idx];
    if (!q) return;
    var progress = ((idx + 1) / QUESTIONS.length) * 100;
    var picked = answers[q.no];
    // 唱片曲目的编号写法：TRACK 03 / 20
    var trackNo = (idx + 1) < 10 ? '0' + (idx + 1) : String(idx + 1);

    contentEl.innerHTML =
      '<div>' +
        '<div class="quiz-top">' +
          '<div><div class="kicker track-no">TRACK ' + trackNo + ' <em>/</em> ' + QUESTIONS.length + '</div></div>' +
          '<div class="kicker">' + esc(q.dim) + '</div>' +
        '</div>' +
        '<div class="progress"><div class="progress-fill" style="width:' + progress + '%"></div></div>' +
        '<div class="q-dim kicker">DIMENSION · ' + esc(q.dim) + '</div>' +
        '<h2 class="q-text">' + esc(q.text) + '</h2>' +
        '<div class="options-list" id="options-container"></div>' +
        '<div class="nav-actions">' +
          '<button class="btn ghost" id="prev-btn"' + (idx === 0 ? ' disabled' : '') + '>← 上一题</button>' +
          '<span class="hint">键盘 1—4 选择 · Enter 下一题</span>' +
          (picked !== undefined
            ? '<button class="btn solid" id="next-btn">' + (idx === QUESTIONS.length - 1 ? '查看结果 →' : '下一题 →') + '</button>'
            : '') +
        '</div>' +
      '</div>';

    var container = $('#options-container');
    container.innerHTML = q.options.map(function (opt, i) {
      return '<div class="option-item' + (picked === i ? ' on' : '') + '" data-i="' + i + '">' +
        '<span class="key">' + String.fromCharCode(65 + i) + '</span>' +
        '<span class="txt">' + esc(opt.label) + '</span>' +
        '</div>';
    }).join('');
    container.querySelectorAll('[data-i]').forEach(function (el) {
      el.addEventListener('click', function () {
        choose(Number(el.getAttribute('data-i')));
      });
    });

    var pb = $('#prev-btn');
    if (pb) pb.addEventListener('click', function () { if (idx > 0) { idx--; render(); } });
    var nb = $('#next-btn');
    if (nb) nb.addEventListener('click', advance);
  }

  /** 选中并自动进入下一题（对齐参考站：点选项即翻页） */
  function choose(i) {
    answers[QUESTIONS[idx].no] = i;
    if (idx < QUESTIONS.length - 1) {
      render();                       // 先回显选中态
      setTimeout(function () { idx++; render(); }, 240);
    } else {
      render();
      setTimeout(computeResult, 240);
    }
  }

  /** 手动翻页：已作答才可前进 */
  function advance() {
    if (answers[QUESTIONS[idx].no] === undefined) return;
    if (idx < QUESTIONS.length - 1) { idx++; render(); }
    else computeResult();
  }

  function computeResult() {
    result = SCORING.compute(answers, QUESTIONS, IDS);
    var hash = '#/result/' + result.main;
    if (result.isDual) hash += '?d=' + result.second;
    location.hash = hash;
  }

  /* ---------------- 结果 / RESULT ---------------- */
  function renderResult(id, query) {
    var album = albumOf(id);
    var persona = PERSONAS[album.id];
    if (!persona) return;

    // 直接打开分享链接（没有作答记录）：构造一份仅供展示的配比
    if (!result || result.main !== album.id) {
      var dualId = '';
      if (query) {
        var m = /d=([a-z0-9]+)/.exec(query);
        if (m) dualId = m[1];
      }
      var sc = {}, sh = {};
      IDS.forEach(function (x) { sc[x] = x === album.id ? 42 : 8.3; });
      IDS.forEach(function (x) { sh[x] = x === album.id ? 33 : 9.6; });
      var rk = IDS.slice().sort(function (a, b) { return sc[b] - sc[a]; });
      result = {
        scores: sc, shares: sh, rank: rk, main: album.id,
        second: dualId || rk[1], ratio: dualId ? 0.95 : 0.5,
        isDual: !!dualId, far: rk[rk.length - 1], fromLink: true
      };
    }
    setTheme(album);

    /* 拿到结果即解锁：主人格必定算，双重人格的第二张也算
     * （它的名字已经出现在你的结果页里，再藏起来反而不通）。
     * 「你的反面」不算 —— 那不是你。 */
    unlock(album.id);
    if (!result.fromLink && result.isDual && result.second) unlock(result.second);

    var h = '';

    /* --- 头部 --- */
    h += '<div class="result-head">' +
      '<span class="tag">结果 NO.' + esc(album.no) + '　' + esc(album.code) + '</span>' +
      '<div class="album-line">' +
        '<span class="year">' + esc(album.year) + '</span>' +
        '<span class="ttl">' + esc(album.title) + '</span>' +
        '<span class="kind">' + esc(album.kind) + '　发行 ' + esc(album.release) + '</span>' +
      '</div>' +
      '<h1 class="result-name">' + esc(persona.name) + '</h1>' +
      '<div class="en">' + esc(persona.en.toUpperCase()) + '</div>' +
      '<p class="tagline">' + esc(persona.tagline) + '</p>' +
    '</div>';

    h += '<div class="grid-2"><div>';

    /* --- 核心性格：默认展开，这是结果最该先读到的部分 --- */
    h += blockOpen('核心性格 / CORE', persona.traits.map(function (t) {
      return '<div class="trait"><div class="t">' + esc(t.t) + '</div><div class="d">' + esc(t.d) + '</div></div>';
    }).join(''));

    /* --- 音乐分析 + 争议 --- */
    h += block('为什么是这张唱片 / THE ALBUM',
      '<div class="prose"><p>' + esc(persona.analysis) + '</p>' +
      '<p class="kicker" style="margin-top:16px">' + esc(album.label) + '　制作人 ' + esc(album.producer) + '　共 ' + album.trackCount + ' 首</p></div>' +
      '<div class="kicker" style="margin:22px 0 12px">另一种声音 / THE OTHER VIEW</div>' +
      '<div class="debate"><p>' + esc(persona.debate) + '</p></div>');

    /* --- 推荐曲目 + 深度解读入口 --- */
    h += block('你可能爱听', persona.songs.map(function (s, k) {
      return '<div class="song">' +
        '<div><span class="nm">《' + esc(s.name) + '》</span><span class="tg">' + esc(s.tag) + '</span></div>' +
        '<div class="wh">' + esc(s.why) + '</div>' +
        '<button class="deep" data-song="' + k + '">📖 深度解读</button>' +
        '</div>';
    }).join(''));

    h += '</div><aside>';

    /* --- 八维条 --- */
    h += '<div class="block"><h3>八张唱片的距离 / THE EIGHT</h3><div class="bars">' +
      IDS.map(function (x) {
        var a = albumOf(x);
        var pct = result.fromLink ? (x === album.id ? 33 : 9.6) : Number(result.shares[x].toFixed(1));
        return '<div class="bar' + (x === album.id ? ' top' : '') + '">' +
          '<span class="lbl">' + esc(a.year) + '</span>' +
          '<span class="track"><i style="width:' + Math.min(100, pct * 2.7) + '%"></i></span>' +
          '<span class="pc">' + pct.toFixed(1) + '%</span>' +
          '</div>';
      }).join('') + '</div></div>';

    /* --- 双重人格 / 最远切面 --- */
    if (result.isDual && result.second) {
      var dAlbum = albumOf(result.second);
      h += '<div class="dual"><div class="kicker">双重人格倾向 / DOUBLE</div>' +
        '<div class="nm">' + esc(PERSONAS[result.second].name) + '</div>' +
        '<div class="st">' + esc(dAlbum.title) + '（' + esc(dAlbum.year) + '）的气质在你身上也很重：' +
        esc(PERSONAS[result.second].tagline.split('。')[0]) + '。</div>' +
        '<div style="margin-top:12px"><a class="jump" href="#/result/' + result.second + '">看看这一面 →</a></div></div>';
    } else {
      h += '<div class="dual" style="border-style:dashed"><div class="kicker">你的反面 / FURTHEST</div>' +
        '<div class="nm">' + esc(PERSONAS[result.far].name) + '</div>' +
        '<div class="st">距离你最远的切面：' + esc(albumOf(result.far).title) + '。' +
        '它未必是缺点，只是你现在最不需要的那个方向。</div>' +
        '<div style="margin-top:12px"><a class="jump" href="#/result/' + result.far + '">去看看它 →</a></div></div>';
    }

    /* --- 操作区 --- */
    h += '<div class="block" style="margin-top:24px">' +
      '<button class="btn solid" id="poster-btn" style="width:100%;justify-content:center">保存分享海报 ↓</button>' +
      '<button class="btn ghost" id="copy-btn" style="width:100%;justify-content:center;margin-top:10px">复制结果链接</button>' +
      '<button class="btn ghost" id="retry-btn" style="width:100%;justify-content:center;margin-top:10px">重新测试</button>' +
      '</div>';

    /* --- 另外七张：只列唱片，不列人格名（避免把答案摊在结果页上） --- */
    h += block('另外七张唱片 / THE OTHER SEVEN',
      '<div class="chips">' +
      ALBUMS.map(function (a) {
        if (a.id === album.id) return '';
        return '<button class="chip" data-peek="' + a.id + '">' + esc(a.year) + '《' + esc(a.title) + '》</button>';
      }).join('') + '</div>' +
      '<p class="kicker" style="margin-top:14px">点开看这张唱片的音乐本身；它对应哪种人格，要测过才知道。</p>');

    h += '</aside></div>';

    /* --- 彩蛋 --- */
    var box = BLIND[album.id];
    if (box) {
      h += '<div class="blind">' +
        '<div class="kicker">🎁 ' + esc(box.tag) + '</div>' +
        '<div class="title">' + esc(box.title) + '</div>' +
        '<div class="from">' + esc(box.from) + '</div>' +
        '<p>' + esc(box.desc) + '</p>' +
        (box.lyric ? '<div class="lyric">“' + esc(box.lyric) + '”</div>' : '') +
        '<p class="note">☆ ' + esc(box.note) + '　— ' + esc(box.persona) + '</p>' +
      '</div>';
    }

    /* --- 结尾 --- */
    h += '<p class="closing">' + esc(persona.closing) + '</p>';

    h += '<div class="result-foot">' +
      '<div class="rule-strong"></div>' +
      '<div class="btn-row" style="margin-top:22px">' +
      '<button class="btn" id="retry-btn2">重新测试</button>' +
      '<button class="btn ghost" id="home-btn">回到封面</button>' +
      '</div></div>';

    contentEl.innerHTML = h;

    /* --- 事件绑定 --- */
    contentEl.querySelectorAll('[data-song]').forEach(function (el) {
      el.addEventListener('click', function () {
        var s = persona.songs[Number(el.getAttribute('data-song'))];
        if (s) showSongModal(s.name);
      });
    });
    contentEl.querySelectorAll('[data-peek]').forEach(function (el) {
      el.addEventListener('click', function () { showPersonaModal(el.getAttribute('data-peek')); });
    });
    $('#poster-btn').addEventListener('click', function () {
      /* 不做真的导出：跨设备/跨浏览器下载不稳定，直接提示截图更可靠 */
      toast('自行截图保存吧~');
    });
    $('#copy-btn').addEventListener('click', function () {
      var url = (location.origin && location.origin !== 'null')
        ? location.origin + location.pathname + location.hash
        : location.href;
      copy(url);
    });
    $('#retry-btn').addEventListener('click', restart);
    $('#retry-btn2').addEventListener('click', restart);
    $('#home-btn').addEventListener('click', function () { location.hash = '#/'; });
  }

  /** 始终展开的板块 */
  function blockOpen(title, inner) {
    return '<div class="block"><h3>' + title + '</h3>' + inner + '</div>';
  }
  /** 默认收起的板块：结果页信息量大，读不读由用户决定 */
  function block(title, inner) {
    return '<details class="fold"><summary>' + title + '</summary>' +
      '<div class="fold-body">' + inner + '</div></details>';
  }

  function restart() {
    resetQuiz();
    location.hash = '#/quiz';
  }

  function copy(text) {
    // 本地直接打开时，复制出来的是本机路径，发给别人打不开，需要说清楚
    var isFile = location.protocol === 'file:';
    var okMsg = isFile
      ? '已复制，但这是你电脑上的本地路径，朋友打不开'
      : '链接已复制，发给朋友即可';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast(okMsg); }
      catch (e) { toast('复制失败，请手动复制地址栏'); }
      document.body.removeChild(ta);
    }
  }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    noteEl.innerHTML = '<span>—夏青丨AI生成仅供娱乐—</span>';
    if (step === 'intro') renderIntro();
    else if (step === 'quiz') renderQuiz();
    else renderResult(currentResultId, currentQuery);
    window.scrollTo(0, 0);
  }

  /* ---------------- 路由 ---------------- */
  var currentResultId = null;
  var currentQuery = '';

  function parseHash() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    var parts = h.split('?');
    var seg = parts[0].split('/');
    return { view: seg[0] || '', arg: seg[1] || '', query: parts[1] || '' };
  }

  function route() {
    var r = parseHash();
    if (r.view === 'quiz') { step = 'quiz'; idx = Math.min(idx, QUESTIONS.length - 1); render(); return; }
    if (r.view === 'result' && r.arg && PERSONAS[r.arg]) {
      step = 'result'; currentResultId = r.arg; currentQuery = r.query; render(); return;
    }
    step = 'intro'; render();
  }

  /* ---------------- 键盘 ---------------- */
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('.overlay')) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    if (step !== 'quiz') return;
    var n = ['1', '2', '3', '4'].indexOf(e.key);
    if (n >= 0 && QUESTIONS[idx].options[n]) choose(n);
    if (e.key === 'Enter') advance();
    if (e.key === 'Backspace') { e.preventDefault(); if (idx > 0) { idx--; render(); } }
  });

  window.addEventListener('hashchange', route);
  route();
})();
