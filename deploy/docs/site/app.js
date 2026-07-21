/* Renderer der API-Referenz. Liest das globale `SPEC` (aus spec.js) und baut
   Nav · Content · Beispiel-Panel. Vanilla JS, kein Framework/Build. */
(function () {
  "use strict";

  var BASE_URL = SPEC.baseUrl;
  var flat = [];
  SPEC.groups.forEach(function (g) {
    g.endpoints.forEach(function (ep) {
      ep._group = g.title;
      ep.id = slug(ep.method + "-" + ep.path);
      flat.push(ep);
    });
  });

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ── Nav ─────────────────────────────────────────────────────────────── */
  function renderNav(filter) {
    var sb = document.getElementById("sidebar");
    sb.innerHTML = "";
    var q = (filter || "").toLowerCase();
    SPEC.groups.forEach(function (g) {
      var eps = g.endpoints.filter(function (ep) {
        return (
          !q ||
          ep.title.toLowerCase().indexOf(q) > -1 ||
          ep.path.toLowerCase().indexOf(q) > -1
        );
      });
      if (!eps.length) return;
      sb.appendChild(el("div", "nav-group-title", esc(g.title)));
      eps.forEach(function (ep) {
        var item = el("div", "nav-item");
        item.dataset.id = ep.id;
        item.appendChild(el("span", "title", esc(ep.title)));
        item.appendChild(
          el("span", "badge " + ep.method.toLowerCase(), esc(ep.method))
        );
        item.onclick = function () {
          location.hash = ep.id;
        };
        sb.appendChild(item);
      });
    });
    highlightNav();
  }

  function highlightNav() {
    var current = (location.hash || "").replace(/^#/, "");
    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.toggle("active", n.dataset.id === current);
    });
  }

  /* ── Content ─────────────────────────────────────────────────────────── */
  function paramRow(p) {
    var row = el("div", "param");
    var head = el("div", "param-head");
    head.appendChild(el("span", "param-name", esc(p.name)));
    if (p.type) head.appendChild(el("span", "param-type", esc(p.type)));
    if (p.required) head.appendChild(el("span", "param-req", "erforderlich"));
    if (p.default != null && p.default !== "")
      head.appendChild(el("span", "param-default", "Standard: " + esc(p.default)));
    row.appendChild(head);
    if (p.desc) row.appendChild(el("div", "param-desc", esc(p.desc)));
    if (p.enum && p.enum.length) {
      var chips = el("div", "chips");
      p.enum.forEach(function (v) {
        chips.appendChild(el("span", "chip", esc(v)));
      });
      row.appendChild(chips);
    }
    return row;
  }

  function renderContent(ep) {
    var c = document.getElementById("content");
    c.innerHTML = "";
    c.appendChild(el("h1", "ep-title", esc(ep.title)));

    var line = el("div", "ep-line");
    line.appendChild(
      el("span", "badge " + ep.method.toLowerCase(), esc(ep.method))
    );
    line.appendChild(el("span", "ep-path", esc(BASE_URL + ep.path)));
    c.appendChild(line);

    if (ep.desc) c.appendChild(el("p", "ep-desc", esc(ep.desc)));

    if (ep.pathParams && ep.pathParams.length) {
      c.appendChild(el("h2", "section-title", "Pfad-Parameter"));
      ep.pathParams.forEach(function (p) { c.appendChild(paramRow(p)); });
    }
    if (ep.query && ep.query.length) {
      c.appendChild(el("h2", "section-title", "Abfrageparameter"));
      ep.query.forEach(function (p) { c.appendChild(paramRow(p)); });
    }
    if (ep.body && ep.body.length) {
      c.appendChild(el("h2", "section-title", "Anfrage-Body"));
      ep.body.forEach(function (p) { c.appendChild(paramRow(p)); });
    }
    if (ep.response && ep.response.length) {
      c.appendChild(el("h2", "section-title", "Antwort · 200"));
      ep.response.forEach(function (p) { c.appendChild(paramRow(p)); });
    }
    c.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /* ── Beispiel-Panel ──────────────────────────────────────────────────── */
  var LANGS = ["curl", "python", "node"];
  function codeFor(ep, lang) {
    var url = BASE_URL + ep.path;
    var m = ep.method;
    if (lang === "curl") {
      return (
        '<span class="c"># ' + esc(ep.title) + "</span>\n" +
        "curl -X " + m + ' "' + esc(url) + '" \\\n' +
        '  -H "X-Api-Key: <span class="s">DEIN_API_KEY</span>" \\\n' +
        '  -H "Accept: application/json"'
      );
    }
    if (lang === "python") {
      return (
        '<span class="k">import</span> requests\n\n' +
        'url = <span class="s">"' + esc(url) + '"</span>\n' +
        'headers = {<span class="s">"X-Api-Key"</span>: <span class="s">"DEIN_API_KEY"</span>}\n' +
        "resp = requests." + m.toLowerCase() + "(url, headers=headers)\n" +
        "<span class=\"k\">print</span>(resp.json())"
      );
    }
    return (
      '<span class="k">const</span> res = <span class="k">await</span> fetch(\n' +
      '  <span class="s">"' + esc(url) + '"</span>,\n' +
      '  { method: <span class="s">"' + m + '"</span>, headers: { <span class="s">"X-Api-Key"</span>: <span class="s">"DEIN_API_KEY"</span> } }\n' +
      ");\n<span class=\"k\">const</span> data = <span class=\"k\">await</span> res.json();"
    );
  }

  function renderExample(ep) {
    var x = document.getElementById("example");
    x.innerHTML = "";
    x.appendChild(el("div", "panel-label", "Sprache"));

    var tabs = el("div", "lang-tabs");
    var pre = el("pre");
    var block = el("div", "code-block");
    var head = el("div", "cb-head", "Anfrage");
    block.appendChild(head);
    block.appendChild(pre);

    var state = { lang: "curl" };
    function paint() {
      pre.innerHTML = codeFor(ep, state.lang);
      tabs.querySelectorAll(".lang-tab").forEach(function (t) {
        t.classList.toggle("active", t.dataset.lang === state.lang);
      });
    }
    LANGS.forEach(function (l) {
      var t = el("div", "lang-tab", l === "curl" ? "cURL" : l === "python" ? "Python" : "Node");
      t.dataset.lang = l;
      t.onclick = function () { state.lang = l; paint(); };
      tabs.appendChild(t);
    });
    x.appendChild(tabs);

    x.appendChild(el("div", "panel-label", "Authentifizierung"));
    x.appendChild(el("div", "auth-row", "X-Api-Key: •••••••••••••"));

    x.appendChild(block);
    paint();

    if (ep.response && ep.response.length) {
      var rh = el("div", "resp-head");
      rh.appendChild(el("span", "dot"));
      rh.appendChild(el("span", null, "200 · OK"));
      x.appendChild(rh);
    }
  }

  /* ── Routing ─────────────────────────────────────────────────────────── */
  function route() {
    var id = (location.hash || "").replace(/^#/, "");
    var ep = flat.filter(function (e) { return e.id === id; })[0] || flat[0];
    if (!ep) return;
    renderContent(ep);
    renderExample(ep);
    highlightNav();
  }

  document.getElementById("search").addEventListener("input", function (e) {
    renderNav(e.target.value);
  });
  window.addEventListener("hashchange", route);

  renderNav("");
  route();
})();
