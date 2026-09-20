export function parseStringArrayFormValue(input: FormDataEntryValue | null): string[] {
  if (typeof input !== 'string' || input.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}
