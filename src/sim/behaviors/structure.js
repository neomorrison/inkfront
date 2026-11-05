// behavior 'structure': immobile blockers (Sticky Wall, chalk Detention walls). Their tags include
// 'structure', so Unit marks them as blockers and enemy walkers stop at their edge.
import { BEHAVIORS } from '../registry.js';

BEHAVIORS.structure = {
  init(u) {
    u.taunt = true; // nearby enemies prefer to chew on the wall
  },
  update(u) {
    u.anim.moving = false;
    u.attacking = false;
    u.target = null;
  },
};
