import type { ArchetypeDefinition, ArchetypeOption, GameSystem } from '@constancia/contracts';

type ArchetypeSystem = Pick<GameSystem, 'archetypes'>;

/** Reads the archetype choices stored in `systemData.archetypes`, ignoring anything that isn't a string. */
export function readArchetypeChoices(
  systemData: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const raw = systemData?.archetypes;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const choices: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.length > 0) choices[key] = value;
  }
  return choices;
}

/** The Game System's first archetype, or undefined when it defines none. */
export function getPrimaryArchetype(system: ArchetypeSystem): ArchetypeDefinition | undefined {
  return system.archetypes[0];
}

/** The option a character chose for the system's primary archetype, if any. */
export function getPrimaryArchetypeChoice(
  system: ArchetypeSystem,
  systemData: Record<string, unknown> | null | undefined,
): ArchetypeOption | undefined {
  const primary = getPrimaryArchetype(system);
  if (!primary) return undefined;
  const chosen = readArchetypeChoices(systemData)[primary.key];
  return primary.options.find((option) => option.name === chosen);
}

/** Returns an error message when `systemData.archetypes` names an unknown archetype or option, otherwise null. */
export function validateArchetypeChoices(
  system: ArchetypeSystem,
  systemData: Record<string, unknown> | null | undefined,
): string | null {
  const raw = systemData?.archetypes;
  if (raw === undefined) return null;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return 'systemData.archetypes must be an object';
  }
  for (const [key, value] of Object.entries(raw)) {
    const definition = system.archetypes.find((archetype) => archetype.key === key);
    if (!definition) return `Unknown archetype "${key}"`;
    if (value === null || value === '') continue;
    if (typeof value !== 'string' || !definition.options.some((option) => option.name === value)) {
      return `"${String(value)}" is not a valid ${definition.label}`;
    }
  }
  return null;
}
