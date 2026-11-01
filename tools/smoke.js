/* =============================================================
 * DAVID TAO · 音乐人格测试
 * tools/smoke.js —— 运行时冒烟测试（桩 DOM，不需要浏览器）
 *
 * 真的走一遍：封面 → 开始测试 → 逐题作答 → 计算结果 → 渲染结果页
 * → 深度解读弹窗 → 重新测试 → 上一题/下一题 → 八个结果页 → 分享链接
 * 冷启动 → 海报/复制/档案/回到封面按钮。
 * 断言直接解析渲染出来的 HTML，验的就是用户最终看到的内容。
 * 用法：node david-tao-personality/tools/smoke.js
 * ============================================================= */

'use strict';
var fs = require('fs');
var path = require('path');
var stub = require('./dom-stub');
var ROOT = path.join(__dirname, '..');

/* ---------------- 目标页面 ----------------
 * 默认验分文件版 index.html；
 * 传 --html=xxx.html 则验打包后的单文件（脚本内联在页面里）。
 */
var arg = (process.argv.slice(2).filter(function (a) { return a.indexOf('--html=') === 0; })[0] || '');
var htmlPath = arg ? path.resolve(process.cwd(), arg.split('=').slice(1).join('=')) : path.join(ROOT, 'index.html');
var htmlSrc = fs.readFileSync(htmlPath, 'utf8');

var ids = (htmlSrc.match(/id="([^"]+)"/g) || []).map(function (s) { return s.slice(4, -1); });
var env = stub.create(ids);
var registry = env.registry;
var appended = env.appended;

/* ---------------- 载入脚本 ---------------- */
var inline = [];
var reBlk = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
var mBlk;
while ((mBlk = reBlk.exec(htmlSrc))) inline.push(mBlk[1]);

var FILES = ['content/albums.js', 'content/personalities.js', 'content/deep-analysis.js',
  'content/blindbox.js', 'content/questions.js', 'js/scoring.js', 'js/poster.js'];

var sources;
if (inline.length) {
  // 单文件版：脚本已内联，按页面顺序执行
  sources = inline;
} else {
  sources = FILES.map(function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); });
}

var W = env.window;             // 内容脚本统一挂到同一个 window 对象上
var problems0 = [];
sources.forEach(function (src, i) {
  try { env.runScript(src); } catch (e) {
    problems0.push('脚本块 #' + (i + 1) + ' 执行失败: ' + e.message);
  }
});

