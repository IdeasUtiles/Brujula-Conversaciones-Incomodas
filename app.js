// Brújula – 100% local. No backend.
// Data model: { settings, draft, sessions[] }
const STORAGE_KEY = "brujula_v1";

const DEFAULT_TOPICS = [
  { id:"sexo", name:"Intimidad y sexualidad" },
  { id:"tiempo", name:"Tiempo de pareja vs tiempo familiar" },
  { id:"crianza", name:"Crianza, valores y educación del hijo" },
  { id:"dinero", name:"Dinero y transparencia" },
  { id:"familia", name:"Familias extensas y límites" },
  { id:"reputacion", name:"Exposición pública y reputación" },
  { id:"proyectos", name:"Proyectos profesionales y apoyo" },
  { id:"confianza", name:"Confianza y herida del pasado" },
  { id:"salud", name:"Salud emocional, estrés y alcohol ocasional" },
];

function nowISO(){
  return new Date().toISOString();
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function safeParse(jsonStr, fallback){
  try { return JSON.parse(jsonStr); } catch { return fallback; }
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  const state = safeParse(raw, null);
  if(state && typeof state === "object") return state;
  return {
    settings: { saveEnabled: true },
    draft: null,
    sessions: []
  };
}
function saveState(state){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// Elements
const saveEnabledEl = document.getElementById("saveEnabled");
const btnNew = document.getElementById("btnNew");
const btnClearAll = document.getElementById("btnClearAll");
const btnExport = document.getElementById("btnExport");
const btnPrivacy = document.getElementById("btnPrivacy");
const privacyDialog = document.getElementById("privacyDialog");
const btnClosePrivacy = document.getElementById("btnClosePrivacy");

const workspace = document.getElementById("workspace");
const form = document.getElementById("form");
const draftMeta = document.getElementById("draftMeta");
const draftStatus = document.getElementById("draftStatus");
const btnOpenDraft = document.getElementById("btnOpenDraft");
const btnDiscardDraft = document.getElementById("btnDiscardDraft");

const sessionsMeta = document.getElementById("sessionsMeta");
const sessionsList = document.getElementById("sessionsList");
const btnCompare = document.getElementById("btnCompare");

const compareCard = document.getElementById("compareCard");
const compareOutput = document.getElementById("compareOutput");
const btnCloseCompare = document.getElementById("btnCloseCompare");

const autosaveStatus = document.getElementById("autosaveStatus");
const btnSaveDraft = document.getElementById("btnSaveDraft");
const btnFinish = document.getElementById("btnFinish");

const topicsContainer = document.getElementById("topics");
const topicTemplate = document.getElementById("topicTemplate");

function setAutosave(text){ autosaveStatus.textContent = "Autosave: " + text; }

function ensureTopicsInDraft(draft){
  if(!draft.topics) draft.topics = {};
  for(const t of DEFAULT_TOPICS){
    if(!draft.topics[t.id]){
      draft.topics[t.id] = { score: 0, need:"", offer:"", proposal:"", limit:"", therapy:"" };
    }
  }
}

function createEmptyDraft(){
  const d = {
    id: uid(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    fields: {},
    topics: {}
  };
  ensureTopicsInDraft(d);
  return d;
}

function getFormData(){
  const fd = new FormData(form);
  const fields = {};
  for(const [k,v] of fd.entries()){
    fields[k] = String(v ?? "");
  }
  // include ranges that may not be in FormData? (they are)
  return fields;
}

function setFormData(draft){
  // Basic fields
  const fields = draft.fields || {};
  for(const [name, value] of Object.entries(fields)){
    const el = form.elements.namedItem(name);
    if(!el) continue;
    el.value = value;
  }
  // Ranges update display
  refreshRangeValues();
  // Topics UI values
  for(const t of DEFAULT_TOPICS){
    const data = draft.topics?.[t.id];
    if(!data) continue;
    const root = document.querySelector(`[data-topic="${t.id}"]`);
    if(!root) continue;
    root.querySelector(".topicRange").value = data.score ?? 0;
    root.querySelector(".topicRangeValue").textContent = (data.score ?? 0) + "/10";
    root.querySelector(".topicScore").textContent = data.score ?? 0;
    root.querySelector(".topicNeed").value = data.need ?? "";
    root.querySelector(".topicOffer").value = data.offer ?? "";
    root.querySelector(".topicProposal").value = data.proposal ?? "";
    root.querySelector(".topicLimit").value = data.limit ?? "";
    root.querySelector(".topicTherapy").value = data.therapy ?? "";
  }
}

function buildTopicsUI(){
  topicsContainer.innerHTML = "";
  for(const t of DEFAULT_TOPICS){
    const node = topicTemplate.content.cloneNode(true);
    const details = node.querySelector("details");
    details.dataset.topic = t.id;
    node.querySelector(".topic-name").textContent = t.name;
    node.querySelector(".topic-score").textContent = "0";
    const range = node.querySelector(".topicRange");
    const rv = node.querySelector(".topicRangeValue");
    const score = node.querySelector(".topic-score");
    range.addEventListener("input", () => {
      rv.textContent = range.value + "/10";
      score.textContent = range.value;
      if(state.draft){
        state.draft.topics[t.id].score = Number(range.value);
        touchDraft();
      }
    });
    // Textareas
    const bind = (cls, key) => {
      const el = node.querySelector(cls);
      el.addEventListener("input", () => {
        if(state.draft){
          state.draft.topics[t.id][key] = el.value;
          touchDraft();
        }
      });
    };
    bind(".topicNeed", "need");
    bind(".topicOffer", "offer");
    bind(".topicProposal", "proposal");
    bind(".topicLimit", "limit");
    bind(".topicTherapy", "therapy");

    topicsContainer.appendChild(node);
  }
}

function touchDraft(){
  if(!state.draft) return;
  state.draft.updatedAt = nowISO();
  // Persist if enabled
  if(state.settings.saveEnabled){
    saveState(state);
    setAutosave("guardado " + fmtDate(state.draft.updatedAt));
  }else{
    setAutosave("guardado desactivado");
  }
  renderSidebar();
}

function renderSidebar(){
  // Settings
  saveEnabledEl.checked = !!state.settings.saveEnabled;

  // Draft
  if(state.draft){
    draftMeta.textContent = "Última edición: " + fmtDate(state.draft.updatedAt);
    draftStatus.textContent = "Borrador listo. Puedes seguir donde lo dejaste.";
    btnOpenDraft.disabled = false;
    btnDiscardDraft.disabled = false;
  }else{
    draftMeta.textContent = "—";
    draftStatus.textContent = "No hay borrador aún.";
    btnOpenDraft.disabled = true;
    btnDiscardDraft.disabled = true;
  }

  // Sessions
  sessionsMeta.textContent = state.sessions.length ? (state.sessions.length + " sesiones guardadas") : "Aún no hay sesiones guardadas.";
  sessionsList.innerHTML = "";
  const selected = new Set(getSelectedSessionIds());
  for(const s of [...state.sessions].sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""))){
    const div = document.createElement("div");
    div.className = "item";
    const left = document.createElement("div");
    left.className = "meta";
    const title = document.createElement("b");
    title.textContent = "Sesión " + fmtDate(s.createdAt);
    const sub = document.createElement("span");
    sub.textContent = "Ruta: " + (labelRoute(s.fields?.m5_route) || "—");
    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(s.id);
    cb.addEventListener("change", () => toggleSessionSelection(s.id, cb.checked));
    right.appendChild(cb);

    div.appendChild(left);
    div.appendChild(right);
    sessionsList.appendChild(div);
  }

  btnCompare.disabled = getSelectedSessionIds().length !== 2;
}

function labelRoute(v){
  if(v==="separacion") return "Separación";
  if(v==="pausa") return "Pausa estructurada";
  if(v==="reintento") return "Reintento condicionado";
  if(v==="no_se") return "No lo sé todavía";
  return "";
}

// Session selection for compare
const SEL_KEY = "brujula_v1_selected_sessions";
function getSelectedSessionIds(){
  return safeParse(localStorage.getItem(SEL_KEY), []);
}
function setSelectedSessionIds(ids){
  localStorage.setItem(SEL_KEY, JSON.stringify(ids));
}
function toggleSessionSelection(id, checked){
  let ids = getSelectedSessionIds();
  if(checked){
    if(!ids.includes(id)) ids.push(id);
  }else{
    ids = ids.filter(x => x !== id);
  }
  // keep max 2
  if(ids.length > 2) ids = ids.slice(ids.length - 2);
  setSelectedSessionIds(ids);
  renderSidebar();
}

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const key = btn.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach(p=>p.hidden = true);
    document.getElementById("tab-" + key).hidden = false;
  });
});

