# D&D Beyond character import: feasibility facts

Research for issue #20 (map #19). Gathered 2026-11-25. This note lists facts for a go/no-go decision. It does not recommend building anything.

Unverified items are marked **(unverified)**. Nobody called the live character service during this research. The JSON shape below comes from the source code of the most widely used open-source consumer, ddb-importer (MIT), and its proxy.

## 1. Routes that exist

| Route | What it gives | Who can use it |
|---|---|---|
| A. Unofficial character-service JSON: `GET https://character-service.dndbeyond.com/character/v5/character/{id}?includeCustomItems=true` | Full raw character JSON: `{ success, message, data: <character> }` | Anyone, if the character's sharing is set to public. A private character needs `Authorization: Bearer <token>`, where the token comes from swapping the user's `CobaltSession` cookie at `https://auth-service.dndbeyond.com/v1/cobalt-token`. |
| B. Official PDF export (sheet -> Manage -> Export to PDF) | Form-fillable PDF of the rendered sheet | Any owner. This is the only export D&D Beyond supports. |
| C. Pasted or uploaded JSON blob | Whatever the user copied, in practice the route A response opened in a browser | The owner, by hand |
| D. Browser extensions (Beyond20 and similar) | Read the rendered sheet page in the user's browser | The owner, with the extension installed |
| E. Official public API | None exists | None |

Sources:
- Endpoint URL and query string: ddb-proxy `config.js` (`baseUrl: "https://character-service.dndbeyond.com/character/v5"`, `characterUrl: .../character/${characterId}?includeCustomItems=true`, `authService: "https://auth-service.dndbeyond.com/v1/cobalt-token"`). https://github.com/MrPrimate/ddb-proxy/blob/main/config.js
- Bearer header is optional, and the body is read as `json.success` / `json.data`: ddb-proxy `character.js` (`const headers = (auth) ? {headers: {"Authorization": \`Bearer ${auth.data}\`}} : {}` ... `if (isValidData(json)) resolve(json.data)`). https://github.com/MrPrimate/ddb-proxy/blob/main/character.js
- ddb-importer builds the same URL (`getCharacterAPIEndpoint`) and accepts sheet URLs, share links (`ddb.ac`) and endpoint URLs (`getCharacterId`). https://github.com/MrPrimate/ddb-importer/blob/main/src/parser/DDBCharacter.ts
- Public access requirement: "A character on DDB needs to be _publicly accessible_, or it needs to be in a campaign that you are a DM for on D&D Beyond." The docs also say players set their own Cobalt cookie to import their own characters. https://docs.ddb.mrprimate.co.uk/docs/ddb-importer/character
- PDF export, official support article: https://dndbeyond-support.wizards.com/hc/en-us/articles/7747238449556-Export-Sheet (it returned 403 to automated fetch, so this is from the search snippet). Forum users report the PDF loses data and does not match the 2024 sheet layout: https://www.dndbeyond.com/forums/d-d-beyond-general/general-discussion/161673-export-to-pdf
- No public API: a member wrote "They don't provide any public documentation for it because this is not a public API" (Jul 2, 2026). That is a member, not staff. https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/188822-d-d-beyond-api
- Beyond20 reads data from the sheet page in the browser (host permission for dndbeyond.com). Its listings mention D&D Beyond site updates that broke parsing. https://addons.mozilla.org/firefox/addon/beyond-20 , https://github.com/kakaroto/Beyond20

There used to be a fifth route, a `/json` suffix on the sheet URL. It was removed in June 2020 (see section 3).

## 2. ToS and legal risk

Current D&D Beyond Terms & Conditions, "Last updated: June 25, 2026": https://www.dndbeyond.com/terms-conditions

