import { Bodies, Body, Constraint, Vector } from 'matter-js';

import {
  fromMatter,
  matterVelocityToMetersPerSecond,
  metersPerSecondToMatterVelocity,
  STEP_SECONDS,
  toMatter,
} from '../engine/physics-scale';
import type { BodyPose, Vec2 } from '../engine/types';
import { clamp, rotate } from '../engine/vec';

/**
 * Geometria e ajuste físico da bike, em metros / kg.
 * Offsets são relativos ao centro do quadro, com o quadro na horizontal (y para baixo).
 */
export const BIKE = {
  wheelRadius: 0.36,
  wheelBase: 1.15,
  frameWidth: 1.0,
  frameHeight: 0.16,
  /** Altura do centro das rodas abaixo do centro do quadro (suspensão em repouso). */
  wheelDrop: 0.34,
  riderWidth: 0.3,
  riderHeight: 0.8,
  riderOffset: { x: -0.1, y: -0.52 },
  /**
   * Faixa do topo do corpo do ciclista (m) que conta como cabeça: a cápsula física
   * inclui a cabeça, então contato do chão nessa faixa = queda.
   */
  headZone: 0.28,
  /** Pontos do quadro onde o ciclista está preso (quadril e mãos no guidão). */
  hipAnchor: { x: -0.18, y: -0.08 },
  handsAnchor: { x: 0.4, y: -0.2 },
  /**
   * Massas: o ciclista é mais leve que na vida real porque razões de massa grandes
   * entre corpos ligados por constraints deixam o solver do matter instável.
   */
  massKg: { frame: 16, wheel: 4, rider: 30 },
  suspension: {
    stiffness: 0.08,
    damping: 0.12,
    /** Distância horizontal (m) de cada ponto de fixação até o eixo da roda. */
    spread: 0.4,
    /** Altura (m) dos pontos de fixação acima do centro do quadro. */
    anchorHeight: 0.2,
    /** Curso (m) a partir do repouso: compressão, extensão e folga lateral. */
    maxCompression: 0.15,
    maxExtension: 0.08,
    maxLateral: 0.1,
  },
  /** Ligação do ciclista ao quadro: quase rígida, com um leve balanço. */
  riderJoint: { stiffness: 0.6, damping: 0.1 },
  /** Arrasto por passo (matter `frictionAir`) em todas as peças; define a velocidade terminal. */
  airFriction: 0.0018,
} as const;

/**
 * Sobre as rodas: o atrito do matter-js faz círculos rolando quicarem e perderem
 * energia de forma irregular (medido: saltos de 6–30 cm numa rampa lisa). Por isso as
 * rodas são corpos SEM atrito e com rotação travada — deslizam suavemente pelo chão —
 * e o giro é só visual, calculado a partir da velocidade (`wheelSpin`).
 * Tração e freio (etapa 2) entram como forças aplicadas por nós, não via atrito.
 */
export type BikePart = 'frame' | 'rearWheel' | 'frontWheel' | 'rider';

export type Bike = {
  readonly frame: Body;
  readonly rearWheel: Body;
  readonly frontWheel: Body;
  readonly rider: Body;
  /** Molas da suspensão. */
  readonly suspension: readonly Constraint[];
  /** Pinos que prendem o ciclista ao quadro (removidos numa queda). */
  readonly riderPins: readonly Constraint[];
  /** Ângulo visual acumulado de cada roda, em radianos. */
  readonly wheelSpin: { rear: number; front: number };
  /** Estado dos controles que persiste entre passos. */
  readonly control: { hopReadyAt: number };
};

export type BikePose = {
  readonly frame: BodyPose;
  readonly rearWheel: BodyPose;
  readonly frontWheel: BodyPose;
  readonly rider: BodyPose;
  /** Velocidade do quadro em m/s. */
  readonly velocity: Vec2;
};

/** Pontos de ancoragem da suspensão no quadro (onde o garfo/balança encostam). */
export function suspensionAnchor(wheel: 'rear' | 'front'): Vec2 {
  const side = wheel === 'front' ? 1 : -1;
  return { x: (side * BIKE.wheelBase) / 2, y: 0 };
}

function wheelOffset(wheel: 'rear' | 'front'): Vec2 {
  const anchor = suspensionAnchor(wheel);
  return { x: anchor.x, y: anchor.y + BIKE.wheelDrop };
}

function toMatterVec(v: Vec2): Vector {
  return { x: toMatter(v.x), y: toMatter(v.y) };
}

