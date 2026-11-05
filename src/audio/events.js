// Sim event -> sound. Positional: pan by screen position, quieter when far off screen.
// OWNER: audio builder (package G) owns the full mapping and the sound library.
import { Audio } from './audio.js';

function spatial(x, session) {
  const cam = session.cam;
  if (x == null) return { vol: 1, pan: 0 };
  const sx = cam.sx(x);
  const off = sx < 0 ? -sx : sx > cam.w ? sx - cam.w : 0;
  const vol = Math.max(0, 1 - off / (cam.w * 0.8));
  return { vol, pan: Math.max(-0.8, Math.min(0.8, (sx / cam.w) * 2 - 1)) };
}

export function handleBattleAudio(e, session) {
  const sp = spatial(e.x, session);
  if (sp.vol <= 0.02) return;
  switch (e.type) {
    case 'hit': Audio.play('hit', { ...sp, vol: sp.vol * Math.min(1, 0.4 + e.amount / 60), pitch: 0.8 + Math.random() * 0.4 }); break;
    case 'shoot': Audio.play('shoot', { ...sp, vol: sp.vol * 0.6 }); break;
    case 'spawn': if (e.team === 0 && !e.instant) Audio.play('spawn', { ...sp, vol: sp.vol * 0.7 }); break;
    case 'death': Audio.play('death', { ...sp, vol: sp.vol * 0.7, pitch: 0.8 + Math.random() * 0.5 }); break;
    case 'explode': Audio.play('boom', sp); break;
    case 'deposit': if (e.team === 0) Audio.play('coin', { ...sp, vol: sp.vol * 0.5 }); break;
    default: break;
  }
}
