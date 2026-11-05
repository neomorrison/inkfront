// Paper Planes: a squadron flies across the page from the caster's side and drops ink bombs
// on any enemy it is about to pass over.
import { SPELL_IMPL } from '../registry.js';
import { spellValue } from '../../data/spells.js';
import { Projectile } from '../projectile.js';
import { foes, spellFx } from './util.js';

const SPEED = 560;
const BOMBS_PER_PLANE = 3;
const BOMB_G = 1100;

SPELL_IMPL.paper_planes = {
  cast(b, team, x, level) {
    const n = spellValue('paper_planes', 'planes', level);
    const dmg = spellValue('paper_planes', 'dmg', level);
    const radius = spellValue('paper_planes', 'radius', level);
    const dir = b.teams[team].dir;
    const startX = dir > 0 ? -90 : b.width + 90;
    const planes = [];
    for (let i = 0; i < n; i++) {
      // A loose V: leader in front, wings behind and higher.
      const wing = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      planes.push({
        i, delay: Math.abs(wing) * 0.22 + (i === 0 ? 0 : 0.1) + b.rng.range(0, 0.08),
        x: startX, y: -(190 + Math.abs(wing) * 14 + b.rng.range(0, 60)), z: Math.max(-1, Math.min(1, wing * 0.45 + b.rng.range(-0.15, 0.15))),
        vx: dir * (SPEED + b.rng.range(-30, 30)), bombs: BOMBS_PER_PLANE, cd: 0.35, started: false, done: false,
      });
    }
    spellFx(b, 'paper_planes', 'cast', startX, team, {});
    b.areas.push({
      kind: 'paper_planes', team, x: b.width / 2, t: 0, planes, dir, alive: true,
      update(b, dt) {
        this.t += dt;
        let live = 0;
        const enemies = foes(b, this.team);
        for (const p of planes) {
          if (p.done) continue;
          if (this.t < p.delay) { live++; continue; }
          if (!p.started) { p.started = true; spellFx(b, 'paper_planes', 'launch', p.x, this.team, {}); }
          p.x += p.vx * dt;
          p.cd -= dt;
          if ((this.dir > 0 && p.x > b.width + 140) || (this.dir < 0 && p.x < -140)) { p.done = true; continue; }
          live++;
          if (p.bombs > 0 && p.cd <= 0 && p.x > 40 && p.x < b.width - 40) {
            const fall = Math.sqrt((2 * -p.y) / BOMB_G);
            const bvx = p.vx * 0.55;
            const land = p.x + bvx * fall;
            let target = false;
            for (const e of enemies) if (e.alive && Math.abs(e.x - land) < radius * 0.55) { target = true; break; }
            const fort = b.teams[1 - this.team].fort;
            if (!target && fort.alive && Math.abs(fort.x - land) < fort.radius) target = true;
            if (target) {
              p.bombs--;
              p.cd = 0.4;
              b.projectiles.push(new Projectile({
                x: p.x, y: p.y + 6, vx: bvx, vy: 0, g: BOMB_G, team: this.team, dmg, kind: 'ink_bomb', dmgKind: 'blast',
                aoe: radius, kb: 90, fortMult: 0.6, z: p.z,
              }));
              spellFx(b, 'paper_planes', 'drop', p.x, this.team, { y: p.y });
            }
          }
        }
        if (!live) {
          spellFx(b, 'paper_planes', 'end', b.width / 2, this.team, {});
          this.alive = false;
        }
      },
    });
    return true;
  },
};
