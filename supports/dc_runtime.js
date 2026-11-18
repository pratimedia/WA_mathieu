/* Mini moteur des supports web de l'Espace Candidat M@N (export autonome des pages Claude Design).
   Interprete le sous-ensemble du format .dc.html utilise par les supports : {{trous}}, <sc-for>, <sc-if>,
   evenements onClick="{{fonction}}", classe Component extends DCLogic (state, setState, renderVals). */
(function () {
  var SVG = 'http://www.w3.org/2000/svg';
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p) {
    var v = typeof p === 'function' ? p(this.state) : p;
    for (var k in v) this.state[k] = v[k];
    if (this.__render) this.__render();
  };
  window.DCLogic = DCLogic;

  function lookup(scope, path) {
    path = path.trim();
    if (path === 'true') return true; if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), cur;
    if (!(parts[0] in scope)) return undefined;
    cur = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  var WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  function interp(str, scope) {
    return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }
  function child(scope, name, value, index) {
    var s = Object.create(scope); s[name] = value; s.$index = index; return s;
  }
  function renderNodes(nodes, scope, inSvg, out) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, inSvg, out);
  }
  function renderNode(n, scope, inSvg, out) {
    if (n.nodeType === 3) { out.push(document.createTextNode(interp(n.nodeValue, scope))); return; }
    if (n.nodeType !== 1) return;
    var tag = n.tagName.toLowerCase();
    if (tag === 'sc-for') {
      var m = WHOLE.exec(n.getAttribute('list') || ''), list = m ? lookup(scope, m[1]) : [];
      var as = n.getAttribute('as') || 'item';
      (list || []).forEach(function (it, idx) { renderNodes(n.childNodes, child(scope, as, it, idx), inSvg, out); });
      return;
    }
    if (tag === 'sc-if') {
      var mv = WHOLE.exec(n.getAttribute('value') || '');
      if (mv && lookup(scope, mv[1])) renderNodes(n.childNodes, scope, inSvg, out);
      return;
    }
    var svg = inSvg || tag === 'svg';
    var el = svg ? document.createElementNS(SVG, n.tagName) : document.createElement(tag);
    for (var a = 0; a < n.attributes.length; a++) {
      var at = n.attributes[a], name = at.name, val = at.value, w = WHOLE.exec(val);
      if (/^on/i.test(name) && w) {
        var fn = lookup(scope, w[1]);
        if (typeof fn === 'function') el.addEventListener(name.slice(2).toLowerCase(), fn);
        continue;
      }
      if (/^(hint-|data-dc)/.test(name)) continue;
      el.setAttribute(name, interp(val, scope));
    }
    var kids = [];
    renderNodes(n.childNodes, scope, svg, kids);
    kids.forEach(function (k) { el.appendChild(k); });
    out.push(el);
  }
  function pathOf(el, root) {
    var p = [];
    while (el && el !== root) { var i = 0, s = el; while ((s = s.previousElementSibling)) i++; p.unshift(i); el = el.parentElement; }
    return el === root ? p : null;
  }
  function byPath(root, p) {
    var el = root;
    for (var i = 0; i < p.length && el; i++) el = el.children[p[i]];
    return el;
  }
  window.dcMount = function (root, tplText, Component) {
    var tpl = document.createElement('template');
    tpl.innerHTML = tplText;
    var comp = new Component({});
    comp.__render = function () {
      var focus = document.activeElement && root.contains(document.activeElement) ? pathOf(document.activeElement, root) : null;
      var out = [];
      renderNodes(tpl.content.childNodes, comp.renderVals(), false, out);
      root.replaceChildren.apply(root, out);
      if (focus) { var f = byPath(root, focus); if (f && f.focus) f.focus({ preventScroll: true }); }
    };
    comp.__render();
    if (comp.componentDidMount) comp.componentDidMount();
  };
})();
