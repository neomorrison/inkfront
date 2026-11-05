// Sim event -> sound. Positional: pan by screen position, quieter when far off screen.
// Busy fights are thinned out with a rolling "load" so a hundred hits stay punchy instead of noisy.
import { Audio } from './audio.js';
import './plugins.js';

const BLUNT = new Set(['fists', 'club', 'board', 'bottle', 'eraser_shield', 'marker_shield', 'satchel', 'claws', 'whiteout']);
const SWINGY = new Set(['sword', 'katana', 'pencil_blade', 'sword_shield', 'quill', 'lance', 'red_lance', 'spear']);
const PROJ_SOUND = {
  arrow: 'shoot', neon_arrow: 'shoot', pencil: 'shoot', glowstick: 'shoot',
  stone: 'sling', shaving: 'sling',
  boulder: 'boulder',
  bolt: 'bolt', zap: 'bolt',
  lead: 'throw', chalk: 'throw', bomb: 'throw', dart: 'throw',
};
const lastSpell = {};
let load = 0;
let loadT = 0;

function now() { return Audio.ctx ? Audio.ctx.currentTime : 0; }

// Rolling count of recent hit-like events with exponential decay.
function bump(w = 1) {
  const t = now();
  load = load * Math.exp(-(t - loadT) / 0.35) + w;
  loadT = t;
  return load;
}

function spatial(x, session) {
  const cam = session.cam;
  if (x == null || !cam) return { vol: 1, pan: 0 };
  const sx = cam.sx(x);
  const off = sx < 0 ? -sx : sx > cam.w ? sx - cam.w : 0;
  const vol = Math.max(0, 1 - off / (cam.w * 0.8));
  return { vol: vol * vol * (3 - 2 * vol), pan: Math.max(-0.8, Math.min(0.8, (sx / cam.w) * 2 - 1)) };
}

function play(name, sp, vol = 1, pitch = 1, extra = {}) {
  Audio.play(name, { pan: sp.pan, vol: sp.vol * vol, pitch, ...extra });
}

function hitSound(e, sp) {
  const src = e.source;
  const important = (src && (src.isHero || src.isBoss)) || (e.target && (e.target.isHero || e.target.isBoss));
  const l = bump(1);
  // Past a few hits per moment, drop most of the small ones.
  if (!important && l > 5 && Math.random() > 5 / l) return;
  let vol = Math.min(1, 0.4 + e.amount / 70) / (1 + l * 0.035);
  if (important) vol = Math.max(vol, 0.75);
  let name = 'hit_melee';
  let pitch = 1;
  const weapon = src && src.def && src.def.look && src.def.look.weapon;
  switch (e.kind) {
    case 'pierce': name = 'hit_pierce'; break;
    case 'blast': name = 'hit_blast'; break;
    case 'magic': case 'true': name = 'hit_magic'; break;
    default: name = BLUNT.has(weapon) || Math.random() < 0.2 ? 'hit_thud' : 'hit_melee'; break;
  }
  // Big units sound deeper.
  if (e.target && e.target.scale) pitch = Math.max(0.7, Math.min(1.3, 1.25 - e.target.scale * 0.25));
  play(name, sp, vol, pitch);
  if (e.crit) play('hit_crit', sp, 0.9);
  else if (e.kind === 'melee' && SWINGY.has(weapon) && l < 3 && Math.random() < 0.4) play('sword_swing', sp, 0.5);
}

