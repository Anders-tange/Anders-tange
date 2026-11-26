// The standalone build: installable web app (PWA) today, wrapped by Capacitor for the App Store later.
import { start } from "./app.js";
import { createLocalPlatform } from "./platform/local.js";
import { createAi, aiSettings, MODELS } from "./platform/ai.js";

const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
let installEvent = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvent = e; });

const hooks = {
  memoryNotice: "Denne browser lader ikke Dyredex gemme noget, så dyr huskes kun, indtil du lukker siden. Prøv uden privat browsing.",
  settingsHtml() {
    const has = aiSettings.hasKey(), model = aiSettings.model();
    const install = standalone() ? "" : `<div class="panel"><h3>Læg Dyredex på hjemmeskærmen</h3>
      ${installEvent ? `<p>Så åbner den som en app og virker også uden net.</p><div class="row-flex"><button class="btn sm" data-tact="setting" data-what="install">Installér app</button></div>`
        : ios ? `<p>Tryk på <b>Del</b>-knappen i Safari og vælg <b>Føj til hjemmeskærm</b>. Så åbner Dyredex som en app og virker også uden net.</p>`
        : `<p>Åbn browserens menu og vælg <b>Installér app</b> eller <b>Føj til startskærm</b>. Så åbner Dyredex som en app og virker også uden net.</p>`}</div>`;
    return `${install}<div class="panel"><h3>AI-genkendelse</h3>
      <p class="note">${has ? `Slået til med ${esc(MODELS.find(m => m.id === model)?.label)}.` : "Slået fra. Uden AI skriver du selv navnet på dyret."}</p>
      <p>Appen bruger din egen nøgle til Claude fra Anthropic. Opret en på <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>, og sæt gerne et forbrugsloft på kontoen. Hver scanning trækker lidt fra din kredit der.</p>
      <div class="row-flex"><input type="password" id="apikey" autocomplete="off" spellcheck="false" placeholder="${has ? "Ny nøgle (sk-ant-…)" : "sk-ant-…"}" style="flex:1 1 200px;min-width:0" aria-label="API-nøgle fra Anthropic">
        <button class="btn sm" data-tact="setting" data-what="savekey">Gem nøgle</button>
        ${has ? `<button class="btn ink sm" data-tact="setting" data-what="clearkey">Fjern</button>` : ""}</div>
      <label class="stack">Model <select data-setting="model">${MODELS.map(m => `<option value="${m.id}"${m.id === model ? " selected" : ""}>${esc(m.label)}: ${esc(m.note)}</option>`).join("")}</select></label>
      <p class="small">Nøglen gemmes kun på denne enhed og sendes kun til Anthropic. Del ikke appen med en nøgle i, og brug en ny nøgle, hvis telefonen bliver væk.</p></div>`;
  },
  async onSetting(what, root, { toast, render, value }) {
    if (what === "savekey") {
      const v = root.querySelector("#apikey")?.value.trim() || "";
      if (!/^sk-ant-/.test(v)) { toast("Det ligner ikke en nøgle fra Anthropic. Den starter med sk-ant-."); return; }
      aiSettings.setKey(v); location.reload();
    } else if (what === "clearkey") { aiSettings.setKey(""); location.reload(); }
    else if (what === "model") { aiSettings.setModel(value); toast("Modellen er skiftet."); render(); }
    else if (what === "install" && installEvent) { installEvent.prompt(); await installEvent.userChoice.catch(() => null); installEvent = null; render(); }
  },
};

createLocalPlatform({ ai: createAi() }).then(P => start(P, hooks), () => start(null, hooks));

if ("serviceWorker" in navigator && isSecureContext) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
