import type { RecipientOption } from '@/lib/war-room-data';
import type { CampaignNpcFact } from './block-registry';

function isKnownToPlayer(fact: CampaignNpcFact, option: RecipientOption) {
  return fact.knownTo.some((entry) => entry.discordUserId === option.discordUserId);
}

export function KnownToPicker({
  fact,
  recipientOptions,
  pending,
  assigning,
  onToggle,
  onApply,
}: {
  fact: CampaignNpcFact;
  recipientOptions: RecipientOption[];
  pending: string[];
  assigning: boolean;
  onToggle: (recipientId: string) => void;
  onApply: () => void;
}) {
  const unrevealedRecipients = recipientOptions.filter((option) => !isKnownToPlayer(fact, option));
  const pendingIds = new Set(pending);

  if (recipientOptions.length === 0) {
    return (
      <p className="form-hint">
        Player identities are still loading. Facts can be assigned once characters are present in
        this campaign.
      </p>
    );
  }

  if (unrevealedRecipients.length === 0) {
    return <p className="form-hint">Everyone on the board already knows this detail.</p>;
  }

  return (
    <>
      <div className="npc-chip-row">
        {recipientOptions.map((option) => {
          const isKnown = isKnownToPlayer(fact, option);
          const isPending = pendingIds.has(option.id);
          return (
            <button
              key={option.id}
              className={`npc-chip-button${isKnown ? ' is-known' : ''}${isPending ? ' is-pending' : ''}`}
              type="button"
              onClick={() => {
                if (!isKnown) {
                  onToggle(option.id);
                }
              }}
              aria-pressed={isKnown ? undefined : isPending}
              disabled={isKnown}
              title={option.secondaryLabel}
            >
              {option.displayName}
            </button>
          );
        })}
      </div>

      <div className="npc-fact-actions">
        <button
          className="form-submit"
          type="button"
          disabled={pending.length === 0 || assigning}
          onClick={onApply}
        >
          {assigning
            ? 'Revealing…'
            : pending.length > 0
              ? `Mark known to ${pending.length}`
              : 'Select players'}
        </button>
        <span className="form-hint">This only grants knowledge; it does not retract it.</span>
      </div>
    </>
  );
}
