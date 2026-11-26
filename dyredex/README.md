# Dyredex

En Pokédex for rigtige dyr. Tag et billede af et dyr, smid det ind, og AI'en (Claude) bestemmer arten. Første gang du fanger en art, bliver den registreret med sit nummer, og silhuetten i Dyredex'en bliver til dit eget billede.

**I Claude:** https://claude.ai/artifact/5Ezc6rr2SdyGsGF4NBZ2AC
**Som app (efter GitHub Pages er slået til, se nedenfor):** `https://anders-tange.github.io/anders-tange/dyredex/web/`

Dyredex findes i to udgaver, bygget fra den samme kode i `src/`:

- **Claude-udgaven** (`index.html`) kører som artifact. Data og billeder ligger hos Claude, AI'en er Claude, og venner kan være med.
- **App-udgaven** (`web/`) kører uden Claude, også uden net. Data og billeder ligger på telefonen, og AI'en kører med din egen API-nøgle fra Anthropic. Den kan lægges på hjemmeskærmen som en app, og den samme mappe kan pakkes til App Store med Capacitor.

## Sådan virker det

- **Katalog med silhuetter:** 196 dyr fordelt på 8 regioner (Danmark, Europa, Afrika, Asien, Nordamerika, Sydamerika, Australien, Hav & is). Dyr, du ikke har fanget, vises som sorte silhuetter med `???`. Du kan afsløre et enkelt navn eller slå "Vis navne" til.
- **Regionale dexer:** Hver region har sin egen fremgang (fx `Afrika 1/27`), og Nationaldex'en viser det samlede tal.
- **Bonusdyr:** Fanger du en art, der ikke står i kataloget, får den et nummer efter kataloget (mærket B) og lægges i den region, hvor arten naturligt lever.
- **Præcis art uden en dyrere model:** Genkendelsen kører i op til to trin på standardmodellen. Først ser AI'en hele billedet, beskriver hvad den kan se, vejer 2-3 kandidater mod hinanden og angiver en ramme om dyret. Er den under 75 % sikker, eller kun nået til slægt eller familie, og fylder dyret under halvdelen af billedet, skæres dyret ud af originalfilen i fuld opløsning og sendes sammen med hele billedet i et andet kald. Modellen ser alle billeder skaleret til cirka 1,2 megapixel, så udsnittet giver flere gange så mange pixels på dyret. Du kan også tilføje op til tre ekstra billeder af samme dyr fra andre vinkler (de gemmes som egne fund), og angive om billederne er fra naturen, en zoo eller hjemme. "Bestem præcis art" på gemte billeder bruger samme nærbillede-metode i stedet for den dyreste model.
- **Achievements:** 32 badges i fanen "Achievements": Big 5, Big 7, Little 5, Ugly 5 og Danmarks Big 5, dyregrupper (kattedyr, menneskeaber, bjørne, skorpioner …), medaljer i bronze, sølv og guld for hver region, rejser og tid (Globetrotter, Natugle, Alle årstider, Safaridag …), samling og nogle sjove. De beregnes ud fra dine fund, og nye badges fejres med en pop-up.
- **Album-import:** "Importér fotoalbum" tager mange billeder på én gang (træk-og-slip af mere end 5 billeder gør det samme). Billeder af arter, du allerede har, springes over, ligesom billeder uden dyr og billeder, der allerede er importeret (genkendt på filnavn, størrelse og dato). Nye arter, som AI'en er mindst 75 % sikker på at have bestemt til art, registreres automatisk. Resten lægges til gennemsyn. To billeder scannes ad gangen, og importen sættes på pause, hvis grænsen for AI-kald rammes.
- **Sjældenhed:** Fem niveauer med hver sin farve (almindelig, usædvanlig, sjælden, episk, legendarisk) ud fra hvor sjælden arten er i naturen, med en kort forklaring og rødlistestatus (IUCN). Brikkerne får farvet kant, episke dyr gløder, legendariske glimter, og fejringen bliver større (konfetti) jo sjældnere fundet er.
- **Shiny-varianter:** Fotograferer du et individ med en usædvanlig farvevariant (albino, bleg/leucistisk, sort/melanistisk), markeres billedet med ✨, holo-kortet glimter ekstra, og det giver bonus-XP og badges.
- **Stats, level og kampkraft:** Hvert dyr har et radar-diagram over fart, styrke, snilde og nuttethed med karakterer fra S til D. Billeder, sejre, sjældenhed og shiny giver XP og level, og Kampkraft (KK) samler det i ét tal. Gitteret kan sorteres efter nummer, kampkraft, sjældenhed, level eller nyeste.
- **Dagens missioner:** Tre nye missioner hver dag (fx "Fang en fugl", "Tag 3 dyrebilleder", "Vind 2 kampe"), de samme for alle trænere. Klarer du alle tre, tæller det med i din streak og i badges.
- **Rejse-dexer:** "+ Rejse-dex" laver en ekstra dex for et land, en ø eller et naturområde. AI'en finder omkring 40 arter, man realistisk kan møde dér, og de vises som silhuetter med egen fremgang og egne medaljer. Arter, du allerede har fanget dér, kommer med, så bonusdyr falder på plads. Siden foreslår selv en rejse-dex, når mange fund ligger uden for kataloget, ud fra landet i fundenes stednavne. Rejse-dexer gemmes i `dexes` og deles af alle trænere.
- **Opdatér samlingen:** Ældre fund mangler de nyere oplysninger. Ét tryk lader AI'en give alle arter sjældenhed i fem niveauer, rødlistestatus, forklaring og region i ét samlet kald (uden billeder), og markerer shiny, hvis den gamle beskrivelse tydeligt nævner en farvevariant.
- **Usikre fund:** Dyr, som AI'en var under 60 % sikker på eller kun bestemte til slægt eller familie, får et "?"-mærke og kan findes med filteret "Usikre". Du kan køre et grundigere tjek eller selv bekræfte arten.
- **Kun ægte dyr:** AI'en tjekker først, om det er et ægte dyr. Statuer, figurer, legetøj, tegninger, udstoppede dyr og dyr på skærme eller skilte kan ikke registreres (album-importen springer dem over). Tager AI'en fejl, kan du trykke "Det er et ægte dyr".
- **Holo-kort:** Tryk "HOLO-KORT" på et fanget dyr for at se dit foto som et samlekort med regnbue-glimmer, der er stærkere jo sjældnere dyret er. Kortet vipper, når du trækker over det, og fotoet ligger bag rammen som i et vindue, så det forskyder sig mod vippet og giver dybde. Tryk på kortet for at vende det: bagsiden viser radar, kampkraft, level, sjældenhed, rødlistestatus, fakta og hvor dyret blev fundet.
- **Flere trænere:** Hver person har sin egen Dyredex under `players/<id>/`. Fanen "Trænere" viser en rangliste med arter, billeder, badges og sejre, og du kan kigge i de andres samlinger (kun læse). Venner inviteres ved at dele siden med deres e-mail som Editor; de skal kunne uploade billeder. Ejerens gamle samling flyttes automatisk ind under ejerens egen trænerprofil første gang den nye version åbnes.
- **Battle:** Vælg 2-6 dyr fra din egen og dine venners samlinger og en arena. Kampen simuleres og vises som animation: dyrene er runde foto-brikker, der løber rundt i arenaen, angriber, trækker sig tilbage og angriber igen, med livsring, skadetal, undvigelser, fuldtræffere og et specialangreb pr. art (stormløb, brøl, gift, skjold, lammelse eller helbredelse). AI'en finder på specialangrebet første gang en art kæmper, og det gemmes i `specials`. Styrke, fart, snilde, nuttethed, level, sjældenhed og hjemmebane (arenaen passer til dyrets type) afgør chancerne, men outsidere kan vinde. Efter 40 sekunder bliver det sudden death. Hastigheden kan sættes til 1x, 2x eller 4x, og man kan springe til resultatet. Du udpeger en af dine egne som din kæmper (★): vinder den, tæller det som en sejr og giver 60 XP.
- **Oplæsning:** Hvor Claude kan læse op, kan dyrets tekst og kampens forløb læses højt.
- **Mobil først:** På telefon har appen en fast bundmenu (Dyredex, Battle, Badges, Trænere) med en rund SCAN-knap i midten, der åbner et ark med "Tag eller vælg billeder", "Importér fotoalbum" og feltet for sted. Toppen er kompakt, regionerne er en vandret række, man swiper i, missionerne er foldet sammen, og dine egne dyr står først ("Fanget først"). Et dyr åbner som et ark, der kan lukkes med telefonens tilbage-knap. Knapper og felter har fingervenlige størrelser. Gitteret viser små miniaturer (360 px), som laves ved upload.
- **Sted og tid:** GPS-position og optagelsestidspunkt læses fra billedets EXIF-data (JPEG og WebP), før billedet gøres mindre. De sendes med til AI'en som hjælp til at bestemme arten, og stedet får et navn. Mangler billedet GPS, kan du skrive stedet selv.
- **Betjening:** SCAN-knappen vælger billeder (flere ad gangen). Du kan også trække dem ind eller sætte ind med Ctrl+V. D-pad'en og piletasterne bladrer i dex'en.

