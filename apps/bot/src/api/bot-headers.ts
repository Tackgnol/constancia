export function botRequestOptions(): RequestInit {
  return {
    headers: { 'x-bot-key': process.env.BOT_API_KEY ?? 'constancia-bot-dev-key' },
  };
}
