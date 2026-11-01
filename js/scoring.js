/* =============================================================
 * DAVID TAO · 音乐人格测试
 * js/scoring.js —— 评分算法（逻辑层，独立业务规则，不含界面代码）
 *
 * 算法说明：
 *   1. 每个选项给「主人格」加 PRIMARY 分，给「副人格」加 SECONDARY 分。
 *   2. 每题再乘以该题的 weight（见 content/questions.js）。
 *   3. 八张专辑各得一个总分，换算成百分比用于展示。
 *   4. 第一名 = 主人格。
 *   5. 若 第二名/第一名 >= DUAL_RATIO，判定为「双重人格倾向」，同时展示两者。
 *   6. 最后一名作为「距离你最远的切面」展示。
 *   7. 名次相同时按专辑年代顺序取前者，保证同一份答案永远得到同一结果。
 *
 * 调参入口全部在下面的 CONFIG 里，不要在别处写死数字。
 * ============================================================= */

window.DT_SCORING = (function () {

  var CONFIG = {
    PRIMARY: 3,        // 选项主人格得分
    SECONDARY: 1,      // 选项副人格得分
    DUAL_RATIO: 0.93,  // 第二名 / 第一名 达到此比例即显示双重人格倾向
                       // 实测触发率约 25%（太大→人人都双人格，太小→永不触发）
    ROUND: 1           // 百分比保留小数位
  };

  // 专辑顺序：仅用于名次相同时的稳定排序（年代顺序）
  var ORDER = ['dt1997', 'ok1999', 'bt2002', 'us2003', 'tp2005', 'be2006', 'op2009', 'hg2013'];

  /**
   * 计算八维得分
   * @param {Object} answers  { 题号(1..n): 选项下标(0..3) }
   * @param {Array}  questions  DT_QUESTIONS
   * @param {Array}  albumIds   八张专辑 id
   * @returns {Object} 见下方结构
   */
  function compute(answers, questions, albumIds) {
    var scores = {};
    albumIds.forEach(function (id) { scores[id] = 0; });

    questions.forEach(function (q) {
      var pick = answers[q.no];
      if (pick === undefined || pick === null) return;
      var opt = q.options[pick];
      if (!opt) return;
      var w = typeof q.weight === 'number' ? q.weight : 1;
      if (opt.p && scores[opt.p] !== undefined) scores[opt.p] += CONFIG.PRIMARY * w;
      if (opt.s && scores[opt.s] !== undefined) scores[opt.s] += CONFIG.SECONDARY * w;
    });

    // 排序：分数降序，分数相同按专辑年代升序，保证结果可复现
    var rank = albumIds.slice().sort(function (a, b) {
      if (scores[b] !== scores[a]) return scores[b] - scores[a];
      return ORDER.indexOf(a) - ORDER.indexOf(b);
    });

    var total = 0;
    albumIds.forEach(function (id) { total += scores[id]; });

    var shares = {};
    albumIds.forEach(function (id) {
      shares[id] = total > 0 ? (scores[id] / total) * 100 : 0;
    });

    var main = rank[0];
    var second = rank[1];
    var ratio = scores[main] > 0 ? scores[second] / scores[main] : 1;
    var isDual = ratio >= CONFIG.DUAL_RATIO;

    return {
      scores: scores,
      shares: shares,
      rank: rank,
      main: main,
      second: second,
      ratio: ratio,
      isDual: isDual,
      far: rank[rank.length - 1],
      farLabel: '距离你最远的切面',
      percentOf: function (id) {
        return Number(shares[id].toFixed(CONFIG.ROUND));
      }
    };
  }

  /** 生成用于分享链接的结果参数 */
  function toShareParams(result) {
    var p = 'r=' + result.main;
    if (result.isDual) p += '&d=' + result.second;
    return p;
  }

  return {
    CONFIG: CONFIG,
    ORDER: ORDER,
    compute: compute,
    toShareParams: toShareParams
  };
})();