export function handleBattleAudio(e, session) {
  if (!Audio.running) return;
  switch (e.type) {
    // These are not tied to a place on the map.
    case 'bossArrive': Audio.play('boss_arrive', { vol: 1 }); return;
    case 'bossDefeated': Audio.play('boss_down', { vol: 1 }); return;
    case 'waveStart': Audio.play('wave_start', { vol: 0.8 }); return;
    case 'waveClear': Audio.play('star', { vol: 0.6 }); return;
    case 'draftOffer': Audio.play('draft_offer', { vol: 0.9 }); return;
    case 'pageChange': Audio.play('page', { vol: 0.8 }); return;
    default: break;
  }
  const sp = spatial(e.x, session);
  if (sp.vol <= 0.02) return;
  switch (e.type) {
    case 'hit': hitSound(e, sp); break;
    case 'shoot': {
      const name = PROJ_SOUND[e.kind] || 'throw';
      const mine = e.team === 0;
      play(name, sp, (mine ? 0.65 : 0.5) / (1 + bump(0.5) * 0.03), e.fort ? 0.8 : 1);
      break;
    }
    case 'projLand': {
      // Arrows stick in the ground, rocks thud.
      if (e.kind === 'boulder') play('impact_ground', sp, 0.8);
      else if (e.kind === 'stone' || e.kind === 'shaving' || e.kind === 'lead') play('impact_ground', sp, 0.25, 1.3);
      else play('hit_pierce', sp, 0.22, 1.2);
      break;
    }
    case 'spawn':
      if (e.unit && e.unit.tags && e.unit.tags.has && e.unit.tags.has('cavalry') && !e.instant) play('gallop', sp, 0.4);
      if (e.team === 0 && !e.instant) play('spawn', sp, 0.7);
      else if (e.team === 1 && !e.instant) play('spawn', sp, 0.3);
      break;
    case 'death': {
      const u = e.unit;
      const big = u && (u.isBoss || (u.scale || 1) > 1.4);
      const l = bump(1.2);
      if (!big && l > 6 && Math.random() > 6 / l) break;
      const sc = (u && u.scale) || 1;
      play('death', sp, (big ? 0.95 : 0.65) / (1 + l * 0.03), Math.max(0.6, 1.3 - sc * 0.3));
      if (big) play('impact_ground', sp, 0.7, 0.9);
      break;
    }
    case 'launch': play('launch', sp, 0.55); break;
    case 'land': play('land', sp, 0.55); break;
    case 'slam': play('impact_ground', sp, 0.8, 1 - Math.min(0.3, (e.radius || 100) / 600)); break;
    case 'explode': {
      const r = e.radius || 80;
      play('boom', sp, Math.min(1, 0.55 + r / 220), Math.max(0.65, 1.3 - r / 260));
      break;
    }
    case 'bomberBlast': {
      // Usually arrives next to an explode event; the boom limit swallows the duplicate.
      play('boom', sp, 0.6, 1.2);
      break;
    }
    case 'blocked': play('blocked', sp, 0.7); break;
    case 'immune': play('immune', sp, 0.6); break;
    case 'gather': play('gather', sp, e.team === 0 ? 0.55 : 0.3); break;
    case 'deposit': if (e.team === 0) play('coin', sp, 0.5); break;
    case 'heal': if (e.amount > 0) play('heal', sp, 0.4); break;
    case 'fortHit': play('fortHit', sp, Math.min(1, 0.5 + (e.amount || 0) / 120)); break;
    case 'fortDestroyed': play('fortDestroyed', { vol: 1, pan: sp.pan }); break;
    case 'gallop': play('gallop', sp, 0.5); break;
    case 'poof': play('poof', sp, 0.7); break;
    case 'summon': play('summon', sp, 0.7); break;
    case 'chain': play('chain', sp, 0.6); break;
    case 'telegraph': play('telegraph', sp, 0.8); break;
    case 'heroAbility': {
      const name = 'ability_' + e.id;
      play(Audio.has(name) ? name : 'spell_cast', { vol: 1, pan: sp.pan }, 0.9);
      break;
    }
    case 'spell': {
      const name = 'spell_' + e.id;
      lastSpell[e.id] = now();
      play(Audio.has(name) ? name : 'spell_cast', { vol: Math.max(sp.vol, 0.7), pan: sp.pan }, e.team === 0 ? 0.95 : 0.75);
      break;
    }
    case 'spellFx': {
      // Backup for spells cast by the AI or without a `spell` event; the usual cast already played.
      const t = now();
      if (t - (lastSpell[e.id] ?? -9) < 1.5) break;
      lastSpell[e.id] = t;
      const name = 'spell_' + e.id;
      if (Audio.has(name)) play(name, { vol: Math.max(sp.vol, 0.6), pan: sp.pan }, 0.8);
      break;
    }
    default: break;
  }
}
