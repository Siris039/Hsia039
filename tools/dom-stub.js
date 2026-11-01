/* =============================================================
 * DAVID TAO · 音乐人格测试
 * tools/dom-stub.js —— 极简 DOM 桩（供 Node 端跑界面逻辑，不需要浏览器）
 *
 * 只实现本工程真正用到的那部分 API：
 *   getElementById / querySelector(All) / createElement / appendChild
 *   addEventListener / click / classList / dataset / set-getAttribute
 * 断言一律直接解析渲染出来的 HTML —— 验的就是用户最终看到的字符串。
 * ============================================================= */

'use strict';

function El(id) {
  this.id = id || '';
  this.className = '';
  this._html = '';
  this.textContent = '';
  this.disabled = false;
  this.style = { setProperty: function () {}, width: '', visibility: '' };
  this.dataset = {};
  this.classList = {
    _s: {},
    add: function (c) { this._s[c] = 1; },
    remove: function (c) { delete this._s[c]; },
    contains: function (c) { return !!this._s[c]; },
    toggle: function () {}
  };
}
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function () { return this._html; },
  // 重绘即清空子节点，模拟浏览器行为
  set: function (v) { this._html = String(v); this._children = []; }
});
El.prototype.addEventListener = function (ev, fn) { (this._ev = this._ev || {})[ev] = fn; };
El.prototype.click = function () {
  if (this._ev && this._ev.click) this._ev.click();
  else throw new Error('元素没有绑定 click: ' + this.id);
};
El.prototype.getAttribute = function (k) { return (this._attr || {})[k]; };
El.prototype.setAttribute = function (k, v) { (this._attr = this._attr || {})[k] = v; };
El.prototype.appendChild = function (child) { (this._children = this._children || []).push(child); };
El.prototype.remove = function () { this._removed = true; };
El.prototype.select = function () {};
El.prototype.querySelector = function () { return new El(); };

/** 只支持本工程用到的属性选择器 [data-xxx] */
El.prototype.querySelectorAll = function (sel) {
  this._cache = this._cache || {};
  // querySelectorAll 的结果必须缓存，否则二次取到的是新对象，拿不到已绑定的事件
  if (this._cache.__html !== this._html) this._cache = { __html: this._html };
  if (this._cache[sel]) return this._cache[sel];

  var out = [], am = /^\[([\w-]+)\]$/.exec(sel);
  if (am) {
    var re = new RegExp(am[1] + '="([^"]*)"', 'g'), m;
    while ((m = re.exec(this._html))) {
      var e = new El();
      e.setAttribute(am[1], m[1]);
      e.parentNode = { classList: { toggle: function () {} } };
      out.push(e);
    }
  }
  this._cache[sel] = out;
  return out;
};

/**
 * 建立一套桩环境。
 * @param {string[]} ids 页面上存在的元素 id
 */
function create(ids) {
  var registry = {};
  (ids || []).forEach(function (id) { registry[id] = new El(id); });

  var appended = [];   // 记录 appendChild 到 body 的元素（弹窗）

  var win = {
    scrollTo: function () {},
    addEventListener: function (ev, fn) { if (ev === 'hashchange') this._hash = fn; },
    location: { hash: '#/', origin: 'https://example.com', pathname: '/', href: 'https://example.com/' },
    navigator: {},
    URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} }
  };

  var doc = {
    documentElement: { style: { setProperty: function () {} } },
    getElementById: function (id) {
      if (!registry[id]) registry[id] = new El(id);
      return registry[id];
    },
    querySelector: function (sel) {
      var k = sel[0] === '#' ? sel.slice(1) : sel;
      if (!registry[k]) registry[k] = new El(k);
      return registry[k];
    },
    querySelectorAll: function () { return []; },
    createElement: function () { return new El(); },
    addEventListener: function () {},
    execCommand: function () { return true; },
    body: {
      appendChild: function (el) { appended.push(el); },
      removeChild: function () {},
      style: {}
    }
  };

  // 同步执行：让「点选项自动翻页」的延时逻辑在桩环境里也能推进流程
  var setTimeoutStub = function (fn) { fn(); return 0; };
  var clearTimeoutStub = function () {};

  // localStorage 桩：解锁状态依赖它，缺了就验不到「答案是否被藏起来」
  var mem = {};
  var storage = {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    clear: function () { mem = {}; }
  };

  win.localStorage = storage;
  global.localStorage = storage;

  global.window = win;
  global.location = win.location;
  global.document = doc;
  global.setTimeout = setTimeoutStub;
  global.clearTimeout = clearTimeoutStub;

  function runScript(src) {
    new Function('window', 'document', 'location', 'navigator', 'setTimeout', 'clearTimeout', 'URL', src)(
      win, doc, win.location, win.navigator, setTimeoutStub, clearTimeoutStub, win.URL);
  }

  return {
    registry: registry,
    window: win,
    document: doc,
    appended: appended,
    runScript: runScript
  };
}

module.exports = { El: El, create: create };
