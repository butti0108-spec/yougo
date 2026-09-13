(() => {
  const PARENTS = [
    {
      id: "content",
      kind: "content",
      title: "Content（読む）",
      note: "読む情報。Hierarchy の対象"
    },
    {
      id: "interaction",
      kind: "interaction",
      title: "Interaction（操作する）",
      note: "Button / Selection Card / Toggle など"
    },
    {
      id: "system",
      kind: "system",
      title: "System（状態）",
      note: "進行・案内・結果を知らせる"
    }
  ];

  const STORAGE_KNOWN = "yougo-known-v1";
  const STORAGE_SEARCH = "yougo-search-v1";

  const state = {
    terms: [],
    byId: new Map(),
    filterParent: null,
    query: "",
    screen: "home",
    known: {},
    searchCount: {}
  };

  const els = {
    q: document.getElementById("q"),
    home: document.getElementById("home-view"),
    parentView: document.getElementById("parent-view"),
    parentHead: document.getElementById("parent-head"),
    parentList: document.getElementById("parent-term-list"),
    parentListTitle: document.getElementById("parent-list-title"),
    parentBack: document.getElementById("parent-back-btn"),
    detailView: document.getElementById("detail-view"),
    detail: document.getElementById("detail"),
    list: document.getElementById("term-list"),
    listBlock: document.getElementById("list-block"),
    parents: document.getElementById("parent-grid"),
    back: document.getElementById("back-btn"),
    listTitle: document.querySelector("#list-block .list-title")
  };

  function loadStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* ignore quota */
    }
  }

  function isKnown(id) {
    return Boolean(state.known[id]);
  }

  function searchHits(id) {
    return Number(state.searchCount[id] || 0);
  }

  function toggleKnown(id) {
    if (state.known[id]) delete state.known[id];
    else state.known[id] = true;
    saveStore(STORAGE_KNOWN, state.known);
  }

  function bumpSearch(id) {
    state.searchCount[id] = searchHits(id) + 1;
    saveStore(STORAGE_SEARCH, state.searchCount);
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[ー−-]/g, "");
  }

  function haystack(term) {
    return normalize(
      [
        term.id,
        term.name,
        term.nameJa,
        term.reading,
        term.oneLiner,
        ...(term.aliases || [])
      ].join(" ")
    );
  }

  function sortTerms(list) {
    return list.slice().sort((a, b) => {
      const ka = isKnown(a.id) ? 1 : 0;
      const kb = isKnown(b.id) ? 1 : 0;
      if (ka !== kb) return ka - kb; // 未習得が上
      const sa = searchHits(a.id);
      const sb = searchHits(b.id);
      if (sa !== sb) return sb - sa; // よく開いた語が上
      return a.nameJa.localeCompare(b.nameJa, "ja");
    });
  }

  function termsForParent(parentId) {
    return sortTerms(
      state.terms.filter((t) => t.id === parentId || t.parentId === parentId)
    );
  }

  function searchTerms(qRaw) {
    const q = normalize(qRaw);
    if (!q) return [];
    return sortTerms(state.terms.filter((t) => haystack(t).includes(q)));
  }

  function allTermsSorted() {
    return sortTerms(state.terms);
  }

  function setScreens(screen) {
    state.screen = screen;
    els.home.hidden = screen !== "home";
    els.parentView.hidden = screen !== "parent";
    els.detailView.hidden = screen !== "detail";
  }

  function showHome() {
    state.filterParent = null;
    setScreens("home");
    history.replaceState(null, "", location.pathname + location.search);
    renderHome();
    window.scrollTo(0, 0);
  }

  function showParent(parentId) {
    state.filterParent = parentId;
    state.query = "";
    els.q.value = "";
    setScreens("parent");
    history.replaceState(null, "", "#cat/" + encodeURIComponent(parentId));
    renderParent();
    window.scrollTo(0, 0);
  }

  function showDetail(id) {
    const term = state.byId.get(id);
    if (!term) return;
    bumpSearch(id);
    setScreens("detail");
    els.detail.innerHTML = renderDetail(term);
    history.replaceState(null, "", "#" + encodeURIComponent(id));
    window.scrollTo(0, 0);
  }

  function backFromDetail() {
    if (state.filterParent) showParent(state.filterParent);
    else showHome();
  }

  function parentLabel(id) {
    if (!id) return "（なし／横断）";
    const t = state.byId.get(id);
    return t ? t.nameJa + " / " + t.name : id;
  }

  function renderDetail(term) {
    const related = (term.related || [])
      .map((id) => state.byId.get(id))
      .filter(Boolean);
    const children = state.terms.filter((t) => t.parentId === term.id);
    const known = isKnown(term.id);

    const relatedHtml = related.length
      ? `<div class="chips">${related
          .map(
            (t) =>
              `<button type="button" class="chip" data-open="${t.id}">${escapeHtml(
                t.nameJa
              )}</button>`
          )
          .join("")}</div>`
      : "<p>（なし）</p>";

    const childrenHtml = children.length
      ? `<div class="chips">${children
          .map(
            (t) =>
              `<button type="button" class="chip" data-open="${t.id}">${escapeHtml(
                t.nameJa
              )}</button>`
          )
          .join("")}</div>`
      : "<p>（なし）</p>";

    const usage = term.usage
      ? `<div><dt>よくある使い方</dt><dd>${escapeHtml(term.usage)}</dd></div>`
      : "";
    const dialogue = term.dialogue
      ? `<div><dt>よくある会話例</dt><dd>${escapeHtml(term.dialogue)}</dd></div>`
      : "";

    return `
      <div class="detail-top">
        <h2>${escapeHtml(term.nameJa)}</h2>
        <button type="button" class="know-btn${known ? " is-on" : ""}" data-know="${term.id}" aria-pressed="${known ? "true" : "false"}" title="わかった印">
          ${known ? "★ わかった" : "☆ わかった"}
        </button>
      </div>
      <p class="reading">${escapeHtml(term.name)} ／ ${escapeHtml(term.reading || "")}</p>
      <p class="one">${escapeHtml(term.oneLiner)}</p>
      <dl class="meta">
        <div><dt>親カテゴリ</dt><dd>${escapeHtml(parentLabel(term.parentId))}</dd></div>
        <div><dt>子分類</dt><dd>${childrenHtml}</dd></div>
        <div><dt>メーカーでの実例</dt><dd>${escapeHtml(term.makerExample || "（未記入）")}</dd></div>
        ${usage}
        ${dialogue}
        <div><dt>関連用語</dt><dd>${relatedHtml}</dd></div>
        <div><dt>別名</dt><dd>${escapeHtml((term.aliases || []).join("、") || "（なし）")}</dd></div>
      </dl>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function termButtonsHtml(list) {
    if (!list.length) {
      return `<li class="empty">該当なし。別名やカタカナでも試せます。</li>`;
    }
    return list
      .map((t) => {
        const known = isKnown(t.id);
        return `<li class="term-row${known ? " is-known" : ""}">
        <button type="button" class="term-open" data-open="${t.id}">
          <span class="name">${escapeHtml(t.nameJa)}</span>
          <span class="sub">${escapeHtml(t.name)} — ${escapeHtml(t.oneLiner)}</span>
        </button>
        <button type="button" class="know-btn${known ? " is-on" : ""}" data-know="${t.id}" aria-pressed="${known ? "true" : "false"}" title="わかった印" aria-label="${escapeHtml(t.nameJa)}をわかったにする">
          ${known ? "★" : "☆"}
        </button>
      </li>`;
      })
      .join("");
  }

  function renderParents() {
    els.parents.innerHTML = PARENTS.map(
      (p) => `<button type="button" class="parent-card" data-kind="${p.kind}" data-filter="${p.id}">
        <strong>${escapeHtml(p.title)}</strong>
        <span>${escapeHtml(p.note)}</span>
      </button>`
    ).join("");
  }

  function renderHome() {
    const searching = Boolean(state.query.trim());
    els.home.classList.toggle("is-searching", searching);
    els.parents.hidden = searching;

    const hint = els.home.querySelector(".hint");
    if (searching) {
      els.home.insertBefore(els.listBlock, els.parents);
    } else if (hint && hint.nextElementSibling !== els.parents) {
      els.home.insertBefore(els.parents, els.listBlock);
    }

    const list = searching ? searchTerms(state.query) : allTermsSorted();
    const unknown = list.filter((t) => !isKnown(t.id)).length;
    els.listTitle.textContent = searching
      ? "検索結果（" + list.length + "）・未習得 " + unknown
      : "すべて（未習得が上・★は下）";
    els.list.innerHTML = termButtonsHtml(list);
    renderParents();
  }

  function renderParent() {
    const p = PARENTS.find((x) => x.id === state.filterParent);
    if (!p) {
      showHome();
      return;
    }
    els.parentHead.innerHTML = `
      <div class="parent-card is-static" data-kind="${p.kind}">
        <strong>${escapeHtml(p.title)}</strong>
        <span>${escapeHtml(p.note)}</span>
      </div>`;
    const list = termsForParent(p.id);
    els.parentListTitle.textContent =
      "この分類の用語（" + list.length + "・未習得が上）";
    els.parentList.innerHTML = termButtonsHtml(list);
  }

  function refreshCurrent() {
    if (state.screen === "detail") {
      const id = decodeURIComponent((location.hash || "#").slice(1));
      if (id && state.byId.has(id)) {
        els.detail.innerHTML = renderDetail(state.byId.get(id));
      }
      return;
    }
    if (state.screen === "parent" && state.filterParent) renderParent();
    else renderHome();
  }

  function applyHash() {
    const raw = decodeURIComponent((location.hash || "#").slice(1));
    if (raw.startsWith("cat/")) {
      const id = raw.slice(4);
      if (PARENTS.some((p) => p.id === id)) {
        showParent(id);
        return;
      }
    }
    if (raw && state.byId.has(raw)) {
      state.filterParent = null;
      showDetail(raw);
      return;
    }
    showHome();
  }

  function bind() {
    els.q.addEventListener("input", () => {
      state.query = els.q.value;
      if (state.query.trim()) {
        state.filterParent = null;
        setScreens("home");
        history.replaceState(null, "", location.pathname + location.search);
        renderHome();
      } else if (state.screen === "home") {
        renderHome();
      }
    });

    els.parents.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-filter]");
      if (!btn) return;
      showParent(btn.getAttribute("data-filter"));
    });

    document.body.addEventListener("click", (ev) => {
      const know = ev.target.closest("[data-know]");
      if (know) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleKnown(know.getAttribute("data-know"));
        refreshCurrent();
        return;
      }
      const open = ev.target.closest("[data-open]");
      if (!open) return;
      showDetail(open.getAttribute("data-open"));
    });

    els.parentBack.addEventListener("click", () => showHome());
    els.back.addEventListener("click", () => backFromDetail());

    window.addEventListener("hashchange", () => applyHash());
  }

  function registerPwa() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW register failed", err);
    });
    const hint = document.getElementById("install-hint");
    if (
      hint &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true)
    ) {
      hint.hidden = true;
    }
  }

  async function boot() {
    state.known = loadStore(STORAGE_KNOWN, {});
    state.searchCount = loadStore(STORAGE_SEARCH, {});
    const res = await fetch("terms.json?v=0.3");
    const data = await res.json();
    state.terms = data.terms || [];
    state.byId = new Map(state.terms.map((t) => [t.id, t]));
    bind();
    applyHash();
    registerPwa();
  }

  boot().catch((err) => {
    els.list.innerHTML = `<li class="empty">読み込みに失敗しました。ページを更新してください。</li>`;
    console.error(err);
  });
})();
