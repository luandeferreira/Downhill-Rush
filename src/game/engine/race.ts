import {
  bikeBodies,
  bikeConstraints,
  bikeParts,
  bikeUp,
  createBike,
  getBikePose,
  setBikeVelocity,
  updateBike,
  velocityOf,
  worldToLocal,
  BIKE,
  type Bike,
  type BikePose,
} from '../entities/Bike';
import { applyBikeInput, type BikeContacts } from '../entities/bike-control';
import { createTerrainBodies, PROTOTYPE_SPAWN, PROTOTYPE_TERRAIN, type TerrainPiece } from '../track/terrain';
import { averageNormal, collectTerrainContacts } from './contacts';
import type { BikeInput } from './input';
import { NEUTRAL_INPUT } from './input';
import { fromMatter, STEP_SECONDS } from './physics-scale';
import { addToWorld, createPhysicsWorld, removeFromWorld, stepPhysicsWorld, type PhysicsWorld } from './physics-world';
import type { BodyPose, Vec2 } from './types';
import { angleBetween } from './vec';

export const CRASH_RULES = {
  /** Ângulo máximo (rad) entre o "para cima" da bike e a normal do chão ao aterrissar. */
  maxLandingAngle: (60 * Math.PI) / 180,
  /** Tempo mínimo no ar (s) para um toque no chão contar como aterrissagem. */
  minAirTime: 0.2,
  /** Espera (s) entre a queda e o respawn. */
  respawnDelay: 1.5,
  /** O respawn usa um ponto seguro de pelo menos este tempo (s) antes da queda. */
  respawnLookBack: 1,
} as const;

const SAFE_POINT = {
  /** Intervalo (s) entre amostras de ponto seguro. */
  interval: 0.25,
  /** Quantas amostras guardar (cobre os últimos ~10 s). */
  maxCount: 40,
  /** Inclinação máxima (rad) em relação ao chão para o ponto contar como seguro. */
  maxTilt: (30 * Math.PI) / 180,
  /** Folga (m) ao longo da normal no respawn, para as rodas não nascerem dentro do chão. */
  lift: 0.05,
} as const;

export type CrashReason = 'head' | 'landing' | 'pit';

export type RiderStatus =
  | { readonly kind: 'riding' }
  | { readonly kind: 'crashed'; readonly reason: CrashReason; readonly crashedAt: number; readonly respawnAt: number };

/** Acontecimentos de um passo, para efeitos fora da lógica (vibração, som, UI). */
export type RaceEvent =
  | { readonly type: 'crash'; readonly reason: CrashReason }
  | { readonly type: 'respawn' }
  | { readonly type: 'hop' }
  | { readonly type: 'land'; readonly airTime: number };

type SafePoint = {
  readonly time: number;
  readonly position: Vec2;
  readonly angle: number;
  readonly normal: Vec2;
  readonly velocity: Vec2;
};

const NO_CONTACTS: BikeContacts = { frame: [], rearWheel: [], frontWheel: [], rider: [] };

/**
 * Estado completo de uma corrida. Os corpos do matter são mutáveis, então `stepRace`
 * atualiza o estado no lugar; o mundo externo só enxerga `RaceSnapshot`s imutáveis.
 */
export type RaceState = {
  readonly physics: PhysicsWorld;
  readonly terrain: readonly TerrainPiece[];
  bike: Bike;
  /** Muda a cada respawn; a renderização não interpola entre bikes diferentes. */
  bikeId: number;
  status: RiderStatus;
  contacts: BikeContacts;
  /** Tempo contínuo (s) sem nenhuma peça da bike tocando o chão. */
  airTime: number;
  safePoints: SafePoint[];
  /** Tempo simulado, em segundos. */
  time: number;
};

/** Fotografia do estado para a renderização (só dados, em metros). */
export type RaceSnapshot = {
  readonly time: number;
  readonly bikeId: number;
  readonly status: RiderStatus;
  readonly bike: BikePose;
};

function spawnBike(physics: PhysicsWorld, position: Vec2, angle: number): Bike {
  const bike = createBike(position, angle);
  addToWorld(physics, bikeBodies(bike));
  addToWorld(physics, bikeConstraints(bike));
  return bike;
}

export function createRace(): RaceState {
  const physics = createPhysicsWorld();
  const terrain = PROTOTYPE_TERRAIN;
  addToWorld(physics, createTerrainBodies(terrain));

  return {
    physics,
    terrain,
    bike: spawnBike(physics, PROTOTYPE_SPAWN.position, PROTOTYPE_SPAWN.angle),
    bikeId: 0,
    status: { kind: 'riding' },
    contacts: NO_CONTACTS,
    airTime: 0,
    safePoints: [],
    time: 0,
  };
}

function hasAnyContact(contacts: BikeContacts): boolean {
  return Object.values(contacts).some((list) => list.length > 0);
}

function detectCrash(race: RaceState): CrashReason | null {
  const { bike, contacts } = race;
  const all = Object.values(contacts).flat();
  if (all.some((c) => c.surface === 'pit')) return 'pit';

  // Cabeça: contato do chão na faixa superior da cápsula do ciclista.
  const headLimit = -BIKE.riderHeight / 2 + BIKE.headZone;
  for (const contact of contacts.rider) {
    if (contact.points.some((p) => worldToLocal(bike.rider, p).y < headLimit)) return 'head';
  }

  // Aterrissagem torta: primeiro toque após um tempo no ar, com a bike muito inclinada.
  if (race.airTime >= CRASH_RULES.minAirTime && all.length > 0) {
    const normal = averageNormal(all);
    if (normal && angleBetween(bikeUp(bike), normal) > CRASH_RULES.maxLandingAngle) return 'landing';
  }
  return null;
}

