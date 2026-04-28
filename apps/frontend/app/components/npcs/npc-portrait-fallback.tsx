type NpcPortraitFallbackProps = {
  name: string;
};

function getVariant(name: string) {
  const score = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return score % 3;
}

export function NpcPortraitFallback({ name }: NpcPortraitFallbackProps) {
  return (
    <div
      className="npc-portrait npc-portrait-fallback"
      data-variant={getVariant(name)}
      aria-hidden="true"
    >
      <span className="npc-fallback-aura" />
      <span className="npc-fallback-silhouette">
        <span className="npc-fallback-head" />
        <span className="npc-fallback-body" />
        <span className="npc-fallback-collar" />
      </span>
      <span className="npc-fallback-sigil" />
    </div>
  );
}
