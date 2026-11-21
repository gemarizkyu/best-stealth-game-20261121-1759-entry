// Everything the player sees, painted on one canvas: the museum floor, stone walls, bushes
// to hide in, the guards and their vision cones, the thief and his lantern light, the relics,
// the exit door, the detection meter, and the title, pause, caught, complete and win screens.
// The canvas is a fixed 1280x720 logical field, scaled to fit the window.
import { COLORS, FIELD, GUARD } from './config.js';
import { lineBlocked } from './vision.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_CAUGHT = 3;
export const SCREEN_COMPLETE = 4;
export const SCREEN_WON = 5;

function circle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
}

function drawCone(context, guard, walls) {
  const range = GUARD.visionRange;
  const half = 0.6;
  // A wall cuts the cone short: sample the cone's edge rays and stop each at the first wall.
  const steps = 14;
  context.beginPath();
  context.moveTo(guard.x, guard.y);
  for (let index = 0; index <= steps; index += 1) {
    const angle = guard.angle - half + (2 * half * index) / steps;
    let reach = range;
    for (let probe = 12; probe <= range; probe += 12) {
      const px = guard.x + Math.cos(angle) * probe;
      const py = guard.y + Math.sin(angle) * probe;
      if (lineBlocked(guard.x, guard.y, px, py, walls)) {
        reach = probe;
        break;
      }
    }
    context.lineTo(guard.x + Math.cos(angle) * reach, guard.y + Math.sin(angle) * reach);
  }
  context.closePath();
  context.fill();
}

function drawGem(context, x, y, radius, colour, time) {
  const sparkle = 0.75 + 0.25 * Math.sin(time * 3 + x);
  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  context.globalAlpha = sparkle;
  context.fillStyle = colour;
  context.fillRect(-radius / 1.4, -radius / 1.4, radius * 1.4, radius * 1.4);
  context.globalAlpha = 1;
  context.strokeStyle = 'rgba(255,255,255,0.7)';
  context.lineWidth = 1.5;
  context.strokeRect(-radius / 1.4, -radius / 1.4, radius * 1.4, radius * 1.4);
  context.restore();
}

