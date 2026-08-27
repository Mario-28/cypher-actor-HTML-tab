/* ================================================================
   Cypher Raw HTML Tab — v0.2.0
   Adds a GM-configurable raw HTML tab to Cypher System PC sheets.
   ================================================================ */
const MODULE_ID = "cypher-raw-html-tab";
const FLAG_SCOPE = MODULE_ID;
const FLAG_CONTENT = "content";
const FLAG_TAB_NAME = "tabName";
const DEFAULT_TAB_NAME = "Custom HTML";

/* Track which sheet instances have been initialized */
const _sheetInit = new WeakSet();

/* ================================================================
   INIT
   ================================================================ */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enableScripts", {
    name: "Execute embedded scripts",
    hint: "Dangerous. If enabled, <script> tags inside the raw HTML tab will be re-inserted and executed after render.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "tabName", {
    name: "Default tab name",
    hint: "Fallback label shown on Cypher actor sheets when the actor has no custom tab name.",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_TAB_NAME
  });

  game.settings.register(MODULE_ID, "onlyPC", {
    name: "Only add to PC sheets",
    hint: "If enabled, the custom tab only appears on PC actor sheets.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

/* ================================================================
   RENDER ACTOR SHEET
   ================================================================ */
Hooks.on("renderActorSheet", (app, html) => {
  if (game.system.id !== "cyphersystem") return;
  if (!app?.actor) return;

  const actor = app.actor;

  /* Only PC sheets (configurable) */
  if (game.settings.get(MODULE_ID, "onlyPC") && actor.type !== "pc") return;

  const root = html[0] ?? html;
  if (!root) return;

  const nav = root.querySelector("nav.sheet-tabs[data-group='primary'], .sheet-tabs[data-group='primary']");
  const body = root.querySelector(".sheet-body");
  if (!nav || !body) return;

  const isFirstRender = !_sheetInit.has(app);

  /* Build or update tab button and panel */
  const button = ensureCustomTabButton(nav, actor);
  const tab = ensureCustomTabPanel(body);
  renderTabContent(actor, tab);
  bindTabContextMenu(button, actor, app);

  /* Only force-activate on first render; respect user tab choice after */
  if (isFirstRender) {
    activateCustomTab(nav, body, app);
    _sheetInit.add(app);
  }
});

/* ================================================================
   TAB UI
   ================================================================ */
function ensureCustomTabButton(nav, actor) {
  let button = nav.querySelector(`[data-tab="${MODULE_ID}"]`);
  if (!button) {
    button = document.createElement("a");
    button.classList.add("item");
    button.dataset.tab = MODULE_ID;
    button.dataset.group = "primary";
    nav.prepend(button);
  }

  const label = getTabName(actor);
  if (button.textContent !== label) button.textContent = label;
  button.title = game.user.isGM ? "Right-click to configure this tab" : label;
  return button;
}

function ensureCustomTabPanel(body) {
  let tab = body.querySelector(`.tab[data-tab="${MODULE_ID}"]`);
  if (!tab) {
    tab = document.createElement("section");
    tab.classList.add("tab", MODULE_ID);
    tab.dataset.tab = MODULE_ID;
    tab.dataset.group = "primary";
    tab.innerHTML = `<div class="${MODULE_ID}__content"></div>`;
    body.prepend(tab);
  }
  return tab;
}

function renderTabContent(actor, tab) {
  const content = actor.getFlag(FLAG_SCOPE, FLAG_CONTENT) ?? "";
  const contentNode = tab.querySelector(`.${MODULE_ID}__content`);
  if (!contentNode) return;

  /* Only update if content changed to avoid DOM thrashing */
  if (contentNode.innerHTML !== content) {
    contentNode.innerHTML = content;
  }

  if (game.settings.get(MODULE_ID, "enableScripts")) executeScripts(contentNode);
}

function bindTabContextMenu(button, actor, sheetApp) {
  if (!button || button.dataset.contextBound === "true") return;
  button.dataset.contextBound = "true";

  const handler = (event) => {
    event.preventDefault();
    openEditor(actor, sheetApp);
  };

  button.addEventListener("contextmenu", handler);

  /* Clean up listener when sheet closes */
  const cleanup = () => button.removeEventListener("contextmenu", handler);
  Hooks.once("closeActorSheet", (closedApp) => {
    if (closedApp === sheetApp) cleanup();
  });
}

function activateCustomTab(nav, body, app) {
  nav.querySelectorAll(".item.active").forEach((el) => el.classList.remove("active"));
  body.querySelectorAll(".tab.active").forEach((el) => el.classList.remove("active"));

  const button = nav.querySelector(`[data-tab="${MODULE_ID}"]`);
  const panel = body.querySelector(`.tab[data-tab="${MODULE_ID}"]`);
  if (button) button.classList.add("active");
  if (panel) panel.classList.add("active");

  if (app._tabs?.length) {
    const el = app.element?.[0] ?? app.element;
    for (const tabs of app._tabs) {
      tabs.active = MODULE_ID;
      if (el) tabs.bind(el);
    }
  }
}

/* ================================================================
   SCRIPT EXECUTION
   ================================================================ */
function executeScripts(container) {
  for (const oldScript of container.querySelectorAll("script")) {
    const script = document.createElement("script");
    for (const { name, value } of oldScript.attributes) script.setAttribute(name, value);
    script.textContent = oldScript.textContent;
    oldScript.replaceWith(script);
  }
}

/* ================================================================
   HELPERS
   ================================================================ */
function getTabName(actor) {
  return actor.getFlag(FLAG_SCOPE, FLAG_TAB_NAME) || game.settings.get(MODULE_ID, "tabName") || DEFAULT_TAB_NAME;
}

/* ================================================================
   EDITOR DIALOG
   ================================================================ */
function openEditor(actor, sheetApp) {
  const existing = actor.getFlag(FLAG_SCOPE, FLAG_CONTENT) ?? "";
  const currentTabName = getTabName(actor);

  const uploadBlock = game.user.isGM
    ? `
      <div class="form-group stacked ${MODULE_ID}__upload-group">
        <label>Upload HTML file</label>
        <input type="file" name="htmlUpload" accept=".html,.htm,text/html" />
        <p class="notes">Only GMs can upload an HTML file. Its contents replace the code field when selected.</p>
      </div>
    `
    : "";

  new Dialog({
    title: `Custom HTML Tab: ${actor.name}`,
    content: `
      <form class="${MODULE_ID}__dialog">
        <div class="form-group stacked">
          <label>Tab name</label>
          <input type="text" name="tabName" value="${foundry.utils.escapeHTML(currentTabName)}" />
        </div>
        <div class="form-group stacked">
          <label>HTML / CSS / optional JS</label>
          <textarea name="rawHtml" rows="24" style="width:100%; font-family:monospace;">${foundry.utils.escapeHTML(existing)}</textarea>
        </div>
        ${uploadBlock}
        <p class="notes">This bypasses ProseMirror. Script execution only happens if the world setting is enabled.</p>
      </form>
    `,
    buttons: {
      save: {
        icon: '<i class="fas fa-save"></i>',
        label: "Save",
        callback: async (dlgHtml) => {
          const root = dlgHtml[0] ?? dlgHtml;
          const tabName = root.querySelector("input[name='tabName']")?.value?.trim() || DEFAULT_TAB_NAME;
          const value = root.querySelector("textarea[name='rawHtml']")?.value ?? "";
          await actor.setFlag(FLAG_SCOPE, FLAG_TAB_NAME, String(tabName));
          await actor.setFlag(FLAG_SCOPE, FLAG_CONTENT, String(value));
          sheetApp.render(false);
        }
      },
      clear: {
        icon: '<i class="fas fa-trash"></i>',
        label: "Clear HTML",
        callback: async (dlgHtml) => {
          const root = dlgHtml[0] ?? dlgHtml;
          const tabName = root.querySelector("input[name='tabName']")?.value?.trim() || DEFAULT_TAB_NAME;
          await actor.setFlag(FLAG_SCOPE, FLAG_TAB_NAME, String(tabName));
          await actor.unsetFlag(FLAG_SCOPE, FLAG_CONTENT);
          sheetApp.render(false);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "save",
    render: (dlgHtml) => bindUploadInput(dlgHtml)
  }).render(true);
}

function bindUploadInput(dlgHtml) {
  if (!game.user.isGM) return;
  const root = dlgHtml[0] ?? dlgHtml;
  const fileInput = root.querySelector("input[name='htmlUpload']");
  const textarea = root.querySelector("textarea[name='rawHtml']");
  if (!fileInput || !textarea || fileInput.dataset.bound) return;

  fileInput.dataset.bound = "true";
  fileInput.addEventListener("change", async (event) => {
    const file = event.currentTarget?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      textarea.value = text;
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to read uploaded HTML file`, error);
      ui.notifications?.error("Failed to read the uploaded HTML file.");
    }
  });
}