The relevant clauses, quoted from the page:
- 5.2 (V) prohibits use of "automation software, bots, mods, hacks, spiders, spyware, scripts, trainers, extraction tools" and "any third-party programs that intercept or emulate communication between our services and our users".
- 5.2 (III): "reverse engineering, or creating derivative works from our services or software is generally prohibited". The same section says: "We aim to eventually open client protocols to facilitate user engagement without the need for reverse engineering".
- 5.2 (VI): "refrain from accessing areas of the D&D Beyond website, Services, or servers that are not publicly available".
- 1.4: Digital Content is licensed "for personal, non-commercial entertainment purposes only".
- 7.2: "When you share your User Content on D&D Beyond, you are the owner of that content." 7.3: sharing (for example linking a sheet to another user's campaign) grants other users a "non-exclusive, perpetual, royalty-free license".

Staff position on the character service (Molster, staff, Jun 11, 2020): "We don't want to officially support this, due to the rapid changes that can happen at this stage", and "we have not, and will not be blocking anyone from using it, as long as they are aware of its unsupported state." https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/71065-removed-undocumented-api-endpoints-regarding?comment=110

Risk by route. This is a factual reading of the clauses above, not legal advice:

| Route | Facts that bear on risk |
|---|---|
| A, server-side fetch by Constancia | An automated server fetching an undocumented internal service fits the wording of 5.2 (V) ("scripts", "extraction tools") and 5.2 (III). Against that, the 2020 staff statement says they will not block it, and ddb-importer has done exactly this at scale since 2020 without a takedown that this research found. That statement is six years old and predates the June 2026 ToS. |
| A, using the user's Cobalt cookie | Collecting a D&D Beyond session credential gives full account access, not read-only access to one character. It is a security liability for Constancia regardless of the ToS. ddb-importer keeps the cookie in the user's browser and sends it through its own proxy. |
| B, PDF | Supported first-party feature. The user exports their own data. No ToS conflict found. |
| C, pasted JSON | Constancia makes no request to D&D Beyond. The user fetches their own character data in their own browser. The ToS has no clause on what a user does with their own character data. Character content is User Content the user owns (7.2), but the JSON also includes Wizards' rules text in `definition` objects (class, feat and item descriptions), which falls under the personal, non-commercial license (1.4). |
| D, extension | Third-party program that reads the service. It sits closest to the 5.2 (V) wording. Constancia would have to ship and maintain an extension. |

SRD fit: map #19 limits content to SRD 5.2. A Beyond character can hold non-SRD content (species, subclasses, feats from paid books). An import that keeps only names and numbers carries less of Wizards' text than one that copies `definition` objects.

## 3. Historical stability

| Date | Event | Source |
|---|---|---|
| 2018 | Users asked for a computer-readable export. The `/json` suffix on the sheet URL was the de facto route. | https://www.dndbeyond.com/forums/d-d-beyond-general/bugs-support/18969-computer-readable-character-export |
| Jun 10, 2020 | `/json` removed with about two days' notice (member SolFolango: "with a two-day notice"). It broke Foundry imports. Members moved to `character-service.dndbeyond.com/character/v3/character/{id}`, "in a different format". | https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/71065-removed-undocumented-api-endpoints-regarding |
| Jun 11, 2020 | Staff explained the move: the logic moved off the web nodes into its own service, "also why the URL has changed". Unsupported, not blocked. | same thread, comment 110 |
| Aug 10, 2021 | ddb-proxy commit "v5 API support". The v5 path has been used since then. | https://github.com/MrPrimate/ddb-proxy/commits/main/config.js |
| 2021-2026 | ddb-proxy `config.js` history shows no change to the v5 base URL after 2021. The later commits are campaigns, spells and options. The most recent are "2024 spell fixes" (2026-10-14) and a 2026-11-25 commit. | same |
| 2024 rules | The v5 endpoint carries 2024 content without a version bump, and ddb-importer handles both rulesets from one shape. Example: 2024 ability score increases come from the background's granted "Ability Score" feat rather than the species, and the parser branches on `background.definition.grantedFeats`. | https://github.com/MrPrimate/ddb-importer/blob/main/src/parser/character/abilities.ts |
| Ongoing | Forum reports of 403s from the character service when cookies grow too large. Beyond20 broken several times by D&D Beyond site updates. | search results above, Beyond20 listings |
| 2026 | ddb-importer still active (last push 2026-11-15) and still on v5. | https://github.com/MrPrimate/ddb-importer |

Summary: route A broke once without warning (2020, about 2 days' notice, path and format both changed). The v5 path has been stable for about 5 years. Field-level drift inside the payload is continuous, so ddb-importer needs regular fixes (its source contains special cases such as a label typo correction in `#sourceFixes`). Route B is stable as a feature, but it is a rendered PDF, not data. Route D breaks whenever the sheet's DOM changes.

## 4. JSON shape (route A `data`, and the same object in route C)

All paths below are relative to the character object (`data` in the raw response, `ddb.character` in ddb-importer). Types come from ddb-importer `src/types/ddb-character-source.d.ts` and `src/types/ddb-base.d.ts`. Derivation logic comes from `src/parser/character/*.ts`. Repo: https://github.com/MrPrimate/ddb-importer

**The payload holds inputs, not results.** Final ability scores, modifiers, proficiency bonus, save and skill bonuses, max HP and AC are **not** stored as finished numbers. Every consumer recomputes them from base values plus a list of modifiers, the way D&D Beyond's own sheet does in the browser.

### Abilities
- `stats: { id, name, value }[]`, where `id` is 1-6 for STR, DEX, CON, INT, WIS, CHA and `value` is the base score before bonuses.
- `bonusStats[]`: manual "other bonus" per ability, applied regardless of the cap. `overrideStats[]`: manual override that replaces the computed score when it is non-zero.
- Racial, background (2024), feat, class and item bonuses come from `modifiers` entries with `type: "bonus"` and `subType: "<ability>-score"` (for example `strength-score`), plus `type: "set"` (items such as Gauntlets of Ogre Power), plus cap changes through `ability-score-maximum` and free-text `restriction` strings such as "Maximum of 20".
- Final score in ddb-importer `_getAbilities`: `override || max(set, min(cap, base + bonuses) + bonusStats)`. The ability modifier is never in the payload; it is `floor((score - 10) / 2)`.

### Level and class
- `classes: IDDBClass[]`, each with `level`, `isStartingClass`, `definition` (name, hit dice, and so on) and `subclassDefinition`. There is no total-level field: total level is the sum of `classes[].level`. Proficiency bonus is not stored and comes from total level.
- XP: `currentXp`.

### Species
- The field is still called `race` (`IDDBRace`: `fullName`, `baseRaceName`, `baseName`, `subRaceShortName`, `isLegacy`, `isHomebrew`, `speciesGroupId`, `racialTraits[]`, `sources[]`), even for 2024 species.
- `background` is separate (`background.definition`, including `grantedFeats` in 2024).

### Modifiers (where proficiencies and bonuses live)
- `modifiers: { race, class, background, item, feat, condition }`, each an array of `IDDBModifier`: `type` (`bonus`, `set`, `proficiency`, `expertise`, `half-proficiency`, `ignore`, ...), `subType` (kebab-case target), `friendlySubtypeName` (display label), `value`, `fixedValue`, `statId`, `restriction` (free text), `isGranted`, `requiresAttunement`, `componentId` / `componentTypeId` (which feature or item granted it), `availableToMulticlass`, `dice`.
- Class modifiers apply only for features the class has reached, and multiclass flags matter (`getChosenClassModifiers`). Item modifiers apply only when the item is equipped, and attuned if it needs attunement (`getActiveItemModifiers`).
- The proxy also returns `unfilteredModifiers` (`filterModifiers: false` in ddb-importer's request). That is a proxy-side addition, not part of the raw response.

### Saving throw proficiency
- A `modifiers` entry with `type: "proficiency"` and `subType: "<ability>-saving-throws"` (for example `wisdom-saving-throws`). Save bonuses are `type: "bonus"` on the same subType. Manual overrides are in `characterValues`.

### Skill proficiency and expertise
- A `modifiers` entry whose `friendlySubtypeName` equals the skill label: `type: "proficiency"` is 1x, `type: "expertise"` is 2x. Jack of All Trades is `type: "half-proficiency"` with `subType: "ability-checks"`. Skill bonuses are `type: "bonus"` with the skill subType, and passive bonuses use `passive-<skill>`.
- Manual per-skill override: `characterValues` entry with `typeId: 26` and `valueId` set to the skill id. Custom skills: `customProficiencies[]`.
- Source: `getSkillProficiency` and `getCustomSkillProficiency` in https://github.com/MrPrimate/ddb-importer/blob/main/src/parser/character/skills.ts

### Hit points
- Stored: `baseHitPoints` (rolled or fixed HP from class levels, **without** CON), `bonusHitPoints` (manual max-HP adjustment), `overrideHitPoints` (manual max), `removedHitPoints` (damage taken), `temporaryHitPoints`.
- Derived: max = `overrideHitPoints` if set, otherwise `baseHitPoints + CON mod x total level + bonusHitPoints` plus modifiers `hit-points-per-level` (per class level or total level, for example Tough) and `hit-points`. Current = max - `removedHitPoints`. The CON modifier itself has to be derived first (see Abilities). Source: https://github.com/MrPrimate/ddb-importer/blob/main/src/parser/character/hp.ts

### Armor class
- Not stored. Computed from equipped `inventory[]` items (`definition.armorClass`, `armorTypeId`, where 4 is a shield), DEX caps by armor type, `type: "bonus"` / `subType: "armor-class"` modifiers, unarmored defense `type: "set"` / `subType: "unarmored-armor-class"` with `statId` (Monk, Barbarian), `ignore` / `unarmored-dex-ac-bonus`, dual-wield bonuses, and manual values in `characterValues` (`typeId: 1` is the AC override; typeIds 2 and 3 are further AC adjustments). Source: https://github.com/MrPrimate/ddb-importer/blob/main/src/parser/character/ac.ts (about 25 KB of logic).

### Other fields present
- `name`, `notes` (object), `traits` (object), `inventory`, `spells`, `feats`, `choices`, `options`, `actions`, `characterValues`, `conditions`, `deathSaves`, `currencies`, `preferences`, `configuration`, `campaign`, `userId`, `username`, `readonlyUrl`, `dateModified`. Large `definition` objects hold rules text.

### Implication for map #19's `systemData`
Map #19 wants six abilities, level, class, species, skill proficiency/expertise, save proficiencies, and HP/AC as display-only values. From the shape above:
- Directly readable: base ability scores, class names and levels, species name, the presence of proficiency and expertise modifiers, `baseHitPoints`, `overrideHitPoints`, `removedHitPoints`, `temporaryHitPoints`.
- Needs a modifier engine: final ability scores (species/background/feat/item bonuses, set, caps, overrides), max HP (CON, per-level bonuses), AC (armor, items, unarmored formulas). ddb-importer's versions of these are thousands of lines and full of special cases. A partial engine gives numbers that differ from the player's sheet.
- Alternative not tested: the user types final AC and HP, or Constancia shows them as display-only values entered by the player, and the import fills only the fields it can read directly.

## 5. What the Progeny import does (the bar a Beyond import would match)

Code: `packages/systems/src/vtm-v5/progeny.ts`, `apps/backend/src/services/character-sheets.ts` (`importPlayerCharacterFromProgeny`), `apps/backend/src/routes/player-character-routes.ts`, `apps/backend/src/schemas.ts` (`progenyVtmCharacterBodySchema`), `apps/frontend/app/components/character-sheet/progeny-import-form.tsx`.

- **Input route:** the player uploads a JSON file the source tool exported (route C style). Constancia never contacts Progeny. Frontend limit: under 1 MB, must be a `.json` file, parsed in the browser.
- **One pure parser in `packages/systems`:** `parseProgenyVtmCharacter(value: unknown)`, used by both the frontend (preview and validation before submit) and the backend (authoritative parse).
- **Endpoint:** `POST .../sheet/imports/progeny` in the player-character routes. A session with a Discord identity is required (403 otherwise). The player's sheet must exist (404 otherwise). The campaign's Game System must be `vtm-v5` (400 "Progeny imports are only supported for VTM V5 campaigns" otherwise). A Fastify JSON schema requires `name`, `attributes`, `skills` and `version`.
- **Validation and sanitising:** deep-clones as JSON, rejecting non-finite numbers and non-JSON values. Drops `__proto__`, `constructor` and `prototype` keys. Trims `name` (required, 80 chars max), `description` (becomes backstory) and `notes` (4000 chars max each). Requires an integer `version >= 1`; `characterVersion` is optional and must be an integer >= 0.
- **Stat normalisation:** matches keys case-insensitively, ignoring spaces, `_` and `-`, against the system's own `VTM_ATTRIBUTES` and `VTM_SKILLS` lists. Every expected stat is filled; a missing stat becomes 0. Each value must be an integer from 0 to 5. Unknown stat keys are dropped from the normalised groups.
- **Mapping:** returns `{ source, gameName, backstory, notes, systemData }`. `systemData` = every non-reserved top-level key from the export (passed through), plus normalised `attributes` and `skills`, plus `systemData.progeny = { source: 'progeny', version, id?, player?, chronicle?, characterVersion? }` as provenance.
- **Persist:** updates `gameName`, `backstory` and `notes`, and **shallow-merges** the imported `systemData` over the existing `systemData`. Import replaces; it does not ask.
- **Errors:** `ProgenyImportError` with user-facing messages becomes a 400.
- **Tests:** `packages/systems/src/__tests__/progeny-import.test.ts`, `apps/backend/src/__tests__/character-sheets.test.ts`.

What a Beyond import would need, compared with Progeny:

| Progeny property | Beyond equivalent |
|---|---|
| User-held export file the user chooses to share | No official JSON export. Route C relies on the user opening an undocumented endpoint URL. Route B (PDF) needs PDF form-field extraction. |
| Export has a `version` field | The raw response has no schema version, and the path version (`v5`) has not changed with 2024 content. Format drift cannot be detected from the payload. |
| Stats are final values (0-5 dots) | Stats are inputs. Final values need the modifier engine described in section 4. |
| Fixed key list, missing = 0, range check | Abilities are keyed by numeric `id` 1-6, and skills by labels or ids inside modifiers. Range checks are possible on base scores (1-30). |
| Small payload | Raw payloads routinely include full rules text for items, spells and features. A 1 MB limit is likely too small for high-level casters **(unverified, no sample measured)**. |
| Pass-through of unknown keys into `systemData` | Passing the Beyond payload through would store Wizards' rules text and non-SRD content in `systemData`. That conflicts with map #19's SRD-only content rule and the "no spells, inventory or features" scope. Progeny's pass-through rule would not carry over as written. |
| Provenance block `systemData.progeny` | Natural equivalent: character `id`, `readonlyUrl`, `dateModified`. |
| Shared parser in `packages/systems`, gated by system id | Same pattern applies, gated on the D&D Game System id. |

## Open questions a go/no-go must settle
- Is route C (the user pastes the JSON they opened themselves) acceptable under the June 2026 ToS reading, or is the 2020 "won't block" staff statement still the operative position? Only Wizards can answer this.
- Is route A's server-side fetch acceptable for public characters? It is an automated request from Constancia's servers to an undocumented service.
- How far should derived values go: none (base scores, proficiency flags, display HP/AC typed by the player), partial, or full ddb-importer-grade?
- What is a real 2024 payload size? A captured public sample would answer the 1 MB question and confirm the shape against live data rather than ddb-importer's types.