function refreshRangeValues(){
  document.querySelectorAll('input[type="range"][name]').forEach(r => {
    const out = document.querySelector(`.range-value[data-for="${r.name}"]`);
    if(out) out.textContent = r.value + "/10";
    r.addEventListener("input", () => {
      if(out) out.textContent = r.value + "/10";
      if(state.draft){
        state.draft.fields[r.name] = r.value;
        touchDraft();
      }
    });
  });
}

// Bind inputs autosave
form.addEventListener("input", (e) => {
  const target = e.target;
  if(!state.draft) return;
  if(target.name){
    state.draft.fields[target.name] = target.value;
    touchDraft();
  }
});

btnSaveDraft.addEventListener("click", () => {
  if(!state.draft) return;
  state.draft.fields = getFormData();
  touchDraft();
  alert("Borrador guardado.");
});

btnFinish.addEventListener("click", () => {
  if(!state.draft) return;
  // snapshot
  const session = {
    id: uid(),
    createdAt: nowISO(),
    fields: getFormData(),
    topics: structuredClone(state.draft.topics || {})
  };
  state.sessions.push(session);
  // keep draft as continuing draft (optional) but update it
  state.draft.fields = session.fields;
  state.draft.updatedAt = nowISO();
  if(state.settings.saveEnabled) saveState(state);
  renderSidebar();
  alert("Sesión guardada en el historial.");
});

