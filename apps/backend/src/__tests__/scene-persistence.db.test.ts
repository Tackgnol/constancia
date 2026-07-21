import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPrismaClient } from '../auth/prisma.js';

const runDatabaseIntegrationTests =
  process.env.CONSTANCIA_ENABLE_DB_TESTS === 'true' && typeof process.env.DATABASE_URL === 'string';
const describeDatabase = runDatabaseIntegrationTests ? describe : describe.skip;

// One namespace per run so cleanup never reaches unrelated rows.
const NS = 'scene-persistence-test';
const GUILD_ID = `${NS}-guild`;
const OTHER_GUILD_ID = `${NS}-guild-other`;
const USER_EMAIL = `${NS}@example.test`;

// Resolved lazily: getPrismaClient() throws without DATABASE_URL, and a module-level call would
// fail collection before describe.skip can take effect in environments with no test database.
const db = () => getPrismaClient();

/**
 * Prisma reports unique violations as P2002. Under the pg driver adapter `meta.target` is absent —
 * the offending fields sit in `meta.driverAdapterError` — so code plus model is the stable
 * discriminator the service layer should translate into a 409.
 */
async function expectUniqueViolation(operation: Promise<unknown>, modelName: string) {
  const error: unknown = await operation.then(
    () => null,
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(Error);
  const record = error as Record<string, unknown>;
  expect(record.code).toBe('P2002');
  expect((record.meta as { modelName?: unknown } | undefined)?.modelName).toBe(modelName);
}

type Fixtures = {
  campaignId: string;
  otherCampaignId: string;
  userId: string;
  eventId: string;
  npcId: string;
  loreEntryId: string;
};

async function removeNamespace() {
  await db().campaign.deleteMany({
    where: { discordGuildId: { in: [GUILD_ID, OTHER_GUILD_ID] } },
  });
  await db().user.deleteMany({ where: { email: USER_EMAIL } });
}

async function seed(): Promise<Fixtures> {
  const campaign = await db().campaign.create({
    data: { name: `${NS} campaign`, discordGuildId: GUILD_ID, gameSystemId: 'vtm-v5' },
  });
  const otherCampaign = await db().campaign.create({
    data: { name: `${NS} other campaign`, discordGuildId: OTHER_GUILD_ID, gameSystemId: 'vtm-v5' },
  });
  const user = await db().user.create({
    data: { name: `${NS} user`, email: USER_EMAIL },
  });
  const channel = await db().channel.create({
    data: { name: 'general', discordChannelId: `${NS}-channel`, campaignId: campaign.id },
  });
  const event = await db().event.create({
    data: { name: 'Ambush', type: 'scene', channelId: channel.id, campaignId: campaign.id },
  });
  const npc = await db().npc.create({ data: { name: 'Marcel', campaignId: campaign.id } });
  const loreEntry = await db().loreEntry.create({
    data: { title: 'The Camarilla', content: 'Old and tired.', campaignId: campaign.id },
  });

  return {
    campaignId: campaign.id,
    otherCampaignId: otherCampaign.id,
    userId: user.id,
    eventId: event.id,
    npcId: npc.id,
    loreEntryId: loreEntry.id,
  };
}

describeDatabase('scene persistence constraints', () => {
  let fx: Fixtures;

  beforeAll(async () => {
    await removeNamespace();
  });

  afterAll(async () => {
    await removeNamespace();
  });

  beforeEach(async () => {
    await removeNamespace();
    fx = await seed();
  });

  async function createScene(name = 'Elysium') {
    return db().scene.create({ data: { name, campaignId: fx.campaignId } });
  }

  async function createUploadAsset(overrides: { eventId?: string; sceneId?: string } = {}) {
    return db().uploadAsset.create({
      data: {
        userId: fx.userId,
        storageKey: `${NS}/${crypto.randomUUID()}.webp`,
        storageProvider: 'local',
        mimeType: 'image/webp',
        sizeBytes: 1024,
        originalMimeType: 'image/png',
        ...overrides,
      },
    });
  }

  it('accepts a peg with exactly one target', async () => {
    const scene = await createScene();

    const peg = await db().scenePeg.create({
      data: { sceneId: scene.id, eventId: fx.eventId, x: 0.25, y: 0.75 },
    });

    expect(peg.npcId).toBeNull();
    expect(peg.loreEntryId).toBeNull();
  });

  it('rejects a peg with no target', async () => {
    const scene = await createScene();

    await expect(
      db().scenePeg.create({ data: { sceneId: scene.id, x: 0.5, y: 0.5 } }),
    ).rejects.toThrow(/scene_pegs_exactly_one_target_check/);
  });

  it('rejects a peg with multiple targets', async () => {
    const scene = await createScene();

    await expect(
      db().scenePeg.create({
        data: { sceneId: scene.id, eventId: fx.eventId, npcId: fx.npcId, x: 0.5, y: 0.5 },
      }),
    ).rejects.toThrow(/scene_pegs_exactly_one_target_check/);
  });

  it.each([
    ['x below range', { x: -0.01, y: 0.5 }, /scene_pegs_x_range_check/],
    ['x above range', { x: 1.01, y: 0.5 }, /scene_pegs_x_range_check/],
    ['y below range', { x: 0.5, y: -0.01 }, /scene_pegs_y_range_check/],
    ['y above range', { x: 0.5, y: 1.01 }, /scene_pegs_y_range_check/],
  ])('rejects %s', async (_label, coords, expected) => {
    const scene = await createScene();

    await expect(
      db().scenePeg.create({ data: { sceneId: scene.id, npcId: fx.npcId, ...coords } }),
    ).rejects.toThrow(expected);
  });

  it('rejects the same target twice in one scene but allows it in another scene', async () => {
    const scene = await createScene('Elysium');
    const otherScene = await createScene('The Docks');
    await db().scenePeg.create({
      data: { sceneId: scene.id, npcId: fx.npcId, x: 0.1, y: 0.1 },
    });

    await expectUniqueViolation(
      db().scenePeg.create({ data: { sceneId: scene.id, npcId: fx.npcId, x: 0.9, y: 0.9 } }),
      'ScenePeg',
    );

    const elsewhere = await db().scenePeg.create({
      data: { sceneId: otherScene.id, npcId: fx.npcId, x: 0.9, y: 0.9 },
    });
    expect(elsewhere.sceneId).toBe(otherScene.id);
  });

  it('allows several pegs of different kinds in one scene', async () => {
    const scene = await createScene();

    await db().scenePeg.create({ data: { sceneId: scene.id, eventId: fx.eventId, x: 0, y: 0 } });
    await db().scenePeg.create({ data: { sceneId: scene.id, npcId: fx.npcId, x: 0.5, y: 0.5 } });
    await db().scenePeg.create({
      data: { sceneId: scene.id, loreEntryId: fx.loreEntryId, x: 1, y: 1 },
    });

    expect(await db().scenePeg.count({ where: { sceneId: scene.id } })).toBe(3);
  });

  it.each([
    ['event', 'eventId'],
    ['npc', 'npcId'],
    ['lore entry', 'loreEntryId'],
  ] as const)('deleting a %s deletes its pegs but keeps the scene', async (_label, field) => {
    const scene = await createScene();
    const targetId = fx[field];
    await db().scenePeg.create({
      data: { sceneId: scene.id, [field]: targetId, x: 0.2, y: 0.2 },
    });

    if (field === 'eventId') await db().event.delete({ where: { id: targetId } });
    if (field === 'npcId') await db().npc.delete({ where: { id: targetId } });
    if (field === 'loreEntryId') await db().loreEntry.delete({ where: { id: targetId } });

    expect(await db().scenePeg.count({ where: { sceneId: scene.id } })).toBe(0);
    expect(await db().scene.findUnique({ where: { id: scene.id } })).not.toBeNull();
  });

  it('deleting a scene deletes its pegs and its map asset row but keeps the targets', async () => {
    const scene = await createScene();
    await db().scenePeg.create({ data: { sceneId: scene.id, npcId: fx.npcId, x: 0.2, y: 0.2 } });
    const asset = await createUploadAsset({ sceneId: scene.id });

    await db().scene.delete({ where: { id: scene.id } });

    expect(await db().scenePeg.count({ where: { sceneId: scene.id } })).toBe(0);
    expect(await db().uploadAsset.findUnique({ where: { id: asset.id } })).toBeNull();
    expect(await db().npc.findUnique({ where: { id: fx.npcId } })).not.toBeNull();
  });

  it('deleting a campaign deletes its scenes', async () => {
    const scene = await createScene();

    await db().campaign.delete({ where: { id: fx.campaignId } });

    expect(await db().scene.findUnique({ where: { id: scene.id } })).toBeNull();
  });

  it('rejects an upload asset attached to both an event and a scene', async () => {
    const scene = await createScene();

    await expect(createUploadAsset({ eventId: fx.eventId, sceneId: scene.id })).rejects.toThrow(
      /upload_assets_single_owner_check/,
    );
  });

  it('rejects two upload assets attached to the same scene', async () => {
    const scene = await createScene();
    await createUploadAsset({ sceneId: scene.id });

    await expectUniqueViolation(createUploadAsset({ sceneId: scene.id }), 'UploadAsset');
  });

  it('does not treat a scene from another campaign as reachable through the campaign scope', async () => {
    const scene = await db().scene.create({
      data: { name: 'Rival scene', campaignId: fx.otherCampaignId },
    });

    const found = await db().scene.findFirst({
      where: { id: scene.id, campaignId: fx.campaignId },
    });

    expect(found).toBeNull();
  });
});
