import type { OAuth2Tokens, OAuth2UserInfo } from 'better-auth/oauth2';

interface LogtoIdentityDetails {
  id?: unknown;
}

interface LogtoIdentity {
  userId?: unknown;
  details?: LogtoIdentityDetails;
}

interface LogtoProfile {
  sub?: unknown;
  id?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  username?: unknown;
  picture?: unknown;
  discord_user_id?: unknown;
  identities?: {
    discord?: LogtoIdentity;
  };
  social?: {
    discord?: {
      id?: unknown;
    };
  };
}

interface MappedLogtoProfile {
  user: OAuth2UserInfo;
  discordUserId: string | null;
}

type FetchLike = typeof fetch;

interface LogtoDiscoveryDocument {
  userinfo_endpoint?: unknown;
}

interface LogtoProfileLogger {
  warn: (payload: Record<string, unknown>, message: string) => void;
}

const defaultLogtoProfileLogger: LogtoProfileLogger = {
  warn: (payload, message) => {
    console.warn(message, payload);
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return asRecord(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split('.');
  return payload ? decodeBase64UrlJson(payload) : null;
}

export function extractLogtoDiscordUserId(profile: LogtoProfile): string | null {
  const direct = readString(profile.discord_user_id);
  if (direct) return direct;

  const identityUserId = readString(profile.identities?.discord?.userId);
  if (identityUserId) return identityUserId;

  const identityDetailsId = readString(profile.identities?.discord?.details?.id);
  if (identityDetailsId) return identityDetailsId;

  return readString(profile.social?.discord?.id);
}

export function mapLogtoProfileToUser(profile: LogtoProfile): MappedLogtoProfile {
  const logtoSub = readString(profile.sub) ?? readString(profile.id);
  const email = readString(profile.email);
  const name =
    readString(profile.name) ?? readString(profile.username) ?? email ?? logtoSub ?? 'Logto user';

  if (!logtoSub) {
    throw new Error('Logto profile did not include a subject');
  }

  if (!email) {
    throw new Error('Logto profile did not include an email');
  }

  return {
    user: {
      id: logtoSub,
      email,
      name,
      image: readString(profile.picture) ?? undefined,
      emailVerified: profile.email_verified === true,
    },
    discordUserId: extractLogtoDiscordUserId(profile),
  };
}

async function fetchJsonRecord(
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`Logto request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const record = asRecord(payload);
  if (!record) {
    throw new Error('Logto response was not a JSON object');
  }

  return record;
}

async function fetchLogtoDiscovery(
  logtoEndpoint: string,
  fetchImpl: FetchLike,
): Promise<LogtoDiscoveryDocument> {
  return fetchJsonRecord(
    getLogtoDiscoveryUrl(logtoEndpoint),
    { method: 'GET' },
    fetchImpl,
  ) as Promise<LogtoDiscoveryDocument>;
}

export async function fetchLogtoUserInfoProfile(
  logtoEndpoint: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<LogtoProfile> {
  const discovery = await fetchLogtoDiscovery(logtoEndpoint, fetchImpl);
  const userInfoUrl = readString(discovery.userinfo_endpoint);

  if (!userInfoUrl) {
    throw new Error('Logto discovery document did not include userinfo_endpoint');
  }

  return fetchJsonRecord(
    userInfoUrl,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    fetchImpl,
  ) as Promise<LogtoProfile>;
}

function mergeLogtoProfiles(
  idTokenProfile: LogtoProfile | null,
  userInfoProfile: LogtoProfile | null,
): LogtoProfile | null {
  if (!idTokenProfile) {
    return userInfoProfile;
  }

  if (!userInfoProfile) {
    return idTokenProfile;
  }

  // OIDC userinfo is intentionally treated as the fresher profile source, so
  // fields such as email_verified may override the ID-token snapshot.
  return {
    ...idTokenProfile,
    ...userInfoProfile,
  };
}

function decodeLogtoIdTokenProfile(idToken: string | undefined): LogtoProfile | null {
  if (!idToken) {
    return null;
  }

  // Better Auth has already handled state/PKCE and code exchange before this
  // callback runs; this decode is only for profile-claim extraction, not
  // standalone JWT validation.
  return decodeJwtPayload(idToken) as LogtoProfile | null;
}

async function readLogtoProfileFromTokens(
  tokens: Pick<OAuth2Tokens, 'idToken' | 'accessToken'>,
  logtoEndpoint: string,
  fetchImpl: FetchLike = fetch,
  logger: LogtoProfileLogger = defaultLogtoProfileLogger,
): Promise<LogtoProfile | null> {
  const idTokenProfile = decodeLogtoIdTokenProfile(tokens.idToken);

  if (!tokens.accessToken) {
    return idTokenProfile;
  }

  if (idTokenProfile && extractLogtoDiscordUserId(idTokenProfile)) {
    return idTokenProfile;
  }

  let userInfoProfile: LogtoProfile | null = null;
  try {
    userInfoProfile = await fetchLogtoUserInfoProfile(logtoEndpoint, tokens.accessToken, fetchImpl);
  } catch (error) {
    if (!idTokenProfile) {
      throw error;
    }

    logger.warn(
      {
        logtoEndpoint: normalizeLogtoEndpoint(logtoEndpoint),
        error: readErrorMessage(error),
      },
      'Logto userinfo lookup failed; continuing with ID-token profile only',
    );
  }

  return mergeLogtoProfiles(idTokenProfile, userInfoProfile);
}

export function createLogtoUserInfoGetter(
  logtoEndpoint: string,
  fetchImpl: FetchLike = fetch,
  logger: LogtoProfileLogger = defaultLogtoProfileLogger,
) {
  return async function getLogtoUserInfo(tokens: OAuth2Tokens): Promise<OAuth2UserInfo | null> {
    const profile = await readLogtoProfileFromTokens(tokens, logtoEndpoint, fetchImpl, logger);
    if (!profile) {
      return null;
    }

    return mapLogtoProfileToUser(profile).user;
  };
}

export async function readLogtoDiscordUserIdFromTokens(
  input: {
    idToken?: string | null;
    accessToken?: string | null;
    logtoEndpoint: string;
  },
  fetchImpl: FetchLike = fetch,
  logger: LogtoProfileLogger = defaultLogtoProfileLogger,
): Promise<string | null> {
  const profile = await readLogtoProfileFromTokens(
    {
      idToken: input.idToken ?? undefined,
      accessToken: input.accessToken ?? undefined,
    },
    input.logtoEndpoint,
    fetchImpl,
    logger,
  );

  if (!profile) {
    return null;
  }

  return extractLogtoDiscordUserId(profile);
}

export function readLogtoScopeList(rawScopes: string | undefined): string[] {
  if (!rawScopes) {
    return ['openid', 'email', 'profile', 'identities'];
  }

  return rawScopes
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

export function normalizeLogtoEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}

export function getLogtoDiscoveryUrl(endpoint: string): string {
  return `${normalizeLogtoEndpoint(endpoint)}/oidc/.well-known/openid-configuration`;
}