// Start / continue
btnNew.addEventListener("click", () => {
  // If draft exists, open it. Else create.
  if(!state.draft) state.draft = createEmptyDraft();
  openDraft();
});

btnOpenDraft.addEventListener("click", openDraft);

function openDraft(){
  if(!state.draft) return;
  ensureTopicsInDraft(state.draft);
  workspace.hidden = false;
  compareCard.hidden = true;
  buildTopicsUI();
  setFormData(state.draft);
  refreshRangeValues();
  setAutosave(state.settings.saveEnabled ? ("guardado " + fmtDate(state.draft.updatedAt)) : "guardado desactivado");
  // jump to M1
  document.querySelector('.tab[data-tab="m1"]').click();
}

btnDiscardDraft.addEventListener("click", () => {
  if(!confirm("¿Descartar el borrador actual? (No borra el historial)")) return;
  state.draft = null;
  if(state.settings.saveEnabled) saveState(state);
  workspace.hidden = true;
  renderSidebar();
});

// Settings
saveEnabledEl.addEventListener("change", () => {
  state.settings.saveEnabled = !!saveEnabledEl.checked;
  saveState(state); // always save settings
  setAutosave(state.settings.saveEnabled ? "activado" : "desactivado");
});

btnClearAll.addEventListener("click", () => {
  if(!confirm("Esto borrará borrador e historial de este dispositivo. ¿Continuar?")) return;
  state = { settings: { saveEnabled: saveEnabledEl.checked }, draft: null, sessions: [] };
  saveState(state);
  localStorage.removeItem(SEL_KEY);
  workspace.hidden = true;
  compareCard.hidden = true;
  renderSidebar();
  alert("Listo. Todo borrado.");
});

