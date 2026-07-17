const clanToneByCharacter: Record<string, string> = {
  Brujah: 'brujah',
  Toreador: 'toreador',
  Nosferatu: 'nosferatu',
  Malkavian: 'malkavian',
};

export function getClanTone(character: string): string {
  return clanToneByCharacter[character] ?? 'neutral';
}
