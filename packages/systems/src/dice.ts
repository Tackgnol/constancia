import { Roller } from '@tackgnol/rpg-tools-roller';

const roller = new Roller();

/** Rolls `count` dice with `sides` faces through the shared fair roller (STD-007) and returns each face. */
export async function rollDice(count: number, sides: number): Promise<number[]> {
  if (count <= 0) return [];
  const result = await roller.roll(`${count}d${sides}`);
  return result.groups.flatMap((group) => group.dice).map((die) => Number(die.value));
}