// Compare
btnCompare.addEventListener("click", () => {
  const ids = getSelectedSessionIds();
  if(ids.length !== 2) return;
  const a = state.sessions.find(s => s.id === ids[0]);
  const b = state.sessions.find(s => s.id === ids[1]);
  if(!a || !b) return;

  compareCard.hidden = false;
  workspace.hidden = true;
  compareOutput.innerHTML = "";

  const head = document.createElement("div");
  head.className = "muted";
  head.textContent = `Comparando: ${fmtDate(a.createdAt)} vs ${fmtDate(b.createdAt)}`;
  compareOutput.appendChild(head);

  // Compare a few numeric radar fields
  const radars = [
    ["m1_desire","Deseo de seguir"],
    ["m1_hope","Confianza en que mejore"],
    ["m1_fatigue","Cansancio emocional"],
    ["m1_activation","Activación"],
  ];
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.marginTop = "10px";
  table.innerHTML = "<tr><th style='text-align:left'>Campo</th><th style='text-align:left'>A</th><th style='text-align:left'>B</th></tr>";
  for(const [k,label] of radars){
    const va = a.fields?.[k] ?? "—";
    const vb = b.fields?.[k] ?? "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td>${va}</td><td>${vb}</td>`;
    table.appendChild(tr);
  }
  compareOutput.appendChild(table);

  // Compare route
  const route = document.createElement("div");
  route.style.marginTop = "10px";
  route.innerHTML = `<b>Ruta</b>: A = ${labelRoute(a.fields?.m5_route) || "—"} | B = ${labelRoute(b.fields?.m5_route) || "—"}`;
  compareOutput.appendChild(route);

  // Compare topic scores (diff)
  const diffWrap = document.createElement("div");
  diffWrap.style.marginTop = "12px";
  diffWrap.innerHTML = "<h3 style='margin:8px 0'>Temas (diferencia de gravedad)</h3>";
  const ul = document.createElement("ul");
  for(const t of DEFAULT_TOPICS){
    const sa = a.topics?.[t.id]?.score ?? 0;
    const sb = b.topics?.[t.id]?.score ?? 0;
    const li = document.createElement("li");
    const delta = sb - sa;
    const sign = delta>0 ? "+" : "";
    li.textContent = `${t.name}: ${sa} → ${sb} (${sign}${delta})`;
    ul.appendChild(li);
  }
  diffWrap.appendChild(ul);
  compareOutput.appendChild(diffWrap);
});

btnCloseCompare.addEventListener("click", () => {
  compareCard.hidden = true;
  workspace.hidden = false;
});

// Export report: open print view. We will create a temporary report in a new window.
btnExport.addEventListener("click", () => {
  // Prefer latest: draft if open, else latest session
  let snapshot = null;
  if(state.draft){
    snapshot = {
      createdAt: state.draft.updatedAt || state.draft.createdAt,
      fields: getFormData(),
      topics: structuredClone(state.draft.topics || {})
    };
  }else if(state.sessions.length){
    snapshot = [...state.sessions].sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""))[0];
  }else{
    alert("No hay datos para exportar todavía. Empieza un borrador o guarda una sesión.");
    return;
  }
  const html = buildReportHTML(snapshot);
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Some browsers require manual print click, but usually works.
  setTimeout(()=> w.print(), 300);
});

