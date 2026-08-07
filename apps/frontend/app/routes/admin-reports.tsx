import {
  createDiscordUserBan,
  disableCampaign,
  listMessageReports,
  updateMessageReport,
} from '@constancia/api-client/endpoints/admin/admin';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { NavLink, useFetcher, useLoaderData } from 'react-router';
import { z } from 'zod';
import { ManagementWorkspace } from '@/components/layout/management-workspace';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formFieldLabelClassName } from '@/components/forms/field-label';
import { buildServerApiOptions } from '@/lib/api-proxy.server';

const reportStatuses = ['pending', 'reviewed', 'dismissed'] as const;
const noteSchema = z.object({
  internalNote: z.string().trim().min(1, 'An internal note is required.'),
  publicReason: z.string().trim(),
});
const triageActionSchema = z.object({
  intent: z.enum(['review', 'dismiss']),
  reportId: z.string().min(1),
});
const banActionSchema = noteSchema.extend({
  intent: z.literal('ban'),
  discordUserId: z.string().min(1),
});
const disableActionSchema = noteSchema.extend({
  intent: z.literal('disable'),
  campaignId: z.string().min(1),
});
type NoteValues = z.infer<typeof noteSchema>;

export async function loader({ request }: LoaderFunctionArgs) {
  const requested = new URL(request.url).searchParams.get('status');
  const status = reportStatuses.find((candidate) => candidate === requested) ?? 'pending';
  const response = await listMessageReports({ status }, buildServerApiOptions(request));
  return { status, reports: response.status === 'ok' ? response.data : [] };
}

export async function action({ request }: ActionFunctionArgs) {
  const input = Object.fromEntries(await request.formData());
  const options = buildServerApiOptions(request);

  const triage = triageActionSchema.safeParse(input);
  if (triage.success) {
    const response = await updateMessageReport(
      { id: triage.data.reportId },
      { status: triage.data.intent === 'review' ? 'reviewed' : 'dismissed' },
      options,
    );
    return response.status === 'ok'
      ? { status: 'success' as const }
      : { status: 'error' as const, message: 'The report could not be updated.' };
  }

  const ban = banActionSchema.safeParse(input);
  if (ban.success) {
    const response = await createDiscordUserBan(
      {
        discordUserId: ban.data.discordUserId,
        internalNote: ban.data.internalNote,
        ...(ban.data.publicReason ? { reasonShownToUser: ban.data.publicReason } : {}),
      },
      options,
    );
    return response.status === 'ok'
      ? { status: 'success' as const }
      : { status: 'error' as const, message: 'The user could not be banned.' };
  }

  const disable = disableActionSchema.safeParse(input);
  if (disable.success) {
    const response = await disableCampaign(
      { id: disable.data.campaignId },
      {
        internalNote: disable.data.internalNote,
        ...(disable.data.publicReason ? { publicReason: disable.data.publicReason } : {}),
      },
      options,
    );
    return response.status === 'ok'
      ? { status: 'success' as const }
      : { status: 'error' as const, message: 'The campaign could not be suspended.' };
  }

  return { status: 'error' as const, message: 'The moderation request was incomplete.' };
}

export default function AdminReports() {
  const { reports, status } = useLoaderData<typeof loader>();

  return (
    <ManagementWorkspace
      className="admin-workspace"
      eyebrow="Moderation queue"
      title="Reported bot messages"
      description="Read the reported output, identify the campaign administrator who authored it, and switch off only the source you intend."
      meta={
        <div className="admin-queue-meta">
          <p className="detail-label">Current view</p>
          <strong>{status}</strong>
          <span>{reports.length} reports shown</span>
        </div>
      }
    >
      <nav className="admin-filter" aria-label="Report status">
        {reportStatuses.map((filter) => (
          <NavLink
            key={filter}
            to={`?status=${filter}`}
            className={status === filter ? 'active' : ''}
          >
            {filter}
          </NavLink>
        ))}
      </nav>

      <section className="admin-report-list" aria-label={`${status} reports`}>
        {reports.length === 0 ? (
          <div className="detail-card admin-empty-state">
            <p className="detail-label">Queue clear</p>
            <h2>No {status} reports</h2>
            <p>There is nothing in this view.</p>
          </div>
        ) : (
          reports.map((report) => <ReportCard key={report.id} report={report} />)
        )}
      </section>
    </ManagementWorkspace>
  );
}

type Report = Awaited<ReturnType<typeof loader>>['reports'][number];

