import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProficiencyTier } from '@constancia/systems';
import { FiveESheet } from '../FiveESheet';
import { nextTier, toFiveECharacterData } from '../FiveESheet.utils';

const stats = {
  level: 5,
  dex: 16,
  wis: 14,
  dexSave: true,
  stealth: ProficiencyTier.Expertise,
  perception: ProficiencyTier.Proficient,
  hpMax: 30,
  hpCurrent: 12,
  ac: 15,
};

describe('FiveESheet', () => {
  it('rebuilds nested 5E data from the flat stats record', () => {
    expect(toFiveECharacterData(stats)).toMatchObject({
      core: { level: 5 },
      abilities: { dex: 16, wis: 14 },
      saves: { dexSave: true },
      skills: { stealth: 2, perception: 1 },
      vitals: { hpMax: 30, hpCurrent: 12, ac: 15 },
    });
  });

  it('cycles the proficiency pip through all three tiers', () => {
    expect(nextTier(ProficiencyTier.Untrained)).toBe(ProficiencyTier.Proficient);
    expect(nextTier(ProficiencyTier.Proficient)).toBe(ProficiencyTier.Expertise);
    expect(nextTier(ProficiencyTier.Expertise)).toBe(ProficiencyTier.Untrained);
  });

  it('shows derived totals and every skill, untrained ones included', () => {
    const html = renderToStaticMarkup(
      createElement(FiveESheet, { stats, onChange: () => undefined }),
    );

    expect(html).toContain('Passive Perception');
    expect(html).toContain('>15<');
    expect(html).toContain('Stealth');
    expect(html).toContain('>+9<');
    expect(html).toContain('Sleight of Hand');
    expect(html).toContain('data-tier="0"');
    expect(html).not.toMatch(/D&amp;D|Dungeons/);
  });
});
