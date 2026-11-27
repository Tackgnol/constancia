import type {
  ArchetypeOption,
  NpcSystemBlockDefinition,
  StatField,
  StatSchema,
} from '@constancia/contracts';

export const SRD_5E_ATTRIBUTION =
  'This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Class and species summaries are adapted from the SRD 5.2.1.';

export const FIVE_E_ABILITIES = [
  { value: 'str', label: 'Strength', short: 'STR' },
  { value: 'dex', label: 'Dexterity', short: 'DEX' },
  { value: 'con', label: 'Constitution', short: 'CON' },
  { value: 'int', label: 'Intelligence', short: 'INT' },
  { value: 'wis', label: 'Wisdom', short: 'WIS' },
  { value: 'cha', label: 'Charisma', short: 'CHA' },
] as const;

export type FiveEAbility = (typeof FIVE_E_ABILITIES)[number]['value'];

/** SRD 5.2.1 p. 9: the ability each skill most often uses. The GM may pair a skill with another ability. */
export const FIVE_E_SKILLS = [
  { value: 'acrobatics', label: 'Acrobatics', ability: 'dex' },
  { value: 'animalHandling', label: 'Animal Handling', ability: 'wis' },
  { value: 'arcana', label: 'Arcana', ability: 'int' },
  { value: 'athletics', label: 'Athletics', ability: 'str' },
  { value: 'deception', label: 'Deception', ability: 'cha' },
  { value: 'history', label: 'History', ability: 'int' },
  { value: 'insight', label: 'Insight', ability: 'wis' },
  { value: 'intimidation', label: 'Intimidation', ability: 'cha' },
  { value: 'investigation', label: 'Investigation', ability: 'int' },
  { value: 'medicine', label: 'Medicine', ability: 'wis' },
  { value: 'nature', label: 'Nature', ability: 'int' },
  { value: 'perception', label: 'Perception', ability: 'wis' },
  { value: 'performance', label: 'Performance', ability: 'cha' },
  { value: 'persuasion', label: 'Persuasion', ability: 'cha' },
  { value: 'religion', label: 'Religion', ability: 'int' },
  { value: 'sleightOfHand', label: 'Sleight of Hand', ability: 'dex' },
  { value: 'stealth', label: 'Stealth', ability: 'dex' },
  { value: 'survival', label: 'Survival', ability: 'wis' },
] as const satisfies readonly { value: string; label: string; ability: FiveEAbility }[];

export type FiveESkill = (typeof FIVE_E_SKILLS)[number]['value'];

/** Skill training, stored as a number 0–2; code reads and writes it only through these names. */
export enum ProficiencyTier {
  Untrained = 0,
  Proficient = 1,
  Expertise = 2,
}

/** The stats key for an ability's saving throw; suffixed so it can't collide with the ability itself. */
export function saveKey(ability: FiveEAbility): `${FiveEAbility}Save` {
  return `${ability}Save`;
}

const numberField = (key: string, label: string, min: number, max: number, defaultValue: number) =>
  ({ key, label, type: 'number', min, max, defaultValue }) satisfies StatField;

export const FIVE_E_STAT_SCHEMA: StatSchema = {
  groups: [
    { key: 'core', label: 'Core', fields: [numberField('level', 'Level', 1, 20, 1)] },
    {
      key: 'abilities',
      label: 'Abilities',
      fields: FIVE_E_ABILITIES.map((ability) =>
        numberField(ability.value, ability.label, 1, 30, 10),
      ),
    },
    {
      key: 'saves',
      label: 'Saving throw proficiencies',
      fields: FIVE_E_ABILITIES.map((ability) => ({
        key: saveKey(ability.value),
        label: `${ability.label} save`,
        type: 'boolean' as const,
        defaultValue: false,
      })),
    },
    {
      key: 'skills',
      label: 'Skills',
      fields: FIVE_E_SKILLS.map((skill) =>
        numberField(
          skill.value,
          skill.label,
          ProficiencyTier.Untrained,
          ProficiencyTier.Expertise,
          ProficiencyTier.Untrained,
        ),
      ),
    },
    {
      key: 'vitals',
      label: 'Vitals',
      fields: [
        numberField('hpMax', 'Max HP', 0, 999, 0),
        numberField('hpCurrent', 'Current HP', 0, 999, 0),
        numberField('ac', 'Armor Class', 0, 40, 10),
      ],
    },
  ],
};