- **Backup og flyt til app:** Under Trænere gemmer "Gem backup" hele samlingen med billeder i én JSON-fil, og "Indlæs backup" lægger den ind igen. Fund, du allerede har, springes over, så samme fil kan indlæses flere gange. Det er også sådan, du flytter dine dyr fra Claude til appen (eller tilbage).

## Teknik

```
src/
  app.js              selve appen; får en platform og bruger kun den til data, billeder, AI og oplæsning
  app.css, body.html  udseende og opmærkning
  head.html           skrifttyper
  backup.js           backup ind og ud
  main-claude.js      indgang for Claude-udgaven
  main-web.js         indgang for app-udgaven (indstillinger for AI og installation, service worker)
  platform/
    claude.js         Claude-runtime: claude.use(...), billeder på /_blob/<id>, filer via downloads
    local.js          samme API på telefonen: IndexedDB til dokumenter og billeder, talesyntese til oplæsning
    ai.js             AI med brugerens egen nøgle via @anthropic-ai/sdk
assets/icons/         app-ikoner (make_icons.py tegner dem)
build.mjs             bygger index.html og web/
```

Byg efter ændringer i `src/` (Node 20+):

```
npm install
npm run build
```

Byggetrinnet laver `index.html` (artifact, uændret adresse) og `web/` med `index.html`, `manifest.webmanifest`, `sw.js` (offline) og ikoner. Begge er tjekket ind, så de kan bruges uden at bygge.

