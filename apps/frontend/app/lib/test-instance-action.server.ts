import {
  closeTestInstance,
  listTestInstances,
  reopenTestInstance,
  reopenTestSubmission,
} from '@constancia/api-client/endpoints/events/events';
import { buildServerApiOptions } from '@/lib/api-proxy.server';
import { assertApiOk, getApiErrorMessage } from '@/lib/api-errors';

const TEST_INSTANCE_INTENTS = [
  'list-test-instances',
  'close-test-instance',
  'reopen-test-instance',
  'reopen-test-submission',
] as const;

type TestInstanceIntent = (typeof TEST_INSTANCE_INTENTS)[number];

const TEST_INSTANCE_ERROR =
  "We couldn't update this Test. Refresh it to see what players have submitted, then try again.";

function isTestInstanceIntent(value: FormDataEntryValue | null): value is TestInstanceIntent {
  return TEST_INSTANCE_INTENTS.some((intent) => intent === value);
}

function requiredString(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Handles the GM-only Test instance intents; returns null for any other intent. */
export async function handleTestInstanceAction(
  request: Request,
  formData: FormData,
  campaignId: string,
): Promise<Response | null> {
  const intent = formData.get('intent');
  if (!isTestInstanceIntent(intent)) {
    return null;
  }

  const eventId = requiredString(formData.get('eventId'));
  const instanceId = requiredString(formData.get('instanceId'));
  const discordUserId = requiredString(formData.get('discordUserId'));
  const apiOptions = buildServerApiOptions(request);

  if (
    eventId === null ||
    (intent !== 'list-test-instances' && instanceId === null) ||
    (intent === 'reopen-test-submission' && discordUserId === null)
  ) {
    return Response.json({ status: 'error', message: TEST_INSTANCE_ERROR }, { status: 400 });
  }

  try {
    if (intent === 'list-test-instances') {
      const response = await listTestInstances({ id: campaignId, eventId }, apiOptions);
      assertApiOk(response, TEST_INSTANCE_ERROR);
      return Response.json({ status: 'success', data: response.data[0] ?? null });
    }

    const params = { id: campaignId, eventId, instanceId: instanceId ?? '' };
    const response =
      intent === 'close-test-instance'
        ? await closeTestInstance(params, apiOptions)
        : intent === 'reopen-test-instance'
          ? await reopenTestInstance(params, apiOptions)
          : await reopenTestSubmission(
              { ...params, discordUserId: discordUserId ?? '' },
              apiOptions,
            );
    assertApiOk(response, TEST_INSTANCE_ERROR);
    return Response.json({ status: 'success', data: response.data });
  } catch (caught) {
    return Response.json(
      { status: 'error', message: getApiErrorMessage(caught, TEST_INSTANCE_ERROR) },
      { status: 500 },
    );
  }
}
