import {
  deleteDiscordUserBan,
  enableCampaign,
  getAdminOverview,
} from '@constancia/api-client/endpoints/admin/admin';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useFetcher, useLoaderData } from 'react-router';
import { z } from 'zod';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { Button } from '@/components/ui/button';
import { buildServerApiOptions } from '@/lib/api-proxy.server';

const liftBanSchema = z.object({ intent: z.literal('lift-ban'), discordUserId: z.string().min(1) });
const enableSchema = z.object({
  intent: z.literal('enable-campaign'),
  campaignId: z.string().min(1),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const response = await getAdminOverview(buildServerApiOptions(request));
  return response.status === 'ok' ? response.data : { bans: [], disabledCampaigns: [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const input = Object.fromEntries(await request.formData());
  const options = buildServerApiOptions(request);
  const lift = liftBanSchema.safeParse(input);
  if (lift.success) {
    const response = await deleteDiscordUserBan(
      { discordUserId: lift.data.discordUserId },
      options,
    );
    return response.status === 'ok'
      ? { status: 'success' as const }
      : { status: 'error' as const, message: 'The ban could not be lifted.' };
  }

  const enable = enableSchema.safeParse(input);
  if (enable.success) {
    const response = await enableCampaign({ id: enable.data.campaignId }, options);
    return response.status === 'ok'
      ? { status: 'success' as const }
      : { status: 'error' as const, message: 'The campaign could not be re-enabled.' };
  }

  return { status: 'error' as const, message: 'The access-control request was incomplete.' };
}

export default function AdminBans() {
  const { bans, disabledCampaigns } = useLoaderData<typeof loader>();

  return (
    <ManagementWorkspace
      className="admin-workspace"
      eyebrow="Access controls"
      title="Things switched off"
      description="Active user bans and campaign suspensions share one reversal desk. Re-enabling restores future activity; cancelled messages stay cancelled."
      meta={
        <div className="admin-queue-meta">
          <p className="detail-label">Active controls</p>
          <strong>{bans.length + disabledCampaigns.length}</strong>
          <span>
            {bans.length} users · {disabledCampaigns.length} campaigns
          </span>
        </div>
      }
    >
      <div className="admin-control-columns">
        <ControlSection title="Banned users" empty="No active bans.">
          {bans.map((ban) => (
            <article className="detail-card admin-control-card" key={ban.id}>
              <div>
                <p className="detail-label">Discord user</p>
                <h2>{ban.discordUserId}</h2>
              </div>
              <dl>
                <div>
                  <dt>Internal note</dt>
                  <dd>{ban.internalNote}</dd>
                </div>
                <div>
                  <dt>User-facing reason</dt>
                  <dd>{ban.reasonShownToUser ?? 'Neutral fallback'}</dd>
                </div>
              </dl>
              <ReverseButton intent="lift-ban" name="discordUserId" value={ban.discordUserId}>
                Lift ban
              </ReverseButton>
            </article>
          ))}
        </ControlSection>

        <ControlSection title="Suspended campaigns" empty="No suspended campaigns.">
          {disabledCampaigns.map((campaign) => (
            <article className="detail-card admin-control-card" key={campaign.id}>
              <div>
                <p className="detail-label">Campaign</p>
                <h2>{campaign.name}</h2>
              </div>
              <dl>
                <div>
                  <dt>Internal note</dt>
                  <dd>{campaign.disabledInternalNote ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Public reason</dt>
                  <dd>{campaign.disabledPublicReason ?? 'Neutral fallback'}</dd>
                </div>
              </dl>
              <ReverseButton intent="enable-campaign" name="campaignId" value={campaign.id}>
                Re-enable campaign
              </ReverseButton>
              <p className="admin-inline-note">Cancelled deliveries will not be resent.</p>
            </article>
          ))}
        </ControlSection>
      </div>
    </ManagementWorkspace>
  );
}

function ControlSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <section className="admin-control-section">
      <header>
        <h2>{title}</h2>
        <span>{count}</span>
      </header>
      {count === 0 ? <p className="detail-card admin-empty-state">{empty}</p> : children}
    </section>
  );
}

function ReverseButton({
  intent,
  name,
  value,
  children,
}: {
  intent: 'lift-ban' | 'enable-campaign';
  name: 'discordUserId' | 'campaignId';
  value: string;
  children: React.ReactNode;
}) {
  const fetcher = useFetcher<typeof action>();
  return (
    <div className="admin-reverse-action">
      <Button
        type="button"
        variant="outline"
        disabled={fetcher.state !== 'idle'}
        onClick={() => fetcher.submit({ intent, [name]: value }, { method: 'post' })}
      >
        {children}
      </Button>
      {fetcher.data ? (
        <p
          className={fetcher.data.status === 'error' ? 'form-error' : 'admin-action-status'}
          role="status"
        >
          {fetcher.data.status === 'success' ? 'Applied.' : fetcher.data.message}
        </p>
      ) : null}
    </div>
  );
}
