// Backup: one JSON file with the trainer's profile, every sighting, travel dexes and the photos as base64.
// The same file moves a collection between the Claude version and the standalone app, in either direction.

export const FORMAT = 1;

const toDataUrl = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});
function fromDataUrl(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(url || ""));
  if (!m) return null;
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || "image/jpeg" });
}

// sightings: [{id, ...fields}]; getBlob(assetId) -> Blob|null.
export async function buildBackup({ player, sightings, dexes, getBlob, onProgress }) {
  const blobs = {};
  const ids = [...new Set(sightings.flatMap(s => [s.assetId, s.thumbId]).filter(Boolean))];
  let n = 0;
  for (const id of ids) {
    const b = await getBlob(id).catch(() => null);
    if (b) blobs[id] = await toDataUrl(b);
    onProgress?.(++n, ids.length);
  }
  const data = { app: "dyredex", format: FORMAT, exportedAt: Date.now(), player: player || {}, sightings, dexes: dexes || [], blobs };
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

export async function readBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error("Filen er ikke en Dyredex-backup."); }
  if (data?.app !== "dyredex" || !Array.isArray(data.sightings)) throw new Error("Filen er ikke en Dyredex-backup.");
  if (data.format > FORMAT) throw new Error("Backuppen er lavet af en nyere version af Dyredex. Opdatér appen først.");
  return data;
}

const COUNTERS = ["wins", "losses", "giants"];

// Adds what is not already there. Sightings keep their ids, so loading the same file twice adds nothing.
// existing: [{id, fileSig, ...}]. Returns {added, skipped}.
export async function applyBackup(data, { existing, existingDexIds, player, sightCol, dexCol, playerDoc, upload, onProgress }) {
  const haveIds = new Set(existing.map(s => s.id));
  const haveSigs = new Set(existing.map(s => s.fileSig).filter(Boolean));
  const todo = data.sightings.filter(s => s && s.id && s.key && s.name && !haveIds.has(s.id) && !(s.fileSig && haveSigs.has(s.fileSig)));
  const newIds = new Map();
  const blobFor = async old => {
    if (!old) return undefined;
    if (newIds.has(old)) return newIds.get(old);
    const b = fromDataUrl(data.blobs?.[old]);
    const id = b ? (await upload(b)).id : undefined;
    newIds.set(old, id);
    return id;
  };
  let n = 0;
  for (const s of todo) {
    const { id, ...doc } = s;
    const assetId = await blobFor(s.assetId);
    if (s.assetId && !assetId) { onProgress?.(++n, todo.length); continue; }
    const thumbId = await blobFor(s.thumbId);
    const out = { ...doc };
    if (assetId) out.assetId = assetId; else delete out.assetId;
    if (thumbId) out.thumbId = thumbId; else delete out.thumbId;
    await sightCol.doc(id).set(out);
    onProgress?.(++n, todo.length);
  }
  for (const d of data.dexes || []) {
    if (!d?.id || existingDexIds.has(d.id) || !Array.isArray(d.species)) continue;
    const { id, ...doc } = d;
    await dexCol.doc(id).set(doc);
  }
  // Battle record: keep whichever is higher, so moving back and forth never loses wins.
  const p = data.player || {}, mine = player || {};
  const upd = {};
  for (const k of COUNTERS) if ((p[k] || 0) > (mine[k] || 0)) upd[k] = p[k];
  if (p.swins && typeof p.swins === "object") {
    const sw = { ...(mine.swins || {}) };
    let changed = false;
    for (const [k, v] of Object.entries(p.swins)) if ((v || 0) > (sw[k] || 0)) { sw[k] = v; changed = true; }
    if (changed) upd.swins = sw;
  }
  if (p.nick && !mine.nick) upd.nick = p.nick;
  if (Object.keys(upd).length) await playerDoc.update(upd).catch(() => {});
  return { added: todo.length, skipped: data.sightings.length - todo.length };
}
