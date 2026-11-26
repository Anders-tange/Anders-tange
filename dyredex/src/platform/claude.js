// Inside Claude: the artifact runtime provides storage, photos, AI, sign-in and speech.
export function createClaudePlatform() {
  let downloads;
  return {
    kind: "claude",
    use: name => window.claude.use(name),
    blobUrl: id => "/_blob/" + id,
    blob: id => fetch("/_blob/" + id).then(r => (r.ok ? r.blob() : null), () => null),
    // Offers a file to the viewer; resolves false if this view cannot save files.
    async save(filename, blob) {
      if (downloads === undefined) downloads = await window.claude.use("downloads").catch(() => null);
      if (!downloads) return false;
      await downloads.save({ filename, data: blob });
      return true;
    },
  };
}
