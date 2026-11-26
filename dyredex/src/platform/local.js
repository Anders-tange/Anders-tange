// The standalone platform: the same small API the Claude runtime offers (db, assets, user, tts),
// kept on the device in IndexedDB. The app code does not know which one it is talking to.

const DB_NAME = "dyredex";
const DB_VERSION = 1;

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "path" });
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "k" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const done = tx => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
const all = (idb, store) => new Promise((resolve, reject) => {
  const req = idb.transaction(store).objectStore(store).getAll();
  req.onsuccess = () => resolve(req.result || []);
  req.onerror = () => reject(req.error);
});
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function merge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v);
  return out;
}
const splitPath = path => { const i = path.lastIndexOf("/"); return [path.slice(0, i), path.slice(i + 1)]; };

export async function createLocalPlatform({ ai = null } = {}) {
  const idb = await openIdb();
  // Every document lives in memory too, so snapshots are synchronous and cheap; writes go through to IndexedDB.
  const cols = new Map(); // collection path -> Map(id -> data)
  for (const row of await all(idb, "docs")) {
    const [col, id] = splitPath(row.path);
    if (!cols.has(col)) cols.set(col, new Map());
    cols.get(col).set(id, row.data);
  }
  const urls = new Map();
  for (const row of await all(idb, "blobs")) urls.set(row.id, URL.createObjectURL(row.blob));
  const kv = new Map((await all(idb, "kv")).map(r => [r.k, r.v]));

  const listeners = new Map(); // collection path -> Set(fn)
  const colMap = path => { if (!cols.has(path)) cols.set(path, new Map()); return cols.get(path); };
  const notify = path => {
    const set = listeners.get(path);
    if (set) for (const fn of [...set]) queueMicrotask(fn);
  };
  async function write(path, data) {
    const [col, id] = splitPath(path);
    if (data === null) colMap(col).delete(id); else colMap(col).set(id, data);
    notify(col);
    const tx = idb.transaction("docs", "readwrite");
    if (data === null) tx.objectStore("docs").delete(path); else tx.objectStore("docs").put({ path, data });
    await done(tx);
  }
  const snapDoc = (id, data) => ({ id, exists: data !== undefined, data: () => clone(data) });

  function query(path, order) {
    const snapshot = () => {
      let docs = [...colMap(path).entries()].map(([id, data]) => snapDoc(id, data));
      if (order) {
        const [f, dir] = order, s = dir === "desc" ? -1 : 1;
        docs.sort((a, b) => { const x = a.data()[f], y = b.data()[f]; return x === y ? (a.id < b.id ? -1 : 1) : (x === undefined ? 1 : y === undefined ? -1 : (x < y ? -s : s)); });
      } else docs.sort((a, b) => (a.id < b.id ? -1 : 1));
      return { docs, empty: !docs.length, size: docs.length };
    };
    return {
      orderBy: (field, dir = "asc") => query(path, [field, dir]),
      get: async () => snapshot(),
      onSnapshot(cb) {
        const fn = () => cb(snapshot());
        if (!listeners.has(path)) listeners.set(path, new Set());
        listeners.get(path).add(fn);
        queueMicrotask(fn);
        return () => listeners.get(path)?.delete(fn);
      },
    };
  }

  const db = {
    collection(path) {
      return {
        ...query(path),
        async add(data) { const id = newId(); await write(`${path}/${id}`, clone(data)); return { id }; },
        doc(id) {
          const full = `${path}/${id}`;
          return {
            id,
            get: async () => snapDoc(id, colMap(path).get(id)),
            set: data => write(full, clone(data)),
            update: data => write(full, merge(colMap(path).get(id) || {}, data)),
            delete: () => write(full, null),
          };
        },
      };
    },
    // Everything, for backup.
    dump() { return [...cols.entries()].flatMap(([col, m]) => [...m.entries()].map(([id, data]) => ({ path: `${col}/${id}`, data: clone(data) }))); },
  };

  const assets = {
    async upload(blob, opts = {}) {
      const id = newId();
      const b = opts.type && blob.type !== opts.type ? new Blob([blob], { type: opts.type }) : blob;
      const tx = idb.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ id, blob: b });
      await done(tx);
      urls.set(id, URL.createObjectURL(b));
      return { id };
    },
    async delete(id) {
      const tx = idb.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(id);
      await done(tx);
      const u = urls.get(id); if (u) URL.revokeObjectURL(u);
      urls.delete(id);
    },
  };

  // One trainer per device. The id is made once and kept with the data.
  let me = kv.get("me");
  if (!me) {
    me = "local-" + newId();
    kv.set("me", me);
    const tx = idb.transaction("kv", "readwrite"); tx.objectStore("kv").put({ k: "me", v: me }); await done(tx);
  }
  const user = {
    id: async () => me,
    isOwner: async () => true,
    profiles: async () => [],
  };

  const tts = typeof speechSynthesis !== "undefined" ? {
    speak(text) {
      return new Promise(resolve => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text || ""));
        u.lang = "da-DK";
        const v = speechSynthesis.getVoices().find(v => /^da/i.test(v.lang));
        if (v) u.voice = v;
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
      });
    },
  } : null;

  const caps = { db, assets, user, tts, sample: ai };
  return {
    kind: "local",
    use: async name => caps[name] || null,
    blobUrl: id => urls.get(id) || "",
    async save(filename, blob) {
      // Share sheet where it exists (phones), else an ordinary download.
      const file = typeof File !== "undefined" ? new File([blob], filename, { type: blob.type }) : null;
      if (file && navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        try { await navigator.share({ files: [file], title: filename }); return true; }
        catch (e) { if (e?.name === "AbortError") throw Object.assign(new Error("declined"), { code: "declined" }); }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      return true;
    },
    // Full blob for a stored asset, for backup.
    async blob(id) {
      return new Promise((resolve, reject) => {
        const req = idb.transaction("blobs").objectStore("blobs").get(id);
        req.onsuccess = () => resolve(req.result?.blob || null);
        req.onerror = () => reject(req.error);
      });
    },
  };
}
