import type { NpcSystemBlockDefinition } from '@constancia/contracts';

export interface Archetype {
  name: string;
  icon: string;
  description: string;
}

export const VTM_CLANS: Archetype[] = [
  {
    name: 'Banu Haqim',
    icon: 'Banu icon.png',
    description:
      'Judges of transgression, intellectuals and lawyers, assassins and blood sorcerers; once known as Assamites, the Children of Haqim have recently joined the ranks of the Camarilla.',
  },
  {
    name: 'Brujah',
    icon: 'Brujah icon.png',
    description:
      'Fighters against the system, rebels against injustice, petty criminals, raging rabble, activists, agents of change, warrior philosophers fallen from grace.',
  },
  {
    name: 'Gangrel',
    icon: 'Gangrel icon.png',
    description:
      'The clan closest to their inner Beast, from feral soldiers to folkloric travelers and free spirits, from inhabitants of the urban jungle to boardroom sharks.',
  },
  {
    name: 'Hecata',
    icon: 'Hecata icon.png',
    description:
      'Necromancers, Graverobbers, Lazarenes. The Hecata are as much a Family as they are a Clan; the only true Independents in these nights, the separate Clans of Death, including the Giovanni, Cappadocians, Samedi and others have now united as the Hecata. For them, the Family is everything; and if you are not one of them, you will never know how deep the Blood runs.',
  },
  {
    name: 'Lasombra',
    icon: 'Lasombra icon.png',
    description:
      'Winners at life, religious figures, manipulative shadow masters, social climbers, ruthless fighters; once a pillar of the Sabbat, they’ve now begun defecting to the ranks of the Camarilla.',
  },
  {
    name: 'Malkavian',
    icon: 'Malkavian icon.png',
    description:
      'Seers and jesters affected by supernatural madness, psychological masters, oracles concealing and revealing truths and themselves.',
  },
  {
    name: 'Ministry',
    icon: 'Ministry icon.png',
    description:
      'The rebranded Followers of Set, refused admission by the Camarilla and welcomed among the Anarchs. Both liars and liberators, seekers of freedom from chains through pain, pleasure, and any other means, occult cultists and preachers, standing between refusal of social norms and true depravity.',
  },
  {
    name: 'Nosferatu',
    icon: 'Nosferatu icon.png',
    description:
      'Permanently afflicted by supernatural hideousness, they hide in the dark as gatherers of secrets, information procurers, hackers, elusive enforcers, often with a connection to rats and outcasts.',
  },
  {
    name: 'Ravnos',
    icon: 'Ravnos icon.png',
    description:
      'A nomadic clan of masters of misdirection, these rogues and illusionists prefer to not bare fangs for something they can obtain with subtler methods.',
  },
  {
    name: 'Salubri',
    icon: 'Salubri icon.png',
    description:
      'Few exist in the modern nights; unlike other clans they are not embraced on a whim. They instead are carefully chosen by their sire to complete a task through their inquisitive nature, nigh-pious with the tenacity to survive through difficulties.',
  },
  {
    name: 'Toreador',
    icon: 'Toreador icon.png',
    description:
      'Seekers of emotion, romance, cruelty, beauty… anything that can remind them of lost humanity and sentiment. Artists, divas, social butterflies, appraisers and lovers of beauty.',
  },
  {
    name: 'Tremere',
    icon: 'Tremere icon.png',
    description:
      'Scholars and counsellors of the occult; heavily hit by the Second Inquisition, the warlocks guard their secrets of sorcery, hoarding and searching for knowledge.',
  },
  {
    name: 'Tzimisce',
    icon: 'Tzimisce icon.png',
    description:
      'The Dragons of Kindred, this clan embraces to own. They do not care if their charges live well, but aim simply to control. Those who are loyal to the Tzimisce are often so more out of fear than love.',
  },
  {
    name: 'Ventrue',
    icon: 'Ventrue icon.png',
    description:
      'Vampiric aristocracy, guardians of the Traditions and a pillar of the Camarilla, businessmen and politicians, sometimes archaic traditionalists, sometimes true entrepreneurs.',
  },
  {
    name: 'Caitiff',
    icon: 'Caitiff icon.png',
    description:
      'Clanless and curse-less, the only trait that the Caitiff share is not having inherited the bane of the other Cainites and finding themselves outcast by Kindred belonging to any true lineage.',
  },
  {
    name: 'Thin-blood',
    icon: 'Thinblood icon.png',
    description:
      'With the thickness of vitae dwindling, the Duskborn are too far removed from Caine to share his curse or reap the full benefits of vampirism. Thrust into the world of the night and disliked by True Kindred, they must survive the night by finding a way in or a way out.',
  },
];

export const VTM_NPC_BLOCKS: NpcSystemBlockDefinition[] = [
  {
    blockType: 'clan',
    label: 'Clan',
    description: 'Core Kindred lineage or faction identity.',
    editor: 'select',
    options: VTM_CLANS.map((clan) => ({
      value: clan.name,
      label: clan.name,
      description: clan.description,
      icon: clan.icon,
    })),
    renderVariant: 'chip',
    defaultValue: '',
  },
  {
    blockType: 'title',
    label: 'Title',
    description: 'Court title, station, or role in the city.',
    editor: 'text',
    placeholder: 'Prince, Sheriff, Regent…',
    renderVariant: 'chip',
    defaultValue: '',
  },
  {
    blockType: 'demeanor',
    label: 'Demeanor',
    description: 'The surface read the coterie gets at a glance.',
    editor: 'textarea',
    placeholder: 'Cold, ceremonial, always speaking like a verdict…',
    renderVariant: 'panel',
    defaultValue: '',
  },
  {
    blockType: 'vtm5-stats',
    label: 'VTM V5 Stats',
    description: 'Flexible stat payload for disciplines, pools, or combat notes.',
    editor: 'json',
    placeholder: '{"physical": {"strength": 3}, "disciplines": {"dominate": 4}}',
    renderVariant: 'stats',
    defaultValue: {},
  },
];