function drawWorld(context, state, time) {
  const level = state.level;
  // Floor: large checker tiles, darker toward the edges like a hall at night.
  const tile = 80;
  for (let ty = 0; ty < FIELD.height / tile; ty += 1) {
    for (let tx = 0; tx < FIELD.width / tile; tx += 1) {
      context.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      context.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }
  context.strokeStyle = 'rgba(255,255,255,0.04)';
  context.lineWidth = 1;
  for (let x = 0; x <= FIELD.width; x += tile) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, FIELD.height);
    context.stroke();
  }
  for (let y = 0; y <= FIELD.height; y += tile) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(FIELD.width, y);
    context.stroke();
  }

  // Bushes: dark green cover the thief can hide in.
  for (const bush of level.bushes) {
    context.fillStyle = COLORS.bush;
    circle(context, bush.x, bush.y, bush.r);
    context.fill();
    context.fillStyle = COLORS.bushLeaf;
    for (let index = 0; index < 7; index += 1) {
      const angle = (index / 7) * Math.PI * 2 + bush.x;
      circle(context, bush.x + Math.cos(angle) * bush.r * 0.55, bush.y + Math.sin(angle) * bush.r * 0.55, bush.r * 0.28);
      context.fill();
    }
  }

  // The exit door on the right wall: green and glowing once the Moonstone is taken.
  const exit = level.exit;
  context.fillStyle = state.moonstoneTaken ? COLORS.exit : COLORS.exitLocked;
  context.fillRect(exit.x, exit.y, exit.w, exit.h);
  context.fillStyle = 'rgba(255,255,255,0.85)';
  context.font = 'bold 13px sans-serif';
  context.textAlign = 'center';
  context.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 4);
  if (state.moonstoneTaken) {
    context.save();
    context.globalAlpha = 0.25 + 0.1 * Math.sin(time * 4);
    context.fillStyle = COLORS.exit;
    context.fillRect(exit.x - 14, exit.y - 14, exit.w + 28, exit.h + 28);
    context.restore();
  }

  // The Moonstone pedestal, then the gold relics.
  context.fillStyle = '#3a3f4a';
  context.fillRect(level.moonstone.x - 22, level.moonstone.y - 10, 44, 20);
  if (!state.moonstoneTaken) {
    drawGem(context, level.moonstone.x, level.moonstone.y - 16, 15, COLORS.moonstone, time);
  }
  level.gems.forEach((gem, index) => {
    if (!state.gemsTaken.has(index)) drawGem(context, gem.x, gem.y, 10, COLORS.gem, time);
  });

  // Stone walls, with a lighter top edge so they read as blocks.
  for (const wall of level.walls) {
    context.fillStyle = COLORS.wall;
    context.fillRect(wall.x, wall.y, wall.w, wall.h);
    context.fillStyle = COLORS.wallTop;
    context.fillRect(wall.x, wall.y, wall.w, 6);
    context.strokeStyle = 'rgba(0,0,0,0.45)';
    context.lineWidth = 2;
    context.strokeRect(wall.x, wall.y, wall.w, wall.h);
  }

  // Vision cones first, so the guards paint over them.
  for (const guard of state.guards) {
    context.fillStyle = guard.state === 'chase'
      ? COLORS.coneChase
      : guard.state === 'suspicious'
        ? COLORS.coneSuspicious
        : COLORS.cone;
    drawCone(context, guard, level.walls);
  }

  // Guards: navy uniforms, a pale face, and a cap brim pointing where they look.
  for (const guard of state.guards) {
    context.fillStyle = COLORS.guardDark;
    circle(context, guard.x, guard.y, GUARD.radius + 2);
    context.fill();
    context.fillStyle = COLORS.guard;
    circle(context, guard.x, guard.y, GUARD.radius);
    context.fill();
    context.fillStyle = '#f2d8b3';
    circle(context, guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5, 6);
    context.fill();
    context.strokeStyle = '#10131a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8);
    context.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
    context.stroke();
    if (guard.state !== 'patrol') {
      context.fillStyle = guard.state === 'chase' ? '#ff5a5a' : '#ffa53c';
      context.font = 'bold 20px sans-serif';
      context.textAlign = 'center';
      context.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - GUARD.radius - 8);
    }
  }

  // The thief: a hooded figure with a warm lantern glow.
  const player = state.player;
  const glow = context.createRadialGradient(player.x, player.y, 4, player.x, player.y, 110);
  glow.addColorStop(0, 'rgba(255, 196, 110, 0.20)');
  glow.addColorStop(1, 'rgba(255, 196, 110, 0)');
  context.fillStyle = glow;
  context.fillRect(player.x - 110, player.y - 110, 220, 220);
  context.fillStyle = COLORS.playerHood;
  circle(context, player.x, player.y, 13);
  context.fill();
  context.fillStyle = COLORS.player;
  circle(context, player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4, 6);
  context.fill();
  context.strokeStyle = '#10131a';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(player.x, player.y);
  context.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
  context.stroke();

  // A soft vignette, so the hall feels lit by lanterns, not floodlights.
  const shade = context.createRadialGradient(640, 360, 240, 640, 360, 760);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  context.fillStyle = shade;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawHud(context, state, screen, muted) {
  const level = state.level;
  context.fillStyle = 'rgba(8, 10, 15, 0.72)';
  context.fillRect(0, 0, FIELD.width, 44);
  context.fillStyle = '#e8e4d8';
  context.font = 'bold 16px sans-serif';
  context.textAlign = 'left';
  context.fillText(`${level.name}  ·  Floor ${state.levelIndex + 1}/3`, 16, 28);
  context.textAlign = 'center';
  const gemsFound = state.gemsTaken.size;
  context.fillText(`◆ ${gemsFound}/${level.gems.length} relics   ${state.moonstoneTaken ? '● Moonstone!' : '○ Moonstone'}`, 640, 28);
  context.textAlign = 'right';
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60);
  context.fillText(`Score ${state.score}   ${minutes}:${String(seconds).padStart(2, '0')}${muted ? '   🔇' : ''}`, 1264, 28);

  // The detection meter: an eye that fills as the guards spot the thief.
  const barX = 480;
  const barY = 56;
  const barWidth = 320;
  context.fillStyle = 'rgba(8, 10, 15, 0.72)';
  context.fillRect(barX - 10, barY - 8, barWidth + 20, 30);
  context.fillStyle = '#2a2f3a';
  context.fillRect(barX, barY, barWidth, 14);
  const fraction = state.detection / 100;
  context.fillStyle = state.alarm ? '#ff5a5a' : fraction > 0.45 ? '#ffa53c' : '#ffd65a';
  context.fillRect(barX, barY, barWidth * fraction, 14);
  context.fillStyle = '#e8e4d8';
  context.font = '13px sans-serif';
  context.textAlign = 'center';
  context.fillText(state.alarm ? 'ALARM — RUN!' : fraction > 0.45 ? 'SUSPICIOUS…' : 'UNSEEN', 640, barY + 30);
  if (screen === SCREEN_PLAY && !state.moonstoneTaken) {
    context.fillStyle = 'rgba(232, 228, 216, 0.75)';
    context.font = '13px sans-serif';
    context.fillText('WASD / arrows to move · hold Shift to sneak · P pause · M mute', 640, 700);
  }
}

