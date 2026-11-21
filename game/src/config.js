// Every tuning number and colour for Moonstone Heist in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 88,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 64,
  chaseSpeed: 138,
  visionRange: 195,
  visionHalfAngle: (34 * Math.PI) / 180,
  hearRadius: 78,
  catchRadius: 24,
  waitAtWaypoint: 1.4,
  lookAroundTime: 2.2,
};

export const DETECTION = {
  seenPerSecond: 60,
  seenSneakPerSecond: 30,
  decayPerSecond: 26,
  suspicionAt: 45,
  alarmAt: 100,
  bushHideRadius: 58,
  alarmCalmSeconds: 4,
};

export const SCORE = { gem: 100, moonstone: 500, levelBonus: 250 };

export const BEST_KEY = 'moonstone-heist-best';

export const COLORS = {
  floorA: '#20242e',
  floorB: '#232833',
  wall: '#4a4238',
  wallTop: '#6b5f4e',
  bush: '#1d4d2b',
  bushLeaf: '#2f7a44',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 150, 60, 0.28)',
  coneChase: 'rgba(255, 70, 70, 0.30)',
  guard: '#3d5a80',
  guardDark: '#2b4361',
  player: '#e8e4d8',
  playerHood: '#2e2a33',
  gem: '#ffd94a',
  moonstone: '#7fe7ff',
  exit: '#39d98a',
  exitLocked: '#5a6b62',
};