export const FIVE_E_CLASSES: ArchetypeOption[] = [
  {
    name: 'Barbarian',
    description:
      'A front-line warrior who channels Rage into resistance to physical harm and extra Strength damage.',
  },
  {
    name: 'Bard',
    description:
      'A performer and versatile caster who draws on Charisma, picks any three skills and inspires allies.',
  },
  {
    name: 'Cleric',
    description:
      'A divine caster serving the gods, using Wisdom to heal, protect and channel divinity.',
  },
  {
    name: 'Druid',
    description:
      'A Wisdom caster bound to nature, who can take on beast shapes and call on primal magic.',
  },
  {
    name: 'Fighter',
    description:
      'A weapons expert with the widest armour and weapon training, using Strength or Dexterity.',
  },
  {
    name: 'Monk',
    description:
      'A Dexterity-and-Wisdom martial artist who fights unarmed and unarmoured with focused discipline.',
  },
  {
    name: 'Paladin',
    description:
      'A Strength-and-Charisma holy warrior sworn to an oath, blending armour, smites and auras.',
  },
  {
    name: 'Ranger',
    description: 'A Dexterity-and-Wisdom wilderness hunter and tracker with nature magic.',
  },
  {
    name: 'Rogue',
    description:
      'A Dexterity specialist in stealth and skills, striking hard with Sneak Attack. Picks four skills.',
  },
  {
    name: 'Sorcerer',
    description: 'A Charisma caster with innate magic, shaped through Metamagic.',
  },
  {
    name: 'Warlock',
    description:
      'A Charisma caster whose magic comes from a pact with an otherworldly patron, with eldritch invocations.',
  },
  {
    name: 'Wizard',
    description: 'An Intelligence caster who learns spells from a spellbook through study.',
  },
];

export const FIVE_E_SPECIES: ArchetypeOption[] = [
  {
    name: 'Dragonborn',
    description:
      'Dragon-descended folk who breathe elemental energy and resist the damage type of their draconic ancestor.',
  },
  {
    name: 'Dwarf',
    description:
      'Hardy folk with long darkvision, resistance to poison and an extra hit point each level. They can sense through stone.',
  },
  {
    name: 'Elf',
    description:
      'Long-lived, trance-resting folk of Drow, High Elf or Wood Elf lineage. They resist being charmed.',
  },
  {
    name: 'Gnome',
    description:
      'Small, clever folk with advantage on mental saves and Forest or Rock Gnome magic.',
  },
  {
    name: 'Goliath',
    description:
      "Towering giant-kin who carry one giant ancestor's boon and can grow to Large size.",
  },
  {
    name: 'Halfling',
    description:
      'Small, brave folk whose Luck lets them reroll 1s. They slip past bigger creatures.',
  },
  {
    name: 'Human',
    description:
      'Adaptable folk who gain an extra skill, an Origin feat and Heroic Inspiration after each long rest.',
  },
  {
    name: 'Orc',
    description:
      'Enduring folk who dash in bursts of adrenaline and can shrug off a killing blow once per long rest.',
  },
  {
    name: 'Tiefling',
    description:
      'Folk touched by a fiendish legacy (Abyssal, Chthonic or Infernal) that grants resistance and innate spells.',
  },
];

/** SRD 5.2.1 creature types. */
export const FIVE_E_CREATURE_TYPES = [
  'Aberration',
  'Beast',
  'Celestial',
  'Construct',
  'Dragon',
  'Elemental',
  'Fey',
  'Fiend',
  'Giant',
  'Humanoid',
  'Monstrosity',
  'Ooze',
  'Plant',
  'Undead',
] as const;

/** NPC system blocks the GM fills in by hand; there is no monster library. */
export const FIVE_E_NPC_BLOCKS: NpcSystemBlockDefinition[] = [
  {
    blockType: '5e-srd-creature-type',
    label: 'Creature type',
    description: 'What kind of creature this NPC is.',
    editor: 'select',
    options: FIVE_E_CREATURE_TYPES.map((type) => ({ value: type, label: type })),
    renderVariant: 'chip',
    display: 'headline',
    defaultValue: 'Humanoid',
  },
  {
    blockType: '5e-srd-challenge-rating',
    label: 'Challenge rating',
    description: 'How dangerous the NPC is, for example 1/4, 2 or 13.',
    editor: 'text',
    placeholder: 'CR 1/4, 2, 13…',
    renderVariant: 'chip',
    display: 'headline',
    defaultValue: '',
  },
  {
    blockType: '5e-srd-stat-summary',
    label: 'Stat summary',
    description: 'A compact stat line: Armor Class, hit points and the six ability scores.',
    editor: 'json',
    placeholder:
      '{"ac": 15, "hp": 52, "str": 16, "dex": 12, "con": 14, "int": 10, "wis": 11, "cha": 13}',
    renderVariant: 'stats',
    display: 'detail',
    defaultValue: { ac: 10, hp: 10, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  },
];
