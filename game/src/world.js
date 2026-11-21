// The game's rules and state, with no drawing and no browser in it: the thief, the guards
// and their patrols, the detection meter, the alarm, the relics and the Moonstone, and the
// exit door. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, screens) without the world knowing about them.
import { DETECTION, FIELD, GUARD, PLAYER, SCORE, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { guardSees, pointInBush } from './vision.js';

export const EVENT_PICKUP = 1;
export const EVENT_MOONSTONE = 2;
export const EVENT_ALARM = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_COMPLETE = 16;

/** Push a circle out of a rectangle; returns the corrected centre. */
function pushOutOfRect(x, y, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - closestX;
  const dy = y - closestY;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return { x, y, hit: false };
  if (distance < 1e-6) return { x, y: rect.y - radius, hit: true };
  return { x: closestX + (dx / distance) * radius, y: closestY + (dy / distance) * radius, hit: true };
}

function turnToward(angle, target, maxTurn) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxTurn) return target;
  return angle + Math.sign(diff) * maxTurn;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: 0, sneaking: false, moving: false, stepTimer: 0 },
    guards: [],
    detection: 0,
    alarm: false,
    alarmTimer: 0,
    lastSeen: { x: 0, y: 0 },
    gemsTaken: new Set(),
    moonstoneTaken: false,
    score: 0,
    elapsed: 0,
    status: 'playing',
  };

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = LEVELS[index];
    const level = state.level;
    state.player.x = level.playerStart.x;
    state.player.y = level.playerStart.y;
    state.player.angle = 0;
    state.player.sneaking = false;
    state.player.moving = false;
    state.guards = level.guards.map((definition) => {
      const [x, y] = definition.waypoints[0];
      const [nx, ny] = definition.waypoints[1] ?? definition.waypoints[0];
      return {
        x,
        y,
        angle: Math.atan2(ny - y, nx - x),
        wpIndex: 1 % definition.waypoints.length,
        waypoints: definition.waypoints,
        wait: 0,
        waitBase: 0,
        state: 'patrol',
        targetX: nx,
        targetY: ny,
        lookTimer: 0,
        stuckTimer: 0,
        lastDistance: Infinity,
      };
    });
    state.detection = 0;
    state.alarm = false;
    state.alarmTimer = 0;
    state.gemsTaken = new Set();
    state.moonstoneTaken = false;
    state.elapsed = 0;
    state.status = 'playing';
  }

  function reset() {
    state.score = 0;
    loadLevel(0);
  }

  function nextLevel() {
    if (state.levelIndex + 1 >= LEVELS.length) return false;
    loadLevel(state.levelIndex + 1);
    return true;
  }

  function moveCircle(entity, dx, dy, radius) {
    let x = entity.x + dx;
    let y = entity.y + dy;
    for (const wall of state.level.walls) {
      const fixed = pushOutOfRect(x, y, radius, wall);
      x = fixed.x;
      y = fixed.y;
    }
    x = Math.max(radius, Math.min(FIELD.width - radius, x));
    y = Math.max(radius, Math.min(FIELD.height - radius, y));
    entity.x = x;
    entity.y = y;
  }

  function guardStep(guard, dt, events) {
    const level = state.level;
    const player = state.player;
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distanceToPlayer = Math.hypot(dx, dy);
    const hidden = pointInBush(player.x, player.y, level.bushes) && distanceToPlayer > DETECTION.bushHideRadius;
    const sees = !hidden && guardSees(guard, player.x, player.y, level.walls, GUARD.visionRange, GUARD.visionHalfAngle);

    if (sees) {
      state.lastSeen.x = player.x;
      state.lastSeen.y = player.y;
      const closeness = 1.5 - distanceToPlayer / GUARD.visionRange;
      const rate = (player.sneaking ? DETECTION.seenSneakPerSecond : DETECTION.seenPerSecond) * closeness;
      state.detection = Math.min(DETECTION.alarmAt, state.detection + rate * dt);
      if (state.detection >= DETECTION.alarmAt && !state.alarm) {
        state.alarm = true;
        state.alarmTimer = 0;
        for (const other of state.guards) other.state = 'chase';
        return events | EVENT_ALARM;
      }
      if (state.detection >= DETECTION.suspicionAt && guard.state === 'patrol') {
        guard.state = 'suspicious';
        guard.targetX = state.lastSeen.x;
        guard.targetY = state.lastSeen.y;
        guard.lookTimer = 0;
      }
    } else if (!state.alarm && player.moving && !player.sneaking && distanceToPlayer < GUARD.hearRadius) {
      // Loud footsteps nearby: the guard comes to look, even without seeing anything.
      if (guard.state === 'patrol') {
        guard.state = 'suspicious';
        guard.targetX = player.x;
        guard.targetY = player.y;
        guard.lookTimer = 0;
      }
    }

    if (distanceToPlayer < GUARD.catchRadius) {
      state.status = 'caught';
      return events | EVENT_CAUGHT;
    }

    let speed = 0;
    let targetX = guard.targetX;
    let targetY = guard.targetY;
    if (guard.state === 'patrol') {
      const waypoint = guard.waypoints[guard.wpIndex];
      targetX = waypoint[0];
      targetY = waypoint[1];
      const distance = Math.hypot(targetX - guard.x, targetY - guard.y);
      if (guard.wait > 0) {
        guard.wait -= dt;
        guard.angle = guard.waitBase + Math.sin(state.elapsed * 1.6) * 0.7;
        if (guard.wait <= 0) guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
        return events;
      }
      if (distance < 6) {
        guard.wait = GUARD.waitAtWaypoint;
        guard.waitBase = guard.angle;
        return events;
      }
      speed = GUARD.patrolSpeed;
    } else if (guard.state === 'suspicious') {
      const distance = Math.hypot(targetX - guard.x, targetY - guard.y);
      if (distance < 10) {
        guard.lookTimer += dt;
        guard.angle += dt * 1.8;
        if (guard.lookTimer > GUARD.lookAroundTime) {
          guard.state = 'patrol';
          guard.wpIndex = nearestWaypoint(guard);
        }
        return events;
      }
      speed = GUARD.patrolSpeed * 1.25;
    } else if (guard.state === 'chase') {
      targetX = player.x;
      targetY = player.y;
      speed = GUARD.chaseSpeed;
    }

    const distance = Math.hypot(targetX - guard.x, targetY - guard.y);
    if (distance > 1e-6) {
      const wanted = Math.atan2(targetY - guard.y, targetX - guard.x);
      guard.angle = turnToward(guard.angle, wanted, 6 * dt);
      const stepDistance = Math.min(distance, speed * dt);
      moveCircle(guard, (Math.cos(wanted) * stepDistance), (Math.sin(wanted) * stepDistance), GUARD.radius);
      const after = Math.hypot(targetX - guard.x, targetY - guard.y);
      if (after > guard.lastDistance - 0.5) guard.stuckTimer += dt;
      else guard.stuckTimer = 0;
      guard.lastDistance = after;
      if (guard.stuckTimer > 1.5 && guard.state !== 'chase') {
        guard.stuckTimer = 0;
        guard.state = 'patrol';
        guard.wpIndex = nearestWaypoint(guard);
      }
    }
    return events;
  }

  function nearestWaypoint(guard) {
    let best = 0;
    let bestDistance = Infinity;
    guard.waypoints.forEach(([x, y], index) => {
      const distance = Math.hypot(x - guard.x, y - guard.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  /**
   * One fixed step. `input` is { x, y, sneak } from the keyboard. Returns event flags;
   * the caller turns them into sounds and screens.
   */
  function step(dt, input, audio) {
    if (state.status !== 'playing') return 0;
    let events = 0;
    state.elapsed += dt;
    const player = state.player;
    const level = state.level;

    const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moving = input.x !== 0 || input.y !== 0;
    player.moving = moving;
    player.sneaking = input.sneak && moving;
    if (moving) {
      player.angle = Math.atan2(input.y, input.x);
      moveCircle(player, input.x * speed * dt, input.y * speed * dt, PLAYER.radius);
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = player.sneaking ? 0.55 : 0.36;
        if (audio) audio.footstep(player.sneaking);
      }
    }

    let anySees = false;
    for (const guard of state.guards) {
      const before = events;
      events = guardStep(guard, dt, events);
      if (events !== before && (events & EVENT_CAUGHT)) return events;
      if (guardSees(guard, player.x, player.y, level.walls, GUARD.visionRange, GUARD.visionHalfAngle)
        && !(pointInBush(player.x, player.y, level.bushes)
          && Math.hypot(player.x - guard.x, player.y - guard.y) > DETECTION.bushHideRadius)) {
        anySees = true;
      }
    }
    if (!anySees) {
      state.detection = Math.max(0, state.detection - DETECTION.decayPerSecond * dt);
      if (state.detection < DETECTION.suspicionAt) {
        for (const guard of state.guards) {
          if (guard.state === 'suspicious') {
            guard.state = 'patrol';
            guard.wpIndex = nearestWaypoint(guard);
          }
        }
      }
    }
    if (state.alarm) {
      if (anySees) state.alarmTimer = 0;
      else {
        state.alarmTimer += dt;
        if (state.alarmTimer > DETECTION.alarmCalmSeconds) {
          state.alarm = false;
          for (const guard of state.guards) {
            guard.state = 'suspicious';
            guard.targetX = state.lastSeen.x;
            guard.targetY = state.lastSeen.y;
            guard.lookTimer = 0;
          }
        }
      }
    }

    level.gems.forEach((gem, index) => {
      if (!state.gemsTaken.has(index) && Math.hypot(gem.x - player.x, gem.y - player.y) < 26) {
        state.gemsTaken.add(index);
        state.score += SCORE.gem;
        events |= EVENT_PICKUP;
      }
    });
    if (!state.moonstoneTaken && Math.hypot(level.moonstone.x - player.x, level.moonstone.y - player.y) < 28) {
      state.moonstoneTaken = true;
      state.score += SCORE.moonstone;
      events |= EVENT_MOONSTONE;
    }
    if (state.moonstoneTaken) {
      const exit = level.exit;
      if (player.x > exit.x && player.x < exit.x + exit.w && player.y > exit.y && player.y < exit.y + exit.h) {
        state.status = 'complete';
        state.score += SCORE.levelBonus;
        events |= EVENT_COMPLETE;
      }
    }
    return events;
  }

  reset();
  return { state, reset, loadLevel, nextLevel, step, STEP };
}
