/* Renderer der API-Referenz (1:1 Lodgify/readme.io-Layout).
   Liest window.SPEC (spec.js) + window.LANG_ICONS (lang-icons.js). Vanilla JS. */
(function () {
  "use strict";

  var BASE = SPEC.baseUrl;
  var ICONS = window.LANG_ICONS || {};

  // Sprachen im Panel: die ersten fünf als Reihe, Rest im „…"-Dropdown.
  var PRIMARY = ["shell", "node", "ruby", "php", "python"];
  var MORE = [
    "c", "csharp", "cplusplus", "clojure", "go", "http", "java", "javascript",
    "json", "kotlin", "objectivec", "ocaml", "powershell", "r", "rust", "swift",
  ];
  var LANG_LABEL = {
    shell: "Shell", node: "Node", ruby: "Ruby", php: "PHP", python: "Python",
    c: "C", csharp: "C#", cplusplus: "C++", clojure: "Clojure", go: "Go",
    http: "HTTP", java: "Java", javascript: "JavaScript", json: "JSON",
    kotlin: "Kotlin", objectivec: "Objective-C", ocaml: "OCaml",
    powershell: "PowerShell", r: "R", rust: "Rust", swift: "Swift",
  };

  // Globale Response-Codes + Accept-Header (bei uns einheitlich JSON).
  var STATUS = [
    { code: 200, txt: "OK", ok: true },
    { code: 400, txt: "Bad Request", ok: false },
    { code: 401, txt: "Unauthorized", ok: false },
    { code: 404, txt: "Not Found", ok: false },
    { code: 422, txt: "Unprocessable Entity", ok: false },
    { code: 500, txt: "Server Error", ok: false },
  ];
  var ACCEPT = ["application/json", "text/plain"];

  var flat = [];
  SPEC.groups.forEach(function (g) {
    g.endpoints.forEach(function (ep) {
      ep._group = g.title;
      ep.id = slug(ep.method + "-" + ep.path);
      flat.push(ep);
    });
  });

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
  function el(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function icon(key, size) {
    var i = ICONS[key];
    if (!i) return '<svg viewBox="0 0 24 24" width="' + (size||18) + '" height="' + (size||18) + '"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    return '<svg viewBox="0 0 24 24" width="' + (size||18) + '" height="' + (size||18) + '" fill="' + (i.color||"currentColor") + '"><path d="' + i.path + '"/></svg>';
  }

  /* ── Sidebar (aufklappbare Gruppen) ────────────────────────────────────── */
  function renderNav(filter) {
    var sb = document.getElementById("sidebar");
    sb.innerHTML = "";

    var jump = el("div", "jump");
    jump.innerHTML = '<input id="jump" placeholder="JUMP TO" /><span class="kbd">⌘/</span>';
    sb.appendChild(jump);

    sb.appendChild(el("div", "ver-label", "myNextDays REST-API v1"));

    var q = (filter || "").toLowerCase();
    var current = (location.hash || "").replace(/^#/, "");
    SPEC.groups.forEach(function (g, gi) {
      var eps = g.endpoints.filter(function (ep) {
        return !q || ep.title.toLowerCase().indexOf(q) > -1 || ep.path.toLowerCase().indexOf(q) > -1;
      });
      if (!eps.length) return;

      var groupHasCurrent = eps.some(function (e) { return e.id === current; });
      var open = q ? true : (groupHasCurrent || gi === 0);

      var grp = el("div", "grp" + (open ? " open" : ""));
      var head = el("div", "grp-head" + (open ? " open" : ""));
      head.innerHTML = '<span>' + esc(g.title) + '</span>' +
        '<svg class="grp-chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>';
      head.onclick = function () { grp.classList.toggle("open"); head.classList.toggle("open"); };
      grp.appendChild(head);

      var items = el("div", "grp-items");
      eps.forEach(function (ep) {
        var it = el("div", "nav-item" + (ep.id === current ? " active" : ""));
        it.dataset.id = ep.id;
        it.innerHTML = '<span class="t">' + esc(ep.title) + '</span><span class="badge ' +
          ep.method.toLowerCase() + '">' + esc(ep.method) + '</span>';
        it.onclick = function () { location.hash = ep.id; };
        items.appendChild(it);
      });
      grp.appendChild(items);
      sb.appendChild(grp);
    });

    var ji = document.getElementById("jump");
    if (ji) ji.addEventListener("input", function (e) { renderNav(e.target.value); setTimeout(function(){var f=document.getElementById("jump"); if(f){f.value=e.target.value; f.focus();}},0); });
  }

  /* ── Content ───────────────────────────────────────────────────────────── */
  function paramRow(p) {
    var row = el("div", "param");
    var head = el("div", "param-head");
    head.appendChild(el("span", "param-name", esc(p.name)));
    if (p.type) head.appendChild(el("span", "param-type", esc(p.type)));
    if (p.required) head.appendChild(el("span", "param-req", "erforderlich"));
    if (p.default != null && p.default !== "") head.appendChild(el("span", "param-default", "Standard: " + esc(p.default)));
    row.appendChild(head);
    if (p.desc) row.appendChild(el("div", "param-desc", esc(p.desc)));
    if (p.enum && p.enum.length) {
      var chips = el("div", "chips");
      chips.appendChild(el("span", "enum-label", "Erlaubt:"));
      p.enum.forEach(function (v) { chips.appendChild(el("span", "chip", esc(v))); });
      row.appendChild(chips);
    }
    return row;
  }

  function selectBox(value) {
    var s = el("span", "select");
    s.innerHTML = esc(value) + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    return s;
  }

  function renderContent(ep) {
    var c = document.getElementById("content");
    c.innerHTML = "";

    var top = el("div", "ep-top");
    top.appendChild(el("h1", "ep-title", esc(ep.title)));
    var cp = el("button", "copy-page");
    cp.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg> Seite kopieren';
    cp.onclick = function () { navigator.clipboard.writeText(location.href); cp.innerHTML = "✓ Kopiert"; };
    top.appendChild(cp);
    c.appendChild(top);

    var line = el("div", "ep-line");
    line.appendChild(el("span", "badge " + ep.method.toLowerCase(), esc(ep.method)));
    line.appendChild(el("span", "ep-path", esc(BASE + ep.path)));
    c.appendChild(line);

    if (ep.desc) c.appendChild(el("p", "ep-desc", esc(ep.desc)));
    c.appendChild(el("hr", "rule"));

    // Recent Requests (statisch wie Lodgify)
    var rh = el("div", "recent-head");
    rh.innerHTML = '<span class="st">Aktuelle Anfragen</span><span class="note">Melde dich an, um den vollständigen Verlauf zu sehen.</span>';
    c.appendChild(rh);
    var rb = el("div", "recent-box");
    rb.innerHTML =
      '<div class="recent-cols"><span>Zeit</span><span>Status</span><span>User-Agent</span></div>' +
      '<div class="recent-empty">Noch keine Anfragen.</div>' +
      '<div class="recent-foot">0 Anfragen diesen Monat</div>';
    c.appendChild(rb);

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

    // Header (Accept)
    c.appendChild(el("h2", "section-title", "Header"));
    var hr = el("div", "hdr-row");
    var hl = el("div", "hdr-left");
    hl.innerHTML = '<div class="param-head"><span class="param-name">Accept</span><span class="param-type">string · enum</span></div>' +
      '<div class="param-desc">Standardmäßig application/json.</div>';
    var hchips = el("div", "chips");
    hchips.appendChild(el("span", "enum-label", "Erlaubt:"));
    ACCEPT.forEach(function (v) { hchips.appendChild(el("span", "chip", v)); });
    hl.appendChild(hchips);
    hr.appendChild(hl);
    hr.appendChild(selectBox("application/json"));
    c.appendChild(hr);

    // Antworten
    c.appendChild(el("h2", "section-title", "Antworten"));
    var rblock = el("div", "resp-block");
    var srow = el("div", "resp-status-row");
    srow.innerHTML = '<span class="dot" style="background:var(--ok)"></span><span class="code">200</span><span class="txt">OK</span>';
    rblock.appendChild(srow);
    if (ep.response && ep.response.length) {
      var tree = el("div", "tree");
      ep.response.forEach(function (f) {
        var tr = el("div", "tree-row");
        tr.innerHTML = '<span class="tree-name">' + esc(f.name) + '</span><span class="tree-type">' + esc(f.type || "") + '</span>' +
          (f.desc ? '<span class="tree-desc">' + esc(f.desc) + '</span>' : "");
        tree.appendChild(tr);
      });
      rblock.appendChild(tree);
    }
    c.appendChild(rblock);

    window.scrollTo(0, 0);
  }

  /* ── Beispiel-Panel ──────────────────────────────────────────────────── */
  function codeFor(ep, lang) {
    var url = BASE + ep.path, m = ep.method;
    if (lang === "shell") {
      return { install: null, lines: [
        '<span class="c"># ' + esc(ep.title) + '</span>',
        'curl -X ' + m + ' "' + esc(url) + '" \\',
        '  -H "X-Api-Key: <span class="s">DEIN_API_KEY</span>" \\',
        '  -H "Accept: application/json"',
      ]};
    }
    if (lang === "python") {
      return { install: "$ python -m pip install requests", lines: [
        '<span class="k">import</span> requests',
        '',
        'url = <span class="s">"' + esc(url) + '"</span>',
        'headers = {<span class="s">"X-Api-Key"</span>: <span class="s">"DEIN_API_KEY"</span>}',
        'resp = requests.' + m.toLowerCase() + '(url, headers=headers)',
        '<span class="k">print</span>(resp.json())',
      ]};
    }
    if (lang === "node" || lang === "javascript") {
      return { install: null, lines: [
        '<span class="k">const</span> res = <span class="k">await</span> fetch(',
        '  <span class="s">"' + esc(url) + '"</span>,',
        '  { method: <span class="s">"' + m + '"</span>, headers: { <span class="s">"X-Api-Key"</span>: <span class="s">"DEIN_API_KEY"</span> } }',
        ');',
        '<span class="k">const</span> data = <span class="k">await</span> res.json();',
      ]};
    }
    if (lang === "php") {
      return { install: null, lines: [
        '<span class="k">$ch</span> = curl_init(<span class="s">"' + esc(url) + '"</span>);',
        'curl_setopt($ch, CURLOPT_HTTPHEADER, [<span class="s">"X-Api-Key: DEIN_API_KEY"</span>]);',
        'curl_setopt($ch, CURLOPT_RETURNTRANSFER, <span class="k">true</span>);',
        '<span class="k">$data</span> = json_decode(curl_exec($ch), <span class="k">true</span>);',
      ]};
    }
    if (lang === "ruby") {
      return { install: null, lines: [
        '<span class="k">require</span> <span class="s">"net/http"</span>',
        'uri = URI(<span class="s">"' + esc(url) + '"</span>)',
        'req = Net::HTTP::' + (m.charAt(0) + m.slice(1).toLowerCase()) + '.new(uri)',
        'req[<span class="s">"X-Api-Key"</span>] = <span class="s">"DEIN_API_KEY"</span>',
      ]};
    }
    // generischer HTTP-Fallback für die restlichen Sprachen
    return { install: null, lines: [
      m + ' ' + esc(ep.path) + ' HTTP/1.1',
      'Host: api.mynextdays.com',
      'X-Api-Key: DEIN_API_KEY',
      'Accept: application/json',
    ]};
  }

  function renderCode(ep, lang) {
    var d = codeFor(ep, lang);
    var block = el("div", "code-block");
    var head = el("div", "cb-head", "Anfrage");
    block.appendChild(head);
    if (d.install) block.appendChild(el("div", "cb-install", esc(d.install)));
    var wrap = el("div", "code-wrap");
    var gutter = el("div", "gutter", d.lines.map(function (_, i) { return i + 1; }).join("<br>"));
    var pre = el("pre", null, d.lines.join("\n"));
    wrap.appendChild(gutter); wrap.appendChild(pre);
    block.appendChild(wrap);
    var foot = el("div", "cb-foot");
    foot.innerHTML = '<button class="copy-btn"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg></button><button class="try-btn">Probier es aus!</button>';
    foot.querySelector(".copy-btn").onclick = function () { navigator.clipboard.writeText(d.lines.join("\n").replace(/<[^>]+>/g, "")); };
    block.appendChild(foot);
    return block;
  }

  function renderExample(ep) {
    var x = document.getElementById("example");
    x.innerHTML = "";
    var state = { lang: "shell", status: 200 };

    x.appendChild(el("div", "panel-label", "Sprache"));
    var row = el("div", "lang-row");
    PRIMARY.forEach(function (l) {
      var b = el("button", "lang-btn" + (l === state.lang ? " active" : ""));
      b.innerHTML = icon(l, 22) + '<span>' + LANG_LABEL[l] + '</span>';
      b.onclick = function () { state.lang = l; paint(); };
      b.dataset.lang = l;
      row.appendChild(b);
    });
    var more = el("div", "lang-more");
    var moreBtn = el("button", "lang-more-btn", "⋮");
    var dd = el("div", "dropdown"); dd.hidden = true;
    MORE.forEach(function (l) {
      var mi = el("div", "dd-item");
      mi.innerHTML = icon(l, 18) + '<span>' + LANG_LABEL[l] + '</span>';
      mi.onclick = function () { state.lang = l; dd.hidden = true; paint(); };
      dd.appendChild(mi);
    });
    moreBtn.onclick = function (e) { e.stopPropagation(); dd.hidden = !dd.hidden; };
    document.addEventListener("click", function () { dd.hidden = true; });
    more.appendChild(moreBtn); more.appendChild(dd);
    row.appendChild(more);
    x.appendChild(row);

    x.appendChild(el("div", "panel-label", "Authentifizierung"));
    var auth = el("div", "auth-row");
    auth.innerHTML = 'X-Api-Key: •••••••••••••<svg class="lock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
    x.appendChild(auth);

    var codeHost = el("div"); x.appendChild(codeHost);

    // Response-Panel mit Status-Dropdown
    var rp = el("div", "resp-panel");
    var selRow = el("div", "resp-select-row");
    var sel = el("div", "status-select");
    var btn = el("button", "status-btn");
    var dd2 = el("div", "dropdown"); dd2.hidden = true;
    STATUS.forEach(function (s) {
      var it = el("div", "dd-item");
      it.innerHTML = '<span class="dot" style="width:8px;height:8px;border-radius:50%;background:' + (s.ok ? "var(--ok)" : "var(--err)") + '"></span> ' + s.code + ' ' + s.txt;
      it.onclick = function () { state.status = s.code; dd2.hidden = true; paint(); };
      dd2.appendChild(it);
    });
    btn.onclick = function (e) { e.stopPropagation(); dd2.hidden = !dd2.hidden; };
    document.addEventListener("click", function () { dd2.hidden = true; });
    sel.appendChild(btn); sel.appendChild(dd2);
    selRow.appendChild(sel);
    rp.appendChild(selRow);
    var respCode = el("div", "resp-code");
    rp.appendChild(respCode);
    x.appendChild(rp);

    function respBody(ep, status) {
      if (status === 200 && ep.response && ep.response.length) {
        var obj = {};
        ep.response.slice(0, 8).forEach(function (f) {
          var t = (f.type || "").toLowerCase();
          obj[f.name.split(".").pop().split("[")[0]] =
            t.indexOf("int") > -1 || t.indexOf("number") > -1 ? 0 :
            t.indexOf("bool") > -1 ? false :
            t.indexOf("[]") > -1 || t.indexOf("array") > -1 ? [] : "string";
        });
        return JSON.stringify(obj, null, 2);
      }
      return JSON.stringify({ message: "string", code: "string", detail: "string" }, null, 2);
    }

    function paint() {
      codeHost.innerHTML = "";
      codeHost.appendChild(renderCode(ep, state.lang));
      row.querySelectorAll(".lang-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === state.lang); });
      var s = STATUS.filter(function (x) { return x.code === state.status; })[0] || STATUS[0];
      btn.innerHTML = '<span class="dot" style="background:' + (s.ok ? "var(--ok)" : "var(--err)") + '"></span>' + s.code + ' <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
      var body = respBody(ep, state.status);
      var lines = body.split("\n");
      respCode.innerHTML = '<div class="code-wrap"><div class="gutter">' +
        lines.map(function (_, i) { return i + 1; }).join("<br>") +
        '</div><pre>' + esc(body) + '</pre></div>';
    }
    paint();
  }

  /* ── Routing ─────────────────────────────────────────────────────────── */
  function route() {
    var id = (location.hash || "").replace(/^#/, "");
    var ep = flat.filter(function (e) { return e.id === id; })[0] || flat[0];
    if (!ep) return;
    renderContent(ep);
    renderExample(ep);
    renderNav(document.getElementById("search") ? document.getElementById("search").value : "");
  }

  var topSearch = document.getElementById("search");
  if (topSearch) topSearch.addEventListener("input", function (e) { renderNav(e.target.value); });
  window.addEventListener("hashchange", route);

  renderNav("");
  route();
})();
