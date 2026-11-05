// Shared helpers for the spell implementations. Pure sim: no DOM, no Math.random.

// Living enemies of `team` (scans b.units so a cast on the very first tick still sees everyone).
export function foes(b, team) {
  const out = [];
  for (const u of b.units) if (u.alive && u.team !== team && u.targetable !== false) out.push(u);
  return out;
}

export function friends(b, team) {
  const out = [];
  for (const u of b.units) if (u.alive && u.team === team && u.targetable !== false && !u.tags.has('structure')) out.push(u);
  return out;
}

// Ground spells skip flyers (the Neon Wyrm) unless they have landed.
export const onGround = (u) => !u.flying || !!u.data.landed;

// Is unit u inside the strip centered on x with half-width `half`?
export const inStrip = (u, x, half) => Math.abs(u.x - x) <= half + u.radius * 0.6;

// Bosses take reduced damage from burst spells so a single cast never deletes one.
export const burstDmg = (u, dmg) => (u.tags.has('boss') ? dmg * 0.55 : dmg);

export function spellFx(b, id, phase, x, team, extra) {
  b.emit('spellFx', { id, phase, x, z: 0, team, ...extra });
}
