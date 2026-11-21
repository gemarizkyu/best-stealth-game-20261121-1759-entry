// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world, steered by a simple autopilot (head for the nearest relic, then the
// Moonstone; duck into a bush and freeze when the guards get suspicious), so the frame is
// what a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_COMPLETE, EVENT_MOONSTONE } from './world.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 20;

function steerToward(state, targetX, targetY) {
  const dx = targetX - state.player.x;
  const dy = targetY - state.player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 10) return { x: 0, y: 0, sneak: false };
  return { x: dx / distance, y: dy / distance, sneak: state.detection > 20 };
}

function nearestBush(state) {
  let best = null;
  let bestDistance = Infinity;
  for (const bush of state.level.bushes) {
    const distance = Math.hypot(bush.x - state.player.x, bush.y - state.player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = bush;
    }
  }
  return best;
}

function autopilot(state) {
  if (state.detection > 55) {
    const bush = nearestBush(state);
    const distance = Math.hypot(bush.x - state.player.x, bush.y - state.player.y);
    if (distance < bush.r * 0.7) return { x: 0, y: 0, sneak: true };
    return steerToward(state, bush.x, bush.y);
  }
  if (!state.moonstoneTaken) {
    let target = state.level.moonstone;
    let bestDistance = Math.hypot(target.x - state.player.x, target.y - state.player.y);
    state.level.gems.forEach((gem, index) => {
      if (state.gemsTaken.has(index)) return;
      const distance = Math.hypot(gem.x - state.player.x, gem.y - state.player.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = gem;
      }
    });
    return steerToward(state, target.x, target.y);
  }
  const bush = nearestBush(state);
  return steerToward(state, bush.x, bush.y);
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0, sneak: false }, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      if (state.status !== 'playing') break;
      world.step(STEP, autopilot(state), null);
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  // The end scene: the thief takes the Moonstone and slips out the green door, for real —
  // the world itself reports the floor complete.
  state.player.x = state.level.moonstone.x;
  state.player.y = state.level.moonstone.y + 30;
  world.step(STEP, { x: 0, y: -1, sneak: false }, null);
  state.player.x = state.level.exit.x + state.level.exit.w / 2;
  state.player.y = state.level.exit.y + state.level.exit.h / 2;
  world.step(STEP, { x: 0, y: 0, sneak: false }, null);
  return { screen: state.status === 'complete' ? SCREEN_COMPLETE : SCREEN_PLAY, best: state.score };
}