### Claude-udgaven

| Funktion | Bruges til |
| --- | --- |
| `sample` (med billeder) | AI-genkendelse, grundig artsbestemmelse, specialangreb til Battle, rejse-dexer og opdatering af samlingen |
| `assets` | Gemmer billederne |
| `db` | Trænere (`players`), hver træners fund (`players/<id>/sightings`), rejse-dexer (`dexes`) og specialangreb (`specials`) |
| `user` | Hvem der kigger, så hver træner får sin egen samling og sit navn på ranglisten |
| `tts` | Oplæsning af dyretekster og kampe |
| `downloads` | Gem backup som fil |

### App-udgaven

- **Data:** samme dokumentstruktur som i Claude, men i IndexedDB på enheden. Der er én træner pr. enhed, og venner kræver en server senere.
- **AI:** `@anthropic-ai/sdk` direkte fra browseren med brugerens egen nøgle (Trænere → AI-genkendelse). Standardmodellen er Claude Opus 5.5; Sonnet 5.5 og Haiku 5.5 kan vælges. Afviser modellen et billede, prøves det automatisk igen på Anthropics anbefalede reservemodel (`fallbacks: "default"`), dog ikke på Haiku, som ikke har en. Nøglen ligger kun i telefonens lokale lager. Det er fint til eget brug og test, men en offentlig app skal have en server, der holder nøglen, før den udgives.
- **Offline:** service workeren gemmer appen, så den åbner uden net. Scanning med AI kræver net.

### Hosting med GitHub Pages

Repository → Settings → Pages → Source: *Deploy from a branch*, vælg branch og mappen `/ (root)`. Appen ligger så på `https://<bruger>.github.io/<repo>/dyredex/web/`. Åbn adressen på telefonen og vælg *Føj til hjemmeskærm* (Safari) eller *Installér app* (Chrome).

### Vejen til App Store

1. `npm install @capacitor/core @capacitor/cli @capacitor/ios` og `npx cap init Dyredex dk.<navn>.dyredex --web-dir web`.
2. `npx cap add ios`, derefter `npm run build && npx cap sync` efter hver ændring.
3. Åbn projektet i Xcode (`npx cap open ios`), vælg dit Apple Developer-team og kør på telefonen eller send til TestFlight.

Det kræver en Mac med Xcode og et Apple Developer-medlemskab. Før appen udgives offentligt, skal AI-kaldene gå gennem en server i stedet for brugerens egen nøgle.

Kataloget ligger i `RAW` i `src/app.js` som linjer på formen `Navn|Latinsk navn|gruppekode|emoji`. Emojien vises som silhuet, indtil dyret er fanget. Fund matches til kataloget på det latinske navn.