function drawPanel(context, title, lines) {
  context.fillStyle = 'rgba(8, 10, 15, 0.82)';
  context.fillRect(320, 180, 640, 360);
  context.strokeStyle = '#ffd65a';
  context.lineWidth = 2;
  context.strokeRect(320, 180, 640, 360);
  context.fillStyle = '#ffd65a';
  context.font = 'bold 34px sans-serif';
  context.textAlign = 'center';
  context.fillText(title, 640, 240);
  context.fillStyle = '#e8e4d8';
  context.font = '17px sans-serif';
  lines.forEach((line, index) => {
    context.fillText(line, 640, 292 + index * 30);
  });
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const width = Math.floor(FIELD.width * scale);
    const height = Math.floor(FIELD.height * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return scale;
  }

  function draw(state, screen, best, muted, time) {
    const scale = fit();
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, FIELD.width, FIELD.height);
    drawWorld(context, state, time);
    if (screen === SCREEN_TITLE) {
      drawPanel(context, 'MOONSTONE HEIST', [
        'A museum at night. One thief. One Moonstone.',
        'Sneak past the guards — their yellow cones are their eyes.',
        'Bushes hide you. Shift sneaks. Grab the relics, take the',
        'Moonstone, then slip out the green door unseen.',
        '',
        'Press Space or click to begin.',
      ]);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel(context, 'PAUSED', ['Take a breath. The guards wait for no one.', '', 'Press P or Space to keep sneaking.']);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel(context, 'CAUGHT!', [
        `The guards found you on ${state.level.name}.`,
        `Score ${state.score} · Best ${best}`,
        '',
        'Press Space to try the floor again.',
      ]);
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel(context, 'FLOOR CLEAR!', [
        `You slipped out of ${state.level.name} unseen.`,
        `Score ${state.score} · Best ${best}`,
        '',
        'Press Space for the next floor.',
      ]);
    } else if (screen === SCREEN_WON) {
      drawPanel(context, 'THE MOONSTONE IS YOURS!', [
        'Three floors, no alarms that stuck, one perfect heist.',
        `Final score ${state.score} · Best ${best}`,
        '',
        'Press Space to steal it all over again.',
      ]);
    }
    drawHud(context, state, screen, muted);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(232, 228, 216, 0.8)';
      context.font = '14px sans-serif';
      context.textAlign = 'center';
      context.fillText(state.level.hint, 640, 580);
    }
  }

  return { draw };
}
