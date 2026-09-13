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

  const state = {
    terms: [],
    byId: new Map(),
    filterParent: null,
    query: ""
  };

  const els = {
    q: document.getElementById("q"),
    home: document.getElementById("home-view"),
    detailView: document.getElementById("detail-view"),
    detail: document.getElementById("detail"),
    list: document.getElementById("term-list"),
    listBlock: document.getElementById("list-block"),
    parents: document.getElementById("parent-grid"),
    back: document.getElementById("back-btn"),
    listTitle: document.querySelector(".list-title")
  };

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

  function filteredTerms() {
    let list = state.terms.slice();
    if (state.filterParent) {
      list = list.filter(
        (t) => t.id === state.filterParent || t.parentId === state.filterParent
      );
    }
    const q = normalize(state.query);
    if (q) {
      list = list.filter((t) => haystack(t).includes(q));
    }
    return list.sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));
  }

  function showHome() {
    els.home.hidden = false;
    els.detailView.hidden = true;
    history.replaceState(null, "", "#");
  }

  function showDetail(id) {
    const term = state.byId.get(id);
    if (!term) return;
    els.home.hidden = true;
    els.detailView.hidden = false;
    els.detail.innerHTML = renderDetail(term);
    history.replaceState(null, "", "#" + encodeURIComponent(id));
    window.scrollTo(0, 0);
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
      <h2>${escapeHtml(term.nameJa)}</h2>
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

  function renderParents() {
    els.parents.innerHTML = PARENTS.map((p) => {
      const active = state.filterParent === p.id ? " is-active" : "";
      return `<button type="button" class="parent-card${active}" data-kind="${p.kind}" data-filter="${p.id}">
        <strong>${escapeHtml(p.title)}</strong>
        <span>${escapeHtml(p.note)}</span>
      </button>`;
    }).join("");
  }

  function renderList() {
    const list = filteredTerms();
    const searching = Boolean(state.query.trim());
    els.home.classList.toggle("is-searching", searching);

    // 検索中は結果をヒント直下（親カードより上）へ。通常は親カードの下。
    const hint = els.home.querySelector(".hint");
    if (searching) {
      els.home.insertBefore(els.listBlock, els.parents);
    } else if (hint && hint.nextElementSibling !== els.parents) {
      els.home.insertBefore(els.parents, els.listBlock);
    }

    if (state.filterParent && !searching) {
      const p = PARENTS.find((x) => x.id === state.filterParent);
      els.listTitle.textContent = p ? p.title + " の用語" : "一覧";
    } else if (searching) {
      els.listTitle.textContent = "検索結果（" + list.length + "）";
    } else {
      els.listTitle.textContent = "すべて";
    }

    if (!list.length) {
      els.list.innerHTML = `<li class="empty">該当なし。別名やカタカナでも試せます。</li>`;
      return;
    }

    els.list.innerHTML = list
      .map(
        (t) => `<li>
        <button type="button" data-open="${t.id}">
          <span class="name">${escapeHtml(t.nameJa)}</span>
          <span class="sub">${escapeHtml(t.name)} — ${escapeHtml(t.oneLiner)}</span>
        </button>
      </li>`
      )
      .join("");
  }

  function render() {
    renderParents();
    renderList();
  }

  function bind() {
    els.q.addEventListener("input", () => {
      state.query = els.q.value;
      if (!els.home.hidden) renderList();
      else {
        showHome();
        render();
      }
    });

    els.parents.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-filter]");
      if (!btn) return;
      const id = btn.getAttribute("data-filter");
      state.filterParent = state.filterParent === id ? null : id;
      state.query = "";
      els.q.value = "";
      showHome();
      render();
    });

    document.body.addEventListener("click", (ev) => {
      const open = ev.target.closest("[data-open]");
      if (!open) return;
      showDetail(open.getAttribute("data-open"));
    });

    els.back.addEventListener("click", () => {
      showHome();
      render();
    });

    window.addEventListener("hashchange", () => {
      const id = decodeURIComponent((location.hash || "#").slice(1));
      if (id && state.byId.has(id)) showDetail(id);
      else {
        showHome();
        render();
      }
    });
  }

  async function boot() {
    const res = await fetch("terms.json?v=0.1");
    const data = await res.json();
    state.terms = data.terms || [];
    state.byId = new Map(state.terms.map((t) => [t.id, t]));
    bind();
    const id = decodeURIComponent((location.hash || "#").slice(1));
    render();
    if (id && state.byId.has(id)) showDetail(id);
  }

  boot().catch((err) => {
    els.list.innerHTML = `<li class="empty">読み込みに失敗しました。ローカルサーバー経由で開いてください。</li>`;
    console.error(err);
  });
})();
