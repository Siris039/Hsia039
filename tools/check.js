/* =============================================================
 * DAVID TAO · 音乐人格测试
 * tools/check.js —— 内容与评分逻辑自检
 *
 * 用法（在任意目录执行）：
 *   node david-tao-personality/tools/check.js
 *
 * 它不会修改任何文件，只负责告诉你哪里坏了。
 * 每次改完 content/ 里的文案或 questions.js 的权重，都应该跑一次。
 * ============================================================= */

'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
function load(rel) {
  var src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return src;
}
function evalWithWindow(src) {
  var fake = {};
  var fn = new Function('window', src + '\nreturn window;');
  return fn(fake);
}

var win = {};
['content/albums.js', 'content/personalities.js', 'content/deep-analysis.js',
 'content/blindbox.js', 'content/questions.js', 'js/scoring.js'].forEach(function (f) {
  var w = evalWithWindow(load(f));
  Object.keys(w).forEach(function (k) { win[k] = w[k]; });
});

var ALBUMS = win.DT_ALBUMS;
var PERSONAS = win.DT_PERSONAS;
var QUESTIONS = win.DT_QUESTIONS;
var SCORING = win.DT_SCORING;
var DEEP = win.DT_DEEP;
var BLIND = win.DT_BLIND;
var IDS = ALBUMS.map(function (a) { return a.id; });

var errors = [];
var warns = [];
function err(s) { errors.push(s); }
function warn(s) { warns.push(s); }
function note(s) { (notes = notes || []).push(s); }

console.log('唱片数: ' + ALBUMS.length + ' | 人格数: ' + Object.keys(PERSONAS).length + ' | 题目数: ' + QUESTIONS.length);

/* ---------- 1. 结构完整性 ---------- */
if (ALBUMS.length !== 8) err('专辑数量应为 8，实际 ' + ALBUMS.length);
if (QUESTIONS.length !== 20) warn('题目数量不是 20，实际 ' + QUESTIONS.length);

/* 结果页正在展示的字段 —— 缺了会报错 */
var REQUIRED = ['name', 'en', 'tagline', 'traits', 'analysis', 'debate', 'songs', 'closing'];
/* 已从结果页撤下的板块 —— 数据保留备用，缺了只是提示 */
var RETIRED  = ['strengths', 'blindspots', 'love', 'people', 'reality'];
ALBUMS.forEach(function (a) {
  var p = PERSONAS[a.id];
  if (!p) { err('缺少人格文案: ' + a.id); return; }
  REQUIRED.forEach(function (k) {
    if (!p[k]) err(a.title + ' 的人格文案缺少字段: ' + k);
  });
  RETIRED.forEach(function (k) {
    if (!p[k]) note(a.title + ' 的备用字段「' + k + '」为空（该板块已从结果页撤下，不影响运行）');
  });
  if (p.songs && p.songs.length < 3) warn(a.title + ' 推荐曲目少于 3 首');
  if (p.songs && p.songs.length > 5) warn(a.title + ' 推荐曲目超过 5 首');
  // 曲目名必须真实存在於该专辑曲目表（防止写错歌名）
  (p.songs || []).forEach(function (s) {
    var hit = a.lineup.some(function (t) {
      return t === s.name || t.indexOf(s.name) === 0 || s.name.indexOf(t) === 0;
    });
    if (!hit) warn('[' + a.title + '] 推荐曲《' + s.name + '》在该专辑曲目表中找不到对应项，请核对曲目名');
  });
});

/* ---------- 2. 题目与选项合法性 ---------- */
var primaryCount = {}, secondaryCount = {};
IDS.forEach(function (id) { primaryCount[id] = 0; secondaryCount[id] = 0; });

QUESTIONS.forEach(function (q) {
  if (!q.no || !q.dim || !q.text) err('题目字段不全: ' + JSON.stringify(q).slice(0, 40));
  if (!q.options || q.options.length < 3 || q.options.length > 4) err('第 ' + q.no + ' 题选项数应为 3-4，实际 ' + (q.options ? q.options.length : 0));
  if (typeof q.weight !== 'number') err('第 ' + q.no + ' 题缺少 weight');
  var seenIds = {};
  (q.options || []).forEach(function (o, i) {
    if (!o.label) err('第 ' + q.no + ' 题第 ' + (i + 1) + ' 选项缺少文案');
    if (IDS.indexOf(o.p) === -1) err('第 ' + q.no + ' 题第 ' + (i + 1) + ' 选项的 p 不合法: ' + o.p);
    if (o.s && IDS.indexOf(o.s) === -1) err('第 ' + q.no + ' 题第 ' + (i + 1) + ' 选项的 s 不合法: ' + o.s);
    if (o.s && o.s === o.p) err('第 ' + q.no + ' 题第 ' + (i + 1) + ' 选项的 s 与 p 相同');
    seenIds[o.p] = (seenIds[o.p] || 0) + 1;
    primaryCount[o.p]++;
    if (o.s) secondaryCount[o.s]++;
  });
  var dup = Object.keys(seenIds).filter(function (k) { return seenIds[k] > 1; });
  if (dup.length) warn('第 ' + q.no + ' 题有重复的主人格: ' + dup.join(','));
});