var problems = problems0.slice();
function check(cond, msg) { if (!cond) problems.push(msg); }
function attempt(label, fn) {
  try { fn(); } catch (e) { problems.push(label + ' 抛错: ' + e.message); }
}
function go(hash) {
  global.window.location.hash = hash;
  global.window._hash && global.window._hash();
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

if (!inline.length) {
  // 分文件版：界面脚本需要单独载入
  attempt('app.js 首次执行', function () {
    env.runScript(fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8'));
  });
}

var contentEl = registry['content-area'];
var QS = W.DT_QUESTIONS;

/* ---------------- 1. 封面 ---------------- */
attempt('封面渲染', function () { go('#/'); });
check(contentEl.innerHTML.indexOf('DAVID TAO') > -1, '封面缺少标题 DAVID TAO');
check(((contentEl.innerHTML.match(/data-(peek|go)=/g) || []).length) === 8, '封面唱片索引不是 8 格');
check(!!registry['start-btn']._ev, '封面「开始测试」按钮没有绑定事件');
/* 唱片档案已下线：结果页的「另外七张」足以承担浏览功能，封面/结果页不应再有档案入口 */
check(contentEl.innerHTML.indexOf('唱片档案') === -1, '封面仍残留「唱片档案」入口');

/* 反剧透：用户还没作答，封面上不许出现任何一个人格名 */
var leakedNames = W.DT_ALBUMS.filter(function (a) {
  return contentEl.innerHTML.indexOf(W.DT_PERSONAS[a.id].name) > -1;
});
check(leakedNames.length === 0,
  '封面在作答前泄露了人格名：' + leakedNames.map(function (a) { return W.DT_PERSONAS[a.id].name; }).join('、'));
check((contentEl.innerHTML.match(/\? \? \?/g) || []).length === 8,
  '封面未解锁的唱片槽不是 8 个');

/* ---------------- 2. 完整走一次 20 题 ---------------- */
attempt('开始测试', function () { registry['start-btn'].click(); });
go(global.window.location.hash);
check(global.window.location.hash === '#/quiz', '开始测试没有进入答题页');

var barWidths = [];
for (var i = 0; i < QS.length; i++) {
  var html = contentEl.innerHTML;
  // 题号改成了唱片曲目写法：TRACK 03 / 20
  var mNo = /TRACK (\d+) <em>\/<\/em> (\d+)/.exec(html);
  check(!!mNo, '第 ' + (i + 1) + ' 轮没有渲染出题号');
  if (mNo) {
    check(Number(mNo[1]) === QS[i].no, '题号错位：期望 ' + QS[i].no + '，实际 ' + mNo[1]);
    check(Number(mNo[2]) === QS.length, '总题数显示为 ' + mNo[2] + '，应为 ' + QS.length);
  }

  check(html.indexOf('class="q-text"') > -1, '第 ' + QS[i].no + ' 题题干没有渲染');
  check(html.indexOf(esc(QS[i].text)) > -1, '第 ' + QS[i].no + ' 题题干内容与数据不一致');

  var container = registry['options-container'];
  var optsHtml = container.innerHTML;
  var opts = container.querySelectorAll('[data-i]');
  check(opts.length === QS[i].options.length,
    '第 ' + QS[i].no + ' 题选项数不符：期望 ' + QS[i].options.length + '，实际 ' + opts.length);
  QS[i].options.forEach(function (o, k) {
    check(optsHtml.indexOf(esc(o.label)) > -1,
      '第 ' + QS[i].no + ' 题第 ' + (k + 1) + ' 个选项文案没有渲染');
  });
  opts.forEach(function (o, k) {
    check(!!o._ev && !!o._ev.click, '第 ' + QS[i].no + ' 题第 ' + (k + 1) + ' 个选项没有绑定点击');
  });

  // 未作答时不应出现「下一题」按钮
  check(html.indexOf('id="next-btn"') === -1,
    '第 ' + QS[i].no + ' 题未选答案时不该出现「下一题」');

  var mBar = /class="progress-fill" style="width:([\d.]+)%/.exec(html);
  check(!!mBar, '第 ' + QS[i].no + ' 题没有渲染进度条');
  if (mBar) barWidths.push(Number(mBar[1]));

  // 轮换选不同位置的选项，覆盖到不同的人格归属
  opts[i % opts.length].click();
}

check(barWidths.length === QS.length, '进度条渲染次数与题目数不符');
check(barWidths[barWidths.length - 1] > barWidths[0], '进度条没有随作答推进');
check(barWidths[barWidths.length - 1] === 100, '最后一题进度条应为 100%');

check(/^#\/result\//.test(global.window.location.hash),
  '答完最后一题没有跳转到结果页，hash=' + global.window.location.hash);
attempt('结果页渲染', function () { go(global.window.location.hash); });

var resultHtml = contentEl.innerHTML;
check(resultHtml.length > 3000, '结果页内容过少，疑似渲染失败');
check(resultHtml.indexOf('你可能爱听') > -1, '结果页缺少「你可能爱听」板块');

var mainId = (global.window.location.hash.match(/#\/result\/([a-z0-9]+)/) || [])[1];
var mainAlbum = W.DT_ALBUMS.filter(function (a) { return a.id === mainId; })[0];
check(!!mainAlbum, '结果页 id 不合法: ' + mainId);
if (mainAlbum) {
  check(resultHtml.indexOf(W.DT_PERSONAS[mainAlbum.id].name) > -1, '结果页没有显示主人格名称');
  check(resultHtml.indexOf(W.DT_PERSONAS[mainAlbum.id].closing) > -1, '结果页没有显示结尾文字');
  check(resultHtml.indexOf(mainAlbum.release) > -1, mainAlbum.title + ' 结果页缺少发行信息');
  check(resultHtml.indexOf(mainAlbum.producer) > -1, mainAlbum.title + ' 结果页缺少制作人信息');

  /* 反剧透：结果页「另外七张」只能露唱片名，不能露人格名 */
  var othIdx = resultHtml.indexOf('另外七张唱片');
  check(othIdx > -1, '结果页缺少「另外七张唱片」区块');
  if (othIdx > -1) {
    var othSeg = resultHtml.slice(othIdx);
    var othLeak = W.DT_ALBUMS.filter(function (a) {
      return a.id !== mainId && othSeg.indexOf(W.DT_PERSONAS[a.id].name) > -1;
    });
    check(othLeak.length === 0,
      '结果页「另外七张」泄露了人格名：' + othLeak.map(function (a) { return W.DT_PERSONAS[a.id].name; }).join('、'));
  }
  /* 结果信息应当分层：详细内容默认折叠，不全铺在首屏
   * 用户已裁掉「优势与盲区」「面对生活」两块，当前保留 3 个折叠区块：
   * 为什么是这张唱片 / 建议聆听 / 另外七张 */
  var folds = (resultHtml.match(/<details class="fold"/g) || []).length;
  check(folds >= 3, '结果页没有把详细信息折叠起来（应至少 3 个折叠区块，实际 ' + folds + ' 个）');
}

/* ---------------- 3. 深度解读弹窗 ---------------- */
var firstSong = null;
attempt('点开歌曲深度解读', function () {
  var btns = contentEl.querySelectorAll('[data-song]');
  check(btns.length >= 3, '结果页深度解读按钮少于 3 个');
  var k = Number(btns[0].getAttribute('data-song'));
  firstSong = W.DT_PERSONAS[mainId].songs[k].name;
  btns[0].click();
});
var pushed = appended.filter(function (el) { return el.className === 'overlay'; });
check(pushed.length > 0, '深度解读弹窗没有插入页面');
if (pushed.length && firstSong) {
  // 断言的是原始 HTML：曲名里的撇号会被转义成 &#39;，浏览器会正常显示
  check(pushed[pushed.length - 1]._html.indexOf(esc(firstSong)) > -1,
    '解读弹窗没有显示曲名《' + firstSong + '》');
  check(pushed[pushed.length - 1]._html.indexOf('暂无详细解读') === -1,
    '《' + firstSong + '》缺少深度解读文案（会显示「暂无详细解读」）');
}
attempt('关闭弹窗', function () {
  global.document.querySelector('.overlay').remove();
});

/* ---------------- 4. 上一题 / 下一题 ---------------- */
attempt('重新测试', function () { registry['retry-btn'].click(); });
go(global.window.location.hash);
check(global.window.location.hash === '#/quiz', '重新测试没有回到答题页');

attempt('上一题与下一题', function () {
  var opts1 = registry['options-container'].querySelectorAll('[data-i]');
  check(opts1.length > 0, '答题页没有渲染出选项');
  check(contentEl.innerHTML.indexOf('id="next-btn"') === -1, '重新测试后第 1 题应为未作答状态');

  opts1[0].click();                                   // 选中 → 自动进入第 2 题
  check(Number((/TRACK (\d+) <em>/.exec(contentEl.innerHTML) || [])[1]) === 2, '选择后没有自动进入第 2 题');

  registry['prev-btn'].click();                       // 回第 1 题
  check(Number((/TRACK (\d+) <em>/.exec(contentEl.innerHTML) || [])[1]) === 1, '「上一题」没有回到第 1 题');
  check(contentEl.innerHTML.indexOf('id="next-btn"') > -1, '回到已作答的题目时应出现「下一题」');

  registry['next-btn'].click();                       // 手动前进
  check(Number((/TRACK (\d+) <em>/.exec(contentEl.innerHTML) || [])[1]) === 2, '手动点「下一题」没有前进');
});

/* ---------------- 5. 八个结果页全部渲染 ---------------- */
W.DT_ALBUMS.forEach(function (a) {
  var p = W.DT_PERSONAS[a.id];
  attempt('渲染 ' + a.title, function () { go('#/result/' + a.id); });
  var h = contentEl.innerHTML;
  check(h.indexOf(p.name) > -1, a.title + ' 结果页没有渲染出人格名');
  check(h.indexOf(p.tagline) > -1, a.title + ' 结果页缺少一句话画像');
  check(h.indexOf(p.closing) > -1, a.title + ' 结果页缺少结尾文字');
  check(h.indexOf(a.release) > -1, a.title + ' 结果页缺少发行信息');
  check(h.indexOf(a.producer) > -1, a.title + ' 结果页缺少制作人信息');
  check((h.match(/data-song=/g) || []).length >= 3, a.title + ' 推荐曲目少于 3 首');

  var box = W.DT_BLIND[a.id];
  check(!!box, a.title + ' 缺少彩蛋');
  if (box) {
    check(h.indexOf(box.title) > -1, a.title + ' 结果页没有显示彩蛋曲目');
    check(h.indexOf(box.desc) > -1, a.title + ' 彩蛋缺少说明文案');
  }
});

/* ---------------- 6. 分享链接冷启动 ---------------- */
attempt('冷启动打开双重人格分享链接', function () { go('#/result/op2009?d=bt2002'); });
var linkHtml = contentEl.innerHTML;
check(linkHtml.indexOf('双重人格倾向') > -1, '带 ?d= 的分享链接没有显示双重人格倾向');
check(linkHtml.indexOf(W.DT_PERSONAS.bt2002.name) > -1, '双重人格链接缺少第二人格名称');
check(linkHtml.indexOf('69乐章') > -1, '双重人格链接缺少主人格专辑名');

/* ---------------- 7. 按钮可用性 ---------------- */
/* 海报按钮改为提示截图（不再真的导出文件），点击后应给出该文案 */
attempt('点击保存海报', function () { registry['poster-btn'].click(); });
check((registry['toast'].textContent || '').indexOf('自行截图保存吧') > -1,
  '点「保存分享海报」后没有提示「自行截图保存吧~」，实际 toast=' + (registry['toast'].textContent || '空'));
attempt('点击复制链接', function () { registry['copy-btn'].click(); });
attempt('点击重新测试', function () { registry['retry-btn'].click(); });
check(global.window.location.hash === '#/quiz', '重新测试没有回到答题页，hash=' + global.window.location.hash);
attempt('点击底部重新测试', function () { registry['retry-btn2'].click(); });
attempt('点击回到封面', function () { registry['home-btn'].click(); });
check(global.window.location.hash === '#/', '回到封面没有生效，hash=' + global.window.location.hash);
/* 结果页正文里不应再出现「唱片档案」字样 */
check(contentEl.innerHTML.indexOf('唱片档案') === -1, '结果页仍残留「唱片档案」按钮');

/* ---------------- 8. 解锁语义：测过才亮名 ---------------- */
attempt('全部测完后回到封面', function () { go('#/'); });
var revealed = W.DT_ALBUMS.filter(function (a) {
  return contentEl.innerHTML.indexOf(W.DT_PERSONAS[a.id].name) > -1;
});
check(revealed.length === 8,
  '八张都测过后封面应亮出全部人格名，实际只有 ' + revealed.length + ' 个');
check(revealed.length === 8, '封面解锁状态没有到满额');

/* 解锁的格子必须变成 data-go（点击直接进它的结果页），未解锁的才是 data-peek（只显示音乐卡片） */
var goCount = (contentEl.innerHTML.match(/data-go=/g) || []).length;
var peekCount = (contentEl.innerHTML.match(/data-peek=/g) || []).length;
check(goCount === 8, '解锁后应有 8 个可跳转格子(data-go)，实际 ' + goCount + ' 个');
check(peekCount === 0, '全部解锁后不应再有待解锁格子(data-peek)，实际 ' + peekCount + ' 个');

/* 封面新版：一句话主文案 + 大唱片 + 标题融合，旧的小字段落不服聚剩下的小字段应该已经删掉 */
check(contentEl.innerHTML.indexOf('从1997—2013') > -1, '封面缺少一句话主文案');
check((contentEl.innerHTML.match(/<div class="disc-groove">/g) || []).length === 1, '封面缺少大唱片元素');
check(contentEl.innerHTML.indexOf('DAVID TAO') > -1, '唱片中心标签缺少 DAVID TAO');
check(contentEl.innerHTML.indexOf('无需登录') === -1 && contentEl.innerHTML.indexOf('不收集信息') === -1,
  '封面仍残留「无需登录 / 不收集信息」气泡');
check(contentEl.innerHTML.indexOf('<div class="specs">') === -1, '封面仍残留 specs 标签区');

/* 刷新一次：解锁状态必须能持久（localStorage 不可用时由内存兜底） */
attempt('模拟重开：再次进入封面', function () { go('#/quiz'); go('#/'); });
var stillLit = W.DT_ALBUMS.filter(function (a) {
  return contentEl.innerHTML.indexOf(W.DT_PERSONAS[a.id].name) > -1;
});
check(stillLit.length === 8, '重返封面后解锁状态丢失，只剩 ' + stillLit.length + ' 个亮着');

/* ---------------- 汇总 ---------------- */
console.log('--- 冒烟测试 ---');
if (problems.length === 0) {
  console.log('✅ 全流程通过');
  console.log('   · 封面：标题 + 8 格唱片索引 + 开始按钮');
  console.log('   · 答题：20 题逐题渲染，题号 / 题干 / 选项文案 / 点击绑定 全部正确');
  console.log('   · 进度条随作答推进，未作答时不出现「下一题」');
  console.log('   · 本次实测结果：' + (mainAlbum ? mainAlbum.title + ' · ' + W.DT_PERSONAS[mainAlbum.id].name : '—'));
  console.log('   · 深度解读弹窗可弹出且内容非空');
  console.log('   · 8 个结果页逐一渲染正常（人格名 / 画像 / 结尾 / 发行 / 制作人 / 推荐曲 / 彩蛋）');
  console.log('   · 双重人格分享链接冷启动正常');
  console.log('   · 海报 / 复制链接 / 重新测试 / 回到封面 按钮均可点击');
  console.log('   · 解锁：测过的唱片在封面亮出人格名 + 专辑色，可点击直达该结果页');
  console.log('   · 唱片档案已移除：封面与结果页均无档案入口');
} else {
  console.log('❌ 发现 ' + problems.length + ' 个问题：');
  problems.forEach(function (p) { if (p) console.log('   · ' + p); });
  process.exit(1);
}
console.log('注意：桩 DOM 无法替代真实浏览器，最终请以本地服务或 GitHub Pages 上线后的实际观感为准。');
