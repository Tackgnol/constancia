import type { Archetype } from '../vtm-v5/data.js';
import type { NpcSystemBlockDefinition, StatSchema } from '@constancia/contracts';

export const MB_STAT_SCHEMA: StatSchema = {
  groups: [],
};

export const MB_CLASSES: Archetype[] = [
  {
    name: 'Fanged Deserter',
    icon: 'Fanged Deserter icon.png',
    description:
      "You have thirty or so friends who never let you down: YOUR TEETH. Disloyal, deranged or simply uncontrollable, any group that didn't boot you out you left anyway. But your parliament of teeth—enormous, protruding, thick and sharp—have always been your allies.",
  },
  {
    name: 'Gutterborn Scum',
    icon: 'Gutterborn Scum icon.png',
    description:
      "An ill star smiled upon your birth. Poverty, crime and bad parenting didn't help either. In your community an honest day's work was never an option. Not that you ever tried, what are you, some kind of mug? A razor blade and a moonless night are worth a week of chump-work.",
  },
  {
    name: 'Esoteric Hermit',
    icon: 'Esoteric Hermit icon.png',
    description:
      "The stone of your cave is one with the stars. Silence and perfection. Now the chaos of a fallen world disturbs your rituals and the caul of night grows blacker than your cavern's gloom. Irritating!",
  },
  {
    name: 'Wretched Royalty',
    icon: 'Wretched Royalty icon.png',
    description:
      'Bowed down only by the memories of your own lost glory, you could never submit to anyone else. Not you, of noble blood!',
  },
  {
    name: 'Heretical Priest',
    icon: 'Heretical Priest icon.png',
    description:
      'Hunted by the Two-Headed Basilisks of the One True Faith, this heretic can be found raving in ruins, traipsing endlessly down dusty roads and desecrating cathedrals by night.',
  },
  {
    name: 'Occult Herbmaster',
    icon: 'Occult Herbmaster icon.png',
    description:
      'Born of the mushroom, raised in the glade, watched by the eye of the moon in a silverblack pool.',
  },
];

export const MB_NPC_BLOCKS: NpcSystemBlockDefinition[] = [
  {
    blockType: 'creature-type',
    label: 'Creature Type',
    description: 'What sort of horror or being this NPC represents.',
    editor: 'text',
    placeholder: 'Wretched Royalty, undead brute, apostate…',
    renderVariant: 'chip',
    defaultValue: '',
  },
  {
    blockType: 'omen',
    label: 'Omen',
    description: 'A brief atmospheric signal that follows them into a scene.',
    editor: 'textarea',
    placeholder: 'Rot in the air, bells at the edge of hearing…',
    renderVariant: 'panel',
    defaultValue: '',
  },
  {
    blockType: 'mork-borg-stats',
    label: 'Mörk Borg Stats',
    description: 'Flexible stat payload for DRs, morale, attacks, or special rules.',
    editor: 'json',
    placeholder: '{"hp": 12, "morale": 7, "dr": 14}',
    renderVariant: 'stats',
    defaultValue: {},
  },
];
