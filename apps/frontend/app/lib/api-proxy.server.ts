import { listCampaigns } from '@constancia/api-client/endpoints/campaigns/campaigns';

export function buildServerApiOptions(request: Request): RequestInit {
  return {
    credentials: 'include',
    headers: {
      cookie: request.headers.get('Cookie') || '',
    },
  };
}

export async function resolveCurrentCampaignId(request: Request): Promise<string | null> {
  const response = await listCampaigns(buildServerApiOptions(request));

  if (response.status !== 'ok') {
    return null;
  }

  return response.data[0]?.id ?? null;
}
