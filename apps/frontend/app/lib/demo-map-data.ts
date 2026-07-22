import type {
  MapWorkspaceCandidates,
  SceneDetailProjection,
  SceneSummaryProjection,
} from './map-workspace-projection.js';

export const demoMapCampaignId = 'demo-campaign';

/**
 * A tiny inline SVG so the demo map renders without a network request or a binary asset in the
 * repository. Slice 9 seeds the richer demo states on top of this.
 */
const demoMapImage =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" role="img">
      <rect width="800" height="500" fill="#1b1720"/>
      <path d="M0 360 H800" stroke="#3b3242" stroke-width="6"/>
      <path d="M300 0 V500" stroke="#3b3242" stroke-width="6"/>
      <rect x="80" y="80" width="170" height="120" fill="#2a2330" stroke="#544860"/>
      <rect x="380" y="120" width="220" height="160" fill="#2a2330" stroke="#544860"/>
      <rect x="420" y="390" width="300" height="80" fill="#2a2330" stroke="#544860"/>
    </svg>`,
  );

/**
 * The one store behind demo Map: every fixture scene's full detail, in display order. `demoScenes`
 * and `demoSceneDetails` below are both derived from this rather than hand-kept in sync, so
 * `hasMap`/`pegCount` can never drift from the pegs a scene actually has. `demo-scene-commands.ts`
 * seeds its own client-side store from this same array and keeps deriving summaries the same way,
 * so a scene created or edited during a session stays consistent everywhere it is shown.
 */
export const demoSceneFixtures: SceneDetailProjection[] = [
  {
    id: 'demo-scene-elysium',
    name: 'Elysium',
    mapUrl: demoMapImage,
    pegs: [
      {
        id: 'demo-peg-event',
        kind: 'event',
        x: 0.22,
        y: 0.3,
        target: { id: 'event-elysium-opens', name: 'Elysium opens', status: 'ready' },
      },
      {
        id: 'demo-peg-npc',
        kind: 'npc',
        x: 0.62,
        y: 0.44,
        target: { id: 'demo-prince-adrian-voss', name: 'Prince Adrian Voss', imageUrl: null },
      },
      {
        id: 'demo-peg-lore',
        kind: 'lore',
        x: 0.71,
        y: 0.86,
        target: { id: 'lore-elysium-bells', title: 'Elysium Bells' },
      },
    ],
  },
  {
    id: 'demo-scene-docks',
    name: 'The Docks',
    mapUrl: null,
    pegs: [],
  },
];

export function toDemoSceneSummary(scene: SceneDetailProjection): SceneSummaryProjection {
  return {
    id: scene.id,
    name: scene.name,
    hasMap: scene.mapUrl !== null,
    pegCount: scene.pegs.length,
  };
}

export const demoScenes: SceneSummaryProjection[] = demoSceneFixtures.map(toDemoSceneSummary);

export const demoSceneDetails: Record<string, SceneDetailProjection> = Object.fromEntries(
  demoSceneFixtures.map((scene) => [scene.id, scene]),
);

/**
 * Ids match the rest of the demo campaign so NPC and lore pegs deep link to real records. The list
 * is long enough that searching narrows it and that already-placed targets are visibly disabled.
 */
export const demoMapCandidates: MapWorkspaceCandidates = {
  events: [
    { id: 'event-elysium-opens', kind: 'event', label: 'Elysium opens' },
    { id: 'event-stealth-approach', kind: 'event', label: 'Stealth approach' },
    { id: 'event-social-manipulation', kind: 'event', label: 'Social manipulation' },
    { id: 'event-the-betrayal', kind: 'event', label: 'The betrayal' },
    { id: 'event-princes-warning', kind: 'event', label: "The Prince's warning" },
  ],
  npcs: [
    { id: 'demo-prince-adrian-voss', kind: 'npc', label: 'Prince Adrian Voss' },
    { id: 'demo-mara-the-veiled', kind: 'npc', label: 'Mara the Veiled' },
  ],
  lore: [
    { id: 'lore-elysium-bells', kind: 'lore', label: 'Elysium Bells' },
    { id: 'lore-harpy-ledger', kind: 'lore', label: 'Harpy ledger' },
  ],
};