function recordSafePoint(race: RaceState): void {
  const { bike, contacts } = race;
  const last = race.safePoints[race.safePoints.length - 1];
  if (last && race.time - last.time < SAFE_POINT.interval) return;

  const both = [...contacts.rearWheel, ...contacts.frontWheel];
  if (contacts.rearWheel.length === 0 || contacts.frontWheel.length === 0) return;
  if (both.some((c) => c.surface !== 'ground')) return;
  const normal = averageNormal(both);
  if (!normal || angleBetween(bikeUp(bike), normal) > SAFE_POINT.maxTilt) return;

  race.safePoints.push({
    time: race.time,
    position: { x: fromMatter(bike.frame.position.x), y: fromMatter(bike.frame.position.y) },
    angle: bike.frame.angle,
    normal,
    velocity: velocityOf(bike.frame),
  });
  if (race.safePoints.length > SAFE_POINT.maxCount) race.safePoints.shift();
}

function crash(race: RaceState, reason: CrashReason): void {
  // O ciclista se solta do quadro e cai por conta própria.
  removeFromWorld(race.physics, race.bike.riderPins);
  race.status = {
    kind: 'crashed',
    reason,
    crashedAt: race.time,
    respawnAt: race.time + CRASH_RULES.respawnDelay,
  };
}

function respawn(race: RaceState, crashedAt: number): void {
  // Ponto seguro mais recente com folga antes da queda; descarta os posteriores, para
  // que quedas repetidas no mesmo lugar recuem cada vez mais.
  const cutoff = crashedAt - CRASH_RULES.respawnLookBack;
  let index = -1;
  for (let i = race.safePoints.length - 1; i >= 0; i--) {
    if (race.safePoints[i].time <= cutoff) {
      index = i;
      break;
    }
  }
  if (index < 0 && race.safePoints.length > 0) index = 0;
  const point = index >= 0 ? race.safePoints[index] : null;
  race.safePoints.length = Math.max(index, 0);

  removeFromWorld(race.physics, [...bikeBodies(race.bike), ...bikeConstraints(race.bike)]);
  if (point) {
    const position = {
      x: point.position.x + point.normal.x * SAFE_POINT.lift,
      y: point.position.y + point.normal.y * SAFE_POINT.lift,
    };
    race.bike = spawnBike(race.physics, position, point.angle);
    setBikeVelocity(race.bike, point.velocity);
  } else {
    race.bike = spawnBike(race.physics, PROTOTYPE_SPAWN.position, PROTOTYPE_SPAWN.angle);
  }
  race.bikeId++;
  race.status = { kind: 'riding' };
  race.contacts = NO_CONTACTS;
  race.airTime = 0;
}

/** Avança a corrida em exatamente um passo fixo (STEP_SECONDS). */
export function stepRace(race: RaceState, input: BikeInput): RaceEvent[] {
  const events: RaceEvent[] = [];
  const riding = race.status.kind === 'riding';

  if (applyBikeInput(race.bike, riding ? input : NEUTRAL_INPUT, race.contacts, race.time)) {
    events.push({ type: 'hop' });
  }
  stepPhysicsWorld(race.physics);
  race.time += STEP_SECONDS;
  updateBike(race.bike);
  race.contacts = collectTerrainContacts(race.physics.engine, bikeParts(race.bike));
  const touching = hasAnyContact(race.contacts);

  if (race.status.kind === 'riding') {
    const reason = detectCrash(race);
    if (reason) {
      crash(race, reason);
      events.push({ type: 'crash', reason });
    } else {
      if (touching && race.airTime >= CRASH_RULES.minAirTime) {
        events.push({ type: 'land', airTime: race.airTime });
      }
      recordSafePoint(race);
    }
  } else if (race.time >= race.status.respawnAt) {
    respawn(race, race.status.crashedAt);
    events.push({ type: 'respawn' });
    return events;
  }

  race.airTime = touching ? 0 : race.airTime + STEP_SECONDS;
  return events;
}

export function snapshotRace(race: RaceState): RaceSnapshot {
  return { time: race.time, bikeId: race.bikeId, status: race.status, bike: getBikePose(race.bike) };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function lerpPose(a: BodyPose, b: BodyPose, t: number): BodyPose {
  // Ângulos do matter são contínuos (não voltam a 0 em 2π), então lerp direto é seguro.
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), angle: lerp(a.angle, b.angle, t) };
}

/** Interpola entre dois passos fixos, para a renderização ficar suave em qualquer FPS. */
export function lerpSnapshot(a: RaceSnapshot, b: RaceSnapshot, t: number): RaceSnapshot {
  // Depois de um respawn a bike é outra: interpolar a arrastaria pela pista.
  if (a.bikeId !== b.bikeId) return b;
  return {
    time: lerp(a.time, b.time, t),
    bikeId: b.bikeId,
    status: b.status,
    bike: {
      frame: lerpPose(a.bike.frame, b.bike.frame, t),
      rearWheel: lerpPose(a.bike.rearWheel, b.bike.rearWheel, t),
      frontWheel: lerpPose(a.bike.frontWheel, b.bike.frontWheel, t),
      rider: lerpPose(a.bike.rider, b.bike.rider, t),
      velocity: b.bike.velocity,
    },
  };
}