function esc(s){
  return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function lineBreaks(s){
  return esc(s).replaceAll("\n","<br/>");
}
function buildReportHTML(snap){
  const f = snap.fields || {};
  const topics = snap.topics || {};
  const dateStr = fmtDate(snap.createdAt || nowISO());
  const route = labelRoute(f.m5_route) || "—";

  const topicRows = DEFAULT_TOPICS.map(t=>{
    const d = topics[t.id] || {};
    return `
      <tr>
        <td><b>${esc(t.name)}</b><div class="small">Gravedad: ${esc(d.score ?? 0)}/10</div></td>
        <td>${lineBreaks(d.need)}</td>
        <td>${lineBreaks(d.offer)}</td>
        <td>${lineBreaks(d.proposal)}</td>
        <td>${lineBreaks(d.limit)}</td>
        <td>${lineBreaks(d.therapy)}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
  <html lang="es"><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Informe Brújula</title>
    <style>
      body{font-family:Arial, sans-serif; padding:24px; color:#111}
      h1{margin:0}
      .muted{color:#555}
      .box{border:1px solid #ddd; border-radius:12px; padding:12px; margin-top:12px}
      .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
      .small{font-size:12px; color:#444}
      table{width:100%; border-collapse:collapse; margin-top:12px}
      th,td{border:1px solid #ddd; padding:8px; vertical-align:top; font-size:12px}
      th{background:#f5f5f5}
      @media print{ body{padding:0} .noprint{display:none} }
    </style>
  </head><body>
    <div class="noprint" style="margin-bottom:10px" >
      <button onclick="window.print()">Imprimir / Guardar como PDF</button>
    </div>

    <h1>Informe Brújula</h1>
    <div class="muted">Fecha: ${esc(dateStr)} · Ruta: ${esc(route)}</div>

    <div class="box">
      <h2 style="margin:0 0 8px 0">M1. Radar</h2>
      <div class="grid">
        <div><b>Deseo de seguir</b>: ${esc(f.m1_desire)}/10</div>
        <div><b>Confianza en que mejore</b>: ${esc(f.m1_hope)}/10</div>
        <div><b>Cansancio emocional</b>: ${esc(f.m1_fatigue)}/10</div>
        <div><b>Activación</b>: ${esc(f.m1_activation)}/10</div>
      </div>
      <div style="margin-top:8px"><b>Miedo principal</b>: ${esc(f.m1_main_fear)}</div>
      <div style="margin-top:8px"><b>Necesito que pase</b>:<br/>${lineBreaks(f.m1_need_phrase)}</div>
      <div style="margin-top:8px"><b>Estoy dispuesto/a a hacer</b>:<br/>${lineBreaks(f.m1_offer_phrase)}</div>
    </div>

    <div class="box">
      <h2 style="margin:0 0 8px 0">M2. Ciclo</h2>
      <div><b>Ciclo</b>:<br/>${lineBreaks(f.m2_cycle)}</div>
      <div style="margin-top:8px"><b>Mi intento de solución que empeora</b>:<br/>${lineBreaks(f.m2_my_wrong_solution)}</div>
      <div style="margin-top:8px"><b>Mi movimiento distinto (pequeño)</b>:<br/>${lineBreaks(f.m2_my_small_move)}</div>
    </div>

    <div class="box">
      <h2 style="margin:0 0 8px 0">M3. Lo que sí</h2>
      <div class="grid">
        <div><b>Agradecimientos</b><br/>${lineBreaks(f.m3_gratitude)}</div>
        <div><b>Aprendizajes</b><br/>${lineBreaks(f.m3_learning)}</div>
      </div>
      <div style="margin-top:8px"><b>Cualidad reconocida</b>:<br/>${lineBreaks(f.m3_quality)}</div>
    </div>

    <div class="box">
      <h2 style="margin:0 0 8px 0">M4. Temas ineludibles</h2>
      <table>
        <tr>
          <th>Tema</th><th>Necesito</th><th>Ofrezco</th><th>Propongo</th><th>Límite</th><th>Para terapia</th>
        </tr>
        ${topicRows}
      </table>
    </div>

    <div class="box">
      <h2 style="margin:0 0 8px 0">M5. Ruta y compromisos</h2>
      <div><b>Ruta</b>: ${esc(route)}</div>
      <div style="margin-top:8px" class="grid">
        <div><b>Pediría al otro</b><br/>${lineBreaks(f.m5_ask)}</div>
        <div><b>Ofrezco yo</b><br/>${lineBreaks(f.m5_give)}</div>
      </div>
      <div style="margin-top:8px"><b>Calendario sugerido</b><br/>${lineBreaks(f.m5_calendar)}</div>
      <div style="margin-top:8px"><b>Si no se cumple…</b><br/>${lineBreaks(f.m5_if_not)}</div>
    </div>

    <div class="box">
      <h2 style="margin:0 0 8px 0">M6. Guion</h2>
      <div><b>Frase de pausa</b>:<br/>${lineBreaks(f.m6_pause)}</div>
    </div>

  </body></html>`;
}

// Privacy modal
btnPrivacy.addEventListener("click", () => privacyDialog.showModal());
btnClosePrivacy.addEventListener("click", () => privacyDialog.close());

// Init default UI
renderSidebar();
