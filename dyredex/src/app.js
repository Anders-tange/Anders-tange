// Dyredex app. The platform (Claude runtime or the local, standalone one) is passed to start().
import { buildBackup, readBackup, applyBackup } from "./backup.js";

// hooks: what only one build has (the standalone build's AI settings and install help).
export function start(P, hooks = {}) {
  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const pad = n => String(n).padStart(3, "0");
  const fmtDate = ms => { try { return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms)); } catch { return ""; } };
  const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const keyFor = d => slug(d.latin) || slug(d.name);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  const CATS = [
    { id: "pattedyr", label: "Pattedyr", c: "#a5521b" }, { id: "fugl", label: "Fugl", c: "#2765b0" },
    { id: "krybdyr", label: "Krybdyr", c: "#2e7a3a" }, { id: "padde", label: "Padde", c: "#127a74" },
    { id: "fisk", label: "Fisk", c: "#23479a" }, { id: "insekt", label: "Insekt", c: "#856500" },
    { id: "edderkoppedyr", label: "Edderkoppedyr", c: "#6a3ea0" }, { id: "bloeddyr", label: "Bløddyr", c: "#a33c70" },
    { id: "krebsdyr", label: "Krebsdyr", c: "#b0411d" }, { id: "andet", label: "Andet", c: "#56606b" },
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const CODE = { m: "pattedyr", b: "fugl", r: "krybdyr", a: "padde", f: "fisk", i: "insekt", s: "edderkoppedyr", l: "bloeddyr", c: "krebsdyr", o: "andet" };
  const TYPES = ["Skov", "Mark", "Vand", "Hav", "Luft", "Bjerg", "Ørken", "Is", "Jungle", "By", "Nat", "Gift", "Hjem"];
  const RARITY = ["almindelig", "usædvanlig", "sjælden", "episk", "legendarisk"];
  const RARITY_LABEL = { almindelig: "Almindelig", "usædvanlig": "Usædvanlig", "sjælden": "Sjælden", episk: "Episk", legendarisk: "Legendarisk" };
  const RARITY_COLOR = { almindelig: "#8a8f98", "usædvanlig": "#2f9e55", "sjælden": "#2a6cc0", episk: "#8b3fc9", legendarisk: "#d99a00" };
  const rIdx = r => Math.max(0, RARITY.indexOf(r));
  const IUCN = { LC: ["Ikke truet", "#2f9e55"], NT: ["Næsten truet", "#7aa834"], VU: ["Sårbar", "#d0a000"], EN: ["Truet", "#e06a1a"], CR: ["Kritisk truet", "#c4142f"], EW: ["Uddød i naturen", "#4a2a6a"], DD: ["Ukendt bestand", "#777"] };
  const STATS = [["fart", "Fart"], ["styrke", "Styrke"], ["snilde", "Snilde"], ["nuttethed", "Nuttethed"]];
  const LEVELS = ["race", "underart", "art", "slægt", "familie"];

  /* ---------- catalogue: the entries you can hunt for, grouped by where they live ---------- */
  const REGIONS = [
    { id: "dk", label: "Danmark" }, { id: "eu", label: "Europa" }, { id: "af", label: "Afrika" }, { id: "as", label: "Asien" },
    { id: "na", label: "Nordamerika" }, { id: "sa", label: "Sydamerika" }, { id: "au", label: "Australien" }, { id: "hav", label: "Hav & is" },
  ];
  const REGION = Object.fromEntries(REGIONS.map(r => [r.id, r]));
  // name | latin | group code | emoji drawn as a black silhouette until caught
  const RAW = {
    dk: `Rødræv|Vulpes vulpes|m|🦊
Rådyr|Capreolus capreolus|m|🦌
Krondyr|Cervus elaphus|m|🦌
Egern|Sciurus vulgaris|m|🐿️
Pindsvin|Erinaceus europaeus|m|🦔
Grævling|Meles meles|m|🦡
Hare|Lepus europaeus|m|🐇
Odder|Lutra lutra|m|🦦
Spættet sæl|Phoca vitulina|m|🦭
Marsvin|Phocoena phocoena|m|🐬
Dværgflagermus|Pipistrellus pygmaeus|m|🦇
Solsort|Turdus merula|b|🐦
Musvit|Parus major|b|🐦
Gråspurv|Passer domesticus|b|🐦
Gråkrage|Corvus cornix|b|🐦
Stor flagspætte|Dendrocopos major|b|🐦
Knopsvane|Cygnus olor|b|🦢
Gråand|Anas platyrhynchos|b|🦆
Fiskehejre|Ardea cinerea|b|🦩
Hvid stork|Ciconia ciconia|b|🦩
Sølvmåge|Larus argentatus|b|🕊️
Musvåge|Buteo buteo|b|🦅
Natugle|Strix aluco|b|🦉
Hugorm|Vipera berus|r|🐍
Markfirben|Lacerta agilis|r|🦎
Skrubtudse|Bufo bufo|a|🐸
Torsk|Gadus morhua|f|🐟
Syvplettet mariehøne|Coccinella septempunctata|i|🐞
Honningbi|Apis mellifera|i|🐝
Dagpåfugleøje|Aglais io|i|🦋
Korsedderkop|Araneus diadematus|s|🕷️
Stor husedderkop|Eratigena atrica|s|🕷️
Vinbjergsnegl|Helix pomatia|l|🐌
Strandkrabbe|Carcinus maenas|c|🦀
Gråsæl|Halichoerus grypus|m|🦭
Havørn|Haliaeetus albicilla|b|🦅
Myreløve|Myrmeleon formicarius|i|🪲
Næsehornsbille|Oryctes nasicornis|i|🪲`,
    eu: `Ulv|Canis lupus|m|🐺
Brunbjørn|Ursus arctos|m|🐻
Los|Lynx lynx|m|🐈
Elg|Alces alces|m|🦌
Vildsvin|Sus scrofa|m|🐗
Alpestenbuk|Capra ibex|m|🐐
Gemse|Rupicapra rupicapra|m|🐐
Alpemurmeldyr|Marmota marmota|m|🐿️
Europæisk bæver|Castor fiber|m|🦫
Rensdyr|Rangifer tarandus|m|🦌
Europæisk bison|Bison bonasus|m|🦬
Kongeørn|Aquila chrysaetos|b|🦅
Isfugl|Alcedo atthis|b|🐦
Hærfugl|Upupa epops|b|🐦
Biæder|Merops apiaster|b|🐦
Lunde|Fratercula arctica|b|🐧
Stor flamingo|Phoenicopterus roseus|b|🦩
Ildsalamander|Salamandra salamandra|a|🦎
Græsk landskildpadde|Testudo hermanni|r|🐢
Murgekko|Tarentola mauritanica|r|🦎
Gulhalet skorpion|Euscorpius flavicaudis|s|🦂
Svalehale|Papilio machaon|i|🦋
Eghjort|Lucanus cervus|i|🪲`,
    af: `Løve|Panthera leo|m|🦁
Afrikansk savanneelefant|Loxodonta africana|m|🐘
Giraf|Giraffa camelopardalis|m|🦒
Steppezebra|Equus quagga|m|🦓
Flodhest|Hippopotamus amphibius|m|🦛
Spidsmundet næsehorn|Diceros bicornis|m|🦏
Breddmundet næsehorn|Ceratotherium simum|m|🦏
Gepard|Acinonyx jubatus|m|🐆
Leopard|Panthera pardus|m|🐆
Plettet hyæne|Crocuta crocuta|m|🐕
Afrikansk vildhund|Lycaon pictus|m|🐕
Vestlig gorilla|Gorilla gorilla|m|🦍
Chimpanse|Pan troglodytes|m|🐒
Anubisbavian|Papio anubis|m|🐒
Katta|Lemur catta|m|🐒
Surikat|Suricata suricatta|m|🐿️
Blåhalet gnu|Connochaetes taurinus|m|🐃
Impala|Aepyceros melampus|m|🦌
Vortesvin|Phacochoerus africanus|m|🐗
Dromedar|Camelus dromedarius|m|🐪
Struds|Struthio camelus|b|🦤
Nilkrokodille|Crocodylus niloticus|r|🐊
Pantherkamæleon|Furcifer pardalis|r|🦎
Afrikansk sporeskildpadde|Centrochelys sulcata|r|🐢
Sort mamba|Dendroaspis polylepis|r|🐍
Gul tykhalet skorpion|Androctonus australis|s|🦂
Kejserskorpion|Pandinus imperator|s|🦂
Kafferbøffel|Syncerus caffer|m|🐃
Elefantspidsmus|Elephantulus myurus|m|🐭
Leopardskildpadde|Stigmochelys pardalis|r|🐢
Rødnæbbet bøffelvæver|Bubalornis niger|b|🐦
Marabustork|Leptoptilos crumenifer|b|🦩
Hvidrygget grib|Gyps africanus|b|🦅`,
    as: `Tiger|Panthera tigris|m|🐅
Kæmpepanda|Ailuropoda melanoleuca|m|🐼
Rød panda|Ailurus fulgens|m|🦝
Asiatisk elefant|Elephas maximus|m|🐘
Borneo-orangutang|Pongo pygmaeus|m|🦧
Sumatra-orangutang|Pongo abelii|m|🦧
Hvidhåndet gibbon|Hylobates lar|m|🐒
Japansk makak|Macaca fuscata|m|🐒
Filippinsk spøgelsesabe|Carlito syrichta|m|🐒
Sneleopard|Panthera uncia|m|🐆
Yak|Bos grunniens|m|🐂
Tokuklet kamel|Camelus bactrianus|m|🐫
Asiatisk palmemår|Paradoxurus hermaphroditus|m|🦝
Malajbjørn|Helarctos malayanus|m|🐻
Skabrakstapir|Tapirus indicus|m|🐖
Pansernæsehorn|Rhinoceros unicornis|m|🦏
Blå påfugl|Pavo cristatus|b|🦚
Stor næsehornsfugl|Buceros bicornis|b|🐦
Mandarinand|Aix galericulata|b|🦆
Komodovaran|Varanus komodoensis|r|🦎
Kongekobra|Ophiophagus hannah|r|🐍
Gavial|Gavialis gangeticus|r|🐊
Koi|Cyprinus rubrofuscus|f|🐟
Atlasspinder|Attacus atlas|i|🦋
Asiatisk skovskorpion|Heterometrus spinifer|s|🦂`,
    na: `Amerikansk bison|Bison bison|m|🦬
Amerikansk sortbjørn|Ursus americanus|m|🐻
Vaskebjørn|Procyon lotor|m|🦝
Prærieulv|Canis latrans|m|🐺
Stribet skunk|Mephitis mephitis|m|🦨
Virginsk opossum|Didelphis virginiana|m|🐀
Canadisk bæver|Castor canadensis|m|🦫
Hvidhalet hjort|Odocoileus virginianus|m|🦌
Puma|Puma concolor|m|🐆
Sorthalet præriehund|Cynomys ludovicianus|m|🐿️
Hvidhovedet havørn|Haliaeetus leucocephalus|b|🦅
Rubinstrubet kolibri|Archilochus colubris|b|🐦
Rød kardinal|Cardinalis cardinalis|b|🐦
Vild kalkun|Meleagris gallopavo|b|🦃
Mississippialligator|Alligator mississippiensis|r|🐊
Diamantklapperslange|Crotalus adamanteus|r|🐍
Monarksommerfugl|Danaus plexippus|i|🦋
Sort enke|Latrodectus mactans|s|🕷️
Arizona-ørkenskorpion|Hadrurus arizonensis|s|🦂`,
    sa: `Jaguar|Panthera onca|m|🐆
Brunstrubet dovendyr|Bradypus variegatus|m|🦥
Kæmpemyresluger|Myrmecophaga tridactyla|m|🦡
Lama|Lama glama|m|🦙
Alpaka|Vicugna pacos|m|🦙
Flodsvin|Hydrochoerus hydrochaeris|m|🐹
Egernabe|Saimiri sciureus|m|🐒
Brun næsebjørn|Nasua nasua|m|🦝
Kæmpetukan|Ramphastos toco|b|🦜
Hyacintara|Anodorhynchus hyacinthinus|b|🦜
Blågul ara|Ara ararauna|b|🦜
Andeskondor|Vultur gryphus|b|🦅
Humboldtpingvin|Spheniscus humboldti|b|🐧
Grøn anakonda|Eunectes murinus|r|🐍
Grøn leguan|Iguana iguana|r|🦎
Galápagoskæmpeskildpadde|Chelonoidis niger|r|🐢
Gylden pilgiftfrø|Phyllobates terribilis|a|🐸
Rødbuget piratfisk|Pygocentrus nattereri|f|🐟
Chilensk rosatarantel|Grammostola rosea|s|🕷️
Blå morfosommerfugl|Morpho menelaus|i|🦋`,
    au: `Rød kænguru|Osphranter rufus|m|🦘
Østlig grå kænguru|Macropus giganteus|m|🦘
Koala|Phascolarctos cinereus|m|🐨
Næbdyr|Ornithorhynchus anatinus|m|🦦
Almindelig wombat|Vombatus ursinus|m|🐻
Tasmansk pungdjævel|Sarcophilus harrisii|m|🦡
Dingo|Canis lupus dingo|m|🐕
Kortnæbbet myrepindsvin|Tachyglossus aculeatus|m|🦔
Emu|Dromaius novaehollandiae|b|🦤
Latterfugl|Dacelo novaeguineae|b|🐦
Gultoppet kakadue|Cacatua galerita|b|🦜
Undulat|Melopsittacus undulatus|b|🦜
Sort svane|Cygnus atratus|b|🦢
Brun kiwi|Apteryx mantelli|b|🐦
Saltvandskrokodille|Crocodylus porosus|r|🐊
Kraveøgle|Chlamydosaurus kingii|r|🦎
Skægagame|Pogona vitticeps|r|🦎
Rødrygget edderkop|Latrodectus hasselti|s|🕷️`,
    hav: `Isbjørn|Ursus maritimus|m|🐻‍❄️
Polarræv|Vulpes lagopus|m|🦊
Hvalros|Odobenus rosmarus|m|🦭
Californisk søløve|Zalophus californianus|m|🦭
Spækhugger|Orcinus orca|m|🐋
Pukkelhval|Megaptera novaeangliae|m|🐋
Blåhval|Balaenoptera musculus|m|🐳
Narhval|Monodon monoceros|m|🐋
Øresvin|Tursiops truncatus|m|🐬
Kejserpingvin|Aptenodytes forsteri|b|🐧
Kongepingvin|Aptenodytes patagonicus|b|🐧
Grøn havskildpadde|Chelonia mydas|r|🐢
Hvidhaj|Carcharodon carcharias|f|🦈
Hvalhaj|Rhincodon typus|f|🦈
Klovnfisk|Amphiprion ocellaris|f|🐠
Perlekuglefisk|Arothron meleagris|f|🐡
Almindelig ottearmet blæksprutte|Octopus vulgaris|l|🐙
Europæisk hummer|Homarus gammarus|c|🦞
Almindelig søstjerne|Asterias rubens|o|⭐
Sydkaper|Eubalaena australis|m|🐋`,
  };
  const BASE_CATALOG = [];
  for (const r of REGIONS) for (const line of RAW[r.id].trim().split("\n")) {
    const [name, latin, c, emoji] = line.split("|").map(s => s.trim());
    BASE_CATALOG.push({ no: BASE_CATALOG.length + 1, key: keyFor({ latin }), name, latin, cat: CODE[c] || "andet", emoji, region: r.id });
  }
  // Travel dexes add their species after the built-in catalogue, so CATALOG is rebuilt whenever they change.
  let CATALOG = BASE_CATALOG.slice();
  let CATALOG_BY_KEY = new Map(CATALOG.map(c => [c.key, c]));
  let dexKeySets = new Map();
  const ANIMAL_EMOJI = "🐒🦍🦧🐕🐺🦊🦝🐈🦁🐅🐆🐎🦓🦌🦬🐂🐃🐄🐖🐗🐏🐑🐐🐪🐫🦙🦒🐘🦏🦛🐁🐀🐹🐇🐿️🦫🦔🦇🐻🐨🐼🦥🦦🦨🦘🦡🦃🐔🐓🐦🐧🕊️🦅🦆🦢🦉🦤🦩🦚🦜🐸🐊🐢🦎🐍🐋🐳🐬🦭🐟🐠🐡🦈🐙🐚🐌🦋🐛🐜🐝🪲🐞🦗🪳🕷️🦂🦟🪰🪱🦀🦞🦐🦑";
  const CAT_EMOJI = { pattedyr: "🐕", fugl: "🐦", krybdyr: "🦎", padde: "🐸", fisk: "🐟", insekt: "🪲", edderkoppedyr: "🕷️", bloeddyr: "🐌", krebsdyr: "🦀", andet: "🐛" };
  function rebuildCatalog() {
    CATALOG = BASE_CATALOG.slice();
    const seen = new Set(CATALOG.map(c => c.key));
    for (const d of state.dexes) for (const sp of d.species || []) {
      if (!sp.key || seen.has(sp.key)) continue;
      seen.add(sp.key);
      CATALOG.push({ no: CATALOG.length + 1, key: sp.key, name: sp.name, latin: sp.latin, cat: CAT[sp.cat] ? sp.cat : "andet", emoji: sp.emoji || CAT_EMOJI[sp.cat] || "🐛", region: REGION[sp.region] ? sp.region : "", extra: true });
    }
    CATALOG_BY_KEY = new Map(CATALOG.map(c => [c.key, c]));
    dexKeySets = new Map(state.dexes.map(d => [d.id, new Set((d.species || []).map(sp => sp.key))]));
  }
  const dexOf = r => String(r).startsWith("x:") ? state.dexes.find(d => d.id === r.slice(2)) : null;
  const inRegion = (e, r) => r === "alle" || (String(r).startsWith("x:") ? !!dexKeySets.get(r.slice(2))?.has(e.key) : e.region === r);
  const regionLabel = r => r === "alle" ? "Nationaldex" : dexOf(r)?.name || REGION[r]?.label || "";

  /* ---------- state ---------- */
  const state = {
    sightings: [], queue: [], region: "alle", show: "alle", q: "", sort: "mine",
    showNames: store.get("dyredex-names") === "1",
    revealed: new Set((store.get("dyredex-revealed") || "").split(",").filter(Boolean)),
    selected: null, pendingSelect: null, photoIdx: 0, confirmDel: false, refine: null,
    db: null, assets: null, sample: null, vision: false, canAdd: true, memory: false,
    tab: "dex", loaded: false, import: null, pendingBadges: [],
    viewCard: false, maxImages: 1, specials: new Map(), dexes: [], dexForm: null, refresh: null, confirmDex: false,
    me: null, viewing: null, mine: [], players: new Map(), names: new Map(), unsubOther: null, user: null, tts: null,
  };
  const importKeys = new Set(), importSigs = new Set();
  const fileSig = f => `${f.name}|${f.size}|${f.lastModified}`;
  const urlOf = it => it.url || (it.url = URL.createObjectURL(it.file));
  const memUrls = new Map();
  let uid = 0;

  /* ---------- derived dex ---------- */
  function speciesOf(list) {
    const map = new Map();
    const sorted = [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    for (const s of sorted) {
      let sp = map.get(s.key);
      if (!sp) { sp = { key: s.key, info: s, photos: [] }; map.set(s.key, sp); }
      sp.photos.push(s);
    }
    return map;
  }
  // Grouping is reused many times per render; it is rebuilt when the list or its length changes, and on every render().
  let cmMemo = null;
  function caughtMap() {
    if (!cmMemo || cmMemo.src !== state.sightings || cmMemo.len !== state.sightings.length) cmMemo = { src: state.sightings, len: state.sightings.length, map: speciesOf(state.sightings) };
    return cmMemo.map;
  }
  const sightPath = uid => `players/${uid}/sightings`;
  const isMine = () => state.viewing === state.me;
  function buildDex() {
    const caught = caughtMap();
    const entries = CATALOG.map(c => ({ ...c, sp: caught.get(c.key) || null }));
    let no = CATALOG.length;
    for (const sp of caught.values()) {
      if (CATALOG_BY_KEY.has(sp.key)) continue;
      const i = sp.info;
      entries.push({ no: ++no, key: sp.key, name: i.name, latin: i.latin, cat: i.category || "andet", emoji: "", region: REGION[i.region] ? i.region : "", bonus: true, sp });
    }
    return entries;
  }
  let DEX = buildDex();
  const entryByKey = key => DEX.find(e => e.key === key);
  const photoSrc = s => s.assetId ? P.blobUrl(s.assetId) : (memUrls.get(s.id) || "");
  const thumbSrc = s => s?.thumbId ? P.blobUrl(s.thumbId) : photoSrc(s || {});
  const photoVague = (p, key) => ["slægt", "familie"].includes(p.specificity) || (!p.specificity && !CATALOG_BY_KEY.has(key) && !/\s/.test(String(p.latin || "").trim()));
  const photoUnsure = (p, key) => photoVague(p, key) || (typeof p.confidence === "number" && p.confidence < 0.6);
  const spUnsure = sp => sp.photos.every(p => photoUnsure(p, sp.key));
  const nameShown = e => !!e.sp || state.showNames || state.revealed.has(e.key);
  // What a sighting will look like in the dex, worked out before the store has echoed it back.
  function previewEntry(doc) {
    const e = entryByKey(doc.key);
    if (e) return { ...e, sp: e.sp || { info: doc } };
    return { no: DEX.length + 1, key: doc.key, name: doc.name, cat: doc.category, region: REGION[doc.region] ? doc.region : "", bonus: true, sp: { info: doc } };
  }

  function visibleEntries() {
    const q = state.q.trim().toLowerCase();
    const list = DEX.filter(e =>
      inRegion(e, state.region) &&
      (state.show === "alle" || (state.show === "fanget" ? !!e.sp : state.show === "usikre" ? !!e.sp && spUnsure(e.sp) : !e.sp)) &&
      (!q || [e.name, e.latin].some(v => String(v || "").toLowerCase().includes(q))));
    if (state.sort === "nr") return list;
    if (state.sort === "mine") return [...list].sort((a, b) => (!!b.sp - !!a.sp) || a.no - b.no);
    const val = e => {
      if (!e.sp) return -1;
      if (state.sort === "rarity") return rIdx(e.sp.info.rarity) * 10 + (e.sp.photos.some(p => p.shiny) ? 5 : 0);
      if (state.sort === "recent") return Math.max(...e.sp.photos.map(p => p.createdAt || 0));
      const pw = speciesPower(e.sp, state.viewing);
      return state.sort === "lv" ? pw.level * 10000 + pw.kk : pw.kk;
    };
    return list.map(e => [e, val(e)]).sort((a, b) => b[1] - a[1] || a[0].no - b[0].no).map(x => x[0]);
  }

  /* ---------- rendering ---------- */
  const catHtml = id => { const c = CAT[id] || CAT.andet; return `<span class="cat" style="--c:${c.c}">${esc(c.label)}</span>`; };
  const rarityHtml = (r, withLabel) => {
    if (!RARITY.includes(r)) return "";
    const n = RARITY.indexOf(r) + 1;
    return `<span class="rar" style="--rc:${RARITY_COLOR[r]}" aria-label="${esc(RARITY_LABEL[r])}" title="${esc(RARITY_LABEL[r])}">${"◆".repeat(n)}<span class="off">${"◆".repeat(5 - n)}</span>${withLabel ? `<b>${esc(RARITY_LABEL[r].toUpperCase())}</b>` : ""}</span>`;
  };
  const iucnHtml = c => IUCN[c] ? `<span class="iucn" style="--ic:${IUCN[c][1]}" title="Rødlistestatus (IUCN)">${esc(IUCN[c][0])} · ${c}</span>` : "";
  const grade = n => n >= 9 ? "S" : n >= 7 ? "A" : n >= 5 ? "B" : n >= 3 ? "C" : "D";

  // Level grows with photos of the species, battle wins, rarity and shiny finds; Kampkraft (KK) sums it up in one number.
  const xpForLevel = L => 8 * (L - 1) ** 2;
  const levelOf = xp => Math.min(50, 1 + Math.floor(Math.sqrt(xp / 8)));
  function speciesPower(sp, trainer) {
    const wins = (state.players.get(trainer)?.swins || {})[sp.key] || 0;
    const shiny = sp.photos.some(p => p.shiny);
    const xp = sp.photos.length * 100 + wins * 60 + rIdx(sp.info.rarity) * 50 + (shiny ? 150 : 0);
    const level = levelOf(xp);
    const st = sp.info.stats || {};
    const v = k => clamp(st[k] ?? 5, 1, 10);
    const kk = Math.round((v("styrke") * 14 + v("fart") * 10 + v("snilde") * 10 + v("nuttethed") * 4) * (1 + rIdx(sp.info.rarity) * 0.15) * (1 + level / 40) * (shiny ? 1.15 : 1));
    return { xp, level, kk, shiny, wins, next: xpForLevel(level + 1), cur: xpForLevel(level) };
  }

  function radarSvg(stats, color) {
    const val = k => clamp(stats?.[k] ?? 0, 0, 10);
    const r = k => val(k) / 10 * 40;
    const pts = `50,${50 - r("fart")} ${50 + r("styrke")},50 50,${50 + r("snilde")} ${50 - r("nuttethed")},50`;
    const ring = f => `<polygon points="50,${50 - 40 * f} ${50 + 40 * f},50 50,${50 + 40 * f} ${50 - 40 * f},50" fill="none" stroke="currentColor" stroke-opacity=".22"/>`;
    return `<svg class="radar" viewBox="-34 -10 168 120" role="img" aria-label="Fart ${val("fart")}, styrke ${val("styrke")}, snilde ${val("snilde")}, nuttethed ${val("nuttethed")}" style="color:var(--lcd-ink)">
      ${ring(1)}${ring(0.66)}${ring(0.33)}
      <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" stroke-opacity=".18"/><line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" stroke-opacity=".18"/>
      <polygon points="${pts}" fill="${color}" fill-opacity=".5" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
      <text x="50" y="3" text-anchor="middle">FART ${grade(val("fart"))}</text>
      <text x="92" y="53" text-anchor="start">STY ${grade(val("styrke"))}</text>
      <text x="50" y="106" text-anchor="middle">SNILDE ${grade(val("snilde"))}</text>
      <text x="8" y="53" text-anchor="end">NUT ${grade(val("nuttethed"))}</text>
    </svg>`;
  }

  function render() {
    cmMemo = null;
    if (String(state.region).startsWith("x:") && !dexOf(state.region)) state.region = "alle";
    DEX = buildDex();
    if (state.pendingSelect && entryByKey(state.pendingSelect)) { state.selected = state.pendingSelect; state.pendingSelect = null; state.photoIdx = 0; }
    if (!state.selected || !entryByKey(state.selected)) state.selected = (DEX.find(e => e.sp) || DEX[0]).key;
    renderCounter(); renderKeys(); renderStrip(); renderDex(); renderViewer();
    const ach = allAch();
    renderBadges(ach); checkBadges(ach); updateSummary(ach);
    renderViewing(); renderMissions(); renderCare();
    if (document.activeElement?.id !== "nick") renderTrainers();
    if (B.stage === "pick") renderBattle();
  }

  function renderCounter() {
    const got = DEX.filter(e => e.sp).length;
    $("#c-big").innerHTML = `${pad(got)}<small>/${pad(DEX.length)}</small>`;
    $("#c-meter").style.width = (DEX.length ? got / DEX.length * 100 : 0) + "%";
    const photos = state.sightings.length;
    $("#c-lbl").textContent = `FANGET · ${photos} ${photos === 1 ? "BILLEDE" : "BILLEDER"}`;
  }

  function renderKeys() {
    const key = (id, label, list) => {
      const got = list.filter(e => e.sp).length;
      const pct = list.length ? got / list.length * 100 : 0;
      return `<button class="key" data-region="${id}" aria-pressed="${state.region === id}"><b>${esc(label)}</b><span>${got}/${list.length}</span><span class="m"><i style="width:${pct}%"></i></span></button>`;
    };
    const keysEl = $("#keys"), keysScroll = keysEl.scrollLeft;
    keysEl.innerHTML = key("alle", "Nationaldex", DEX) + REGIONS.map(r => key(r.id, r.label, DEX.filter(e => e.region === r.id))).join("")
      + state.dexes.map(d => key("x:" + d.id, d.name, DEX.filter(e => inRegion(e, "x:" + d.id))).replace('class="key"', 'class="key trip"')).join("")
      + (state.sample && isMine() ? `<button class="key add" data-dexadd="1"><b>+ Rejse-dex</b><span>NYT STED</span></button>` : "");
    keysEl.scrollLeft = keysScroll;
  }

  function renderStrip() {
    const list = DEX.filter(e => inRegion(e, state.region));
    const got = list.filter(e => e.sp).length;
    const pct = list.length ? Math.round(got / list.length * 100) : 0;
    const name = regionLabel(state.region).toUpperCase();
    const dex = dexOf(state.region);
    const del = dex && dex.by === state.me && isMine() ? (state.confirmDex ? `<button class="btn sm" data-dexdel="yes">Slet rejse-dex</button><button class="btn ghost-dark sm" data-dexdel="no">Behold</button>` : `<button class="btn ghost-dark sm" data-dexdel="ask">Slet</button>`) : "";
    $("#strip").innerHTML = `<span>${esc(name)}</span><span>${got} FANGET</span><span class="meter"><i style="width:${pct}%"></i></span><span>${list.length - got} TILBAGE · ${pct}%</span>${del}`;
  }

  function tileHtml(e) {
    const caught = !!e.sp;
    const show = nameShown(e);
    const label = `Nummer ${e.no}, ${show ? e.name : "ukendt dyr"}${caught ? ", fanget" : ", ikke fanget"}`;
    const pw = caught ? speciesPower(e.sp, state.viewing) : null;
    const r = caught ? e.sp.info.rarity : "";
    return `<button class="tile${caught ? ` caught r-${rIdx(r)}` : ""}${pw?.shiny ? " shiny" : ""}${state.selected === e.key ? " sel" : ""}" data-key="${esc(e.key)}" aria-label="${esc(label)}${pw ? `, ${RARITY_LABEL[r] || ""}, kampkraft ${pw.kk}` : ""}" ${caught ? `style="--rc:${RARITY_COLOR[r] || "transparent"}"` : ""}>
      <span class="no">${pad(e.no)}</span>${caught ? '<span class="ball" aria-hidden="true"></span>' : ""}${e.bonus ? '<span class="bonus-tag" aria-hidden="true">B</span>' : ""}
      <span class="art">${caught && spUnsure(e.sp) ? '<span class="unsure" title="Usikker bestemmelse" aria-hidden="true">?</span>' : ""}${caught ? `<img src="${esc(thumbSrc(e.sp.photos[0]))}" alt="" loading="lazy" decoding="async"><span class="kkb">KK ${pw.kk}</span>${pw.shiny ? '<span class="shn" aria-hidden="true">✨</span>' : ""}` : `<span class="sil" aria-hidden="true">${e.emoji}</span>`}</span>
      <span class="nm">${show ? esc(e.name) : "???"}</span>
    </button>`;
  }

  function renderDex() {
    const list = visibleEntries();
    $("#dex").innerHTML = list.length ? list.map(tileHtml).join("") : `<p class="empty">Ingen dyr her. Prøv en anden region eller søgning.</p>`;
  }

  function renderViewer() {
    const e = entryByKey(state.selected);
    const v = $("#viewer");
    if (!e) { v.innerHTML = ""; return; }
    const reg = e.region ? REGION[e.region].label : "Ukendt region";
    const head = `<div class="v-head"><span>No.${pad(e.no)}${e.bonus ? " · BONUS" : ""}</span><span class="reg">${esc(reg)}</span></div>`;
    if (!e.sp) {
      const show = nameShown(e);
      v.innerHTML = `${head}
        <div class="v-art"><span class="sil" aria-hidden="true">${e.emoji}</span></div>
        <div><h2 class="v-name">${show ? esc(e.name) : "???"}</h2>${show ? `<p class="v-latin">${esc(e.latin)}</p>` : ""}</div>
        <div class="chips">${catHtml(e.cat)}<span class="type">${esc(reg)}</span></div>
        <p class="small">Ikke fanget endnu. Find dyret i naturen, i en zoo eller et akvarium, og scan billedet for at registrere det.</p>
        <div class="actions">
          ${state.canAdd && isMine() ? `<button class="btn" data-act="pick">Scan et billede</button>` : ""}
          ${show ? "" : `<button class="btn ghost" data-act="reveal">Afslør navn</button>`}
        </div>`;
      return;
    }
    const sp = e.sp;
    state.photoIdx = Math.min(state.photoIdx, sp.photos.length - 1);
    const p = sp.photos[state.photoIdx];
    const i = sp.info;
    const canEdit = (state.memory || !!state.assets) && isMine();
    const vague = photoVague(p, e.key);
    const shaky = !vague && photoUnsure(p, e.key);
    const mapLink = p.geo ? ` · <a href="https://www.openstreetmap.org/?mlat=${Number(p.geo.lat)}&amp;mlon=${Number(p.geo.lon)}#map=14/${Number(p.geo.lat)}/${Number(p.geo.lon)}" target="_blank" rel="noopener">kort</a>` : "";
    const running = state.refine && state.refine.sid === p.id;
    v.innerHTML = `${head}
      <div class="v-mode" role="group" aria-label="Visning"><button data-view="photo" aria-pressed="${!state.viewCard}">FOTO</button><button data-view="card" aria-pressed="${state.viewCard}">HOLO-KORT</button></div>
      ${state.viewCard ? cardHtml(e, p) : `<div class="v-art"><img src="${esc(photoSrc(p))}" alt="${esc(e.name)}"></div>`}
      ${sp.photos.length > 1 ? `<div class="thumbs">${sp.photos.map((ph, n) => `<button data-ph="${n}" aria-label="Billede ${n + 1}" aria-current="${n === state.photoIdx}"><img src="${esc(thumbSrc(ph))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      ${state.viewCard ? "" : `<div><h2 class="v-name">${esc(e.name)}</h2><p class="v-latin">${esc(e.latin || "")}${i.nameEn ? ` · ${esc(i.nameEn)}` : ""}</p></div>
      <div class="chips">${catHtml(e.cat)}${(i.types || []).map(t => `<span class="type">${esc(t)}</span>`).join("")}${rarityHtml(i.rarity, true)}${iucnHtml(i.iucn)}</div>`}
      ${p.shiny ? `<p class="shinyline">✨ Shiny-variant${p.variant ? `: ${esc(p.variant)}` : ""}</p>` : ""}
      ${vague ? `<p class="small" style="color:var(--danger)">Kun bestemt til ${esc(p.specificity || "slægt eller familie")}. Tryk "Bestem præcis art".</p>` : ""}
      ${shaky ? `<p class="small" style="color:var(--danger)">AI'en var kun ${Math.round(p.confidence * 100)} % sikker på arten.${canEdit ? ` Tryk "Bestem præcis art" for et grundigere tjek, eller <button class="btn ghost sm" data-act="confirm-id">Jeg er sikker</button>` : ""}</p>` : ""}
      ${i.description && !state.viewCard ? `<p class="small">${esc(i.description)}</p>` : ""}
      ${i.stats && !state.viewCard ? statPanel(e, sp) : ""}
      <dl class="facts">
        <dt>Fundet</dt><dd>${esc(fmtDate(p.takenAt || p.createdAt))}${p.place ? `, ${esc(p.place)}` : ""}${mapLink}${sp.photos.length > 1 ? ` (billede ${state.photoIdx + 1}/${sp.photos.length})` : ""}</dd>
        ${i.rarityWhy ? `<dt>Sjælden?</dt><dd>${esc(i.rarityWhy)}</dd>` : ""}
        ${i.size ? `<dt>Størrelse</dt><dd>${esc(i.size)}</dd>` : ""}
        ${i.habitat ? `<dt>Levested</dt><dd>${esc(i.habitat)}</dd>` : ""}
        ${p.idTips ? `<dt>Kendetegn</dt><dd>${esc(p.idTips)}</dd>` : ""}
      </dl>
      ${i.funFact ? `<p class="fun"><strong>Vidste du?</strong> ${esc(i.funFact)}</p>` : ""}
      ${refineHtml(p)}
      ${!canEdit && state.tts ? `<div class="actions"><button class="btn ghost sm" data-act="speak">Læs op</button></div>` : ""}
      ${canEdit ? `<div class="actions">
        ${state.tts ? `<button class="btn ghost sm" data-act="speak">Læs op</button>` : ""}
        ${state.vision && !running ? `<button class="btn blue sm" data-act="refine">Bestem præcis art</button>` : ""}
        ${state.confirmDel ? `<button class="btn sm" data-act="del-yes">Slet billedet</button><button class="btn ghost sm" data-act="del-no">Behold</button>` : `<button class="btn ghost sm" data-act="del">Slet billede</button>`}
      </div>` : ""}`;
    if (state.viewCard) mountCard();
  }

  function statPanel(e, sp) {
    const i = sp.info, pw = speciesPower(sp, state.viewing);
    const best = STATS.map(([k, label]) => [label, clamp(i.stats[k], 0, 10)]).sort((a, b) => b[1] - a[1])[0];
    const pct = pw.level >= 50 ? 100 : Math.round((pw.xp - pw.cur) / (pw.next - pw.cur) * 100);
    return `<div class="statpanel">${radarSvg(i.stats, RARITY_COLOR[i.rarity] || (CAT[e.cat] || CAT.andet).c)}
      <div class="power">
        <div class="kk">${pw.kk}<small>KAMPKRAFT</small></div>
        <div class="lv"><span>LV ${pw.level}</span><span>${pw.level >= 50 ? "MAKS" : `${pw.xp}/${pw.next} XP`}</span></div>
        <span class="xpbar"><i style="width:${pct}%"></i></span>
        <span class="spec">Bedst til: ${esc(best[0].toLowerCase())} (${grade(best[1])}) · ${sp.photos.length} ${sp.photos.length === 1 ? "billede" : "billeder"}${pw.wins ? ` · ${pw.wins} ${pw.wins === 1 ? "sejr" : "sejre"}` : ""}</span>
        <span class="spec">Flere billeder og sejre giver XP og højere level.</span>
      </div></div>`;
  }

  function refineHtml(p) {
    const r = state.refine;
    if (!r || r.sid !== p.id) return "";
    if (r.status === "running") return `<div class="box"><span class="lcdfont" style="font-size:20px">ANALYSERER GRUNDIGT…</span><p class="small dim">AI'en zoomer ind på dyret og vejer de arter, der ligner hinanden, mod hinanden. Det kan tage op til et minut.</p><div class="actions"><button class="btn ghost sm" data-act="refine-stop">Stop</button></div></div>`;
    if (r.status === "error") return `<div class="box"><p class="err">${esc(r.error)}</p><div class="actions"><button class="btn ghost sm" data-act="refine-close">Luk</button></div></div>`;
    const d = r.draft;
    const same = keyFor(d) === p.key;
    const alts = (r.result?.alternatives || []).filter(a => a && a.name);
    return `<div class="box">
      <span class="lcdfont" style="font-size:20px">${same ? "BEKRÆFTET" : "NYT FORSLAG"} · ${Math.round((d.confidence || 0) * 100)}% SIKKER</span>
      <div><strong>${esc(d.name)}</strong> <em class="dim">${esc(d.latin)}</em>${d.specificity ? ` <span class="dim">(${esc(d.specificity)})</span>` : ""}</div>
      ${d.idTips ? `<p class="small">${esc(d.idTips)}</p>` : ""}
      ${alts.length ? `<p class="small dim">Andre muligheder: ${alts.map(a => esc(a.name)).join(", ")}</p>` : ""}
      <div class="actions">
        <button class="btn sm" data-act="refine-apply">${same ? "Opdatér oplysninger" : "Brug denne art"}</button>
        <button class="btn ghost sm" data-act="refine-close">Behold nuværende</button>
      </div>
    </div>`;
  }

  const isPhone = () => matchMedia("(max-width: 880px)").matches;
  let sheetHash = false;
  function openSheet() {
    document.body.classList.add("sheet"); $(".left").scrollTop = 0;
    try { if (location.hash !== "#dyr") { location.hash = "dyr"; sheetHash = true; } } catch {}
  }
  function closeSheet() {
    if (!document.body.classList.contains("sheet")) return;
    document.body.classList.remove("sheet");
    try { if (sheetHash && location.hash === "#dyr") history.back(); } catch {}
    sheetHash = false;
  }
  // The phone's back button or gesture closes the open animal instead of leaving the app.
  window.addEventListener("hashchange", () => { if (location.hash !== "#dyr") { sheetHash = false; document.body.classList.remove("sheet"); } });

  function select(key, scroll) {
    state.selected = key; state.photoIdx = 0; state.confirmDel = false; CARD.flip = false;
    if (state.refine && state.refine.status !== "running") state.refine = null;
    for (const t of document.querySelectorAll(".tile.sel")) t.classList.remove("sel");
    document.querySelector(`.tile[data-key="${CSS.escape(key)}"]`)?.classList.add("sel");
    renderViewer();
    if (scroll && isPhone()) { openSheet(); return; }
    if (scroll) {
      const r = $("#viewer").getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.6) $("#viewer").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }

  /* ---------- holo card: the real photo as a foil trading card that tilts, and flips to show its back ---------- */
  const CARD = { rx: 0, ry: 0, tx: 0, ty: 0, active: false, raf: 0, tilt: null, tiltSeen: false, flip: false, flipCur: 0, down: null };
  const HOLO = { almindelig: .45, "usædvanlig": .6, "sjælden": .78, episk: .92, legendarisk: 1.05 };
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function cardHtml(e, p) {
    const i = e.sp.info, sp = e.sp;
    const c = (CAT[e.cat] || CAT.andet).c;
    const src = esc(photoSrc(p));
    const pw = speciesPower(sp, state.viewing);
    const sparkle = p.shiny || rIdx(i.rarity) >= 3;
    return `<div class="card-stage" id="cstage">
      <div class="pcard" id="pcard" style="--c:${c};--holo:${p.shiny ? 1.3 : (HOLO[i.rarity] ?? .5)}">
        <div class="pc-body">
          <div class="pc-top"><b>${esc(e.name)}</b><span>No.${pad(e.no)}</span></div>
          <div class="pc-art">
            <img src="${src}" alt="${esc(e.name)}">
            ${sparkle ? '<div class="pc-spark"></div>' : ""}
            <div class="pc-foil"></div><div class="pc-glare"></div>
          </div>
          <div class="pc-meta"><span class="chips">${catHtml(e.cat)}${(i.types || []).map(t => `<span class="type">${esc(t)}</span>`).join("")}</span>${rarityHtml(i.rarity)}</div>
          <div class="pc-meta"><b class="lcdfont" style="font-size:18px">KK ${pw.kk} · LV ${pw.level}</b>${p.shiny ? `<b style="color:#b0179b">✨ SHINY</b>` : ""}</div>
          ${e.latin ? `<div class="pc-meta"><i>${esc(e.latin)}</i></div>` : ""}
          ${i.description ? `<p class="pc-desc">${esc(i.description)}</p>` : ""}
          ${i.stats ? `<div class="pc-stats">${STATS.map(([k, label]) => `<span>${label}<span class="bar"><i style="width:${clamp(i.stats[k], 0, 10) * 10}%"></i></span></span>`).join("")}</div>` : ""}
          <div class="pc-foot"><span>${esc(e.region ? REGION[e.region].label.toUpperCase() : "")}</span><span>DYREDEX</span></div>
        </div>
        <div class="pc-back">
          <h4>${esc(e.name)}<span>No.${pad(e.no)}</span></h4>
          ${i.stats ? statPanel(e, sp).replace('<span class="spec">Flere billeder og sejre giver XP og højere level.</span>', "") : ""}
          <div class="pc-meta"><span>${rarityHtml(i.rarity, true)}</span>${iucnHtml(i.iucn)}</div>
          ${i.rarityWhy ? `<p>${esc(i.rarityWhy)}</p>` : ""}
          ${i.funFact ? `<p><b>Vidste du?</b> ${esc(i.funFact)}</p>` : ""}
          <dl>
            <dt>Fundet</dt><dd>${esc(fmtDate(p.takenAt || p.createdAt))}${p.place ? `, ${esc(p.place)}` : ""}</dd>
            ${i.size ? `<dt>Størrelse</dt><dd>${esc(i.size)}</dd>` : ""}
            ${i.habitat ? `<dt>Levested</dt><dd>${esc(i.habitat)}</dd>` : ""}
            <dt>Træner</dt><dd>${esc(trainerName(state.viewing))}</dd>
          </dl>
        </div>
        <div class="pc-foil"></div><div class="pc-glare"></div>
      </div>
    </div>
    <p class="small dim" id="card-hint">Træk over kortet for at vippe det${CARD.tiltSeen ? ", eller vip telefonen" : ""}. <button class="btn ghost sm" data-act="flip">Vend kortet</button></p>`;
  }

  function mountCard() {
    const stage = $("#cstage"), card = $("#pcard");
    if (!stage || !card) return;
    const move = ev => {
      const r = card.getBoundingClientRect();
      CARD.tx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      CARD.ty = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
      CARD.active = true;
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerdown", ev => { move(ev); CARD.down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
    const stop = () => { CARD.active = false; };
    stage.addEventListener("pointerleave", stop); stage.addEventListener("pointercancel", stop);
    // A short tap that barely moved turns the card over; a drag only tilts it.
    stage.addEventListener("pointerup", ev => {
      const d = CARD.down; CARD.down = null;
      if (ev.pointerType !== "mouse") stop();
      if (d && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 8 && performance.now() - d.t < 450 && ev.target.closest("#pcard")) CARD.flip = !CARD.flip;
    });
    if (!CARD.raf) CARD.raf = requestAnimationFrame(cardLoop);
  }

  function cardLoop(t) {
    const el = $("#pcard");
    if (!el) { CARD.raf = 0; return; }
    CARD.raf = requestAnimationFrame(cardLoop);
    let tx = CARD.tx, ty = CARD.ty;
    if (CARD.tilt && !CARD.active) { tx = Math.max(-1, Math.min(1, CARD.tilt.g / 25)); ty = Math.max(-1, Math.min(1, (CARD.tilt.b - 45) / 25)); }
    else if (!CARD.active) { if (reducedMotion()) { tx = 0; ty = 0; } else { tx = Math.sin(t / 1500) * .45; ty = Math.cos(t / 2100) * .3; } }
    CARD.ry += (tx - CARD.ry) * .12;
    CARD.rx += (ty - CARD.rx) * .12;
    const target = CARD.flip ? 180 : 0;
    CARD.flipCur = reducedMotion() || Math.abs(target - CARD.flipCur) < 0.5 ? target : CARD.flipCur + (target - CARD.flipCur) * .16;
    el.style.setProperty("--ry", `${(CARD.ry * 16 + CARD.flipCur).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-CARD.rx * 12).toFixed(2)}deg`);
    el.style.setProperty("--px", `${(-CARD.ry * 5).toFixed(2)}%`);
    el.style.setProperty("--py", `${(-CARD.rx * 4).toFixed(2)}%`);
    el.style.setProperty("--mx", `${(50 + CARD.ry * 45).toFixed(1)}%`);
    el.style.setProperty("--my", `${(50 + CARD.rx * 45).toFixed(1)}%`);
    el.style.setProperty("--int", Math.min(1, Math.hypot(CARD.rx, CARD.ry) * 1.2).toFixed(3));
  }

  // Tilt works only where the viewer lets the page read device motion; dragging always works.
  window.addEventListener("deviceorientation", ev => {
    if (ev.gamma == null || ev.beta == null) return;
    CARD.tilt = { g: ev.gamma, b: ev.beta };
    if (!CARD.tiltSeen) { CARD.tiltSeen = true; if (state.viewCard) renderViewer(); }
  });
  function askTilt() {
    try { if (typeof DeviceOrientationEvent?.requestPermission === "function") DeviceOrientationEvent.requestPermission().catch(() => {}); } catch {}
  }

  /* ---------- achievements ---------- */
  const genusOf = latin => String(latin || "").trim().split(/\s+/)[0].toLowerCase();
  const want = (label, latin, genera) => ({ label, latin: (latin || []).map(x => x.toLowerCase()), genera: (genera || []).map(x => x.toLowerCase()) });
  const BIG5 = [
    want("Løve", ["Panthera leo"]), want("Leopard", ["Panthera pardus"]), want("Afrikansk elefant", [], ["Loxodonta"]),
    want("Næsehorn", [], ["Diceros", "Ceratotherium"]), want("Kafferbøffel", ["Syncerus caffer"]),
  ];
  const LEO = want("Leopard", ["Panthera pardus"]);
  const hourOf = ms => new Date(ms).getHours();
  const dayOf = ms => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const SEASONS = [["Forår", [2, 3, 4]], ["Sommer", [5, 6, 7]], ["Efterår", [8, 9, 10]], ["Vinter", [11, 0, 1]]];
  function km(a, b) {
    const R = 6371, r = x => x * Math.PI / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const setOf = (id, icon, name, desc, items) => ({ id, icon, name, desc, items });
  const countOf = (id, icon, name, desc, tiers, value, unit) => ({ id, icon, name, desc, tiers, value, unit });
  const ACH = [
    { group: "Big-sæt", list: [
      setOf("big5", "🦁", "Big 5", "De fem store fra den afrikanske savanne.", BIG5),
      setOf("big7", "🐋", "Big 7", "Big 5 plus de to kæmper i havet ud for Sydafrika.", [...BIG5, want("Hvidhaj", ["Carcharodon carcharias"]), want("Sydkaper", [], ["Eubalaena"])]),
      setOf("little5", "🐞", "Little 5", "De små dyr opkaldt efter Big 5. Svære at få øje på.", [
        want("Elefantspidsmus", [], ["Elephantulus", "Macroscelides", "Rhynchocyon", "Petrodromus", "Petrosaltator", "Galegeeska"]),
        want("Myreløve", [], ["Myrmeleon", "Euroleon", "Palpares", "Hagenomyia", "Distoleon", "Macroleon"]),
        want("Næsehornsbille", [], ["Oryctes", "Dynastes", "Xylotrupes", "Augosoma", "Megasoma", "Golofa"]),
        want("Leopardskildpadde", ["Stigmochelys pardalis"]), want("Bøffelvæver", [], ["Bubalornis", "Dinemellia"])]),
      setOf("ugly5", "🐗", "Ugly 5", "Savannens fem mindst kønne. Elsk dem alligevel.", [
        want("Hyæne", [], ["Crocuta", "Hyaena", "Parahyaena"]), want("Vortesvin", [], ["Phacochoerus"]), want("Gnu", [], ["Connochaetes"]),
        want("Marabustork", ["Leptoptilos crumenifer"]), want("Grib", [], ["Gyps", "Torgos", "Trigonoceps", "Necrosyrtes", "Aegypius", "Neophron", "Gypaetus", "Gypohierax"])]),
      setOf("dk5", "🦌", "Danmarks Big 5", "De store danske naturoplevelser.", [
        want("Krondyr", ["Cervus elaphus"]), want("Sæl", ["Phoca vitulina", "Halichoerus grypus"]), want("Marsvin", ["Phocoena phocoena"]),
        want("Havørn", ["Haliaeetus albicilla"]), want("Odder", ["Lutra lutra"])]),
    ] },
    { group: "Dyregrupper", list: [
      setOf("cats", "🐅", "Kattekongen", "Alle otte store kattedyr.", [want("Løve", ["Panthera leo"]), want("Tiger", ["Panthera tigris"]), LEO,
        want("Gepard", ["Acinonyx jubatus"]), want("Jaguar", ["Panthera onca"]), want("Puma", ["Puma concolor"]), want("Sneleopard", ["Panthera uncia"]), want("Los", [], ["Lynx"])]),
      setOf("apes", "🦍", "Menneskeaber", "Vores nærmeste slægtninge.", [want("Gorilla", [], ["Gorilla"]), want("Chimpanse", [], ["Pan"]),
        want("Borneo-orangutang", ["Pongo pygmaeus"]), want("Sumatra-orangutang", ["Pongo abelii"])]),
      setOf("bears", "🐻", "Bjørnejæger", "Alle bjørnene i Dyredex'en.", [want("Brunbjørn", ["Ursus arctos"]), want("Sortbjørn", ["Ursus americanus"]),
        want("Isbjørn", ["Ursus maritimus"]), want("Malajbjørn", ["Helarctos malayanus"]), want("Kæmpepanda", ["Ailuropoda melanoleuca"])]),
      setOf("giants", "🐘", "Kæmpernes klub", "De største dyr på land og i havet.", [want("Elefant", [], ["Loxodonta", "Elephas"]), want("Giraf", [], ["Giraffa"]),
        want("Næsehorn", [], ["Diceros", "Ceratotherium", "Rhinoceros", "Dicerorhinus"]), want("Blåhval", ["Balaenoptera musculus"]), want("Hvalhaj", ["Rhincodon typus"])]),
      setOf("fossils", "🦖", "Levende fossiler", "Dyr hvis slægt næsten ikke har ændret sig i millioner af år.", [want("Næbdyr", ["Ornithorhynchus anatinus"]),
        want("Gavial", ["Gavialis gangeticus"]), want("Krokodille", [], ["Crocodylus", "Alligator", "Caiman"]), want("Kæmpeskildpadde", [], ["Chelonoidis", "Aldabrachelys"])]),
      countOf("scorp", "🦂", "Skorpionjæger", "Forskellige skorpioner.", [1, 3, 5], c => c.caught.filter(e => /skorpion|scorpion/i.test(`${e.name} ${e.sp.info.nameEn || ""}`)).length),
      countOf("peng", "🐧", "Pingvinparade", "Tre forskellige pingviner.", [3], c => c.caught.filter(e => /pingvin|penguin/i.test(`${e.name} ${e.sp.info.nameEn || ""}`)).length),
    ] },
    { group: "Regioner", list: [
      ...REGIONS.map(r => ({ id: "reg-" + r.id, icon: { dk: "🌳", eu: "🏔️", af: "🌍", as: "🌏", na: "🌎", sa: "🌴", au: "🦘", hav: "🌊" }[r.id], name: r.label,
        desc: "Fang 25 %, 50 % og alle regionens dyr.", region: r.id })),
      { id: "world", icon: "🗺️", name: "Verdensborger", desc: "Mindst ét dyr fra hver region.", itemsFn: c => REGIONS.map(r => ({ label: r.label, done: c.caught.some(e => e.region === r.id) })) },
    ] },
    { group: "Rejser og tid", list: [
      countOf("globe", "✈️", "Globetrotter", "To fund mere end 1.000 km fra hinanden.", [1000], c => c.maxKm, "km"),
      countOf("local", "🏡", "Lokalpatriot", "10 forskellige arter fundet samme sted.", [10], c => c.bestPlace),
      countOf("night", "🦉", "Natugle", "Billeder taget mellem kl. 22 og 4.", [5], c => c.timed.filter(p => { const h = hourOf(p.takenAt); return h >= 22 || h < 4; }).length),
      countOf("dawn", "🌅", "Morgenfrisk", "Et billede taget mellem kl. 4 og 6.", [1], c => c.timed.filter(p => { const h = hourOf(p.takenAt); return h >= 4 && h < 6; }).length),
      { id: "seasons", icon: "🍂", name: "Alle årstider", desc: "Fund i alle fire årstider.", itemsFn: c => SEASONS.map(([label, months]) => ({ label, done: c.timed.some(p => months.includes(new Date(p.takenAt).getMonth())) })) },
      countOf("safari", "🚙", "Safaridag", "Forskellige arter fotograferet samme dag.", [10], c => c.bestDay),
      countOf("xmas", "🎄", "Juledyr", "Et dyr fotograferet juleaften.", [1], c => c.timed.filter(p => { const d = new Date(p.takenAt); return d.getMonth() === 11 && d.getDate() === 24; }).length),
    ] },
    { group: "Samling", list: [
      countOf("collector", "📘", "Samler", "Arter i din Dyredex.", [10, 50, 100], c => c.caught.length),
      countOf("paparazzi", "📸", "Paparazzi", "Billeder i alt.", [25, 100, 250], c => c.photos.length),
      countOf("legend", "💎", "Legendarisk", "Fang et legendarisk dyr.", [1], c => c.caught.filter(e => e.sp.info.rarity === "legendarisk").length),
      countOf("rare", "💠", "Sjældenhedsjæger", "Sjældne, episke og legendariske arter.", [3, 10, 25], c => c.caught.filter(e => rIdx(e.sp.info.rarity) >= 2).length),
      countOf("epic", "🔮", "Episk samler", "Episke eller legendariske arter.", [1, 5], c => c.caught.filter(e => rIdx(e.sp.info.rarity) >= 3).length),
      countOf("shiny", "✨", "Shiny-jæger", "Arter fanget i en sjælden farvevariant.", [1, 3, 10], c => c.caught.filter(e => e.sp.photos.some(p => p.shiny)).length),
      countOf("redlist", "🛟", "Naturbeskytter", "Truede arter (sårbar, truet eller kritisk truet).", [1, 5, 15], c => c.caught.filter(e => ["VU", "EN", "CR", "EW"].includes(e.sp.info.iucn)).length),
      countOf("lvl", "⭐", "Mestertræner", "Højeste level på et af dine dyr.", [10, 20, 35], c => Math.max(0, ...c.caught.map(e => speciesPower(e.sp, state.viewing).level))),
      countOf("explorer", "🧭", "Opdagelsesrejsende", "Bonusdyr uden for kataloget.", [1, 5, 10], c => c.caught.filter(e => e.bonus).length),
    ] },
    { group: "Battle", list: [
      countOf("win1", "🥊", "Første sejr", "Din kæmper (★) vinder en kamp.", [1], c => c.player.wins || 0),
      countOf("wins", "🏆", "Kampveteran", "Sejre i alt.", [5, 25, 100], c => c.player.wins || 0),
      countOf("giant", "🪨", "David mod Goliat", "Vind med en kæmper, der har meget lavere kampkraft end den stærkeste modstander.", [1], c => c.player.giants || 0),
    ] },
    { group: "Daglige missioner", list: [
      countOf("daily", "📅", "Missionær", "Dage hvor alle tre missioner blev klaret.", [1, 7, 30], c => (c.player.daily || []).length),
      countOf("streak", "🔥", "I streg", "Dage i træk med klarede missioner.", [3, 7, 14], c => streakOf(c.player.daily || [])),
    ] },
    { group: "Sjove", list: [
      countOf("spiders", "🕷️", "Ikke bange for edderkopper", "Forskellige edderkoppedyr.", [5], c => c.caught.filter(e => e.cat === "edderkoppedyr").length),
      countOf("poison", "☠️", "Giftskabet", "Dyr af typen Gift.", [5], c => c.caught.filter(e => (e.sp.info.types || []).includes("Gift")).length),
      countOf("cute", "🥰", "Nuttethed 10/10", "Et dyr med maksimal nuttethed.", [1], c => c.caught.filter(e => Number(e.sp.info.stats?.nuttethed) >= 10).length),
      countOf("fast", "⚡", "Lynhurtig", "Et dyr med fart 10.", [1], c => c.caught.filter(e => Number(e.sp.info.stats?.fart) >= 10).length),
    ] },
  ];
  const MEDALS = ["#cd7f32", "#c9ccd1", "#f7c843"];
  const TIER_NAMES = ["Bronze", "Sølv", "Guld"];

  function achContext() {
    const caught = DEX.filter(e => e.sp);
    const photos = state.sightings;
    const timed = photos.filter(p => p.takenAt);
    const geo = [];
    const seen = new Set();
    for (const p of photos) if (p.geo) { const k = `${p.geo.lat.toFixed(2)},${p.geo.lon.toFixed(2)}`; if (!seen.has(k)) { seen.add(k); geo.push(p.geo); } }
    let maxKm = 0;
    for (let a = 0; a < geo.length; a++) for (let b = a + 1; b < geo.length; b++) maxKm = Math.max(maxKm, km(geo[a], geo[b]));
    const byPlace = new Map(), byDay = new Map();
    for (const p of photos) {
      const pk = p.geo ? `${p.geo.lat.toFixed(2)},${p.geo.lon.toFixed(2)}` : String(p.place || "").trim().toLowerCase();
      if (pk) { if (!byPlace.has(pk)) byPlace.set(pk, new Set()); byPlace.get(pk).add(p.key); }
      if (p.takenAt) { const dk = dayOf(p.takenAt); if (!byDay.has(dk)) byDay.set(dk, new Set()); byDay.get(dk).add(p.key); }
    }
    const most = m => Math.max(0, ...[...m.values()].map(x => x.size));
    return { caught, photos, timed, maxKm: Math.round(maxKm), bestPlace: most(byPlace), bestDay: most(byDay), player: state.players.get(state.viewing) || {} };
  }

  function evalAch(a, c) {
    if (a.items) {
      const items = a.items.map(w => {
        const hit = c.caught.find(e => w.latin.includes(String(e.latin || "").toLowerCase()) || w.genera.includes(genusOf(e.latin)));
        return { label: w.label, done: !!hit, who: hit?.name };
      });
      const value = items.filter(x => x.done).length;
      return { value, tiers: [items.length], items };
    }
    if (a.itemsFn) { const items = a.itemsFn(c); return { value: items.filter(x => x.done).length, tiers: [items.length], items }; }
    if (a.region || a.dexId) {
      const list = DEX.filter(e => inRegion(e, a.dexId ? "x:" + a.dexId : a.region));
      const n = list.length;
      return { value: list.filter(e => e.sp).length, tiers: [Math.ceil(n * .25), Math.ceil(n * .5), n] };
    }
    return { value: a.value(c), tiers: a.tiers, unit: a.unit };
  }

  function allAch() {
    const c = achContext();
    const groups = state.dexes.length
      ? [...ACH.slice(0, 3), { group: "Rejse-dexer", list: state.dexes.map(d => ({ id: "dex-" + d.id, icon: "✈️", name: d.name, desc: "Fang 25 %, 50 % og alle rejse-dexens dyr.", dexId: d.id })) }, ...ACH.slice(3)]
      : ACH;
    return groups.map(g => ({ group: g.group, list: g.list.map(a => { const r = evalAch(a, c); return { ...a, ...r, level: r.tiers.filter(t => r.value >= t).length }; }) }));
  }

  function medalOf(a) {
    if (!a.level) return "";
    return a.tiers.length === 1 ? MEDALS[2] : MEDALS[a.level - 1 + (3 - a.tiers.length)];
  }
  const tierName = a => a.tiers.length > 1 && a.level ? TIER_NAMES[a.level - 1 + (3 - a.tiers.length)] : "";

  function renderBadges(groups) {
    groups = groups || allAch();
    let got = 0, total = 0;
    for (const g of groups) for (const a of g.list) { got += a.level; total += a.tiers.length; }
    $("#badge-count").textContent = `${got}/${total}`;
    const el = $("#badges");
    if (state.tab !== "badges") return;
    el.innerHTML = groups.map(g => `<section class="b-group"><h3>${esc(g.group.toUpperCase())}</h3><div class="b-grid">${g.list.map(a => {
      const next = a.tiers.find(t => a.value < t) ?? a.tiers[a.tiers.length - 1];
      const pct = Math.min(100, a.value / next * 100);
      const done = a.level === a.tiers.length;
      const unit = a.unit ? ` ${a.unit}` : "";
      return `<article class="badge${a.level ? " on" : ""}${done ? " done" : ""}" ${a.level ? `style="--medal:${medalOf(a)}"` : ""}>
        <div class="b-icon"><span class="${a.level ? "" : "sil"}" aria-hidden="true">${a.icon}</span>${tierName(a) ? `<span class="b-tier">${tierName(a).toUpperCase()}</span>` : ""}</div>
        <div style="min-width:0">
          <h4>${esc(a.name)}</h4>
          <p>${esc(a.desc)}</p>
          <div class="b-prog"><span class="meter"><i style="width:${pct}%"></i></span><span>${Math.min(a.value, next)}${unit}/${next}${unit}</span></div>
          ${a.items ? `<ul class="b-items">${a.items.map(x => `<li class="${x.done ? "done" : ""}" ${x.who && x.who !== x.label ? `title="${esc(x.who)}"` : ""}>${esc(x.label)}</li>`).join("")}</ul>` : ""}
        </div>
      </article>`;
    }).join("")}</div></section>`).join("");
  }

  // Celebrates badges that became unlocked since this browser last looked, once the collection has loaded.
  function checkBadges(groups) {
    if (!state.loaded || !isMine()) return;
    const cur = [];
    const byId = {};
    for (const g of groups || allAch()) for (const a of g.list) { byId[a.id] = a; for (let l = 1; l <= a.level; l++) cur.push(`${a.id}:${l}`); }
    const raw = store.get("dyredex-badges");
    store.set("dyredex-badges", cur.join(","));
    if (raw === null) return;
    const before = new Set(raw.split(",").filter(Boolean));
    const fresh = cur.filter(k => !before.has(k)).map(k => byId[k.split(":")[0]]);
    const unique = [...new Map(fresh.map(a => [a.id, a])).values()];
    if (!unique.length) return;
    if (state.import && !state.import.finished) state.pendingBadges.push(...unique);
    else celebrateBadges(unique);
  }

  /* ---------- EXIF: GPS position and capture time, read from the original file ---------- */
  async function readExif(file) {
    try {
      const v = new DataView(await file.slice(0, 1024 * 1024).arrayBuffer());
      let tiff = -1;
      if (v.getUint16(0) === 0xFFD8) {
        let o = 2;
        while (o + 10 <= v.byteLength) {
          const m = v.getUint16(o);
          if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
          if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) { tiff = o + 10; break; }
          o += 2 + v.getUint16(o + 2);
        }
      } else if (v.getUint32(0) === 0x52494646 && v.getUint32(8) === 0x57454250) {
        let o = 12;
        while (o + 8 <= v.byteLength) {
          const size = v.getUint32(o + 4, true);
          if (v.getUint32(o) === 0x45584946) { tiff = o + 8; if (v.getUint32(tiff) === 0x45786966) tiff += 6; break; }
          o += 8 + size + (size & 1);
        }
      }
      if (tiff < 0) return null;
      const le = v.getUint16(tiff) === 0x4949;
      const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
      const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      const ifd = start => {
        const out = {};
        for (let i = 0, n = u16(start); i < n; i++) { const e = start + 2 + i * 12; out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 }; }
        return out;
      };
      const where = t => (SIZES[t.type] || 1) * t.count <= 4 ? t.at : tiff + u32(t.at);
      const ascii = t => { let s = ""; const p = where(t); for (let i = 0; i < t.count; i++) { const c = v.getUint8(p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
      const rats = t => { const p = where(t), r = []; for (let i = 0; i < t.count; i++) r.push(u32(p + i * 8) / (u32(p + i * 8 + 4) || 1)); return r; };
      const ifd0 = ifd(tiff + u32(tiff + 4));
      const res = { geo: null, takenAt: null };
      let date = "";
      if (ifd0[0x8769]) { const ex = ifd(tiff + u32(ifd0[0x8769].at)); const t = ex[0x9003] || ex[0x9004]; if (t) date = ascii(t); }
      if (!date && ifd0[0x0132]) date = ascii(ifd0[0x0132]);
      const m = date.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
      if (m) res.takenAt = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime() || null;
      if (ifd0[0x8825]) {
        const g = ifd(tiff + u32(ifd0[0x8825].at));
        if (g[2] && g[4]) {
          const deg = r => r[0] + (r[1] || 0) / 60 + (r[2] || 0) / 3600;
          let lat = deg(rats(g[2])), lon = deg(rats(g[4]));
          if (g[1] && ascii(g[1]).startsWith("S")) lat = -lat;
          if (g[3] && ascii(g[3]).startsWith("W")) lon = -lon;
          if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon))
            res.geo = { lat: +lat.toFixed(5), lon: +lon.toFixed(5) };
        }
      }
      return res;
    } catch { return null; }
  }

  async function compress(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("encode")), "image/jpeg", 0.85));
    } finally { URL.revokeObjectURL(url); }
  }

  // The model sees every image scaled to about 1.2 megapixels, so a small animal in a wide photo is only a few pixels.
  // Cutting the animal out of the full-resolution original gives it several times more detail to judge from.
  function cleanBox(b) {
    if (!Array.isArray(b) || b.length !== 4) return null;
    const [x0, y0, x1, y1] = b.map(Number);
    if (![x0, y0, x1, y1].every(v => Number.isFinite(v) && v >= -0.02 && v <= 1.02)) return null;
    const box = [Math.max(0, x0), Math.max(0, y0), Math.min(1, x1), Math.min(1, y1)];
    return box[2] - box[0] >= 0.03 && box[3] - box[1] >= 0.03 ? box.map(v => +v.toFixed(3)) : null;
  }
  const boxArea = b => (b[2] - b[0]) * (b[3] - b[1]);
  async function cropBlob(src, box) {
    const url = URL.createObjectURL(src);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
      const W = img.naturalWidth, H = img.naturalHeight, pad = 0.2;
      const bw = box[2] - box[0], bh = box[3] - box[1];
      const x0 = Math.max(0, box[0] - bw * pad) * W, y0 = Math.max(0, box[1] - bh * pad) * H;
      const x1 = Math.min(1, box[2] + bw * pad) * W, y1 = Math.min(1, box[3] + bh * pad) * H;
      const sw = Math.max(16, x1 - x0), sh = Math.max(16, y1 - y0), sc = Math.min(1, 1280 / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(sw * sc)); c.height = Math.max(1, Math.round(sh * sc));
      c.getContext("2d").drawImage(img, x0, y0, sw, sh, 0, 0, c.width, c.height);
      return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("encode")), "image/jpeg", 0.9));
    } finally { URL.revokeObjectURL(url); }
  }
  // Older answers listed "alternatives"; newer ones list the candidates the model weighed, best first.
  function normResult(r) {
    if (r && typeof r === "object" && !Array.isArray(r.alternatives))
      r.alternatives = (Array.isArray(r.candidates) ? r.candidates : []).filter(c => c && c.name && keyFor(c) !== keyFor(r)).slice(0, 3);
    return r;
  }
  const needsCloser = d => !!d && !d.noAnimal && !d.notReal && !!d.name && ((d.confidence || 0) < 0.75 || ["slægt", "familie"].includes(d.specificity));
  const SETTING_NOTE = {
    vild: "Dyret er fotograferet vildt i naturen, så arten skal kunne forekomme vildt på stedet.",
    zoo: "Dyret er fotograferet i en zoo, et akvarium eller en dyrepark. Se derfor bort fra, hvor billedet er taget: arten kan komme fra hele verden.",
    hjem: "Det er et kæledyr eller husdyr. Angiv race, hvis den kan ses.",
  };

  /* ---------- AI prompt ---------- */
  function buildPrompt({ geo, takenAt, place, previous, setting, images }) {
    const ctx = [];
    if (setting !== "zoo") {
      if (geo) ctx.push(`Billedet er taget ved GPS-koordinaterne ${geo.lat}, ${geo.lon}.`);
      else if (place) ctx.push(`Brugeren oplyser, at billedet er taget her: ${place}.`);
    }
    if (takenAt) { const t = new Date(takenAt); ctx.push(`Det er taget ${fmtDate(takenAt)} kl. ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}, så tænk på årstiden og på, om dyret er dag- eller nataktivt.`); }
    if (SETTING_NOTE[setting]) ctx.push(SETTING_NOTE[setting]);
    const many = !!images && (images.length > 1 || images[0] !== "hele billedet");
    const catalog = CATALOG.map(c => `${c.name} (${c.latin})`).join("; ");
    const bonus = DEX.filter(e => e.bonus).map(e => `${e.name} (${e.latin || "?"})`).join("; ");
    return `Du er motoren i en "Dyredex": en Pokédex for rigtige dyr, som brugeren selv har fotograferet.
Identificér det dyr, der er hovedmotivet. Husdyr, kæledyr og dyr i zoo og akvarier tæller også.
${many ? `\nDu får ${images.length === 1 ? "ét billede" : `${images.length} billeder af SAMME dyr i denne rækkefølge`}: ${images.map((t, n) => `${n + 1}) ${t}`).join("; ")}. Brug nærbilleder til detaljerne og hele billedet til omgivelser og størrelse.\n` : ""}
Tjek FØRST, om det er et ÆGTE dyr af kød og blod, fotograferet i virkeligheden. Det tæller IKKE som ægte:
statuer, skulpturer, figurer, legetøj, bamser, kostumer, tegninger, malerier, graffiti, mosaikker, udstoppede dyr, skeletter, fossiler,
og dyr der kun ses på en skærm, plakat, skilt, i en bog eller på et andet foto. Kig efter tegn som ens farve og overflade (sten, metal, plastik, træ, gips),
en sokkel, mangel på pels- eller hudstruktur, unaturlige proportioner, stive poser og glasøjne. Er du i tvivl, så sæt "isReal" til false og forklar hvorfor.

Arbejd som en feltbiolog, i denne rækkefølge:
1. Beskriv, hvad du faktisk kan se på dyret ("seen"). Gæt ikke på detaljer, du ikke kan se.
2. Opstil de 2-3 mest sandsynlige arter ("candidates"), og skriv for hver, hvad der taler for og imod.
3. Vælg den bedste. Bestem arten, og underart eller race hvis den kan ses (fx hunde-, katte-, heste- og hønseracer).
Skriv aldrig bare en gruppe som "skorpion", "edderkop", "bille" eller "orangutang", hvis du kan vurdere den konkrete art.
Kan de kendetegn, der skiller arten fra dens nærmeste forvekslingsarter, ikke ses på billedet, så vælg den mest sandsynlige art, men sæt "confidence" lavt. Brug kun slægt eller familie, hvis billedet slet ikke gør det muligt at skelne.
${ctx.length ? `\n${ctx.join(" ")}\n${setting === "zoo" ? "" : "Brug sted og tidspunkt til at vurdere, hvilke arter der realistisk lever der, men stol mest på billedet: dyr i zoo, akvarier og hjem kan være eksotiske.\n"}` : ""}${previous ? `\nEt første bud var: ${previous.name} (${previous.latin || "?"})${previous.cands ? `, med disse andre kandidater: ${previous.cands}` : ""}. Det bud var usikkert. Tjek nu grundigt de kendetegn, der skiller kandidaterne ad (farve, mønster, kropsform, proportioner, hale, klør, ben, følehorn), og ret buddet, hvis det er forkert eller for upræcist. Du må gerne ende på en helt anden art.\n` : ""}
Svar KUN med ét JSON-objekt i præcis dette format og denne rækkefølge:
{
  "seen": "1-2 sætninger om hvad du konkret kan se: farver, mønstre, kropsform, ben, følehorn, hale og størrelsen i forhold til omgivelserne",
  "candidates": de 2-3 mest sandsynlige arter, bedste først: [{"name": "dansk navn", "latin": "videnskabeligt navn", "for": "kendetegn på billedet der taler for", "against": "hvad der taler imod, eller hvad man skulle kunne se for at være sikker"}],
  "box": [x0, y0, x1, y1] for en ramme tæt omkring dyret i ${many && images.length > 1 ? `billede nr. ${Math.max(1, images.indexOf("hele billedet") + 1)}` : "billedet"}, som tal fra 0 til 1, hvor [0, 0] er øverste venstre hjørne,
  "isAnimal": true,
  "isReal": true eller false (false hvis det er en statue, figur, tegning, udstoppet dyr, skærmbillede osv.),
  "fake": "hvis isReal er false: kort beskrivelse på dansk af hvad det er, fx 'statue af en giraf i bronze' (ellers tom streng)",
  "name": "dansk navn på arten med stort forbogstav, fx Gul tykhalet skorpion",
  "nameEn": "engelsk navn",
  "latin": "videnskabeligt navn på artsniveau, fx Androctonus australis",
  "specificity": en af ${JSON.stringify(LEVELS)} (det niveau dit navn er på),
  "confidence": tal mellem 0 og 1 for, at netop ARTEN er rigtig. Vær ærlig: brug højst 0.6, hvis de afgørende kendetegn ikke kan ses tydeligt, og over 0.85 kun når arten ikke kan forveksles,
  "idTips": "1 sætning om hvilke kendetegn på billedet der peger på netop denne art frem for lignende arter",
  "category": en af ${JSON.stringify(CATS.map(c => c.id))},
  "region": en af ${JSON.stringify(REGIONS.map(r => r.id))} (hvor arten naturligt lever; "dk" hvis den lever vildt i Danmark, "hav" for havdyr og polardyr),
  "types": 1-2 værdier fra ${JSON.stringify(TYPES)},
  "rarity": en af ${JSON.stringify(RARITY)}: hvor sjældent arten ses i naturen på verdensplan (bestandens størrelse, hvor truet den er, og hvor sky og skjult den lever), IKKE hvor billedet er taget. "almindelig" = husdyr, kæledyr, byfugle og meget almindelige vilde arter; "usædvanlig" = vilde dyr man ser af og til; "sjælden" = sky, skjulte eller meget lokale arter; "episk" = truede arter eller dyr der er meget svære at opleve; "legendarisk" = kritisk truede arter eller dyr der næsten aldrig ses i naturen,
  "rarityWhy": "1 kort sætning om hvorfor arten har den sjældenhed, fx 'Kritisk truet; kun omkring 14.000 tilbage på Sumatra'",
  "iucn": IUCN-rødlistestatus, en af ["LC","NT","VU","EN","CR","EW","DD"] (tom streng for husdyr og kæledyr),
  "shiny": true KUN hvis netop dette individ har en usædvanlig farvevariant for arten (albino, leucistisk/bleg, melanistisk/sort eller et meget usædvanligt mønster); ellers false. Almindelig forskel på han/hun, unger eller årstidsdragt tæller ikke,
  "variant": "hvis shiny: kort beskrivelse, fx 'leucistisk, næsten hvid pels'; ellers tom streng",
  "description": "2 korte sætninger på dansk i Pokédex-stil om dyret",
  "funFact": "1 overraskende fakta på dansk",
  "size": "typisk størrelse/vægt, kort",
  "habitat": "hvor det lever, kort",
  "place": ${geo ? `"kort stednavn ud fra koordinaterne, fx 'Dyrehaven, Klampenborg, Danmark'"` : `""`},
  "stats": {"fart": 1-10, "styrke": 1-10, "snilde": 1-10, "nuttethed": 1-10}
}
Hvis der ikke er noget dyr på billedet: {"isAnimal": false}.

Dyredex-katalog. Hvis arten står her, så brug PRÆCIS samme navn og latinske navn som i listen:
${catalog}${bonus ? `\n\nBrugeren har også fanget disse arter uden for kataloget (brug samme navne, hvis det er en af dem): ${bonus}` : ""}`;
  }

  function toDraft(r, fallbackPlace, hasGeo) {
    const place = hasGeo ? (String(r?.place || "").trim() || fallbackPlace) : fallbackPlace;
    if (!r || r.isAnimal === false) return { name: "", latin: "", category: "andet", place, noAnimal: true };
    const catKey = slug(r.category).replace(/-/g, "");
    const d = {
      name: String(r.name || "").trim(), nameEn: String(r.nameEn || "").trim(), latin: String(r.latin || "").trim(),
      category: CAT[catKey] ? catKey : "andet",
      region: REGION[r.region] ? r.region : "",
      specificity: LEVELS.includes(r.specificity) ? r.specificity : "",
      types: (Array.isArray(r.types) ? r.types : []).map(String).filter(t => TYPES.includes(t)).slice(0, 2),
      rarity: RARITY.includes(r.rarity) ? r.rarity : "almindelig",
      description: String(r.description || "").trim(), funFact: String(r.funFact || "").trim(),
      size: String(r.size || "").trim(), habitat: String(r.habitat || "").trim(), idTips: String(r.idTips || "").trim(),
      stats: Object.fromEntries(STATS.map(([k]) => [k, clamp(r.stats?.[k], 1, 10)])),
      confidence: clamp(r.confidence, 0, 1), place,
      notReal: r.isReal === false, fake: String(r.fake || "").trim(),
      rarityWhy: String(r.rarityWhy || "").trim(), iucn: IUCN[r.iucn] ? r.iucn : "",
      shiny: r.shiny === true, variant: r.shiny === true ? String(r.variant || "").trim() : "",
      box: cleanBox(r.box),
    };
    const cat = CATALOG_BY_KEY.get(keyFor(d));
    if (cat) Object.assign(d, { name: cat.name, latin: cat.latin, region: cat.region, category: cat.cat });
    return d;
  }

  const DISABLED = ["not_granted", "sampling_disabled", "images_unavailable", "not_declared", "capability_disabled", "capability_removed"];
  function aiError(code) {
    if (DISABLED.includes(code)) return "AI-genkendelse er slået fra her, så skriv selv hvilket dyr det er.";
    if (code === "rate_limited") return "Du har scannet mange billeder på kort tid. Vent lidt og prøv igen.";
    if (code === "image_rejected") return "AI'en kunne ikke læse billedet. Prøv et andet billede.";
    if (code === "refused") return "AI'en ville ikke vurdere dette billede.";
    if (code === "invalid_json") return "Svaret fra AI'en kunne ikke læses. Prøv igen.";
    if (code === "bad_key") return "API-nøglen virker ikke. Tjek den under Trænere → Indstillinger.";
    if (code === "bad_request") return "Anthropic afviste forespørgslen. Tjek at din API-konto har kredit, og prøv igen.";
    return "Forbindelsen til AI'en fejlede. Prøv igen.";
  }

  /* ---------- scanning queue ---------- */
  const scanningState = it => ["scanning", "closer", "prep", "starting"].includes(it.status);

  function renderTrayHead() {
    const shown = state.queue.filter(i => !i.hidden);
    const ready = shown.filter(i => i.status === "ready").length;
    const busy = state.queue.some(scanningState);
    const imp = state.import;
    $("#lens").classList.toggle("busy", busy);
    $("#tray").hidden = !shown.length && !imp;
    let html = "";
    if (imp) {
      const pct = imp.total ? imp.done / imp.total * 100 : 0;
      html += `<div class="imp" style="flex-basis:100%">
        <div class="row"><span>ALBUM-IMPORT ${imp.done}/${imp.total}${imp.finished ? " · FÆRDIG" : imp.paused ? " · PAUSE" : " · SCANNER…"}</span>
          ${imp.paused && !imp.finished ? `<button class="btn sm" data-act="imp-resume">Fortsæt import</button>` : ""}
          ${imp.finished ? `<button class="btn ghost-dark sm" data-act="imp-close">Luk</button>` : `<button class="btn ghost-dark sm" data-act="imp-stop">Stop import</button>`}</div>
        <span class="meter"><i style="width:${pct}%"></i></span>
        <div class="row"><span>${imp.added.length} NYE ARTER</span><span>${imp.skipped} KENDTE SPRUNGET OVER</span>${imp.dupes ? `<span>${imp.dupes} ALLEREDE IMPORTERET</span>` : ""}<span>${imp.none} UDEN DYR</span>${imp.fake ? `<span>${imp.fake} IKKE ÆGTE DYR</span>` : ""}<span>${imp.review} TIL GENNEMSYN</span></div>
        ${imp.paused && !imp.finished ? `<span style="font-size:17px;opacity:.85">Du har scannet mange billeder på kort tid. Vent et par minutter, og tryk så Fortsæt import.</span>` : ""}
      </div>`;
    }
    if (shown.length) html += `<span class="grow">${imp ? "TIL GENNEMSYN" : "SCANNER"} · ${shown.length} ${shown.length === 1 ? "BILLEDE" : "BILLEDER"}${busy && !imp ? " · ANALYSERER…" : ""}</span>` +
      (ready > 1 ? `<button class="btn sm" data-act="save-all">Registrér alle ${ready}</button>` : "") +
      (shown.length > 1 ? `<button class="btn ghost-dark sm" data-act="clear">Ryd</button>` : "");
    $("#tray-head").innerHTML = html;
  }

  function statusHtml(it) {
    const d = it.draft;
    const key = keyFor(d);
    const caught = key && caughtMap().has(key);
    const e = key && entryByKey(key);
    let s = "";
    if (it.status === "prep" || it.status === "starting") s = "<span>I KØ…</span>";
    else if (it.status === "scanning") s = "<span>ANALYSERER BILLEDET…</span>";
    else if (it.status === "closer") s = "<span>USIKKER · KIGGER NÆRMERE PÅ DYRET…</span>";
    else if (it.status === "saving") s = "<span>GEMMER…</span>";
    else if (it.status === "paused") s = `<span class="tag warn">PAUSE</span>`;
    else if (d.noAnimal) s = `<span class="tag warn">INTET DYR FUNDET</span>`;
    else if (d.notReal) s = `<span class="tag warn">IKKE ET ÆGTE DYR</span>`;
    else if (it.status === "ready" && it.result && needsCloser(d)) s = `<span class="tag warn">USIKKER</span>` + (caught ? `<span>LIGNER No.${pad(e.no)}</span>` : "");
    else if (caught) s = `<span class="tag known">ALLEREDE FANGET · No.${pad(e.no)}</span>`;
    else if (e) s = `<span class="tag new">NYT DYR · No.${pad(e.no)}</span>`;
    else if (d.name) s = `<span class="tag bonus">NYT BONUSDYR</span>`;
    else s = "<span>SKRIV HVILKET DYR DET ER</span>";
    if (it.status === "ready" && it.result && !d.noAnimal && !d.notReal) {
      const pct = Math.round((d.confidence || 0) * 100);
      s += `<span>SIKKER <span class="conf"><i style="width:${pct}%"></i></span> ${pct}%</span>`;
      if (d.specificity && d.specificity !== "art") s += `<span>NIVEAU: ${esc(d.specificity.toUpperCase())}</span>`;
    }
    if (it.exif !== undefined && !scanningState(it)) {
      s += it.exif?.geo ? `<span class="pin ok">GPS</span>` : `<span class="pin">INGEN GPS</span>`;
      const setting = { vild: "VILDT", zoo: "ZOO", hjem: "KÆLEDYR" }[$("#setting").value];
      if (setting) s += `<span>${setting}</span>`;
      if (it.exif?.takenAt) s += `<span>${esc(fmtDate(it.exif.takenAt).toUpperCase())}</span>`;
    }
    return s;
  }

  function itemHtml(it) {
    const d = it.draft;
    const editable = it.status === "ready" || it.status === "paused";
    const scanning = scanningState(it);
    const alts = (it.result?.alternatives || []).filter(a => a && a.name);
    const caught = caughtMap().has(keyFor(d));
    return `<div class="shot${scanning ? " scanning" : ""}"><img src="${esc(urlOf(it))}" alt="Dit billede"></div>
      <div class="scan-body">
        <div class="status">${statusHtml(it)}</div>
        ${scanning ? `<p class="small dim">AI'en kigger på billedet. Det tager typisk 5–30 sekunder.</p>
          <div class="actions"><button class="btn ghost sm" data-act="discard">Annullér</button></div>` : `
        <div class="fields">
          <div class="field"><label for="n-${it.id}">Navn</label><input class="name" id="n-${it.id}" data-k="name" value="${esc(d.name)}" placeholder="Fx Rødræv" ${editable ? "" : "disabled"}></div>
          <div class="field"><label for="l-${it.id}">Latinsk navn</label><input class="latin" id="l-${it.id}" data-k="latin" value="${esc(d.latin)}" placeholder="Fx Vulpes vulpes" ${editable ? "" : "disabled"}></div>
          <div class="field"><label for="c-${it.id}">Gruppe</label><select id="c-${it.id}" data-k="category" ${editable ? "" : "disabled"}>${CATS.map(c => `<option value="${c.id}" ${d.category === c.id ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select></div>
          <div class="field"><label for="p-${it.id}">Sted</label><input id="p-${it.id}" data-k="place" value="${esc(d.place)}" placeholder="Hvor er billedet taget?" ${editable ? "" : "disabled"}></div>
        </div>
        ${(it.extra || []).length ? `<div class="xthumbs">${it.extra.map(x => `<img src="${esc(x.url)}" alt="">`).join("")}<span>${it.extra.length} ekstra ${it.extra.length === 1 ? "billede" : "billeder"} af samme dyr</span></div>` : ""}
        ${alts.length ? `<div class="alts"><span>Eller måske:</span>${alts.map((a, n) => `<button data-alt="${n}">${esc(a.name)}</button>`).join("")}</div>` : ""}
        ${alts.some(a => a.against) && needsCloser(d) ? `<p class="altwhy">${alts.filter(a => a.against).slice(0, 2).map(a => `<b>${esc(a.name)}:</b> ${esc(a.against)}`).join(" ")}</p>` : ""}
        ${it.closer ? `<p class="altwhy">Tjekket en ekstra gang på et nærbillede af dyret.</p>` : ""}
        ${it.status === "ready" && it.result && needsCloser(d) && !d.notReal ? `<p class="altwhy">Et billede mere fra en anden vinkel gør AI'en mere sikker.</p>` : ""}
        ${d.notReal ? `<p class="small"><strong>Det ligner ${esc(d.fake || "en efterligning af et dyr")}.</strong> Kun ægte dyr kan registreres. Statuer, figurer, legetøj, tegninger, udstoppede dyr og dyr på skærme tæller ikke.</p>` : ""}
        ${!d.notReal && d.idTips ? `<p class="small"><strong>Kendetegn:</strong> ${esc(d.idTips)}</p>` : ""}
        ${it.error ? `<p class="err">${esc(it.error)}</p>` : ""}
        <div class="actions">
          ${it.status === "paused" ? `<button class="btn blue sm" data-act="retry">Scan igen</button>` : ""}
          ${it.status === "ready" && !d.notReal ? `<button class="btn" data-act="save" ${state.canAdd ? "" : "disabled"}>${caught ? "Tilføj billede" : "Registrér i Dyredex"}</button>` : ""}
          ${it.status === "ready" && d.notReal ? `<button class="btn ghost sm" data-act="real">Det er et ægte dyr</button>` : ""}
          ${it.status === "ready" && state.vision && state.maxImages >= 2 && (it.extra || []).length < 3 ? `<button class="btn ghost sm" data-act="more">+ Flere billeder af dyret</button>` : ""}
          ${it.status === "ready" && state.vision ? `<button class="btn ghost sm" data-act="rescan">Scan igen</button>` : ""}
          <button class="btn ghost sm" data-act="discard" ${it.status === "saving" ? "disabled" : ""}>Kassér</button>
        </div>`}
      </div>`;
  }

  function renderItem(it) {
    if (it.hidden) { renderTrayHead(); return; }
    let el = document.getElementById("it-" + it.id);
    if (!el) {
      el = document.createElement("article");
      el.className = "scan"; el.id = "it-" + it.id; el.dataset.id = it.id;
      $("#queue").append(el);
    }
    el.innerHTML = itemHtml(it);
    renderTrayHead();
  }
  function removeItem(it, keepUrl) {
    state.queue = state.queue.filter(i => i !== it);
    it.ctl?.abort();
    document.getElementById("it-" + it.id)?.remove();
    if (!keepUrl && it.url) URL.revokeObjectURL(it.url);
    if (!keepUrl) for (const x of it.extra || []) URL.revokeObjectURL(x.url);
    renderTrayHead();
  }
  function refreshQueueStatus() {
    for (const it of state.queue) {
      const st = document.querySelector(`#it-${it.id} .status`);
      if (st) st.innerHTML = statusHtml(it);
    }
  }

  function addFiles(files, auto) {
    ensureMine();
    closeSheet();
    if (!state.canAdd) { toast("Kun ejeren af denne Dyredex kan registrere dyr"); return; }
    const imgs = [...files].filter(f => f && /^image\//.test(f.type || ""));
    if (!imgs.length) { toast("Vælg et billede (JPG, PNG, WebP eller GIF)"); return; }
    if (auto && !state.vision) { auto = false; toast("AI-genkendelse er ikke tilgængelig, så hvert billede skal navngives"); }
    if (auto) {
      if (!state.import || state.import.finished) state.import = { total: 0, done: 0, added: [], skipped: 0, dupes: 0, none: 0, fake: 0, review: 0, paused: false, finished: false };
      state.import.total += imgs.length;
    }
    for (const f of imgs) {
      const it = { id: ++uid, file: f, url: null, sig: fileSig(f), status: "prep", auto: !!auto, hidden: !!auto, draft: { name: "", latin: "", category: "andet", place: "" } };
      state.queue.push(it); renderItem(it);
    }
    renderTrayHead();
    $("#tray").scrollIntoView({ block: "nearest" });
    pump();
  }

  // Two scans run at once; the platform queues a few more and rejects floods.
  let active = 0;
  function pump() {
    while (active < 2) {
      const it = state.queue.find(i => i.status === "prep");
      if (!it) break;
      active++;
      it.status = "starting";
      scanItem(it).catch(() => {}).finally(() => { active--; pump(); });
    }
    renderTrayHead();
    finishImportIfDone();
  }

  /* ---------- album import: decides on its own when it can ---------- */
  function autoDone(it, kind) {
    if (state.import) { state.import[kind]++; state.import.done++; }
    removeItem(it);
  }
  function toReview(it) {
    if (!it.auto) return;
    it.auto = false; it.hidden = false;
    if (it.status === "starting" || it.status === "scanning") it.status = "ready";
    if (state.import) { state.import.review++; state.import.done++; }
    renderItem(it);
  }
  async function autoDecide(it) {
    const d = it.draft, key = keyFor(d);
    if (d.noAnimal || !d.name) return autoDone(it, "none");
    if (d.notReal) return autoDone(it, "fake");
    if (caughtMap().has(key) || importKeys.has(key)) return autoDone(it, "skipped");
    const sure = (d.confidence || 0) >= 0.75 && ["art", "underart", "race", ""].includes(d.specificity || "");
    if (!sure) return toReview(it);
    importKeys.add(key);
    const cat = CATALOG_BY_KEY.get(key);
    if (await saveItem(it, true)) {
      if (state.import) { state.import.added.push({ key, name: cat ? cat.name : d.name }); state.import.done++; }
    } else { importKeys.delete(key); toReview(it); }
  }
  function finishImportIfDone() {
    const imp = state.import;
    if (!imp || imp.finished || imp.done < imp.total) return;
    imp.finished = true;
    renderTrayHead();
    toast(`Import færdig: ${imp.added.length} nye arter, ${imp.skipped} kendte sprunget over`);
    const badges = [...new Map(state.pendingBadges.splice(0).map(a => [a.id, a])).values()];
    if (imp.added.length) importSummary(imp);
    if (badges.length) celebrateBadges(badges);
  }

  async function scanItem(it) {
    it.error = "";
    if (it.auto && (importSigs.has(it.sig) || state.sightings.some(x => x.fileSig === it.sig))) { autoDone(it, "dupes"); return; }
    if (it.exif === undefined) it.exif = await readExif(it.file);
    if (!it.exif?.geo && !it.draft.place) it.draft.place = $("#default-place").value.trim();
    if (it.exif?.geo && !it.draft.place) it.draft.place = `${it.exif.geo.lat.toFixed(4)}, ${it.exif.geo.lon.toFixed(4)}`;
    try { it.blob = it.blob || await compress(it.file); }
    catch {
      it.status = "ready"; it.blob = null;
      it.error = "Billedet kunne ikke åbnes. Prøv et JPG eller PNG (iPhone: Indstillinger → Kamera → Formater → Mest kompatibel).";
      if (it.auto) toReview(it); else renderItem(it);
      return;
    }
    if (!state.sample || !state.vision) { it.status = "ready"; if (it.auto) toReview(it); else renderItem(it); return; }
    it.status = "scanning"; renderItem(it);
    it.ctl = new AbortController();
    try {
      const base = { geo: it.exif?.geo, takenAt: it.exif?.takenAt, place: it.draft.place, setting: $("#setting").value };
      const extra = (it.extra || []).slice(0, Math.max(0, state.maxImages - 1));
      const imgs = [it.blob, ...extra.map(x => x.blob)], notes = ["hele billedet", ...extra.map(() => "endnu et billede af dyret fra en anden vinkel")];
      const r = normResult(await state.sample.json(buildPrompt({ ...base, images: notes }), { images: imgs, signal: it.ctl.signal, cache: false }));
      if (!state.queue.includes(it)) return;
      it.result = r; it.closer = false;
      it.draft = toDraft(r, it.draft.place, !!it.exif?.geo);
      // Second look, only when the first was unsure and the animal is small in the frame: same model, far more pixels on the animal.
      const box = it.draft.box;
      if (needsCloser(it.draft) && box && boxArea(box) <= 0.5) {
        it.status = "closer"; renderItem(it);
        try {
          const crop = await cropBlob(it.file, box);
          const cands = (r.alternatives || []).map(a => `${a.name} (${a.latin || "?"})`).join(", ");
          const keep = state.maxImages - 1;
          const r2 = normResult(await state.sample.json(
            buildPrompt({ ...base, previous: { name: it.draft.name, latin: it.draft.latin, cands }, images: ["et nærbillede (udsnit i høj opløsning) af dyret", ...notes.slice(0, keep)] }),
            { images: [crop, ...imgs.slice(0, keep)], signal: it.ctl.signal, cache: false }));
          if (!state.queue.includes(it)) return;
          const d2 = toDraft(r2, it.draft.place, !!it.exif?.geo);
          if (!d2.noAnimal && d2.name) { it.result = r2; it.draft = { ...d2, box, closer: true }; it.closer = true; }
        } catch (e2) { if (e2?.code === "cancelled") throw e2; }
      }
      it.status = "ready";
      if (it.auto) await autoDecide(it);
    } catch (e) {
      if (!state.queue.includes(it) || e?.code === "cancelled") return;
      it.error = aiError(e?.code);
      if (DISABLED.includes(e?.code)) { state.vision = false; it.status = "ready"; showNotice("AI-genkendelse er ikke tilladt her. Du kan stadig registrere dyr ved at skrive navnet selv."); }
      else if (["image_rejected", "refused"].includes(e?.code)) it.status = "ready";
      else {
        it.status = "paused";
        if (e?.code === "rate_limited") for (const o of state.queue) if (o.status === "prep") { o.status = "paused"; renderItem(o); }
      }
      if (e?.code === "rate_limited" && state.import && !state.import.finished) state.import.paused = true;
      if (DISABLED.includes(e?.code)) { for (const o of [...state.queue]) toReview(o); }
      else if (it.auto && e?.code !== "rate_limited") toReview(it);
    } finally {
      if (state.queue.includes(it)) renderItem(it);
    }
  }

  function readDraft(it) {
    const el = document.getElementById("it-" + it.id);
    if (el) for (const inp of el.querySelectorAll("[data-k]")) it.draft[inp.dataset.k] = inp.value.trim();
    return it.draft;
  }

  // Fields stored on a sighting. Catalogue species always use the catalogue's name, so the dex stays consistent.
  function docFrom(d, extra) {
    const cat = CATALOG_BY_KEY.get(keyFor(d));
    return {
      key: keyFor(d), name: cat ? cat.name : d.name, nameEn: d.nameEn || "", latin: cat ? cat.latin : (d.latin || ""),
      category: cat ? cat.cat : (d.category || "andet"), region: cat ? cat.region : (d.region || ""),
      specificity: d.specificity || "", types: d.types || [], rarity: d.rarity || "almindelig",
      description: d.description || "", funFact: d.funFact || "", size: d.size || "", habitat: d.habitat || "",
      idTips: d.idTips || "", stats: d.stats || null, confidence: typeof d.confidence === "number" ? d.confidence : null,
      rarityWhy: d.rarityWhy || "", iucn: d.iucn || "", shiny: !!d.shiny, variant: d.variant || "", rv: 2,
      ...(d.box ? { box: d.box } : {}), ...(d.closer ? { closer: true } : {}),
      ...extra,
    };
  }

  async function saveItem(it, quiet) {
    const d = readDraft(it);
    if (d.notReal) { it.error = "Kun ægte dyr kan registreres."; renderItem(it); return false; }
    if (!d.name) { it.error = "Giv dyret et navn først."; renderItem(it); document.getElementById("n-" + it.id)?.focus(); return false; }
    if (!it.blob) { it.error = "Billedet kunne ikke åbnes, så det kan ikke gemmes."; renderItem(it); return false; }
    const key = keyFor(d);
    const isNew = !caughtMap().has(key);
    it.status = "saving"; it.error = ""; renderItem(it);
    const doc = docFrom(d, {
      source: it.result && !d.noAnimal ? "ai" : "manuel", createdAt: Date.now(), assetId: null,
      place: d.place || "", geo: it.exif?.geo || null, takenAt: it.exif?.takenAt || null, fileSig: it.sig || fileSig(it.file),
    });
    const preview = previewEntry(doc);
    let uploaded = null, thumb = null;
    try {
      if (state.memory) {
        const id = "mem-" + (++uid);
        memUrls.set(id, urlOf(it));
        state.sightings.push({ id, ...doc });
        for (const [n, x] of (it.extra || []).entries()) {
          const xid = "mem-" + (++uid);
          memUrls.set(xid, x.url);
          state.sightings.push({ id: xid, ...doc, box: undefined, createdAt: doc.createdAt + n + 1, geo: x.exif?.geo || doc.geo, takenAt: x.exif?.takenAt || doc.takenAt, fileSig: x.sig });
        }
        removeItem(it, true);
      } else {
        uploaded = await state.assets.upload(it.blob, { type: "image/jpeg" });
        doc.assetId = uploaded.id;
        try { thumb = await state.assets.upload(await makeThumb(it.blob), { type: "image/jpeg" }); doc.thumbId = thumb.id; } catch { thumb = null; }
        await state.db.collection(sightPath(state.me)).add(doc);
        uploaded = null; thumb = null;
        for (const [n, x] of (it.extra || []).entries()) {
          try {
            const up = await state.assets.upload(x.blob, { type: "image/jpeg" });
            const xdoc = { ...doc, assetId: up.id, thumbId: null, createdAt: doc.createdAt + n + 1, geo: x.exif?.geo || doc.geo, takenAt: x.exif?.takenAt || doc.takenAt, fileSig: x.sig };
            delete xdoc.box;
            try { xdoc.thumbId = (await state.assets.upload(await makeThumb(x.blob), { type: "image/jpeg" })).id; } catch {}
            await state.db.collection(sightPath(state.me)).add(xdoc);
            importSigs.add(x.sig);
          } catch {}
        }
        removeItem(it);
      }
      importSigs.add(doc.fileSig);
      state.pendingSelect = key;
      render();
      refreshQueueStatus();
      if (!quiet) {
        if (isNew || doc.shiny) celebrate({ ...preview, shinyNew: !!doc.shiny, known: !isNew }, doc.assetId ? P.blobUrl(doc.assetId) : urlOf(it));
        else toast(`Nyt billede af ${preview.name}`);
      }
      return isNew ? preview.name : true;
    } catch (err) {
      if (uploaded) state.assets.delete(uploaded.id).catch(() => {});
      if (thumb) state.assets.delete(thumb.id).catch(() => {});
      it.status = "ready";
      it.error = ({ quota_or_state: "Der er ikke mere plads til billeder. Slet nogle og prøv igen.", too_large: "Billedet er for stort til at gemme.", rate_limited: "Du gemmer hurtigt. Vent et øjeblik og prøv igen." })[err?.code] || "Billedet kunne ikke gemmes. Prøv igen.";
      renderItem(it);
      return false;
    }
  }

  async function saveAll() {
    let saved = 0; const fresh = [];
    for (const it of state.queue.filter(i => i.status === "ready" && !i.hidden)) {
      const r = await saveItem(it, true);
      if (r) saved++;
      if (typeof r === "string") fresh.push(r);
    }
    toast(`${saved} billeder registreret` + (fresh.length ? ` · ${fresh.length} nye dyr: ${fresh.join(", ")}` : ""));
  }

  /* ---------- refine: a slower, closer look at a saved photo ---------- */
  async function refine(p) {
    const ctl = new AbortController();
    state.refine = { sid: p.id, status: "running", ctl };
    renderViewer();
    try {
      const blob = await fetch(photoSrc(p)).then(r => { if (!r.ok) throw { code: "fetch" }; return r.blob(); }, () => { throw { code: "fetch" }; });
      let box = cleanBox(p.box);
      if (!box) {
        try { box = cleanBox((await state.sample.json(`Find det dyr, der er hovedmotivet på billedet. Svar KUN med JSON: {"box": [x0, y0, x1, y1]} for en ramme tæt omkring dyret, som tal fra 0 til 1, hvor [0, 0] er øverste venstre hjørne. Hvis der ikke er et dyr: {"box": null}`, { images: [blob], signal: ctl.signal, cache: false, modelTier: "quick" }))?.box); }
        catch (e) { if (e?.code === "cancelled" || DISABLED.includes(e?.code)) throw e; }
      }
      const crop = box && boxArea(box) <= 0.6 ? await cropBlob(blob, box).catch(() => null) : null;
      const two = crop && state.maxImages >= 2;
      const prompt = buildPrompt({ geo: p.geo, takenAt: p.takenAt, place: p.geo ? "" : p.place, previous: p, setting: $("#setting").value,
        images: two ? ["et nærbillede (udsnit) af dyret", "hele billedet"] : crop ? ["et nærbillede (udsnit) af dyret"] : ["hele billedet"] });
      const r = normResult(await state.sample.json(prompt, { images: two ? [crop, blob] : [crop || blob], signal: ctl.signal, cache: false }));
      if (r && box && !cleanBox(r.box)) r.box = box;
      if (state.refine?.ctl !== ctl) return;
      const d = toDraft(r, p.place, false);
      state.refine = d.noAnimal || !d.name
        ? { sid: p.id, status: "error", error: "AI'en fandt ikke et dyr ved den grundige analyse." }
        : d.notReal
          ? { sid: p.id, status: "error", error: `AI'en mener ikke, at det er et ægte dyr: ${d.fake || "det ligner en efterligning"}. Overvej at slette billedet.` }
          : { sid: p.id, status: "done", draft: d, result: r };
    } catch (e) {
      if (state.refine?.ctl !== ctl) return;
      if (DISABLED.includes(e?.code)) state.vision = false;
      state.refine = e?.code === "cancelled" ? null
        : { sid: p.id, status: "error", error: e?.code === "fetch" ? "Billedet kunne ikke hentes til analysen." : aiError(e?.code) };
    }
    renderViewer();
  }

  async function applyRefine() {
    const r = state.refine;
    const p = state.sightings.find(s => s.id === r?.sid);
    if (!p || !r.draft) return;
    const fields = docFrom(r.draft, { place: p.place || "" });
    const oldKey = p.key;
    const wasCaught = caughtMap().has(fields.key);
    try {
      if (!state.memory) await state.db.collection(sightPath(state.me)).doc(p.id).update(fields);
      Object.assign(p, fields);
      state.refine = null;
      state.pendingSelect = fields.key;
      render();
      const e = entryByKey(fields.key);
      toast(fields.key === oldKey || wasCaught ?`${e.name} er opdateret` : `Registreret som ${e.name} · No.${pad(e.no)}`);
    } catch {
      state.refine = { ...r, status: "error", error: "Ændringen kunne ikke gemmes. Prøv igen." };
      renderViewer();
    }
  }

  async function deletePhoto() {
    const e = entryByKey(state.selected);
    const p = e?.sp?.photos[state.photoIdx];
    if (!p) return;
    try {
      if (state.memory) { URL.revokeObjectURL(memUrls.get(p.id)); memUrls.delete(p.id); }
      else {
        await state.db.collection(sightPath(state.me)).doc(p.id).delete();
        if (p.assetId) state.assets.delete(p.assetId).catch(() => {});
        if (p.thumbId) state.assets.delete(p.thumbId).catch(() => {});
      }
      state.sightings = state.sightings.filter(s => s.id !== p.id);
      if (state.memory) state.mine = state.sightings;
      state.confirmDel = false; state.photoIdx = Math.max(0, state.photoIdx - 1);
      toast(e.sp.photos.length > 1 ? "Billedet er slettet" : `${e.name} er ikke længere fanget`);
      render();
    } catch { toast("Billedet kunne ikke slettes. Prøv igen."); }
  }

  /* ---------- collection care: refresh old finds with the newer fields, and build travel dexes ---------- */
  const staleSpecies = () => [...speciesOf(state.mine).values()].filter(sp => sp.photos.some(p => !p.rv));

  function refreshPrompt(batch) {
    return `Du opdaterer oplysninger om dyrearter i en "Dyredex" (en Pokédex for rigtige dyr). Vurdér hver art nedenfor.

For hver art skal du give:
- "rarity": en af ${JSON.stringify(RARITY)}: hvor sjældent arten ses i naturen på verdensplan (bestandens størrelse, hvor truet den er, og hvor sky og skjult den lever). "almindelig" = husdyr, kæledyr, byfugle og meget almindelige vilde arter; "usædvanlig" = vilde dyr man ser af og til; "sjælden" = sky, skjulte eller meget lokale arter; "episk" = truede arter eller dyr der er meget svære at opleve; "legendarisk" = kritisk truede arter eller dyr der næsten aldrig ses i naturen.
- "rarityWhy": 1 kort sætning på dansk om hvorfor arten har den sjældenhed.
- "iucn": IUCN-rødlistestatus, en af ["LC","NT","VU","EN","CR","EW","DD"] (tom streng for husdyr og kæledyr).
- "region": en af ${JSON.stringify(REGIONS.map(r => r.id))} (hvor arten naturligt lever; "dk" hvis den lever vildt i Danmark, "hav" for havdyr og polardyr).
- "shiny": true KUN hvis beskrivelsen af brugerens fund tydeligt siger, at netop dette individ havde en usædvanlig farvevariant (albino, leucistisk/bleg eller melanistisk/sort); ellers false.
- "variant": hvis shiny, en kort beskrivelse af varianten; ellers tom streng.

Arter (nøgle: navn (videnskabeligt navn). Beskrivelse af brugerens fund):
${batch.map(sp => `- ${sp.key}: ${sp.info.name} (${sp.info.latin || "?"}). ${String(sp.info.description || "").slice(0, 240)}`).join("\n")}

Svar KUN med ét JSON-objekt, hvor nøglerne er artsnøglerne: {"${batch[0].key}": {"rarity": "...", "rarityWhy": "...", "iucn": "...", "region": "...", "shiny": false, "variant": ""}}`;
  }

  async function refreshAll() {
    if (state.refresh?.running || !state.sample) return;
    const list = staleSpecies();
    if (!list.length) return;
    state.refresh = { running: true, done: 0, total: list.length, error: "" };
    renderCare();
    try {
      for (let at = 0; at < list.length; at += 25) {
        const batch = list.slice(at, at + 25);
        const r = await state.sample.json(refreshPrompt(batch), { cache: false });
        for (const sp of batch) {
          const x = r?.[sp.key] || {};
          const fields = { rv: 2 };
          if (RARITY.includes(x.rarity)) fields.rarity = x.rarity;
          if (x.rarityWhy) fields.rarityWhy = String(x.rarityWhy).trim().slice(0, 200);
          fields.iucn = IUCN[x.iucn] ? x.iucn : "";
          if (!CATALOG_BY_KEY.has(sp.key) && REGION[x.region]) fields.region = x.region;
          for (const [n, ph] of sp.photos.entries()) {
            const f = { ...fields };
            if (n === 0 && x.shiny === true && !ph.shiny) Object.assign(f, { shiny: true, variant: String(x.variant || "").trim().slice(0, 80) });
            if (state.db && !state.memory) await state.db.collection(sightPath(state.me)).doc(ph.id).update(f);
            Object.assign(ph, f);
          }
          state.refresh.done++;
        }
        renderCare();
      }
      state.refresh = null;
      toast("Samlingen er opdateret");
    } catch (e) {
      state.refresh = { running: false, done: 0, total: 0, error: e?.code ? aiError(e.code) : "Noget af samlingen kunne ikke gemmes. Prøv igen." };
    }
    render();
  }

  function dexPrompt(place) {
    const mine = [...speciesOf(state.mine).values()].map(sp => `${sp.info.name} (${sp.info.latin || "?"})`).join("; ");
    return `Lav en "rejse-dex" til en Dyredex (en Pokédex for rigtige dyr): en liste over 40 dyrearter, som en rejsende realistisk kan se og fotografere her: "${place.replace(/"/g, "'")}".

Regler:
- Kun vildtlevende arter, der faktisk forekommer dér. Præcise arter med videnskabeligt navn, aldrig grupper som "abe" eller "sommerfugl".
- Bland ikoniske dyr, hverdagsdyr man møder i byer, haver, ved hoteller, templer og strande, og nogle få sjældne drømmefund.
- Bland dyregrupper: pattedyr, fugle, krybdyr, padder, fisk, insekter, edderkoppedyr og andre smådyr.
- Brugeren har allerede fanget disse arter. Tag dem med i listen med PRÆCIS samme videnskabelige navn, hvis de forekommer vildt i området: ${mine || "(ingen endnu)"}
- Hvis en art står i dette katalog, så brug PRÆCIS samme navn og videnskabelige navn: ${BASE_CATALOG.map(c => `${c.name} (${c.latin})`).join("; ")}

Svar KUN med JSON:
{"name": "kort dansk navn på stedet, fx Indonesien", "species": [{"name": "dansk navn med stort forbogstav", "latin": "videnskabeligt navn", "cat": en af ${JSON.stringify(CATS.map(c => c.id))}, "region": en af ${JSON.stringify(REGIONS.map(r => r.id))} (verdensdelen arten lever i), "emoji": ét emoji fra denne liste, der ligner dyrets silhuet mest: ${ANIMAL_EMOJI}}]}
Hvis "${place.replace(/"/g, "'")}" ikke er et rigtigt sted, så svar {"name": "", "species": []}.`;
  }

  function cleanDexSpecies(list) {
    if (!Array.isArray(list)) return [];
    const out = [], seen = new Set();
    for (const x of list.slice(0, 80)) {
      const latin = String(x?.latin || "").trim(), name = String(x?.name || "").trim();
      const key = keyFor({ latin });
      if (!name || !/\s/.test(latin) || !key || seen.has(key)) continue;
      seen.add(key);
      const base = BASE_CATALOG.find(c => c.key === key);
      const cat = CAT[x.cat] ? x.cat : "andet";
      const emoji = String(x.emoji || "").trim();
      out.push({ key, name: base ? base.name : name.slice(0, 48), latin: base ? base.latin : latin.slice(0, 60), cat: base ? base.cat : cat,
        region: base ? base.region : (REGION[x.region] ? x.region : ""), emoji: base ? base.emoji : (emoji && ANIMAL_EMOJI.includes(emoji) ? emoji : CAT_EMOJI[cat]) });
    }
    return out.slice(0, 60);
  }

  async function createDex(place) {
    place = String(place || "").trim().slice(0, 60);
    if (!place || state.dexForm?.running || !state.sample) return;
    state.dexForm = { open: true, running: true, place, error: "" };
    renderCare();
    try {
      const r = await state.sample.json(dexPrompt(place), { cache: false });
      const species = cleanDexSpecies(r?.species);
      if (species.length < 8) throw { code: "bad_dex" };
      const name = String(r.name || place).trim().slice(0, 40);
      let id = slug(name) || "dex";
      if (state.dexes.some(d => d.id === id)) id += "-" + Date.now().toString(36).slice(-4);
      const doc = { name, place, by: state.me, createdAt: Date.now(), species };
      if (state.db && !state.memory) await state.db.collection("dexes").doc(id).set(doc);
      if (!state.dexes.some(d => d.id === id)) state.dexes.push({ id, ...doc });
      rebuildCatalog();
      state.dexForm = null; state.region = "x:" + id;
      render();
      const got = DEX.filter(e => inRegion(e, "x:" + id) && e.sp).length;
      toast(`Rejse-dex ${name}: ${species.length} dyr, du har allerede ${got}`);
    } catch (e) {
      state.dexForm = { open: true, running: false, place, error: e?.code === "bad_dex" ? "AI'en kunne ikke lave en liste for det sted. Prøv et land, en ø eller et naturområde." : e?.code ? aiError(e.code) : "Rejse-dexen kunne ikke gemmes. Prøv igen." };
      renderCare();
    }
  }

  async function deleteDex(id) {
    try { if (state.db && !state.memory) await state.db.collection("dexes").doc(id).delete(); }
    catch { toast("Rejse-dexen kunne ikke slettes."); return; }
    state.dexes = state.dexes.filter(d => d.id !== id);
    state.confirmDex = false; state.region = "alle";
    rebuildCatalog(); render();
    toast("Rejse-dexen er slettet. Dine fund er der stadig.");
  }

  // Suggests a travel dex when many finds fall outside the catalogue, using the country in their place names.
  function dexSuggestion() {
    if (store.get("dyredex-nosuggest") === "1") return null;
    const bonus = [...speciesOf(state.mine).values()].filter(sp => !CATALOG_BY_KEY.has(sp.key));
    if (bonus.length < 5) return null;
    const count = new Map();
    for (const sp of bonus) {
      const pl = String(sp.photos.find(ph => ph.place && !/^-?\d/.test(ph.place))?.place || "").split(",").pop().trim();
      if (pl) count.set(pl, (count.get(pl) || 0) + 1);
    }
    const top = [...count].sort((a, b) => b[1] - a[1])[0];
    const place = top && top[1] >= 3 ? top[0] : "";
    if (place ? state.dexes.some(d => d.name.toLowerCase() === place.toLowerCase() || String(d.place || "").toLowerCase() === place.toLowerCase()) : state.dexes.some(d => d.by === state.me)) return null;
    return { n: bonus.length, place };
  }

  function renderCare() {
    const el = $("#care");
    if (document.activeElement?.id === "dexplace" && !state.dexForm?.running) return;
    if (!isMine() || !state.loaded || !state.sample) { el.hidden = true; return; }
    const parts = [];
    const f = state.dexForm;
    if (f?.open) parts.push(`<div class="panel"><h3>Ny rejse-dex</h3>
      ${f.running ? `<p class="lcdfont" style="font-size:20px">BYGGER REJSE-DEX FOR ${esc(f.place.toUpperCase())}…</p><p>AI'en finder 40 dyr, du kan møde dér. Det tager op til et minut.</p>`
        : `<p>Skriv et land, en ø eller et naturområde, så laver AI'en en dex med 40 dyr, du kan finde dér. Dyr, du allerede har fanget dér, kommer med.</p>
          <div class="row-flex"><input id="dexplace" maxlength="60" value="${esc(f.place)}" placeholder="Fx Indonesien, Bali, Kenya eller Mols Bjerge" style="flex:1 1 220px;min-width:0" aria-label="Sted"><button class="btn sm" data-care="dex-create">Opret</button><button class="btn ghost sm" data-care="dex-cancel">Annullér</button></div>
          ${f.error ? `<p class="err">${esc(f.error)}</p>` : ""}`}</div>`);
    const rf = state.refresh, stale = staleSpecies().length;
    if (rf?.running) parts.push(`<div class="panel"><h3>Opdaterer samlingen</h3><p class="lcdfont" style="font-size:20px">${rf.done}/${rf.total} DYR</p><span class="meter"><i style="width:${rf.total ? rf.done / rf.total * 100 : 0}%"></i></span></div>`);
    else if (stale) parts.push(`<div class="panel"><h3>Opdatér samlingen</h3><p>${stale} af dine dyr mangler ny sjældenhed og rødlistestatus.</p>
      ${rf?.error ? `<p class="err">${esc(rf.error)}</p>` : ""}<div><button class="btn sm" data-care="refresh">Opdatér ${stale} dyr</button></div></div>`);
    const sg = !f?.open && dexSuggestion();
    if (sg) parts.push(`<div class="panel"><h3>Lav en rejse-dex</h3><p>${sg.n} af dine dyr er uden for kataloget${sg.place ? `, og de fleste er fra ${esc(sg.place)}` : ""}. En rejse-dex viser de dyr, du kan finde dér.</p>
      <div class="row-flex">${sg.place ? `<button class="btn sm" data-care="suggest" data-place="${esc(sg.place)}">Opret rejse-dex for ${esc(sg.place)}</button>` : ""}<button class="btn ${sg.place ? "ghost" : ""} sm" data-care="suggest-other">${sg.place ? "Andet sted" : "Vælg sted"}</button><button class="btn ghost sm" data-care="nosuggest">Nej tak</button></div></div>`);
    el.hidden = !parts.length;
    el.innerHTML = parts.join("");
  }

  /* ---------- daily missions: three per day, the same for everyone, picked from the date ---------- */
  const dayKeyOf = ms => { const d = new Date(ms || 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const today = () => dayKeyOf(Date.now());
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }
  function streakOf(days) {
    const set = new Set(days);
    const d = new Date();
    if (!set.has(dayKeyOf(d.getTime()))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(dayKeyOf(d.getTime()))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const MISSION_CATS = [["fugl", "en fugl"], ["insekt", "et insekt"], ["pattedyr", "et pattedyr"], ["edderkoppedyr", "et edderkoppedyr"], ["krybdyr", "et krybdyr"]];
  const MISSION_TYPES = ["Skov", "By", "Vand", "Luft", "Mark", "Hjem"];
  function missionsFor(day) {
    const rnd = seeded("dyredex-" + day);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const pool = [
      () => ({ id: "new", text: "Registrér et nyt dyr", goal: 1 }),
      () => { const n = 2 + Math.floor(rnd() * 3); return { id: "photos", text: `Tag ${n} dyrebilleder`, goal: n }; },
      () => { const [c, label] = pick(MISSION_CATS); return { id: "cat", cat: c, text: `Fang ${label}`, goal: 1 }; },
      () => { const t = pick(MISSION_TYPES); return { id: "type", type: t, text: `Fang et dyr af typen ${t}`, goal: 1 }; },
      () => { const n = 1 + Math.floor(rnd() * 3); return { id: "wins", text: `Vind ${n} ${n === 1 ? "kamp" : "kampe"} i Battle`, goal: n }; },
      () => ({ id: "cute", text: "Fang et dyr med nuttethed 8 eller mere", goal: 1 }),
      () => ({ id: "rare", text: "Fang et usædvanligt eller sjældnere dyr", goal: 1 }),
    ];
    const out = [], used = new Set();
    while (out.length < 3) { const k = Math.floor(rnd() * pool.length); if (!used.has(k)) { used.add(k); out.push(pool[k]()); } }
    return out;
  }
  function missionProgress(m, day) {
    const todays = state.mine.filter(x => dayKeyOf(x.createdAt) === day);
    if (m.id === "new") {
      const first = new Map();
      for (const x of [...state.mine].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))) if (!first.has(x.key)) first.set(x.key, x.createdAt);
      return [...first.values()].filter(t => dayKeyOf(t) === day).length;
    }
    if (m.id === "photos") return todays.length;
    if (m.id === "cat") return todays.filter(x => x.category === m.cat).length;
    if (m.id === "type") return todays.filter(x => (x.types || []).includes(m.type)).length;
    if (m.id === "wins") { const w = state.players.get(state.me)?.winsDay; return w?.d === day ? w.n : 0; }
    if (m.id === "cute") return todays.filter(x => Number(x.stats?.nuttethed) >= 8).length;
    if (m.id === "rare") return todays.filter(x => rIdx(x.rarity) >= 1).length;
    return 0;
  }
  function renderMissions() {
    const el = $("#missions");
    if (!isMine() || !state.loaded) { el.hidden = true; return; }
    const day = today();
    const ms = missionsFor(day).map(m => ({ ...m, have: Math.min(m.goal, missionProgress(m, day)) }));
    const done = ms.every(m => m.have >= m.goal);
    const player = state.players.get(state.me) || {};
    const days = player.daily || [];
    if (done && !days.includes(day)) {
      const next = [...days, day].slice(-120);
      state.players.set(state.me, { ...player, daily: next });
      if (state.db && !state.memory) state.db.collection("players").doc(state.me).update({ daily: next }).catch(() => {});
      if (store.get("dyredex-daily") !== day) {
        store.set("dyredex-daily", day);
        showOverlay(overlayHtml("Dagens missioner klaret!", `<div class="ub"><span style="font-size:54px;font-family:var(--font-emoji)">🔥</span><h3>${streakOf(next)} ${streakOf(next) === 1 ? "dag" : "dage"} i træk</h3><p class="small">Kom igen i morgen for nye missioner og en længere streak.</p><button class="btn" id="unlock-ok">Fedt!</button></div>`, { color: "#e06a1a", confetti: confettiHtml(30, ["#f7c843", "#e06a1a", "#ffffff"]) }));
      }
    }
    const streak = streakOf(state.players.get(state.me)?.daily || []);
    el.hidden = false;
    const open = (store.get("dyredex-missions") ?? (isPhone() ? "0" : "1")) === "1";
    el.innerHTML = `<button class="mh" data-mtoggle="1" aria-expanded="${open}"><span>DAGENS MISSIONER ${open ? "▾" : "▸"}</span><span>${done ? '<span class="all">ALLE KLARET!</span>' : `${ms.filter(m => m.have >= m.goal).length}/3<span class="w"> KLARET</span>`} · 🔥 ${streak}<span class="w"> ${streak === 1 ? "DAG" : "DAGE"}</span></span></button>
      <ul ${open ? "" : "hidden"}>${ms.map(m => `<li class="${m.have >= m.goal ? "done" : ""}"><span>${m.have >= m.goal ? "✓" : "○"}</span><span class="t">${esc(m.text)}</span><span>${m.have}/${m.goal}</span></li>`).join("")}</ul>`;
  }

  /* ---------- trainers: everyone keeps their own dex under players/<id>/ ---------- */
  const gen = name => /[sxz]$/i.test(name) ? `${name}'` : `${name}s`;
  function trainerIds() { return [...new Set([state.me, ...state.players.keys()])].filter(Boolean); }
  function trainerName(uid) { return state.players.get(uid)?.nick || state.names.get(uid) || (uid === state.me ? "Dig" : "Træner"); }

  function viewTrainer(uid) {
    if (!uid) return;
    if (state.unsubOther) { state.unsubOther(); state.unsubOther = null; }
    state.viewing = uid; state.selected = null; state.photoIdx = 0; state.refine = null; state.confirmDel = false;
    if (uid === state.me) { state.sightings = state.mine; render(); return; }
    state.sightings = [];
    render();
    if (!state.db) return;
    state.unsubOther = state.db.collection(sightPath(uid)).orderBy("createdAt", "asc").onSnapshot(snap => {
      if (state.viewing !== uid) return;
      state.sightings = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.key && x.name);
      render();
    }, () => showNotice("Den samling kunne ikke hentes."));
  }

  function setTab(tab) {
    const changed = state.tab !== tab;
    state.tab = tab;
    for (const x of document.querySelectorAll(".tabs [data-tab], .bnav [data-tab]")) x.setAttribute("aria-selected", x.dataset.tab === tab);
    if (changed && isPhone()) window.scrollTo(0, 0);
    $("#view-dex").hidden = tab !== "dex";
    $("#badges").hidden = tab !== "badges";
    $("#battle").hidden = tab !== "battle";
    $("#trainers").hidden = tab !== "trainers";
    renderBadges(); renderBattle(); renderTrainers();
  }

  function renderViewing() {
    const el = $("#viewing");
    if (isMine() || !state.me) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<span>Du ser <b>${esc(gen(trainerName(state.viewing)))}</b> Dyredex. Du kan kigge, men ikke ændre noget.</span><button class="btn ink sm" data-tact="home">Tilbage til min</button>`;
  }

  function renderTrainers() {
    const el = $("#trainers");
    if (state.tab !== "trainers") return;
    const mineSpecies = speciesOf(state.mine).size;
    const rows = trainerIds().map(id => {
      const p = state.players.get(id) || {};
      return { id, species: id === state.me ? mineSpecies : (p.species || 0), photos: id === state.me ? state.mine.length : (p.photos || 0), badges: p.badges || 0, wins: p.wins || 0 };
    }).sort((x, y) => y.species - x.species || y.badges - x.badges || y.wins - x.wins);
    const nick = state.players.get(state.me)?.nick || "";
    el.innerHTML = `${state.db ? `<div class="panel"><h3>Dit trænernavn</h3><div class="row-flex"><input id="nick" maxlength="24" value="${esc(nick)}" placeholder="${esc(state.names.get(state.me) || "Fx Ash")}" style="flex:1 1 180px;min-width:0" aria-label="Trænernavn"><button class="btn sm" data-tact="nick">Gem</button></div></div>` : ""}
      <div class="trainers">${rows.map((r, i) => `<div class="tr-row${r.id === state.me ? " me" : ""}">
        <span class="tr-rank">${i + 1}</span>
        <div style="min-width:0"><div class="tr-name">${esc(trainerName(r.id))}${r.id === state.me ? " (dig)" : ""}</div>
          <div class="tr-stats"><span>${r.species}/${CATALOG.length} ARTER</span><span>${r.photos} BILLEDER</span><span>${r.badges} BADGES</span><span>${r.wins} SEJRE</span></div></div>
        <button class="btn ink sm" data-tact="view" data-id="${esc(r.id)}">Se Dyredex</button>
      </div>`).join("")}</div>
      ${P?.kind === "local"
        ? `<div class="panel"><h3>Venner og familie</h3><p>Denne udgave af appen gemmer alt på din telefon, så venner kan ikke se din Dyredex endnu. Det kræver en server, som kommer senere. Indtil da kan I dele Dyredex'en i Claude.</p></div>`
        : `<div class="panel"><h3>Inviter venner og familie</h3>
        <p>Tryk <b>Del</b> på siden i Claude og tilføj deres e-mail med adgangen <b>Editor</b>. Så får de deres egen Dyredex her, kan scanne deres egne dyr, kæmpe mod dine og komme med på listen. Del ikke med et offentligt link, for så kan de kun kigge.</p></div>`}
      ${settingsHtml()}`;
  }

  /* ---------- settings and backup ---------- */
  function settingsHtml() {
    if (!P || !state.db || !isMine()) return "";
    const busy = state.backup?.running;
    const local = P.kind === "local";
    return `${hooks.settingsHtml ? hooks.settingsHtml() : ""}
      <div class="panel"><h3>Backup${local ? "" : " og flyt til app"}</h3>
        <p>${local
          ? "Alt gemmes kun på denne telefon. Gem en backup en gang imellem, så du ikke mister dine dyr, hvis telefonen bliver væk. Du kan også indlæse en backup fra Dyredex i Claude her."
          : "Gem hele din samling med billeder i én fil. Indlæs filen i Dyredex-appen på telefonen, så har du dine dyr med dig, også uden Claude."}</p>
        ${state.backup?.msg ? `<p class="note" role="status">${esc(state.backup.msg)}</p>` : ""}
        <div class="row-flex"><button class="btn sm" data-tact="export"${busy ? " disabled" : ""}>Gem backup</button>
          <button class="btn ink sm" data-tact="import"${busy ? " disabled" : ""}>Indlæs backup</button></div>
        <input type="file" id="backupfile" accept="application/json,.json" hidden></div>
      <p style="text-align:center;opacity:.6;font-size:12px;margin:0">Dyredex ${esc(__VERSION__)} · ${local ? "app-udgave" : "Claude-udgave"}</p>`;
  }
  function setBackup(running, msg) { state.backup = { running, msg }; renderTrainers(); }
  async function exportBackup() {
    if (state.backup?.running || !state.db) return;
    setBackup(true, "Pakker din samling…");
    try {
      const blob = await buildBackup({
        player: state.players.get(state.me) || {},
        sightings: state.mine.map(s => ({ ...s })),
        dexes: state.dexes.map(d => ({ ...d })),
        getBlob: id => P.blob(id),
        onProgress: (n, total) => { if (n % 4 === 0 || n === total) setBackup(true, `Pakker billeder… ${n}/${total}`); },
      });
      const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ok = await P.save(`dyredex-backup-${stamp}.json`, blob);
      setBackup(false, ok ? `Backuppen er gemt (${speciesOf(state.mine).size} arter, ${state.mine.length} billeder, ${(blob.size / 1048576).toFixed(1)} MB).` : "Filer kan ikke gemmes i denne visning. Åbn Dyredex i Claude i en browser og prøv igen.");
    } catch (e) {
      setBackup(false, e?.code === "declined" ? "" : "Backuppen kunne ikke gemmes. Prøv igen.");
    }
  }
  async function importBackup(file) {
    if (state.backup?.running || !state.db || !state.assets) return;
    setBackup(true, "Læser backuppen…");
    try {
      const data = await readBackup(file);
      const r = await applyBackup(data, {
        existing: state.mine, existingDexIds: new Set(state.dexes.map(d => d.id)),
        player: state.players.get(state.me) || {},
        sightCol: state.db.collection(sightPath(state.me)), dexCol: state.db.collection("dexes"),
        playerDoc: state.db.collection("players").doc(state.me),
        upload: b => state.assets.upload(b, { type: b.type || "image/jpeg" }),
        onProgress: (n, total) => setBackup(true, `Indlæser dyr… ${n}/${total}`),
      });
      setBackup(false, r.added ? `${r.added} billeder er indlæst.${r.skipped ? ` ${r.skipped} havde du i forvejen.` : ""}` : "Du havde allerede alt fra backuppen.");
    } catch (e) {
      setBackup(false, e?.message && !e.code ? e.message : "Backuppen kunne ikke indlæses.");
    }
  }

  async function saveNick() {
    const v = ($("#nick")?.value || "").trim().slice(0, 24);
    const p = state.players.get(state.me) || {};
    state.players.set(state.me, { ...p, nick: v });
    try { await state.db?.collection("players").doc(state.me).update({ nick: v }); toast("Trænernavnet er gemt"); }
    catch { toast("Navnet kunne ikke gemmes."); }
    renderTrainers(); renderViewing();
  }

  function resolveNames() {
    if (!state.user) return;
    const ids = trainerIds().filter(id => !id.startsWith("g-") && id !== "local");
    if (!ids.length) return;
    state.user.profiles(ids).then(ps => {
      let changed = false;
      for (const id of ids) { const n = ps?.[id]?.name; if (n && state.names.get(id) !== n) { state.names.set(id, n); changed = true; } }
      if (changed) { renderTrainers(); renderViewing(); if (B.stage === "pick") renderBattle(); }
    }).catch(() => {});
  }

  async function joinPlayers() {
    const ref = state.db.collection("players").doc(state.me);
    try { const snap = await ref.get(); if (!snap.exists) await ref.set({ joinedAt: Date.now(), nick: "", species: 0, photos: 0, badges: 0, wins: 0, losses: 0, giants: 0 }); } catch {}
  }

  // The leaderboard reads these numbers from players/<id>, so each trainer keeps their own up to date.
  let lastSummary = "", summaryTimer = 0;
  function updateSummary(groups) {
    if (!state.db || state.memory || !state.me || !isMine() || !state.loaded) return;
    let badges = 0;
    for (const g of groups) for (const a of g.list) badges += a.level;
    const sum = { species: DEX.filter(e => e.sp).length, photos: state.sightings.length, badges };
    const key = JSON.stringify(sum);
    if (key === lastSummary) return;
    lastSummary = key;
    clearTimeout(summaryTimer);
    summaryTimer = setTimeout(() => state.db.collection("players").doc(state.me).update(sum).catch(() => {}), 1500);
  }

  // Owner's photos from before trainers existed lived in a shared "sightings" collection.
  async function migrateLegacy() {
    let legacy;
    try { legacy = await state.db.collection("sightings").get(); } catch { return; }
    if (!legacy?.docs?.length) return;
    showNotice(`Flytter din samling til din trænerprofil (${legacy.docs.length} billeder)…`);
    const dest = state.db.collection(sightPath(state.me));
    for (const d of legacy.docs) {
      try { await dest.doc(d.id).set(d.data()); await state.db.collection("sightings").doc(d.id).delete(); }
      catch { showNotice("Noget af din samling kunne ikke flyttes. Genindlæs siden for at prøve igen."); return; }
    }
    showNotice("");
  }

  /* ---------- small thumbnails keep the grid fast ---------- */
  async function makeThumb(blob) {
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("thumb")), "image/jpeg", 0.8));
  }
  let backfilling = false;
  async function backfillThumbs() {
    if (backfilling || !state.assets || state.memory || !state.me) return;
    backfilling = true;
    try {
      for (const sg of [...state.mine]) {
        if (sg.thumbId || !sg.assetId) continue;
        const blob = await P.blob(sg.assetId).catch(() => null);
        if (!blob) continue;
        const t = await state.assets.upload(await makeThumb(blob), { type: "image/jpeg" });
        await state.db.collection(sightPath(state.me)).doc(sg.id).update({ thumbId: t.id });
        sg.thumbId = t.id;
      }
    } catch {} finally { backfilling = false; }
  }

  /* ---------- battle: pick several animals and watch them fight it out in a simulated arena ---------- */
  const ARENAS = [["tilfaeldig", "Tilfældig arena"], ["savanne", "Savannen ved solnedgang"], ["jungle", "Den tætte jungle"], ["skov", "Den danske skov"],
    ["kyst", "Kysten, halvt vand og halvt land"], ["hav", "Det åbne hav"], ["bjerg", "De stejle bjerge"], ["is", "Isen i polarnatten"], ["oerken", "Den brændende ørken"], ["by", "Byen om natten"]];
  const MAX_FIGHTERS = 6;
  const B = { stage: "pick", lineup: [], champ: null, browse: null, arena: "tilfaeldig", rosters: new Map(), run: null };
  const spName = sp => CATALOG_BY_KEY.get(sp.key)?.name || sp.info.name;
  const uidOf = x => `${x.trainer}|${x.key}`;

  function rosterOf(uid) {
    if (!uid) return [];
    if (uid === state.me) return [...speciesOf(state.mine).values()];
    if (uid === state.viewing) return [...caughtMap().values()];
    if (B.rosters.has(uid)) return B.rosters.get(uid);
    B.rosters.set(uid, null);
    state.db?.collection(sightPath(uid)).get().then(snap => {
      B.rosters.set(uid, [...speciesOf(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.key && x.name)).values()]);
      renderBattle();
    }, () => { B.rosters.set(uid, []); renderBattle(); });
    return null;
  }
  const lineupSp = x => rosterOf(x.trainer)?.find(sp => sp.key === x.key) || null;

  function fixChamp() {
    if (B.champ && B.lineup.some(x => uidOf(x) === B.champ && x.trainer === state.me)) return;
    const mine = B.lineup.find(x => x.trainer === state.me);
    B.champ = mine ? uidOf(mine) : null;
  }

  function renderBattle() {
    const el = $("#battle");
    if (state.tab !== "battle") return;
    if (B.stage !== "pick" && B.run) { el.innerHTML = fightHtml(B.run); drawArena(B.run, $("#bcanvas")); return; }
    if (!B.browse || !trainerIds().includes(B.browse)) B.browse = state.me;
    B.lineup = B.lineup.filter(x => rosterOf(x.trainer) === null || lineupSp(x));
    fixChamp();
    const ids = trainerIds();
    const roster = rosterOf(B.browse);
    const chips = B.lineup.map(x => {
      const sp = lineupSp(x); if (!sp) return "";
      const pw = speciesPower(sp, x.trainer), u = uidOf(x), mine = x.trainer === state.me;
      return `<div class="b-chip${B.champ === u ? " champ" : ""}"><img src="${esc(thumbSrc(sp.photos[0]))}" alt="">
        <div style="min-width:0"><b>${esc(spName(sp))}</b><small>${esc(trainerName(x.trainer))} · KK ${pw.kk} · LV ${pw.level}</small></div>
        <span class="acts">${mine ? `<button data-bact="champ" data-uid="${esc(u)}" aria-pressed="${B.champ === u}" aria-label="Vælg som din kæmper" title="Din kæmper">★</button>` : ""}<button data-bact="remove" data-uid="${esc(u)}" aria-label="Fjern ${esc(spName(sp))}">✕</button></span></div>`;
    }).join("");
    const ready = B.lineup.length >= 2;
    el.innerHTML = `<section class="b-panel"><h3>Kampens deltagere <span class="kkmini">${B.lineup.length}/${MAX_FIGHTERS}</span></h3>
        ${B.lineup.length ? `<div class="b-lineup">${chips}</div>` : `<p class="b-empty">Vælg 2-${MAX_FIGHTERS} dyr herunder. Alle kæmper mod alle i arenaen, og du ser kampen udspille sig.</p>`}
        ${B.champ ? `<p class="b-empty">★ er din kæmper. Vinder den, tæller det som en sejr og giver XP.</p>` : ""}
      </section>
      <section class="b-panel"><h3>Vælg dyr <span><button class="btn ghost sm" data-bact="random">Tilføj tilfældigt</button> ${B.lineup.length ? `<button class="btn ghost sm" data-bact="clear">Ryd</button>` : ""}</span></h3>
        ${ids.length > 1 ? `<select data-bsel="1" aria-label="Træner">${ids.map(id => `<option value="${esc(id)}" ${id === B.browse ? "selected" : ""}>${esc(trainerName(id))}${id === state.me ? " (dig)" : ""}</option>`).join("")}</select>` : ""}
        ${roster === null ? `<p class="b-empty">Henter dyr…</p>` : roster.length
          ? `<div class="b-roster">${roster.map(sp => `<button data-bpick="${esc(sp.key)}" aria-pressed="${B.lineup.some(x => x.trainer === B.browse && x.key === sp.key)}"><img src="${esc(thumbSrc(sp.photos[0]))}" alt="" loading="lazy"><span>${esc(spName(sp))}</span><span class="kkmini">KK ${speciesPower(sp, B.browse).kk}</span></button>`).join("")}</div>`
          : `<p class="b-empty">Ingen fangede dyr endnu. Scan nogle dyr først.</p>`}
      </section>
      <div class="b-go">
        <select id="barena" aria-label="Arena">${ARENAS.map(([id, label]) => `<option value="${id}" ${B.arena === id ? "selected" : ""}>${esc(label)}</option>`).join("")}</select>
        <button class="btn big" data-bact="start" ${ready ? "" : "disabled"}>Start kampen!</button>
        <span style="font-size:14px">${ready ? `${B.lineup.length} dyr er klar.` : "Vælg mindst to dyr."}</span>
      </div>`;
  }

  // Each arena has its own colours, and animals whose types belong there fight a little better.
  const ARENA_LOOK = {
    savanne: { sky: "#f6d59a", ground: "#c99a4e", spot: "rgba(120,80,20,.18)", types: ["Mark"] },
    jungle: { sky: "#3e8a52", ground: "#1f5a33", spot: "rgba(10,40,20,.25)", types: ["Jungle", "Skov"] },
    skov: { sky: "#8fbf7a", ground: "#4f7f3f", spot: "rgba(30,60,20,.22)", types: ["Skov"] },
    kyst: { sky: "#7fc8e8", ground: "#e3cf96", spot: "rgba(255,255,255,.25)", types: ["Vand", "Hav"] },
    hav: { sky: "#3f8fd0", ground: "#1b4f8f", spot: "rgba(255,255,255,.14)", types: ["Hav", "Vand"] },
    bjerg: { sky: "#b9c4d0", ground: "#7b8794", spot: "rgba(60,70,80,.25)", types: ["Bjerg"] },
    is: { sky: "#e8f4fb", ground: "#b5d6ea", spot: "rgba(255,255,255,.55)", types: ["Is"] },
    oerken: { sky: "#f7dfa3", ground: "#dba95a", spot: "rgba(160,100,30,.2)", types: ["Ørken"] },
    by: { sky: "#2a2f45", ground: "#161a2a", spot: "rgba(255,220,120,.12)", types: ["By", "Nat", "Hjem"] },
  };
  const SPECIAL_KINDS = ["dash", "roar", "heal", "poison", "shield", "stun"];
  const SPECIAL_FALLBACK = { pattedyr: ["Stormløb", "dash"], fugl: ["Styrtdyk", "dash"], krybdyr: ["Skælpanser", "shield"], padde: ["Slimskud", "stun"], fisk: ["Halesmæld", "dash"],
    insekt: ["Sværm", "poison"], edderkoppedyr: ["Giftbid", "poison"], bloeddyr: ["Blækspy", "stun"], krebsdyr: ["Klopanser", "shield"], andet: ["Brøl", "roar"] };

  function makeRun() {
    const names = B.lineup.map(x => { const sp = lineupSp(x); return sp ? spName(sp) : ""; });
    const arenaId = B.arena === "tilfaeldig" ? ARENAS[1 + Math.floor(Math.random() * (ARENAS.length - 1))][0] : B.arena;
    const look = ARENA_LOOK[arenaId];
    const W = 1000, H = isPhone() ? 1000 : 640;
    const fighters = B.lineup.map((x, n) => {
      const sp = lineupSp(x); if (!sp) return null;
      const pw = speciesPower(sp, x.trainer), i = sp.info, st = i.stats || {};
      const v = k => clamp(st[k] ?? 5, 1, 10);
      const dup = names.filter(nm => nm === names[n]).length > 1;
      const home = (i.types || []).some(t => look.types.includes(t));
      const mult = Math.sqrt((1 + pw.level / 40) * (1 + rIdx(i.rarity) * 0.05) * (pw.shiny ? 1.08 : 1) * (home ? 1.12 : 1)) * (0.9 + Math.random() * 0.2);
      const maxHp = Math.round((210 + v("styrke") * 11 + v("snilde") * 5) * mult);
      const ang = n / B.lineup.length * Math.PI * 2 - Math.PI / 2;
      const img = new Image(); img.src = thumbSrc(sp.photos[0]);
      return { id: "ABCDEF"[n], uid: uidOf(x), trainer: x.trainer, key: sp.key, sp, name: names[n], dn: dup ? `${gen(trainerName(x.trainer))} ${names[n]}` : names[n],
        latin: CATALOG_BY_KEY.get(sp.key)?.latin || i.latin || "", cat: CAT[i.category] ? i.category : "andet", src: img.src, img, level: pw.level, kk: pw.kk, home,
        r: 58 + v("styrke") * 3, x: W / 2 + Math.cos(ang) * W * 0.34, y: H / 2 + Math.sin(ang) * H * 0.32, vx: 0, vy: 0,
        maxHp, hp: maxHp, atk: (13 + v("styrke") * 1.5) * mult, def: 1 + v("snilde") * 0.04 + v("styrke") * 0.02,
        speed: 190 + v("fart") * 30, cd: 0.4 + Math.random() * 0.6, rate: 1.1 - v("fart") * 0.04,
        crit: 0.05 + v("snilde") * 0.015, dodge: 0.04 + v("fart") * 0.016 + v("snilde") * 0.008 + (10 - v("styrke")) * 0.008, charm: v("nuttethed") * 0.009,
        back: 0, stagger: 0, side: Math.random() < 0.5 ? 1 : -1,
        energy: Math.random() * 0.4, gain: 0.07 + v("snilde") * 0.006, special: null, target: null, retarget: 0,
        flash: 0, stun: 0, shield: 0, poison: 0, ptick: 0, dashT: 0, venom: false, out: false, fade: 1 };
    }).filter(Boolean);
    const decor = Array.from({ length: 8 }, () => [Math.random() * W, Math.random() * H, 60 + Math.random() * 130]);
    return { fighters, arenaId, arena: ARENAS.find(a => a[0] === arenaId)[1], look, W, H, decor, champ: B.champ, t: 0, fx: [], outs: [], winner: null, done: false,
      speed: 1, ticker: "", sudden: false, endAnim: 0, reward: "" };
  }

  async function ensureSpecials(fs) {
    const need = [...new Map(fs.filter(f => !state.specials.has(f.key)).map(f => [f.key, f])).values()];
    const ok = x => x && SPECIAL_KINDS.includes(x.kind) && String(x.name || "").trim();
    const keep = (f, x) => state.specials.set(f.key, { name: String(x.name).trim().slice(0, 20), kind: x.kind });
    if (state.db && !state.memory) await Promise.all(need.map(async f => {
      try { const d = await state.db.collection("specials").doc(f.key).get(); if (d.exists && ok(d.data())) keep(f, d.data()); } catch {}
    }));
    const missing = need.filter(f => !state.specials.has(f.key));
    if (missing.length && state.sample) {
      try {
        const r = await state.sample.json(`Giv hvert dyr ét specialangreb til et kampspil med rigtige dyr. Det skal bygge på dyrets rigtige evner og adfærd.
${missing.map(f => `- ${f.key}: ${f.name} (${f.latin || "?"})`).join("\n")}

"kind" er en af: "dash" (lynhurtigt stormløb, spring eller styrtdyk), "roar" (brøl eller trusselsadfærd, der skubber alle væk), "heal" (hviler, slikker sår eller gemmer sig), "poison" (gift, brod eller giftigt bid), "shield" (panser, skal, pigge eller tyk hud), "stun" (lammer, blænder, spinder ind eller skræmmer en modstander).
"name" er 1-2 ord på dansk, højst 18 tegn, fx "Lianesving".
Svar KUN med JSON, hvor nøglerne er dyrenes nøgler: {"${missing[0].key}": {"name": "...", "kind": "..."}}`, { modelTier: "quick", cache: false });
        for (const f of missing) if (ok(r?.[f.key])) {
          keep(f, r[f.key]);
          if (state.db && !state.memory) state.db.collection("specials").doc(f.key).set(state.specials.get(f.key)).catch(() => {});
        }
      } catch {}
    }
    for (const f of fs) f.special = state.specials.get(f.key) || { name: SPECIAL_FALLBACK[f.cat][0], kind: SPECIAL_FALLBACK[f.cat][1] };
  }

  /* --- simulation: everything below runs on a 1000-wide logical arena, 60 steps a second --- */
  function say(run, text) { run.ticker = text; const el = $("#bticker"); if (el && B.run === run) el.textContent = text; }
  const fxText = (run, x, y, text, color, size = 40, life = 0.9) => run.fx.push({ kind: "text", x, y, text, color, size, life, t: 0, rise: 70 });
  const fxRing = (run, x, y, r0, r1, color, life = 0.5) => run.fx.push({ kind: "ring", x, y, r0, r1, color, life, t: 0 });
  function fxSparks(run, x, y, color, n = 6) {
    for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, sp = 150 + Math.random() * 260; run.fx.push({ kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color, life: 0.35 + Math.random() * 0.2, t: 0 }); }
  }

  function hurt(run, f, dmg, color = "#fff") {
    if (f.out) return;
    if (f.shield > 0) dmg *= 0.45;
    dmg = Math.max(1, Math.round(dmg));
    f.hp -= dmg; f.flash = 1;
    fxText(run, f.x + (Math.random() - 0.5) * 40, f.y - f.r - 10, String(dmg), color, 38, 0.8);
    if (f.hp > 0) return;
    f.hp = 0; f.out = true; f.fade = 1;
    run.outs.push(f.id);
    fxRing(run, f.x, f.y, f.r * 0.6, f.r * 2.4, "#ffffff", 0.6); fxSparks(run, f.x, f.y, "#ffffff", 12);
    fxText(run, f.x, f.y - f.r - 50, "UDE!", "#ff6b6b", 54, 1.3);
    say(run, `${f.dn} er ude!`);
    if (B.run === run) $("#bf-" + f.id)?.classList.add("out");
  }

  function useSpecial(run, f, alive) {
    const s = f.special || { name: "Angreb", kind: "dash" };
    fxText(run, f.x, f.y - f.r - 56, s.name.toUpperCase() + "!", "#ffe35a", 46, 1.3);
    fxRing(run, f.x, f.y, f.r, f.r + 60, "#ffe35a", 0.4);
    say(run, `${f.dn} bruger ${s.name}!`);
    const others = alive.filter(o => o !== f && !o.out);
    if (s.kind === "dash") { f.dashT = 1.3; f.cd = 0; }
    else if (s.kind === "poison") { f.venom = true; f.dashT = 0.7; f.cd = 0; }
    else if (s.kind === "shield") f.shield = 3.5;
    else if (s.kind === "heal") { const h = Math.round(Math.min(f.maxHp - f.hp, f.maxHp * 0.22)); f.hp += h; if (h) fxText(run, f.x, f.y - f.r - 10, "+" + h, "#7dff9a", 40, 1); }
    else if (s.kind === "stun") {
      const t = others.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
      if (t) { t.stun = 1.8; fxText(run, t.x, t.y - t.r - 14, "LAMMET", "#c9b6ff", 36, 1.1); }
    } else {
      fxRing(run, f.x, f.y, f.r, 380, "#ffffff", 0.55);
      for (const o of others) {
        const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy) || 1;
        if (d > 400) continue;
        o.vx += dx / d * 620; o.vy += dy / d * 620; o.stun = Math.max(o.stun, 0.5);
        hurt(run, o, f.atk * 0.55 / o.def);
      }
    }
  }

  function tryStrike(run, a, b, rage) {
    if (a.cd > 0 || a.stun > 0 || a.out || b.out) return;
    a.cd = a.rate * (0.85 + Math.random() * 0.3);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    if (Math.random() < b.charm) { fxText(run, a.x, a.y - a.r - 10, "AWW…", "#ffb3e6", 34, 0.9); return; }
    if (Math.random() < b.dodge) { fxText(run, b.x, b.y - b.r - 10, "UNDVIG!", "#9ad8ff", 34, 0.8); b.vx = -ny * 420 * b.side; b.vy = nx * 420 * b.side; b.stagger = 0.2; a.back = 0.3; return; }
    const crit = Math.random() < a.crit;
    const dmg = a.atk * (0.6 + Math.random() * 0.8) / b.def * (a.dashT > 0 ? 1.8 : 1) * (crit ? 1.8 : 1) * rage;
    const kb = 430 + dmg * 7;
    b.vx = nx * kb; b.vy = ny * kb; b.stagger = 0.28;
    a.vx = -nx * 260; a.vy = -ny * 260; a.back = 0.45 + Math.random() * 0.45; a.side = Math.random() < 0.5 ? 1 : -1;
    fxSparks(run, a.x + nx * a.r, a.y + ny * a.r, crit ? "#ffe35a" : "#ffffff", crit ? 10 : 5);
    if (crit) { fxText(run, b.x, b.y - b.r - 48, "KRIT!", "#ffe35a", 40, 0.9); say(run, `Fuldtræffer fra ${a.dn}!`); }
    if (a.venom) { a.venom = false; b.poison = 4; b.ptick = 0.8; fxText(run, b.x, b.y - b.r - 14, "FORGIFTET", "#7bd65a", 34, 1.1); }
    a.dashT = 0;
    hurt(run, b, dmg, crit ? "#ffe35a" : "#fff");
  }

  function simStep(run, dt) {
    run.t += dt;
    const { W, H } = run;
    const rage = run.t > 40 ? 1 + (run.t - 40) * 0.12 : 1;
    if (run.t > 40 && !run.sudden) { run.sudden = true; fxText(run, W / 2, H * 0.24, "SUDDEN DEATH", "#ff6b6b", 64, 2); say(run, "Sudden death! Alle slag gør mere skade."); }
    const alive = run.fighters.filter(f => !f.out);
    for (const f of run.fighters) {
      if (f.out) { f.fade = Math.max(0, f.fade - dt * 1.6); continue; }
      f.flash = Math.max(0, f.flash - dt * 4); f.cd -= dt; f.shield = Math.max(0, f.shield - dt); f.dashT = Math.max(0, f.dashT - dt);
      if (f.poison > 0) { f.poison -= dt; f.ptick -= dt; if (f.ptick <= 0) { f.ptick = 0.8; hurt(run, f, f.maxHp * 0.03 * rage, "#7bd65a"); if (f.out) continue; } }
      f.back = Math.max(0, f.back - dt);
      if (f.stun > 0) { f.stun -= dt; f.vx *= 0.9; f.vy *= 0.9; }
      else if (f.stagger > 0) { f.stagger -= dt; f.vx *= 0.94; f.vy *= 0.94; }
      else {
        f.retarget -= dt;
        if (!f.target || f.target.out || f.retarget <= 0) {
          const others = alive.filter(o => o !== f && !o.out);
          others.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y));
          const roll = Math.random(), leader = [...others].sort((a, b) => b.hp - a.hp)[0];
          f.target = !others.length ? null : roll < 0.5 ? others[0] : roll < 0.8 ? leader : others[Math.floor(Math.random() * others.length)];
          f.retarget = 1.5 + Math.random() * 2;
        }
        const t = f.target;
        if (t) {
          const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) || 1;
          const sp = f.speed * (f.dashT > 0 ? 2.6 : 1), wob = Math.sin(run.t * 2.3 + f.r) * 0.3;
          let tvx = (dx / d - dy / d * wob) * sp, tvy = (dy / d + dx / d * wob) * sp;
          if (f.back > 0 && f.dashT <= 0) {
            // Backing off: away from the target in an arc, drifting towards the middle so the whole arena gets used.
            const cx = (W / 2 - f.x) / W, cy = (H / 2 - f.y) / H;
            tvx = (-dx / d * 0.7 - dy / d * 0.7 * f.side + cx * 1.2) * sp; tvy = (-dy / d * 0.7 + dx / d * 0.7 * f.side + cy * 1.2) * sp;
          }
          const k = Math.min(1, dt * (f.dashT > 0 ? 8 : 4));
          f.vx += (tvx - f.vx) * k; f.vy += (tvy - f.vy) * k;
        }
        f.energy += f.gain * dt;
        if (f.energy >= 1) { f.energy = 0; useSpecial(run, f, alive); }
      }
      f.x += f.vx * dt; f.y += f.vy * dt;
      const pad = f.r + 22;
      if (f.x < pad) { f.x = pad; f.vx = Math.abs(f.vx) * 0.8; } else if (f.x > W - pad) { f.x = W - pad; f.vx = -Math.abs(f.vx) * 0.8; }
      if (f.y < pad + 30) { f.y = pad + 30; f.vy = Math.abs(f.vy) * 0.8; } else if (f.y > H - pad - 44) { f.y = H - pad - 44; f.vy = -Math.abs(f.vy) * 0.8; }
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (a.out || b.out) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r;
      if (d >= min + 8) continue;
      if (d < min) { const push = (min - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
      if (Math.random() < 0.5) { tryStrike(run, a, b, rage); tryStrike(run, b, a, rage); } else { tryStrike(run, b, a, rage); tryStrike(run, a, b, rage); }
    }
    for (const e of run.fx) e.t += dt;
    run.fx = run.fx.filter(e => e.t < e.life);
    const left = run.fighters.filter(f => !f.out);
    if (left.length === 1) run.winner = left[0].id;
    else if (!left.length) { const id = run.outs.pop(); const f = run.fighters.find(x => x.id === id); Object.assign(f, { out: false, hp: 1, fade: 1 }); run.winner = id; if (B.run === run) $("#bf-" + id)?.classList.remove("out"); }
    else if (run.t > 120) { left.sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp); for (const f of left.slice(1).reverse()) hurt(run, f, f.hp + 999); run.winner = left[0].id; }
    if (run.winner) { const w = run.fighters.find(f => f.id === run.winner); say(run, `${w.dn} vinder kampen!`); }
  }

  function outlined(c, text, x, y, fill, size) {
    c.font = `${size}px VT323, ui-monospace, monospace`; c.textAlign = "center"; c.lineJoin = "round";
    c.lineWidth = Math.max(4, size / 6); c.strokeStyle = "rgba(0,0,0,.8)"; c.strokeText(text, x, y);
    c.fillStyle = fill; c.fillText(text, x, y);
  }

  function drawArena(run, cv) {
    const cw = cv.clientWidth; if (!cw) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), sc = cw / run.W;
    const pw = Math.round(cw * dpr), ph = Math.round(cw * run.H / run.W * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const c = cv.getContext("2d"), { W, H, look } = run, TAU = Math.PI * 2;
    c.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, look.sky); g.addColorStop(1, look.ground);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = look.spot;
    for (const [bx, by, br] of run.decor) { c.beginPath(); c.ellipse(bx, by, br, br * 0.42, 0, 0, TAU); c.fill(); }
    if (run.sudden && !run.winner) { const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); v.addColorStop(0, "rgba(200,0,0,0)"); v.addColorStop(1, "rgba(200,0,0,.4)"); c.fillStyle = v; c.fillRect(0, 0, W, H); }
    for (const f of [...run.fighters].sort((a, b) => a.y - b.y)) {
      if (f.out && f.fade <= 0) continue;
      c.save();
      c.globalAlpha = f.out ? f.fade : 1;
      const r = f.r * (f.out ? 0.6 + 0.4 * f.fade : 1), x = f.x + (f.flash > 0 ? (Math.random() - 0.5) * 12 * f.flash : 0), y = f.y;
      c.fillStyle = "rgba(0,0,0,.22)"; c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.9, r * 0.26, 0, 0, TAU); c.fill();
      if (f.dashT > 0) for (let k = 1; k <= 3; k++) { c.fillStyle = `rgba(255,255,255,${0.2 - k * 0.05})`; c.beginPath(); c.arc(x - f.vx * 0.035 * k, y - f.vy * 0.035 * k, r, 0, TAU); c.fill(); }
      c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
      if (f.img.complete && f.img.naturalWidth) { const iw = f.img.naturalWidth, ih = f.img.naturalHeight, s = Math.max(2 * r / iw, 2 * r / ih); c.drawImage(f.img, x - iw * s / 2, y - ih * s / 2, iw * s, ih * s); }
      else { c.fillStyle = (CAT[f.cat] || CAT.andet).c; c.fillRect(x - r, y - r, 2 * r, 2 * r); outlined(c, f.name.slice(0, 1), x, y + r * 0.3, "#fff", r); }
      if (f.poison > 0) { c.fillStyle = "rgba(90,200,60,.32)"; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
      if (f.stun > 0) { c.fillStyle = "rgba(120,120,170,.4)"; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
      if (f.flash > 0) { c.fillStyle = `rgba(255,255,255,${0.7 * f.flash})`; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
      c.restore();
      c.lineWidth = 6; c.strokeStyle = f.uid === run.champ ? "#f7c843" : "#ffffff"; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      if (f.shield > 0) { c.lineWidth = 8; c.strokeStyle = "rgba(90,170,255,.9)"; c.beginPath(); c.arc(x, y, r + 22, 0, TAU); c.stroke(); }
      if (!f.out) {
        const hp = f.hp / f.maxHp, a0 = -Math.PI / 2;
        c.lineWidth = 10; c.strokeStyle = "rgba(0,0,0,.5)"; c.beginPath(); c.arc(x, y, r + 9, 0, TAU); c.stroke();
        c.strokeStyle = hp > 0.5 ? "#39d86a" : hp > 0.22 ? "#f0c02a" : "#f0453a"; c.beginPath(); c.arc(x, y, r + 9, a0, a0 + TAU * hp); c.stroke();
        c.lineWidth = 4; c.strokeStyle = "#ffe35a"; c.beginPath(); c.arc(x, y, r + 17, a0, a0 + TAU * Math.min(1, f.energy)); c.stroke();
        if (f.stun > 0) outlined(c, "✶ ✶ ✶", x, y - r - 22, "#c9b6ff", 34);
        if (!run.winner) outlined(c, f.name.length > 13 ? f.name.slice(0, 12) + "…" : f.name, x, y + r + 44, f.uid === run.champ ? "#ffe35a" : "#ffffff", 30);
      }
      c.restore();
    }
    for (const e of run.fx) {
      const p = e.t / e.life;
      c.globalAlpha = Math.max(0, 1 - p * p);
      if (e.kind === "text") outlined(c, e.text, Math.max(90, Math.min(W - 90, e.x)), Math.max(40, e.y - p * e.rise), e.color, e.size);
      else if (e.kind === "ring") { c.lineWidth = 9 * (1 - p) + 2; c.strokeStyle = e.color; c.beginPath(); c.arc(e.x, e.y, e.r0 + (e.r1 - e.r0) * p, 0, TAU); c.stroke(); }
      else { c.fillStyle = e.color; c.beginPath(); c.arc(e.x + e.vx * e.t, e.y + e.vy * e.t, 8 * (1 - p) + 1, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    if (run.winner) {
      const w = run.fighters.find(f => f.id === run.winner), k = Math.min(1, run.endAnim * 1.5);
      c.fillStyle = `rgba(0,0,0,${0.4 * k})`; c.fillRect(0, 0, W, H);
      c.save(); c.translate(w.x, w.y); c.rotate(run.endAnim * 0.6);
      for (let n = 0; n < 12; n++) { c.rotate(TAU / 12); c.fillStyle = `rgba(255,227,90,${0.28 * k})`; c.beginPath(); c.moveTo(0, 0); c.lineTo(-26, -w.r * 3.2); c.lineTo(26, -w.r * 3.2); c.fill(); }
      c.restore();
      c.save(); c.beginPath(); c.arc(w.x, w.y, w.r, 0, TAU); c.clip();
      if (w.img.complete && w.img.naturalWidth) { const iw = w.img.naturalWidth, ih = w.img.naturalHeight, s = Math.max(2 * w.r / iw, 2 * w.r / ih); c.drawImage(w.img, w.x - iw * s / 2, w.y - ih * s / 2, iw * s, ih * s); }
      else { c.fillStyle = (CAT[w.cat] || CAT.andet).c; c.fillRect(w.x - w.r, w.y - w.r, 2 * w.r, 2 * w.r); }
      c.restore();
      c.lineWidth = 8; c.strokeStyle = "#ffe35a"; c.beginPath(); c.arc(w.x, w.y, w.r, 0, TAU); c.stroke();
      outlined(c, "VINDER!", Math.max(140, Math.min(W - 140, w.x)), Math.max(70, w.y - w.r - 30), "#ffe35a", 72);
      outlined(c, w.name, Math.max(140, Math.min(W - 140, w.x)), Math.min(H - 20, w.y + w.r + 56), "#ffffff", 40);
    }
  }

  const fighterCls = (run, f) => `b-f${f.out ? " out" : ""}${run.winner === f.id && run.done ? " win" : ""}${run.champ === f.uid ? " champ" : ""}`;

  function fightHtml(run) {
    const placing = run.done && run.winner ? [run.fighters.find(f => f.id === run.winner), ...[...run.outs].reverse().map(id => run.fighters.find(f => f.id === id))].filter(Boolean) : [];
    const win = placing[0];
    return `<canvas class="bcanvas" id="bcanvas" style="aspect-ratio:${run.W} / ${run.H}" role="img" aria-label="Kamparena: ${esc(run.arena)}"></canvas>
      <div class="bticker" id="bticker" aria-live="polite">${esc(run.ticker)}</div>
      <div class="b-fighters">${run.fighters.map(f => `<div class="${fighterCls(run, f)}" id="bf-${f.id}"><img src="${esc(f.src)}" alt=""><span class="tagout">UDE</span><b>${esc(f.name)}</b><small>${esc(f.special ? f.special.name : trainerName(f.trainer))}</small><small class="kkmini">KK ${f.kk}${f.home ? " · HJEMMEBANE" : ""}</small></div>`).join("")}</div>
      ${run.done ? `<div class="b-result">
          ${win ? `<h3>🏆 ${esc(win.dn)} vinder!</h3><ol>${placing.map(f => `<li>${esc(f.dn)} (${esc(trainerName(f.trainer))})</li>`).join("")}</ol>` : `<h3>Kampen endte uafgjort</h3>`}
          <p>${run.reward ? esc(run.reward) + " " : ""}Kampen varede ${Math.round(run.t)} sekunder i ${esc(run.arena.toLowerCase())}.</p>
          <div class="bctl"><button class="btn" data-bact="rematch">Omkamp</button><button class="btn blue" data-bact="new">Ny kamp</button></div>
        </div>`
        : `<div class="bctl"><button class="btn blue sm" data-bact="speed" id="bspeed">Hastighed ${run.speed}x</button><button class="btn ghost-dark sm" data-bact="skip">Spring til resultat</button><button class="btn ghost-dark sm" data-bact="stop">Stop</button></div>`}`;
  }

  function finishFight(run) {
    if (B.run !== run || run.done) return;
    run.done = true; B.stage = "done"; run.fx = [];
    for (const f of run.fighters) if (f.id !== run.winner && !run.outs.includes(f.id)) run.outs.unshift(f.id);
    const champ = run.fighters.find(f => f.uid === run.champ);
    if (champ && run.winner) {
      const won = champ.id === run.winner;
      const before = speciesPower(champ.sp, state.me).level;
      const strongest = Math.max(...run.fighters.filter(f => f !== champ).map(f => f.kk));
      recordBattle(won, won && champ.kk < strongest * 0.7, champ.key);
      const after = speciesPower(champ.sp, state.me).level;
      const place = 2 + [...run.outs].reverse().indexOf(champ.id);
      run.reward = won ? `★ Din kæmper ${champ.name} vandt og fik 60 XP!${after > before ? ` Den steg til level ${after}!` : ""}` : `★ Din kæmper ${champ.name} blev nummer ${place} af ${run.fighters.length}.`;
    }
    renderBattle();
  }

  function skipFight(run) {
    if (!run || run.done) return;
    for (let n = 0; !run.winner && n < 60 * 200; n++) simStep(run, 1 / 60);
    run.endAnim = 3;
    finishFight(run);
  }

  function battleLoop(run) {
    let last = performance.now(), acc = 0;
    const frame = now => {
      if (B.run !== run || run.done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!run.winner) { acc += dt * run.speed; while (acc >= 1 / 60 && !run.winner) { simStep(run, 1 / 60); acc -= 1 / 60; } }
      else { run.endAnim += dt; for (const e of run.fx) e.t += dt; run.fx = run.fx.filter(e => e.t < e.life); for (const f of run.fighters) if (f.out) f.fade = Math.max(0, f.fade - dt * 1.6); }
      const cv = $("#bcanvas"); if (cv) drawArena(run, cv);
      if (run.winner && run.endAnim > 2.4) { finishFight(run); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  async function startBattle() {
    if (B.lineup.length < 2) return;
    const run = makeRun();
    if (run.fighters.length < 2) return;
    B.run = run; B.stage = "fight"; run.ticker = "Dyrene gør sig klar…";
    renderBattle();
    $("#battle").scrollIntoView({ block: "start" });
    await ensureSpecials(run.fighters);
    if (B.run !== run) return;
    renderBattle();
    const home = run.fighters.filter(f => f.home).map(f => f.name);
    say(run, home.length ? `Hjemmebane for ${home.join(" og ")}. Kamp!` : `${run.fighters.length} dyr, alle mod alle. Kamp!`);
    fxText(run, run.W / 2, run.H / 2, "KAMP!", "#ffe35a", 110, 1.1);
    if (reducedMotion()) skipFight(run); else battleLoop(run);
  }

  function recordBattle(won, giant, key) {
    const p = state.players.get(state.me) || {};
    const day = today();
    const upd = won
      ? { wins: (p.wins || 0) + 1, swins: { ...(p.swins || {}), [key]: ((p.swins || {})[key] || 0) + 1 },
          winsDay: { d: day, n: (p.winsDay?.d === day ? p.winsDay.n : 0) + 1 }, ...(giant ? { giants: (p.giants || 0) + 1 } : {}) }
      : { losses: (p.losses || 0) + 1 };
    state.players.set(state.me, { ...p, ...upd });
    if (state.db && !state.memory) state.db.collection("players").doc(state.me).update(upd).catch(() => {});
    if (isMine()) { const ach = allAch(); renderBadges(ach); checkBadges(ach); renderMissions(); renderDex(); renderViewer(); }
  }

  /* ---------- unlock moments: one overlay at a time ---------- */
  const overlays = [];
  function showOverlay(html) { overlays.push(html); if (overlays.length === 1) openOverlay(); }
  function openOverlay() {
    const root = $("#unlock-root");
    if (!overlays.length) { root.innerHTML = ""; return; }
    root.innerHTML = overlays[0];
    const ov = root.querySelector(".unlock"), ok = root.querySelector("#unlock-ok");
    const close = () => { overlays.shift(); openOverlay(); };
    ok.focus(); ok.onclick = close;
    ov.onclick = ev => { if (ev.target === ov) close(); };
    ov.onkeydown = ev => { if (ev.key === "Escape") close(); };
  }
  const overlayHtml = (label, body, opt = {}) => `<div class="unlock" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="flash"></div>${opt.confetti || ""}<div class="u" ${opt.color ? `style="--uc:${opt.color}"` : ""}><div class="lbl">${esc(label.toUpperCase())}</div>${body}</div></div>`;
  function confettiHtml(n, colors) {
    if (!n || reducedMotion()) return "";
    let out = "";
    for (let k = 0; k < n; k++) out += `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 0.9).toFixed(2)}s;--c:${colors[k % colors.length]}"></i>`;
    return `<div class="confetti" aria-hidden="true">${out}</div>`;
  }

  function celebrate(e, src) {
    const r = e.sp?.info?.rarity, ri = rIdx(r);
    const label = e.shinyNew ? "✨ Shiny fundet! ✨" : ["Nyt dyr registreret!", "Usædvanligt fund!", "Sjældent fund!", "Episk fund!", "Legendarisk fund!"][ri];
    const color = e.shinyNew ? "#c22aa8" : RARITY_COLOR[r];
    const confetti = e.shinyNew ? confettiHtml(46, ["#ff7ad9", "#7ad7ff", "#fff27a", "#ffffff"]) : confettiHtml([0, 0, 18, 32, 50][ri], [RARITY_COLOR[r], "#f7c843", "#ffffff"]);
    showOverlay(overlayHtml(label, `<img src="${esc(src)}" alt="">
      <div class="ub">
        <span class="lcdfont" style="font-size:22px">No.${pad(e.no)}${e.region ? ` · ${esc(REGION[e.region].label.toUpperCase())}` : ""}</span>
        <h3>${esc(e.name)}</h3>
        <div class="chips">${catHtml(e.cat)}${rarityHtml(e.sp?.info?.rarity, true)}${iucnHtml(e.sp?.info?.iucn)}</div>
        ${e.shinyNew && e.sp?.info?.variant ? `<p class="small">${esc(e.sp.info.variant)}</p>` : ""}
        ${e.bonus && !e.known ? `<p class="small">Bonusdyr uden for kataloget</p>` : ""}
        <button class="btn" id="unlock-ok">Fedt!</button>
      </div>`, { color, confetti }));
  }
  function celebrateBadges(list) {
    showOverlay(overlayHtml(list.length > 1 ? `${list.length} achievements låst op!` : "Achievement låst op!", `<div class="ub">
      ${list.map(a => `<div class="won"><div class="b-icon" style="background:${medalOf(a)}">${a.icon}</div><div><h3>${esc(a.name)}${tierName(a) ? ` · ${tierName(a)}` : ""}</h3><p class="small">${esc(a.desc)}</p></div></div>`).join("")}
      <button class="btn" id="unlock-ok">Fedt!</button>
    </div>`));
  }
  function importSummary(imp) {
    const rows = imp.added.map(x => { const e = entryByKey(x.key); return `<li>${e ? `No.${pad(e.no)} ` : ""}${esc(e ? e.name : x.name)}</li>`; }).join("");
    showOverlay(overlayHtml(`${imp.added.length} nye dyr fra albummet!`, `<div class="ub">
      <ul class="small" style="text-align:left;margin:0;padding-left:18px;max-height:45vh;overflow:auto;justify-self:stretch">${rows}</ul>
      <button class="btn" id="unlock-ok">Fedt!</button>
    </div>`));
  }

  /* ---------- misc UI ---------- */
  let toastTimer;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4200); }
  function showNotice(msg) { const n = $("#notice"); n.textContent = msg; n.hidden = !msg; }
  function ensureMine() { if (state.me && !isMine()) viewTrainer(state.me); }
  const pick = () => { ensureMine(); $("#file").click(); };

  function nav(step) {
    const list = visibleEntries();
    if (!list.length) return;
    let i = list.findIndex(e => e.key === state.selected);
    if (step === "cols" || step === "-cols") {
      const cols = getComputedStyle($("#dex")).gridTemplateColumns.split(" ").length || 1;
      step = step === "cols" ? cols : -cols;
    }
    i = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + Number(step)));
    select(list[i].key);
    document.querySelector(`.tile[data-key="${CSS.escape(list[i].key)}"]`)?.scrollIntoView({ block: "nearest" });
  }

  /* ---------- events ---------- */
  $("#scanbtn").addEventListener("click", pick);
  $("#file").addEventListener("change", e => { addFiles([...e.target.files]); e.target.value = ""; });
  const device = $("#device");
  window.addEventListener("dragover", e => { e.preventDefault(); device.classList.add("over"); });
  window.addEventListener("dragleave", e => { if (!e.relatedTarget) device.classList.remove("over"); });
  window.addEventListener("drop", e => { e.preventDefault(); device.classList.remove("over"); const f = e.dataTransfer?.files; if (f?.length) addFiles([...f], f.length > 5); });
  $("#albumbtn").addEventListener("click", () => $("#albumfile").click());
  $("#albumfile").addEventListener("change", e => { addFiles([...e.target.files], true); e.target.value = ""; });
  document.querySelector(".tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab);
  });
  $("#sheetclose").addEventListener("click", closeSheet);
  $("#bnav").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });
  const scanSheet = open => { $("#scansheet").hidden = !open; if (open) $("#sheetscan").focus(); };
  $("#navscan").addEventListener("click", () => scanSheet(true));
  $("#sheetscan").addEventListener("click", () => { scanSheet(false); pick(); });
  $("#sheetalbum").addEventListener("click", () => { scanSheet(false); ensureMine(); $("#albumfile").click(); });
  $("#sheetcancel").addEventListener("click", () => scanSheet(false));
  $("#scansheet").addEventListener("click", e => { if (e.target.id === "scansheet") scanSheet(false); });
  $("#scansheet").addEventListener("keydown", e => { if (e.key === "Escape") scanSheet(false); });
  // The "place for photos without GPS" field lives in the scan sheet on phones and beside the viewer on wider screens.
  const placeEl = document.querySelector(".place"), phoneMq = matchMedia("(max-width: 880px)");
  const placeHome = () => { if (phoneMq.matches) $("#ss-place").append(placeEl); else document.querySelector(".left .album").after(placeEl); };
  placeHome();
  phoneMq.addEventListener("change", () => { placeHome(); if (!phoneMq.matches) { scanSheet(false); closeSheet(); } });
  $("#helpok").addEventListener("click", () => { $("#help").hidden = true; store.set("dyredex-help", "1"); });
  $("#help").hidden = store.get("dyredex-help") === "1";
  $("#viewing").addEventListener("click", e => { if (e.target.closest("[data-tact='home']")) viewTrainer(state.me); });
  $("#trainers").addEventListener("click", e => {
    const b = e.target.closest("[data-tact]"); if (!b) return;
    if (b.dataset.tact === "view") { viewTrainer(b.dataset.id); setTab("dex"); }
    if (b.dataset.tact === "nick") saveNick();
    if (b.dataset.tact === "export") exportBackup();
    if (b.dataset.tact === "import") $("#backupfile").click();
    if (b.dataset.tact === "setting") hooks.onSetting?.(b.dataset.what, $("#trainers"), { toast, render: renderTrainers });
  });
  $("#trainers").addEventListener("change", e => {
    if (e.target.id === "backupfile") { const f = e.target.files?.[0]; e.target.value = ""; if (f) importBackup(f); }
    else if (e.target.dataset.setting) hooks.onSetting?.(e.target.dataset.setting, $("#trainers"), { toast, render: renderTrainers, value: e.target.value });
  });
  $("#trainers").addEventListener("keydown", e => { if (e.target.id === "nick" && e.key === "Enter") saveNick(); });
  $("#battle").addEventListener("click", e => {
    const pk = e.target.closest("[data-bpick]");
    if (pk) {
      const at = B.lineup.findIndex(x => x.trainer === B.browse && x.key === pk.dataset.bpick);
      if (at >= 0) B.lineup.splice(at, 1);
      else if (B.lineup.length >= MAX_FIGHTERS) { toast(`Højst ${MAX_FIGHTERS} dyr i en kamp`); return; }
      else B.lineup.push({ trainer: B.browse, key: pk.dataset.bpick });
      renderBattle(); return;
    }
    const ab = e.target.closest("[data-bact]"); if (!ab) return;
    const act = ab.dataset.bact;
    if (act === "remove") { B.lineup = B.lineup.filter(x => uidOf(x) !== ab.dataset.uid); renderBattle(); }
    else if (act === "champ") { B.champ = ab.dataset.uid; renderBattle(); }
    else if (act === "clear") { B.lineup = []; renderBattle(); }
    else if (act === "random") {
      if (B.lineup.length >= MAX_FIGHTERS) { toast(`Højst ${MAX_FIGHTERS} dyr i en kamp`); return; }
      const pool = trainerIds().flatMap(id => (rosterOf(id) || []).map(sp => ({ trainer: id, key: sp.key }))).filter(x => !B.lineup.some(y => uidOf(y) === uidOf(x)));
      if (!pool.length) { toast("Der er ikke flere dyr at vælge"); return; }
      B.lineup.push(pool[Math.floor(Math.random() * pool.length)]); renderBattle();
    }
    else if (act === "start" || act === "rematch") startBattle();
    else if (act === "stop" || act === "new") { B.run = null; B.stage = "pick"; renderBattle(); }
    else if (act === "skip") skipFight(B.run);
    else if (act === "speed" && B.run) { B.run.speed = B.run.speed >= 4 ? 1 : B.run.speed * 2; ab.textContent = `Hastighed ${B.run.speed}x`; }
  });
  $("#battle").addEventListener("change", e => {
    if (e.target.matches("[data-bsel]")) { B.browse = e.target.value; renderBattle(); }
    if (e.target.id === "barena") B.arena = e.target.value;
  });
  document.addEventListener("paste", e => {
    const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  // Extra photos of the same animal: they are judged together with the first one and saved as their own finds of the species.
  let moreFor = null;
  $("#morefile").addEventListener("change", async e => {
    const files = [...e.target.files].filter(f => /^image\//.test(f.type || "")); e.target.value = "";
    const it = state.queue.find(i => i.id === moreFor);
    if (!it || !files.length) return;
    readDraft(it);
    it.extra = it.extra || [];
    for (const f of files.slice(0, 3 - it.extra.length)) {
      try { it.extra.push({ file: f, blob: await compress(f), url: URL.createObjectURL(f), exif: await readExif(f), sig: fileSig(f) }); } catch {}
    }
    if (!state.queue.includes(it)) return;
    it.status = "prep"; it.error = ""; renderItem(it); pump();
  });
  $("#setting").value = store.get("dyredex-setting") || "";
  $("#setting").addEventListener("change", e => store.set("dyredex-setting", e.target.value));
  $("#default-place").value = store.get("dyredex-place") || "";
  $("#default-place").addEventListener("change", e => store.set("dyredex-place", e.target.value.trim()));

  $("#queue").addEventListener("click", e => {
    const el = e.target.closest(".scan"); if (!el) return;
    const it = state.queue.find(i => String(i.id) === el.dataset.id); if (!it) return;
    const alt = e.target.closest("[data-alt]");
    if (alt) {
      const a = it.result.alternatives[Number(alt.dataset.alt)];
      readDraft(it);
      const cat = CATALOG_BY_KEY.get(keyFor({ latin: a.latin, name: a.name }));
      Object.assign(it.draft, { name: cat ? cat.name : String(a.name || ""), latin: cat ? cat.latin : String(a.latin || ""), description: "", funFact: "", stats: null, size: "", habitat: "", idTips: "", specificity: "" });
      if (cat) Object.assign(it.draft, { category: cat.cat, region: cat.region });
      renderItem(it); return;
    }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "save") saveItem(it);
    else if (act === "real") { readDraft(it); it.draft.notReal = false; it.draft.overridden = true; renderItem(it); }
    else if (act === "discard") removeItem(it);
    else if (act === "retry" || act === "rescan") { readDraft(it); it.status = "prep"; it.error = ""; renderItem(it); pump(); }
    else if (act === "more") { moreFor = it.id; $("#morefile").click(); }
  });
  $("#queue").addEventListener("input", e => {
    const el = e.target.closest(".scan"); if (!el || !e.target.dataset.k) return;
    const it = state.queue.find(i => String(i.id) === el.dataset.id); if (!it) return;
    readDraft(it);
    el.querySelector(".status").innerHTML = statusHtml(it);
    const btn = el.querySelector('[data-act="save"]');
    if (btn) btn.textContent = caughtMap().has(keyFor(it.draft)) ? "Tilføj billede" : "Registrér i Dyredex";
  });
  $("#tray-head").addEventListener("click", e => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "save-all") saveAll();
    if (act === "clear") for (const it of [...state.queue]) if (it.status !== "saving" && !it.hidden) removeItem(it);
    if (act === "imp-resume" && state.import) { state.import.paused = false; for (const it of state.queue) if (it.auto && it.status === "paused") it.status = "prep"; pump(); }
    if (act === "imp-stop" && state.import) {
      for (const it of [...state.queue]) if (it.auto && it.status !== "saving") removeItem(it);
      state.import.total = state.import.done + state.queue.filter(i => i.auto).length;
      finishImportIfDone(); renderTrayHead();
    }
    if (act === "imp-close") { state.import = null; renderTrayHead(); }
  });

  $("#keys").addEventListener("click", e => {
    if (e.target.closest("[data-dexadd]")) { state.dexForm = { open: true, running: false, place: "", error: "" }; renderCare(); $("#dexplace")?.focus(); return; }
    const b = e.target.closest("[data-region]"); if (!b) return;
    state.region = b.dataset.region; state.confirmDex = false; render();
  });
  $("#missions").addEventListener("click", e => {
    if (!e.target.closest("[data-mtoggle]")) return;
    const open = (store.get("dyredex-missions") ?? (isPhone() ? "0" : "1")) === "1";
    store.set("dyredex-missions", open ? "0" : "1"); renderMissions();
  });
  $("#strip").addEventListener("click", e => {
    const b = e.target.closest("[data-dexdel]"); if (!b) return;
    if (b.dataset.dexdel === "ask") { state.confirmDex = true; renderStrip(); }
    else if (b.dataset.dexdel === "no") { state.confirmDex = false; renderStrip(); }
    else deleteDex(state.region.slice(2));
  });
  $("#care").addEventListener("click", e => {
    const b = e.target.closest("[data-care]"); if (!b) return;
    const act = b.dataset.care;
    if (act === "refresh") refreshAll();
    else if (act === "dex-create") createDex($("#dexplace")?.value);
    else if (act === "dex-cancel") { state.dexForm = null; renderCare(); }
    else if (act === "suggest") createDex(b.dataset.place);
    else if (act === "suggest-other") { state.dexForm = { open: true, running: false, place: "", error: "" }; renderCare(); $("#dexplace")?.focus(); }
    else if (act === "nosuggest") { store.set("dyredex-nosuggest", "1"); renderCare(); }
  });
  $("#care").addEventListener("keydown", e => { if (e.target.id === "dexplace" && e.key === "Enter") createDex(e.target.value); });
  document.querySelector(".seg").addEventListener("click", e => {
    const b = e.target.closest("[data-show]"); if (!b) return;
    state.show = b.dataset.show;
    for (const x of document.querySelectorAll(".seg button")) x.setAttribute("aria-pressed", x === b);
    renderDex();
  });
  $("#q").addEventListener("input", e => { state.q = e.target.value; renderDex(); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; renderDex(); });
  $("#shownames").checked = state.showNames;
  $("#shownames").addEventListener("change", e => { state.showNames = e.target.checked; store.set("dyredex-names", e.target.checked ? "1" : "0"); renderDex(); renderViewer(); });
  $("#dex").addEventListener("click", e => { const t = e.target.closest(".tile"); if (t) select(t.dataset.key, true); });
  document.querySelector(".dpad").addEventListener("click", e => { const b = e.target.closest("[data-nav]"); if (b) nav(b.dataset.nav); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("sheet") && !$("#unlock-root").firstChild) { closeSheet(); return; }
    if (e.target.closest("input, select, textarea") || $("#unlock-root").firstChild) return;
    const map = { ArrowLeft: "-1", ArrowRight: "1", ArrowUp: "-cols", ArrowDown: "cols" };
    if (map[e.key] && e.target.closest(".dex, .dpad")) { e.preventDefault(); nav(map[e.key]); }
  });

  $("#viewer").addEventListener("click", e => {
    const ph = e.target.closest("[data-ph]");
    if (ph) { state.photoIdx = Number(ph.dataset.ph); state.confirmDel = false; renderViewer(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    const entry = entryByKey(state.selected);
    const vb = e.target.closest("[data-view]");
    if (vb) {
      state.viewCard = vb.dataset.view === "card";
      if (state.viewCard) askTilt();
      renderViewer(); return;
    }
    if (act === "flip") { CARD.flip = !CARD.flip; return; }
    if (act === "confirm-id") {
      const ph = entry?.sp?.photos[state.photoIdx]; if (!ph) return;
      ph.confidence = 1; ph.confirmed = true;
      if (state.db && !state.memory) state.db.collection(sightPath(state.me)).doc(ph.id).update({ confidence: 1, confirmed: true }).catch(() => toast("Kunne ikke gemme."));
      render(); return;
    }
    if (act === "pick") pick();
    else if (act === "speak" && state.tts && entry?.sp) { const i = entry.sp.info; state.tts.speak(`${entry.name}. ${i.description || ""} ${i.funFact || ""}`).catch(() => {}); }
    else if (act === "reveal") { state.revealed.add(entry.key); store.set("dyredex-revealed", [...state.revealed].join(",")); renderViewer(); renderDex(); }
    else if (act === "del") { state.confirmDel = true; renderViewer(); }
    else if (act === "del-no") { state.confirmDel = false; renderViewer(); }
    else if (act === "del-yes") deletePhoto();
    else if (act === "refine") refine(entry.sp.photos[state.photoIdx]);
    else if (act === "refine-stop") state.refine?.ctl?.abort();
    else if (act === "refine-close") { state.refine = null; renderViewer(); }
    else if (act === "refine-apply") applyRefine();
  });

  /* ---------- boot ---------- */
  async function boot() {
    render();
    if (!P) {
      Object.assign(state, { memory: true, loaded: true, me: "local", viewing: "local" });
      state.mine = state.sightings;
      showNotice(hooks.memoryNotice || "Denne kopi kører uden for Claude, så AI-genkendelse er slået fra, og dyr gemmes kun, indtil du lukker siden.");
      render();
      return;
    }
    showNotice("Forbinder til din Dyredex…");
    const [db, assets, sample, user, tts] = await Promise.all(["db", "assets", "sample", "user", "tts"].map(n => P.use(n).catch(() => null)));
    Object.assign(state, { db, assets, sample, user, tts });
    if (sample) { const lim = await sample.limits().catch(() => null); state.vision = !!lim?.images; state.maxImages = Math.max(1, Math.min(4, Number(lim?.images?.maxCount) || 1)); }
    // An outside Editor may have no platform id; such a trainer gets a stable id kept in this browser.
    let me = null;
    try { me = user ? await user.id() : null; } catch {}
    if (!me) { me = store.get("dyredex-me"); if (!me) { me = "g-" + Math.random().toString(36).slice(2, 12); store.set("dyredex-me", me); } }
    state.me = me; state.viewing = me;
    if (!db) {
      Object.assign(state, { memory: true, loaded: true });
      state.mine = state.sightings;
      showNotice("Samlingen kan ikke gemmes i denne visning. Dyr huskes kun, mens siden er åben.");
      render();
    } else {
      showNotice("");
      if (!assets) { state.canAdd = false; for (const id of ["#scanbtn", "#albumbtn", "#navscan"]) $(id).disabled = true; showNotice("Du kan se Dyredex'en og bruge Battle, men ikke scanne dyr. Bed ejeren om at dele siden med dig som Editor."); }
      else if (!state.vision) showNotice(P.kind === "local" ? "AI-genkendelse er slået fra. Tilføj din API-nøgle under Trænere → Indstillinger, eller skriv selv navnet på dyret." : "AI-genkendelse er ikke tilgængelig her. Du kan stadig registrere dyr ved at skrive navnet selv.");
      if (user && await user.isOwner()) await migrateLegacy();
      joinPlayers();
      db.collection("players").onSnapshot(snap => {
        state.players = new Map(snap.docs.map(d => [d.id, d.data()]));
        resolveNames();
        renderViewing(); if (document.activeElement?.id !== "nick") renderTrainers();
        if (B.stage === "pick") renderBattle();
        if (isMine() && state.loaded) { const ach = allAch(); renderBadges(ach); checkBadges(ach); }
      }, () => {});
      db.collection("dexes").onSnapshot(snap => {
        state.dexes = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.name && Array.isArray(d.species)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        rebuildCatalog(); render();
      }, () => {});
      let first = true;
      db.collection(sightPath(me)).orderBy("createdAt", "asc").onSnapshot(snap => {
        state.mine = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.key && x.name);
        if (first) { first = false; state.loaded = true; state.selected = null; setTimeout(backfillThumbs, 4000); }
        if (isMine()) { state.sightings = state.mine; render(); refreshQueueStatus(); }
        else if (B.stage === "pick") renderBattle();
      }, () => showNotice("Samlingen kunne ikke hentes. Genindlæs siden for at prøve igen."));
    }
    renderViewer();
    for (const it of state.queue) if (it.status === "ready" && !it.result && state.vision) it.status = "prep";
    pump();
  }
  boot();
}
