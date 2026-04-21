import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  route('auth', './routes/auth.tsx'),
  route('player/campaigns/:campaignId/npcs/:npcId/for/:discordId', './routes/player-npc.tsx'),
  layout('./routes/demo-layout.tsx', { id: 'demo-layout' }, [
    route('demo', './routes/play.tsx', { id: 'demo-play' }),
    route('demo/setup', './routes/setup.tsx', { id: 'demo-setup' }),
    route('demo/npcs', './routes/npcs.tsx', { id: 'demo-npcs' }),
    route('demo/participants', './routes/participants.tsx', { id: 'demo-participants' }),
    route('demo/log', './routes/log.tsx', { id: 'demo-log' }),
  ]),
  layout('./routes/war-room-layout.tsx', [
    index('./routes/play.tsx'),
    route('setup', './routes/setup.tsx'),
    route('npcs', './routes/npcs.tsx'),
    route('participants', './routes/participants.tsx'),
    route('log', './routes/log.tsx'),
  ]),
] satisfies RouteConfig;