function ReportCard({ report }: { report: Report }) {
  const triage = useFetcher<typeof action>();
  const campaign = report.campaign;
  const isBusy = triage.state !== 'idle';

  return (
    <article className="detail-card admin-report-card">
      <header className="admin-report-header">
        <div>
          <p className="detail-label">Reported output</p>
          <h2>{campaign?.name ?? 'Campaign deleted'}</h2>
        </div>
        <div className="admin-report-stamp">
          <strong>{report.status}</strong>
          <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time>
        </div>
      </header>

      <div className="admin-report-content">
        <p>{report.messageContent || 'No text was captured.'}</p>
        {report.imageUrl ? (
          <img src={report.imageUrl} alt="Attachment from the reported bot message" />
        ) : null}
      </div>

      <dl className="admin-report-facts">
        <div>
          <dt>Reporter</dt>
          <dd>{report.discordUserId}</dd>
        </div>
        <div>
          <dt>Campaign</dt>
          <dd>{campaign?.name ?? 'Deleted; actions unavailable'}</dd>
        </div>
        <div>
          <dt>Message</dt>
          <dd>{report.discordMessageId ?? 'Not recorded'}</dd>
        </div>
      </dl>

      <div className="admin-triage-actions">
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() =>
            triage.submit({ intent: 'dismiss', reportId: report.id }, { method: 'post' })
          }
        >
          Dismiss report
        </Button>
        <Button
          type="button"
          disabled={isBusy}
          onClick={() =>
            triage.submit({ intent: 'review', reportId: report.id }, { method: 'post' })
          }
        >
          Mark reviewed
        </Button>
        <ActionStatus fetcher={triage} />
      </div>

      {campaign ? (
        <div className="admin-enforcement-grid">
          <section className="admin-enforcement-panel">
            <p className="detail-label">User-level action</p>
            <h3>Ban a campaign GM</h3>
            <p>Only the selected GM sees the optional reason. Players are not notified.</p>
            {campaign.admins.length === 0 ? (
              <p className="admin-inline-note">No campaign administrator is attached.</p>
            ) : (
              campaign.admins.map((discordUserId) => (
                <BanForm key={discordUserId} reportId={report.id} discordUserId={discordUserId} />
              ))
            )}
          </section>

          <section className="admin-enforcement-panel">
            <p className="detail-label">Campaign-level action</p>
            <h3>{campaign.disabledAt ? 'Campaign suspended' : 'Suspend this campaign'}</h3>
            <p>The public reason is shown to everyone who invokes Constancia in this server.</p>
            {campaign.disabledAt ? (
              <p className="admin-inline-note">Already suspended. Lift it from Access controls.</p>
            ) : (
              <DisableCampaignForm reportId={report.id} campaignId={campaign.id} />
            )}
          </section>
        </div>
      ) : (
        <p className="admin-inline-note">The report remains as history; its campaign is gone.</p>
      )}
    </article>
  );
}

function BanForm({ reportId, discordUserId }: { reportId: string; discordUserId: string }) {
  const fetcher = useFetcher<typeof action>();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { internalNote: '', publicReason: '' },
  });
  const baseId = `ban-${reportId}-${discordUserId}`;

  return (
    <details className="admin-action-details">
      <summary>Ban {discordUserId}</summary>
      <form
        className="admin-action-form"
        onSubmit={handleSubmit((values) =>
          fetcher.submit({ intent: 'ban', discordUserId, ...values }, { method: 'post' }),
        )}
        noValidate
      >
        <div>
          <Label htmlFor={`${baseId}-note`} className={formFieldLabelClassName}>
            Internal note (only you see this)
          </Label>
          <Textarea id={`${baseId}-note`} rows={3} {...register('internalNote')} />
          {errors.internalNote ? (
            <span className="form-error">{errors.internalNote.message}</span>
          ) : null}
        </div>
        <div>
          <Label htmlFor={`${baseId}-reason`} className={formFieldLabelClassName}>
            Reason shown to the banned user
          </Label>
          <Textarea id={`${baseId}-reason`} rows={2} {...register('publicReason')} />
        </div>
        <Button type="submit" variant="destructive" disabled={fetcher.state !== 'idle'}>
          Ban this GM
        </Button>
        <ActionStatus fetcher={fetcher} />
      </form>
    </details>
  );
}

function DisableCampaignForm({ reportId, campaignId }: { reportId: string; campaignId: string }) {
  const fetcher = useFetcher<typeof action>();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { internalNote: '', publicReason: '' },
  });
  const baseId = `disable-${reportId}`;

  return (
    <details className="admin-action-details">
      <summary>Prepare suspension</summary>
      <form
        className="admin-action-form"
        onSubmit={handleSubmit((values) =>
          fetcher.submit({ intent: 'disable', campaignId, ...values }, { method: 'post' }),
        )}
        noValidate
      >
        <div>
          <Label htmlFor={`${baseId}-note`} className={formFieldLabelClassName}>
            Internal note (only you see this)
          </Label>
          <Textarea id={`${baseId}-note`} rows={3} {...register('internalNote')} />
          {errors.internalNote ? (
            <span className="form-error">{errors.internalNote.message}</span>
          ) : null}
        </div>
        <div>
          <Label htmlFor={`${baseId}-reason`} className={formFieldLabelClassName}>
            Reason shown to everyone in the Discord server
          </Label>
          <Textarea id={`${baseId}-reason`} rows={2} {...register('publicReason')} />
        </div>
        <Button type="submit" variant="destructive" disabled={fetcher.state !== 'idle'}>
          Suspend campaign
        </Button>
        <ActionStatus fetcher={fetcher} />
      </form>
    </details>
  );
}

function ActionStatus({ fetcher }: { fetcher: ReturnType<typeof useFetcher<typeof action>> }) {
  const message =
    fetcher.state !== 'idle'
      ? 'Applying…'
      : fetcher.data?.status === 'success'
        ? 'Applied.'
        : fetcher.data?.message;
  return message ? (
    <p
      className={fetcher.data?.status === 'error' ? 'form-error' : 'admin-action-status'}
      role="status"
    >
      {message}
    </p>
  ) : null;
}