/**
 * Cria a bike com o centro do quadro em `position`, inclinada em `angle`
 * (útil para nascer alinhada a uma rampa).
 */
export function createBike(position: Vec2, angle = 0): Bike {
  // Grupo negativo: as peças da mesma bike nunca colidem entre si.
  const group = Body.nextGroup(true);
  const worldPoint = (local: Vec2): Vector => {
    const r = rotate(local, angle);
    return toMatterVec({ x: position.x + r.x, y: position.y + r.y });
  };

  const center = worldPoint({ x: 0, y: 0 });
  const frame = Bodies.rectangle(center.x, center.y, toMatter(BIKE.frameWidth), toMatter(BIKE.frameHeight), {
    label: 'bike-frame',
    collisionFilter: { group },
    friction: 0.3,
    frictionAir: BIKE.airFriction,
    restitution: 0,
  });

  const makeWheel = (wheel: 'rear' | 'front'): Body => {
    const p = worldPoint(wheelOffset(wheel));
    return Bodies.circle(
      p.x,
      p.y,
      toMatter(BIKE.wheelRadius),
      {
        label: `bike-wheel-${wheel}`,
        collisionFilter: { group },
        friction: 0,
        frictionStatic: 0,
        frictionAir: BIKE.airFriction,
        restitution: 0,
      },
      32,
    );
  };
  const rearWheel = makeWheel('rear');
  const frontWheel = makeWheel('front');

  const riderCenter = worldPoint(BIKE.riderOffset);
  const rider = Bodies.rectangle(riderCenter.x, riderCenter.y, toMatter(BIKE.riderWidth), toMatter(BIKE.riderHeight), {
    label: 'bike-rider',
    collisionFilter: { group },
    chamfer: { radius: toMatter(BIKE.riderWidth / 2) },
    friction: 0.5,
    frictionAir: BIKE.airFriction,
    restitution: 0,
  });

  for (const body of [frame, rearWheel, frontWheel, rider]) {
    Body.setAngle(body, angle);
  }
  Body.setMass(frame, BIKE.massKg.frame);
  Body.setMass(rearWheel, BIKE.massKg.wheel);
  Body.setMass(frontWheel, BIKE.massKg.wheel);
  Body.setMass(rider, BIKE.massKg.rider);
  // Rotação travada (inércia infinita): ver comentário do tipo `Bike`.
  Body.setInertia(rearWheel, Infinity);
  Body.setInertia(frontWheel, Infinity);

  // Suspensão: cada roda presa por duas molas que partem de pontos acima do quadro,
  // um à frente e outro atrás da roda, formando um "V" invertido. Ela cede na vertical
  // e resiste de lado. Os pontos ficam bem acima do eixo da roda de propósito: duas
  // distâncias admitem uma solução espelhada (roda acima da linha entre os pontos) e,
  // com os pontos longe, chegar nela exigiria comprimir a mola ~1 m.
  const suspension = (wheel: Body, side: 'rear' | 'front'): Constraint[] => {
    const offset = wheelOffset(side);
    return [-1, 1].map((dir) =>
      Constraint.create({
        bodyA: frame,
        pointA: toMatterVec(
          rotate({ x: offset.x + dir * BIKE.suspension.spread, y: -BIKE.suspension.anchorHeight }, angle),
        ),
        bodyB: wheel,
        stiffness: BIKE.suspension.stiffness,
        damping: BIKE.suspension.damping,
      }),
    );
  };

  // Ciclista "soldado" ao quadro por dois pinos (comprimento zero) em pontos distintos.
  const riderPin = (anchor: Vec2): Constraint =>
    Constraint.create({
      bodyA: frame,
      pointA: toMatterVec(rotate(anchor, angle)),
      bodyB: rider,
      pointB: toMatterVec(rotate({ x: anchor.x - BIKE.riderOffset.x, y: anchor.y - BIKE.riderOffset.y }, angle)),
      length: 0,
      stiffness: BIKE.riderJoint.stiffness,
      damping: BIKE.riderJoint.damping,
    });

  return {
    frame,
    rearWheel,
    frontWheel,
    rider,
    suspension: [...suspension(rearWheel, 'rear'), ...suspension(frontWheel, 'front')],
    riderPins: [riderPin(BIKE.hipAnchor), riderPin(BIKE.handsAnchor)],
    wheelSpin: { rear: angle, front: angle },
    control: { hopReadyAt: 0 },
  };
}

