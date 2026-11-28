import type { ChatInputCommandInteraction } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { buildHelpText, handleHelp } from '../commands/help.js';

describe('buildHelpText', () => {
  it('shows both sections with no filter or with both flags', () => {
    for (const text of [buildHelpText(false, false), buildHelpText(true, true)]) {
      expect(text).toContain('Player commands');
      expect(text).toContain('GM commands');
    }
  });

  it('filters to players only', () => {
    const text = buildHelpText(true, false);
    expect(text).toContain('/sheet');
    expect(text).not.toContain('/setup');
  });

  it('filters to GMs only', () => {
    const text = buildHelpText(false, true);
    expect(text).toContain('/setup');
    expect(text).not.toContain('/sheet');
  });

  it('lists Game System credits when a system has an attribution', () => {
    const text = buildHelpText(false, false, ['SRD 5.2.1 credit line']);
    expect(text).toContain('**Credits**');
    expect(text).toContain('-# SRD 5.2.1 credit line');
    expect(buildHelpText(false, false)).not.toContain('Credits');
  });

  it('defers the reply before looking up credits', async () => {
    const calls: string[] = [];
    const interaction = {
      options: { getBoolean: () => null },
      deferReply: vi.fn(async () => calls.push('defer')),
      editReply: vi.fn(async () => calls.push('edit')),
    } as unknown as ChatInputCommandInteraction;
    const backend = {
      listGameSystems: vi.fn(async () => {
        calls.push('lookup');
        return [];
      }),
    };

    await handleHelp(interaction, backend);

    expect(calls).toEqual(['defer', 'lookup', 'edit']);
  });
});
