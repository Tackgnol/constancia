# Research: SRD 5.2 content and attribution

Ticket: #21. Map: #19. Researched 2026-11-25.

## Answer in brief

- The current version is **SRD 5.2.1**, published 2025-05-01. It replaces 5.2.0 from 2025-04-22. Both are CC-BY-4.0. Build against 5.2.1 and attribute 5.2.1. [D&D Beyond SRD page][srd-page]
- The SRD has **12 classes**, with one subclass each, and **9 species**. It also has 4 backgrounds, 18 skills and the proficiency bonus table. All of it can ship under CC-BY-4.0 with the attribution statement below.
- The SRD contains **no flavour prose** for classes or species. Class sections open straight on the "Core X Traits" table, and species open on "Creature Type / Size / Speed". The archetype `description` strings therefore have to be written by us. The sample descriptions below are paraphrased from SRD facts.
- Attribution is **one fixed statement**, given by Wizards in the SRD's Legal Information page. Put it in the app UI and in the repo.
- **Do not** use "Dungeons & Dragons" or "D&D" in the system's display name. CC-BY-4.0 grants no trademark rights. The SRD explicitly allows "compatible with fifth edition" and "5E compatible".

Primary sources:
- [srd-page]: https://www.dndbeyond.com/srd (version list, licence, downloads)
- [srd-pdf]: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf (the SRD 5.2.1 text; page numbers below are the PDF's printed page numbers)
- [cc-by]: https://creativecommons.org/licenses/by/4.0/legalcode.en (the licence)
- [creator-faq]: https://www.dndbeyond.com/creator-faq
- [fcp]: https://company.wizards.com/en/legal/fancontentpolicy

[srd-page]: https://www.dndbeyond.com/srd
[srd-pdf]: https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
[cc-by]: https://creativecommons.org/licenses/by/4.0/legalcode.en
[creator-faq]: https://www.dndbeyond.com/creator-faq
[fcp]: https://company.wizards.com/en/legal/fancontentpolicy

## 1. Classes and species as archetype data

### Verbatim or paraphrase?

CC-BY-4.0 allows both. Either way, the attribution statement is required. CC-BY-4.0 §3(a)(1)(B) also requires that you "indicate if You modified the Licensed Material" when you share an adaptation. [cc-by] Three practical points:

- Rules facts, such as hit die, saves and skill lists, are what the SRD exists to license. Using them as data is fine.
- The SRD has no ready-made blurbs to copy, so the descriptions will be ours anyway (see the brief above). A short paraphrase that cites SRD facts is an adaptation. Cover it with the attribution statement plus "modified from the original" wording (see §4).
- Write descriptions from the SRD only. Do not lift Player's Handbook 2024 or D&D Beyond Basic Rules prose. Those are not CC-licensed: "The D&D Beyond Basic Rules cannot be used in content creation." [creator-faq]

### Classes (SRD 5.2.1 pp. 28-82)

"Likes", primary ability and complexity come from the Class Overview table (p. 18). Hit die, saves and skill choices come from each class's "Core Traits" table. The SRD subclass is the only subclass each class has in the SRD. [srd-pdf]

| Class | Likes | Primary ability | Hit die | Save proficiencies | Skill choices | SRD subclass |
|---|---|---|---|---|---|---|
| Barbarian | Battle | Strength | d12 | Str, Con | 2 of Animal Handling, Athletics, Intimidation, Nature, Perception, Survival | Path of the Berserker |
| Bard | Performing | Charisma | d8 | Dex, Cha | any 3 | College of Lore |
| Cleric | Gods | Wisdom | d8 | Wis, Cha | 2 of History, Insight, Medicine, Persuasion, Religion | Life Domain |
| Druid | Nature | Wisdom | d8 | Int, Wis | 2 of Animal Handling, Arcana, Insight, Medicine, Nature, Perception, Religion, Survival | Circle of the Land |
| Fighter | Weapons | Strength or Dexterity | d10 | Str, Con | 2 of Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Persuasion, Perception, Survival | Champion |
| Monk | Unarmed combat | Dexterity and Wisdom | d8 | Str, Dex | 2 of Acrobatics, Athletics, History, Insight, Religion, Stealth | Warrior of the Open Hand |
| Paladin | Defense | Strength and Charisma | d10 | Wis, Cha | 2 of Athletics, Insight, Intimidation, Medicine, Persuasion, Religion | Oath of Devotion |
| Ranger | Survival | Dexterity and Wisdom | d10 | Str, Dex | 3 of Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival | Hunter |
| Rogue | Stealth | Dexterity | d8 | Dex, Int | 4 of Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Persuasion, Sleight of Hand, Stealth | Thief |
| Sorcerer | Power | Charisma | d6 | Con, Cha | 2 of Arcana, Deception, Insight, Intimidation, Persuasion, Religion | Draconic Sorcery |
| Warlock | Occult lore | Charisma | d8 | Wis, Cha | 2 of Arcana, Deception, History, Intimidation, Investigation, Nature, Religion | Fiend Patron |
| Wizard | Spellbooks | Intelligence | d6 | Int, Wis | 2 of Arcana, History, Insight, Investigation, Medicine, Nature, Religion | Evoker |

Sample descriptions, written by us from the SRD facts above. They suit `Archetype.description`:

- **Barbarian**: A front-line warrior who channels Rage into resistance to physical harm and extra Strength damage. Strength, d12.
- **Bard**: A performer and versatile caster who draws on Charisma, picks any three skills and inspires allies.
- **Cleric**: A divine caster serving the gods, using Wisdom to heal, protect and channel divinity.
- **Druid**: A Wisdom caster bound to nature, who can take on beast shapes and call on primal magic.
- **Fighter**: A weapons expert with the widest armour and weapon training, using Strength or Dexterity.
- **Monk**: A Dexterity-and-Wisdom martial artist who fights unarmed and unarmoured with focused discipline.
- **Paladin**: A Strength-and-Charisma holy warrior sworn to an oath, blending armour, smites and auras.
- **Ranger**: A Dexterity-and-Wisdom wilderness hunter and tracker with nature magic.
- **Rogue**: A Dexterity specialist in stealth and skills, striking hard with Sneak Attack. Picks four skills.
- **Sorcerer**: A Charisma caster with innate magic, shaped through Metamagic.
- **Warlock**: A Charisma caster whose magic comes from a pact with an otherworldly patron, with eldritch invocations.
- **Wizard**: An Intelligence caster who learns spells from a spellbook through study.

### Species (SRD 5.2.1 pp. 83-86)

All nine species are Humanoid. [srd-pdf]

| Species | Size | Speed | Key traits (SRD) |
|---|---|---|---|
| Dragonborn | Medium | 30 ft | Draconic Ancestry (damage type), Breath Weapon, Damage Resistance, Darkvision 60, Draconic Flight (level 5) |
| Dwarf | Medium | 30 ft | Darkvision 120, Dwarven Resilience (poison), Dwarven Toughness (+1 HP per level), Stonecunning |
| Elf | Medium | 30 ft | Darkvision 60, Elven Lineage (Drow / High Elf / Wood Elf), Fey Ancestry, Keen Senses, Trance |
| Gnome | Small | 30 ft | Darkvision 60, Gnomish Cunning (Adv. on Int/Wis/Cha saves), Gnomish Lineage (Forest / Rock) |
| Goliath | Medium | 35 ft | Giant Ancestry (six giant boons), Large Form (level 5), Powerful Build |
| Halfling | Small | 30 ft | Brave, Halfling Nimbleness, Luck (reroll natural 1s), Naturally Stealthy |
| Human | Medium or Small | 30 ft | Resourceful (Heroic Inspiration), Skillful (one skill), Versatile (Origin feat) |
| Orc | Medium | 30 ft | Adrenaline Rush, Darkvision 120, Relentless Endurance |
| Tiefling | Medium or Small | 30 ft | Darkvision 60, Fiendish Legacy (Abyssal / Chthonic / Infernal), Otherworldly Presence |

Sample descriptions, written by us:

- **Dragonborn**: Dragon-descended folk who breathe elemental energy and resist the damage type of their draconic ancestor.
- **Dwarf**: Hardy folk with long darkvision, resistance to poison and an extra hit point each level. They can sense through stone.
- **Elf**: Long-lived, trance-resting folk of Drow, High Elf or Wood Elf lineage. They resist being charmed.
- **Gnome**: Small, clever folk with advantage on mental saves and Forest or Rock Gnome magic.
- **Goliath**: Towering giant-kin who carry one giant ancestor's boon and can grow to Large size.
- **Halfling**: Small, brave folk whose Luck lets them reroll 1s. They slip past bigger creatures.
- **Human**: Adaptable folk who gain an extra skill, an Origin feat and Heroic Inspiration after each long rest.
- **Orc**: Enduring folk who dash in bursts of adrenaline and can shrug off a killing blow once per long rest.
- **Tiefling**: Folk touched by a fiendish legacy (Abyssal, Chthonic or Infernal) that grants resistance and innate spells.

The SRD also has four backgrounds: Acolyte, Criminal, Sage and Soldier (p. 83). They are out of the map's scope but could be shipped.

Names are safe to use as-is. Wizards renamed the SRD items whose names were protected (for example *Mysterious Deck* and *Dragon Orb*), and none of the class, subclass or species names above were affected. [srd-page]

## 2. Skill-to-ability mapping

From the Skills table, SRD 5.2.1 p. 9. [srd-pdf] Constitution has no skills.

| Skill | Ability |
|---|---|
| Acrobatics | Dexterity |
| Animal Handling | Wisdom |
| Arcana | Intelligence |
| Athletics | Strength |
| Deception | Charisma |
| History | Intelligence |
| Insight | Wisdom |
| Intimidation | Charisma |
| Investigation | Intelligence |
| Medicine | Wisdom |
| Nature | Intelligence |
| Perception | Wisdom |
| Performance | Charisma |
| Persuasion | Charisma |
| Religion | Intelligence |
| Sleight of Hand | Dexterity |
| Stealth | Dexterity |
| Survival | Wisdom |

Rules notes on the same pages:

- The table gives the ability a skill "most often applies to". The GM can pair a skill with a different ability (the SRD says the GM "has the ultimate say"), and so can some features, such as Barbarian Primal Knowledge. For the d20 block, treat the mapping as a default ability that can be overridden.
- Proficiency is never added more than once. Expertise doubles the bonus, and the bonus "can be multiplied only once and divided only once" (p. 8).
- A passive score is 10 plus the skill modifier. This matches the map's passive-score resolver. The Passive Perception lines in the SRD stat blocks follow the same formula.

## 3. Proficiency bonus by level

From the Proficiency Bonus table, SRD 5.2.1 p. 8. The same table covers monster CR. [srd-pdf]

| Level or CR | Bonus |
|---|---|
| up to 4 | +2 |
| 5-8 | +3 |
| 9-12 | +4 |
| 13-16 | +5 |
| 17-20 | +6 |
| 21-24 | +7 |
| 25-28 | +8 |
| 29-30 | +9 |

Characters only go up to level 20, so the values for characters run from +2 to +6. The rows from 21 up apply only to monster CR. For levels 1-20 the formula is `2 + floor((level - 1) / 4)`.

## 4. Attribution: exact text and placement

### Exact text

This is from the SRD 5.2.1 Legal Information page (p. 1). Use it verbatim: [srd-pdf]

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

The same page adds two conditions:

> Please do not include any other attribution to Wizards or its parent or affiliates other than that provided above. You may, however, include a statement on your work indicating that it is "compatible with fifth edition" or "5E compatible."

So the statement is not a template to rephrase, and we must not add extra Wizards credit lines elsewhere, such as "D&D is a trademark of…" in the attribution block. If code is built against 5.2.0, the statement names 5.2.0. Targeting 5.2.1 avoids that.

### What CC-BY-4.0 adds

- §3(a)(1)(B): indicate if the material was modified. Our archetype descriptions are adaptations, and the data is selected and restructured. Add a line such as "Class and species summaries are adapted from the SRD 5.2.1." This is CC's requirement, not Wizards' wording, so it sits beside the verbatim statement rather than inside it. [cc-by]
- §3(a)(2): conditions can be met "in any reasonable manner based on the medium, means, and context". For an app, a credits or about location reachable from where the content appears counts as reasonable. [cc-by]
- §2(b)(2): "Patent and trademark rights are not licensed under this Public License." [cc-by]

### Where it must appear

The SRD asks for the statement "in any of your work". [srd-pdf] Constancia distributes the content in two ways, so it needs the statement in both places:

1. **Repo / source distribution.** Put it in the D&D adapter's directory, for example a `NOTICE` or README next to `packages/systems/src/dnd-5e/data.ts`. Also reference it from the root README or a top-level `NOTICE`. The repo is GPL-3.0. The FSF lists CC-BY-4.0 as GPLv3-compatible, so the SRD data can sit in the repo. It stays CC-BY-licensed and still needs its notice.
2. **App UI (the work as users see it).** Show it where the system is shown or chosen, such as a frontend credits/about page, the Game System picker or detail, and the character sheet footer for D&D campaigns. The bot can show a short line in `/help` or the `/setup` system description that links to the full statement. This is the "reasonable manner" for each medium.

Because the statement is fixed text, the natural home in code is a field on the Game System adapter, such as an `attribution` string. The map already plans to move per-system UI facts onto the adapter. That way the frontend and bot render the same string. (This is direction only; the ticket excludes implementation.)

## 5. Trademark and naming

- CC-BY-4.0 grants no trademark rights (§2(b)(2)). [cc-by] "Dungeons & Dragons", "D&D", "D&D Beyond", the dragon ampersand and Wizards product names are Wizards trademarks. [creator-faq]
- The SRD licence explicitly allows "compatible with fifth edition" and "5E compatible". [srd-pdf] That is the only sanctioned phrasing.
- **Do not** use "Dungeons & Dragons" or "D&D" in the Game System display name or id, in marketing, or as a "D&D 5e" label. This includes "D&D 5e (2024)". It is not licensed, and the SRD's instruction against other Wizards attribution points the same way.
- **Recommended display name:** "5E (SRD 5.2.1)" or "Fifth Edition (SRD 5.2.1)", with a tagline "5E compatible". Use a neutral internal id such as `5e-srd` or `srd-5e`, not `dnd5e`. Plain words such as "fifth edition", "SRD" and "d20" are fine.
- The Fan Content Policy is **not** the route for this. It forbids Wizards' logos and trademarks, and it forbids charging for or gating access ("You can't require payments, surveys, downloads, subscriptions, or email registration…"). [fcp] Constancia requires login, so the SRD/CC-BY route is the right basis. It has no such restrictions, but it also gives no trademark use.

## Out of scope / not checked

- The SRD monster stat blocks are licensable on the same terms, but the map excludes a monster library.
- No lawyer reviewed this. The trademark advice follows the licence text and conservative practice, not a legal opinion.
- Unrelated but noticed: `packages/systems/src/mork-borg/data.ts` carries Mörk Borg class descriptions that look verbatim, and the repo has no attribution or licence notice for them. That is worth its own ticket.