export function bikeBodies(bike: Bike): readonly Body[] {
  return [bike.frame, bike.rearWheel, bike.frontWheel, bike.rider];
}

export function bikeParts(bike: Bike): Readonly<Record<BikePart, Body>> {
  return { frame: bike.frame, rearWheel: bike.rearWheel, frontWheel: bike.frontWheel, rider: bike.rider };
}

export function bikeConstraints(bike: Bike): readonly Constraint[] {
  return [...bike.suspension, ...bike.riderPins];
}

/** Posição de um ponto do mundo (m) no sistema local de um corpo (m, sem rotação). */
export function worldToLocal(body: Body, point: Vec2): Vec2 {
  return rotate(
    { x: point.x - fromMatter(body.position.x), y: point.y - fromMatter(body.position.y) },
    -body.angle,
  );
}

/** Vetor "para cima" do quadro (unitário), no mundo. */
export function bikeUp(bike: Bike): Vec2 {
  return rotate({ x: 0, y: -1 }, bike.frame.angle);
}

/** Dá a todas as peças a mesma velocidade (m/s) — usado no respawn. */
export function setBikeVelocity(bike: Bike, velocity: Vec2): void {
  const v = { x: metersPerSecondToMatterVelocity(velocity.x), y: metersPerSecondToMatterVelocity(velocity.y) };
  for (const body of bikeBodies(bike)) {
    Body.setVelocity(body, v);
    Body.setAngularVelocity(body, 0);
  }
}

/** Velocidade de um corpo do matter, em m/s. */
export function velocityOf(body: Body): Vec2 {
  const v = Body.getVelocity(body);
  return { x: matterVelocityToMetersPerSecond(v.x), y: matterVelocityToMetersPerSecond(v.y) };
}

/**
 * Batente da suspensão: se um impacto forte levar a roda além do curso, ela volta para
 * o limite e perde a velocidade relativa ao quadro (batida seca, sem quique).
 * Sem isso, num pouso muito duro a roda pode atravessar o quadro e ficar presa do outro lado.
 */
function limitSuspensionTravel(bike: Bike, wheel: Body, side: 'rear' | 'front'): void {
  const { frame } = bike;
  const rest = wheelOffset(side);
  const rel = {
    x: fromMatter(wheel.position.x - frame.position.x),
    y: fromMatter(wheel.position.y - frame.position.y),
  };
  const local = rotate(rel, -frame.angle);
  const limited = {
    x: clamp(local.x, rest.x - BIKE.suspension.maxLateral, rest.x + BIKE.suspension.maxLateral),
    y: clamp(local.y, rest.y - BIKE.suspension.maxCompression, rest.y + BIKE.suspension.maxExtension),
  };
  if (limited.x === local.x && limited.y === local.y) return;

  const world = rotate(limited, frame.angle);
  Body.setPosition(wheel, {
    x: frame.position.x + toMatter(world.x),
    y: frame.position.y + toMatter(world.y),
  });
  Body.setVelocity(wheel, Body.getVelocity(frame));
}

/**
 * Lógica própria da bike após cada passo de física: batente da suspensão e giro
 * (visual) das rodas de acordo com a velocidade ao longo do quadro (ω = v / r).
 */
export function updateBike(bike: Bike): void {
  limitSuspensionTravel(bike, bike.rearWheel, 'rear');
  limitSuspensionTravel(bike, bike.frontWheel, 'front');

  const forward = rotate({ x: 1, y: 0 }, bike.frame.angle);
  const spinStep = (wheel: Body): number => {
    const v = velocityOf(wheel);
    return ((v.x * forward.x + v.y * forward.y) / BIKE.wheelRadius) * STEP_SECONDS;
  };
  bike.wheelSpin.rear += spinStep(bike.rearWheel);
  bike.wheelSpin.front += spinStep(bike.frontWheel);
}

function poseOf(body: Body, angle = body.angle): BodyPose {
  return { x: fromMatter(body.position.x), y: fromMatter(body.position.y), angle };
}

export function getBikePose(bike: Bike): BikePose {
  return {
    frame: poseOf(bike.frame),
    rearWheel: poseOf(bike.rearWheel, bike.wheelSpin.rear),
    frontWheel: poseOf(bike.frontWheel, bike.wheelSpin.front),
    rider: poseOf(bike.rider),
    velocity: velocityOf(bike.frame),
  };
}