console.log('\n--- 八维覆盖均衡 ---');
var vals = IDS.map(function (id) { return primaryCount[id]; });
var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
IDS.forEach(function (id) {
  var bar = new Array(primaryCount[id] + 1).join('█');
  console.log('  ' + pad(id + '(' + titleOf(id) + ')', 26) + ' 主 ' + pad(primaryCount[id], 3) + ' 副 ' + pad(secondaryCount[id], 3) + ' ' + bar);
});
if (max - min > 3) warn('八维作为主人格的分布不均（最多 ' + max + ' / 最少 ' + min + '），结果会偏！建议挪动个别选项的 p');
if (IDS.some(function (id) { return primaryCount[id] === 0; })) err('有专辑从未作为主人格出现，该人格永远测不出来');

/* ---------- 3. 可达性：八个人格是否都可能成为结果 ---------- */
console.log('\n--- 可达性验证（每种人格是否存在一种作答能测出来）---');
IDS.forEach(function (id) {
  var ok = tryReach(id);
  console.log('  ' + (ok ? '[可达]' : '[死人格]') + ' ' + titleOf(id) + ' / ' + PERSONAS[id].name);
  if (!ok) err('人格 ' + id + ' 无法通过任何作答得到');
});

function tryReach(target) {
  // 策略一：贪心，每题都选对 target 贡献最大的选项
  var answers = {};
  QUESTIONS.forEach(function (q) {
    var best = 0, bestScore = -1;
    q.options.forEach(function (o, i) {
      var s = (o.p === target ? SCORING.CONFIG.PRIMARY : 0) + (o.s === target ? SCORING.CONFIG.SECONDARY : 0);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    answers[q.no] = best;
  });
  if (SCORING.compute(answers, QUESTIONS, IDS).main === target) return true;

  // 策略二：随机偏好搜索（贪心失败时的兜底）
  for (var t = 0; t < 4000; t++) {
    var a = {};
    QUESTIONS.forEach(function (q) {
      var weights = q.options.map(function (o) {
        var s = (o.p === target ? 4 : 0) + (o.s === target ? 1.5 : 0);
        return Math.pow(2, s);
      });
      a[q.no] = weightedPick(weights);
    });
    if (SCORING.compute(a, QUESTIONS, IDS).main === target) return true;
  }
  return false;
}
function weightedPick(weights) {
  var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total;
  for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}

/* ---------- 4. 随机作答的分布与双重人格比例 ---------- */
console.log('\n--- 随机作答 10 万次的结果分布 ---');
var N = 100000, dist = {}, dual = 0;
IDS.forEach(function (id) { dist[id] = 0; });
for (var i = 0; i < N; i++) {
  var a = {};
  QUESTIONS.forEach(function (q) { a[q.no] = Math.floor(Math.random() * q.options.length); });
  var r = SCORING.compute(a, QUESTIONS, IDS);
  dist[r.main]++;
  if (r.isDual) dual++;
}
IDS.forEach(function (id) {
  var pct = dist[id] / N * 100;
  console.log('  ' + pad(PERSONAS[id].name + ' / ' + titleOf(id), 34) + pad(pct.toFixed(2) + '%', 8) + ' ' + new Array(Math.max(1, Math.round(pct)) + 1).join('█'));
  if (pct < 2) warn('随机作答下 ' + titleOf(id) + ' 出现率低于 2%，偏冷（可接受，但不低于 0.5%）');
  if (pct < 0.5) err(titleOf(id) + ' 出现率低于 0.5%，几乎不可能被测出');
});
console.log('  双重人格倾向出现率: ' + (dual / N * 100).toFixed(2) + '%');
if (dual / N > 0.5) warn('双重人格比例超过 50%，DUAL_RATIO 可以调低一些');
if (dual / N < 0.03) warn('双重人格比例不足 3%，几乎没有触发机会，DUAL_RATIO 可以调高一些');

/* ---------- 5. 稳定性：改动一题是否会导致结果翻盘 ---------- */
console.log('\n--- 稳定性：随机改动一题，主人格变化的比例 ---');
var flips = 0, cases = 20000;
for (var k = 0; k < cases; k++) {
  var base = {};
  QUESTIONS.forEach(function (q) { base[q.no] = Math.floor(Math.random() * q.options.length); });
  var r0 = SCORING.compute(base, QUESTIONS, IDS).main;
  var changed = {};
  Object.keys(base).forEach(function (n) { changed[n] = base[n]; });
  var target = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  var allowSelection = target.options.map(function (_, idx) { return idx; }).filter(function (idx) { return idx !== base[target.no]; });
  changed[target.no] = allowSelection[Math.floor(Math.random() * allowSelection.length)];
  if (SCORING.compute(changed, QUESTIONS, IDS).main !== r0) flips++;
}
var flipRate = flips / cases * 100;
console.log('  改动任意一题后结果改变: ' + flipRate.toFixed(2) + '%');
if (flipRate > 40) warn('单题影响力偏高（>40%），测试结果不够稳定');
if (flipRate < 5) warn('单题影响力偏低（<5%），20 题的区分度可能不足');

/* ---------- 6. 第四层：40 首推荐曲目的深度解读覆盖 ---------- */
console.log('\n--- 深度解读层（第四层）---');
var deepKeys = Object.keys(DEEP);
var missing = [], thin = [], orphan = [];
var usedKeys = {};
ALBUMS.forEach(function (a) {
  (PERSONAS[a.id].songs || []).forEach(function (s) {
    usedKeys[s.name] = true;
    if (!DEEP[s.name]) missing.push(a.title + ' / 《' + s.name + '》');
    else if (String(DEEP[s.name]).length < 60) thin.push(s.name);
  });
});
deepKeys.forEach(function (k) { if (!usedKeys[k]) orphan.push(k); });

console.log('  解读条目: ' + deepKeys.length + ' 条　|　被结果页引用: ' + Object.keys(usedKeys).length + ' 首');
if (missing.length) {
  missing.forEach(function (m) { err('缺少深度解读: ' + m); });
} else {
  console.log('  ✓ 结果页推荐的每一首歌都能点开解读');
}
if (thin.length) warn('以下解读过短（<60 字），信息量可能不足: ' + thin.join('、'));
if (orphan.length) warn('以下解读没有任何结果页引用（写了但点不到）: ' + orphan.join('、'));

/* ---------- 7. 第五层：彩蛋 ---------- */
console.log('\n--- 彩蛋层（第五层）---');
IDS.forEach(function (id) {
  var b = BLIND[id];
  var a = albumOf(id);
  if (!b) { err('缺少彩蛋: ' + id); return; }
  if (!b.title || !b.desc || !b.note) err(id + ' 的彩蛋字段不全');

  // 曲名去掉书名号后，必须能在该专辑曲目表里找到
  var nm = String(b.title).replace(/[《》]/g, '').trim();
  var inAlbum = a.lineup.some(function (t) { return t === nm; });
  if (!inAlbum) err('[' + a.title + '] 彩蛋曲目《' + nm + '》不在该专辑曲目表里');

  // 彩蛋曲目不得与结果页推荐曲目重复，否则等于没多给一首
  var dupe = (PERSONAS[id].songs || []).some(function (s) { return s.name === nm; });
  if (dupe) warn('[' + a.title + '] 彩蛋《' + nm + '》与推荐曲目重复，彩蛋失去「多给一首」的价值');
});
console.log('  ✓ 八种人格各配一枚彩蛋');

/* ---------- 汇总 ---------- */
console.log('\n================ 检查汇总 ================');
if (warns.length) {
  console.log('提示 ' + warns.length + ' 条：');
  warns.forEach(function (w) { console.log('  · ' + w); });
}
if (errors.length) {
  console.log('错误 ' + errors.length + ' 条：');
  errors.forEach(function (e) { console.log('  ✗ ' + e); });
  console.log('\n❌ 未通过');
  process.exit(1);
} else {
  console.log('✅ 全部通过' + (warns.length ? '（有 ' + warns.length + ' 条提示，不影响运行）' : ''));
}

/* ---------- 小工具 ---------- */
function titleOf(id) {
  var a = ALBUMS.filter(function (x) { return x.id === id; })[0];
  return a ? a.title : id;
}
function albumOf(id) {
  return ALBUMS.filter(function (x) { return x.id === id; })[0] || ALBUMS[0];
}
function pad(s, n) {
  s = String(s);
  var w = 0;
  for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 2 : 1;
  return s + new Array(Math.max(0, n - w) + 1).join(' ');
}
