# Dyredex

En Pokédex for rigtige dyr. Tag et billede af et dyr, smid det ind, og AI'en (Claude) bestemmer arten. Første gang du fanger en art, bliver den registreret med sit nummer, og silhuetten i Dyredex'en bliver til dit eget billede.

**Live version:** https://claude.ai/artifact/5Ezc6rr2SdyGsGF4NBZ2AC

## Sådan virker det

- **Katalog med silhuetter:** 196 dyr fordelt på 8 regioner (Danmark, Europa, Afrika, Asien, Nordamerika, Sydamerika, Australien, Hav & is). Dyr, du ikke har fanget, vises som sorte silhuetter med `???`. Du kan afsløre et enkelt navn eller slå "Vis navne" til.
- **Regionale dexer:** Hver region har sin egen fremgang (fx `Afrika 1/27`), og Nationaldex'en viser det samlede tal.
- **Bonusdyr:** Fanger du en art, der ikke står i kataloget, får den et nummer efter kataloget (mærket B) og lægges i den region, hvor arten naturligt lever.
- **Præcis art:** AI'en skal altid bestemme arten (og race eller underart, hvis det kan ses), ikke bare "skorpion" eller "bille". Den forklarer, hvilke kendetegn der peger på arten, og foreslår lignende arter. "Bestem præcis art" kører en grundigere analyse af et gemt billede og kan flytte det til den rigtige art.
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

## Teknik

`index.html` er én fil med HTML, CSS og JavaScript uden byggetrin. Den kører som Claude-artifact og bruger tre funktioner fra artifact-runtime:

| Funktion | Bruges til |
| --- | --- |
| `sample` (med billeder) | AI-genkendelse, grundig artsbestemmelse, specialangreb til Battle, rejse-dexer og opdatering af samlingen |
| `assets` | Gemmer billederne |
| `db` | Trænere (`players`), hver træners fund (`players/<id>/sightings`), rejse-dexer (`dexes`) og specialangreb (`specials`) |
| `user` | Hvem der kigger, så hver træner får sin egen samling og sit navn på ranglisten |
| `tts` | Oplæsning af dyretekster og kampe |

Kataloget ligger i `RAW` øverst i scriptet som linjer på formen `Navn|Latinsk navn|gruppekode|emoji`. Emojien vises som silhuet, indtil dyret er fanget. Fund matches til kataloget på det latinske navn.

Åbner du filen direkte i en browser uden for Claude, virker den stadig, men uden AI og uden at gemme.
