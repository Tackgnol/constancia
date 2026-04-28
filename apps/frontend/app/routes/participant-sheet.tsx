import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import { CharacterSheetForm } from '@/components/character-sheet/character-sheet-form';
import { Button } from '@/components/ui/button';
import {
  getCharacterSheet,
  updateCharacterSheet,
  type CharacterSheetData,
  type CharacterSheetPatchBody,
} from '@/lib/character-sheet';
import type { WarRoomContext } from '@/lib/war-room-data';

export default function ParticipantSheetRoute() {
  const { charId } = useParams();
  const warRoom = useOutletContext<WarRoomContext>();
  const [sheet, setSheet] = useState<CharacterSheetData | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  useEffect(() => {
    let active = true;

    if (!charId) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    void getCharacterSheet(warRoom.campaign.id, charId, { credentials: 'include' })
      .then((nextSheet) => {
        if (!active) {
          return;
        }

        setSheet(nextSheet);
        setStatus('ready');
      })
      .catch((error) => {
        console.error('Failed to load participant sheet:', error);
        if (!active) {
          return;
        }
        setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [charId, warRoom.campaign.id]);

  const handleSave = async (payload: CharacterSheetPatchBody) => {
    if (!sheet) {
      throw new Error('Sheet is not loaded yet.');
    }

    const updated = await updateCharacterSheet(sheet.campaign.id, sheet.character.id, payload, {
      credentials: 'include',
    });
    setSheet(updated);
    return updated;
  };

  return (
    <div className="mode-route">
      <section className="hero-strip hero-strip-compact">
        <div className="sheet-hero-copy">
          <p className="eyebrow">Participant Sheet</p>
          <h1>
            {sheet?.character.gameName || sheet?.character.discordName || 'Loading character…'}
          </h1>
          <p className="hero-copy">
            This GM view edits the same system-backed sheet the player can access through their own
            magic link.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/participants">Back To Roster</Link>
        </Button>
      </section>

      {status === 'loading' ? (
        <section className="detail-card sheet-loading-card">
          <p className="detail-label">Loading</p>
          <p className="hero-copy">Pulling the player dossier from the backend…</p>
        </section>
      ) : null}

      {status === 'error' ? (
        <section className="detail-card sheet-loading-card">
          <p className="detail-label">Unavailable</p>
          <p className="hero-copy">
            This character sheet could not be loaded. Check that the participant exists in the
            active campaign and that your session still has access.
          </p>
        </section>
      ) : null}

      {status === 'ready' && sheet ? (
        <CharacterSheetForm sheet={sheet} audience="gm" onSave={handleSave} />
      ) : null}
    </div>
  );
}
