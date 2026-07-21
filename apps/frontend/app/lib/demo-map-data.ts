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

export const demoScenes: SceneSummaryProjection[] = [
  { id: 'demo-scene-elysium', name: 'Elysium', hasMap: true, pegCount: 3 },
  { id: 'demo-scene-docks', name: 'The Docks', hasMap: false, pegCount: 0 },
];

export const demoSceneDetails: Record<string, SceneDetailProjection> = {
  'demo-scene-elysium': {
    id: 'demo-scene-elysium',
    name: 'Elysium',
    mapAssetId: 'demo-map-asset',
    mapUrl: demoMapImage,
    pegs: [
      {
        id: 'demo-peg-event',
        kind: 'event',
        x: 0.22,
        y: 0.3,
        target: { id: 'demo-event-1', name: 'The Prince arrives', status: 'ready' },
      },
      {
        id: 'demo-peg-npc',
        kind: 'npc',
        x: 0.62,
        y: 0.44,
        target: { id: 'demo-npc-1', name: 'Marcel', imageUrl: null },
      },
      {
        id: 'demo-peg-lore',
        kind: 'lore',
        x: 0.71,
        y: 0.86,
        target: { id: 'demo-lore-1', title: 'Elysium Bells' },
      },
    ],
  },
  'demo-scene-docks': {
    id: 'demo-scene-docks',
    name: 'The Docks',
    mapAssetId: null,
    mapUrl: null,
    pegs: [],
  },
};

export const demoMapCandidates: MapWorkspaceCandidates = {
  events: [
    { id: 'demo-event-1', kind: 'event', label: 'The Prince arrives' },
    { id: 'demo-event-2', kind: 'event', label: 'Spot the sigil' },
  ],
  npcs: [
    { id: 'demo-npc-1', kind: 'npc', label: 'Marcel' },
    { id: 'demo-npc-2', kind: 'npc', label: 'Regent Hale' },
  ],
  lore: [
    { id: 'demo-lore-1', kind: 'lore', label: 'Elysium Bells' },
    { id: 'demo-lore-2', kind: 'lore', label: 'The Camarilla' },
  ],
};
