/**
 * 把整个项目打包成一个单文件 HTML。
 * 产物：DAVID-TAO-音乐人格测试.html —— 双击即可打开，不需要服务器。
 *
 * 用法：node tools/build-standalone.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'DAVID-TAO-音乐人格测试.html');

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

const CONTENT = [
  'content/albums.js',
  'content/personalities.js',
  'content/deep-analysis.js',
  'content/blindbox.js',
  'content/questions.js',
];
const LOGIC = ['js/scoring.js', 'js/poster.js'];
const VIEW = ['js/app.js'];

// 内联脚本必须避免出现 </script，否则 HTML 解析器会提前结束脚本块
function safeInline(src, label) {
  if (/<\/script/i.test(src)) {
    throw new Error('脚本 ' + label + ' 含 </script，无法安全内联');
  }
  return src;
}

const css = read('assets/style.css');
const contentJs = CONTENT.map(function (f) {
  return '/* ===== ' + f + ' ===== */\n' + safeInline(read(f), f);
}).join('\n\n');
const logicJs = LOGIC.map(function (f) {
  return '/* ===== ' + f + ' ===== */\n' + safeInline(read(f), f);
}).join('\n\n');
const viewJs = VIEW.map(function (f) {
  return '/* ===== ' + f + ' ===== */\n' + safeInline(read(f), f);
}).join('\n\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>DAVID TAO · 你是哪一种陶喆音乐人格？</title>
<meta name="description" content="以陶喆八张重要专辑为基础的音乐人格测试。八张唱片，八种表达，八种精神切面。">
<meta property="og:title" content="DAVID TAO · 你是哪一种陶喆音乐人格？">
<meta property="og:description" content="八张专辑，八种音乐表达，八种精神切面。">
<meta name="theme-color" content="#efe9df">
<style>
${css}</style>
</head>
<body>

<!-- 胶片噪点与暗角 -->
<div class="film-bg" aria-hidden="true"></div>

<main class="card" id="app-card">
  <div id="content-area"></div>
  <div class="author-note" id="author-note-container"></div>
</main>

<div id="modal-root"></div>
<div class="toast" id="toast"></div>

<!-- ===== 内容层：八张专辑 / 八种人格 / 40 首解读 / 8 枚彩蛋 ===== -->
<script>
${contentJs}</script>

<!-- ===== 逻辑层：评分规则 + 海报生成，不含界面代码 ===== -->
<script>
${logicJs}</script>

<!-- ===== 界面层 ===== -->
<script>
${viewJs}</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('已生成：' + path.relative(process.cwd(), OUT));
console.log('体积：' + kb + ' KB（纯本地，无任何外部依赖）');
