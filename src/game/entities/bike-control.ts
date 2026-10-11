import { Body } from 'matter-js';

import { averageNormal, type TerrainContact } from '../engine/contacts';
import type { BikeInput } from '../engine/input';
import {
  forceToMatter,
  metersPerSecondToMatterVelocity,
  STEP_SECONDS,
  torqueToMatter,
} from '../engine/physics-scale';
import type { Vec2 } from '../engine/types';
import { clamp, dot } from '../engine/vec';
import { bikeBodies, velocityOf, type Bike, type BikePart } from './Bike';

/** Ajuste dos controles, em unidades físicas (N, N·m, m/s, s). */
export const BIKE_CONTROL = {
  /** Torque de inclinação no ar: gira a bike inteira. */
  airLeanTorque: 170,
  /** Torque de inclinação no chão: transfere peso (empinar / jogar o peso na frente). */
  groundLeanTorque: 520,
  /** Acima desta rotação (rad/s) no ar, inclinar no mesmo sentido não acelera mais. */
  maxAirSpin: 7,
  /** Força de tração ao pedalar, parado; cai linearmente até zero em `maxPedalSpeed`. */
  pedalForce: 300,
  maxPedalSpeed: 16,
  /** Desaceleração máxima do freio com as duas rodas no chão (m/s²). */
  brakeDecel: 9,
  /** Velocidade (m/s) somada ao longo da normal do chão no bunny hop. */
  hopSpeed: 4.2,
  hopCooldown: 0.6,
} as const;

export type BikeContacts = Readonly<Record<BikePart, readonly TerrainContact[]>>;

/** Direção "para frente" ao longo de uma superfície com essa normal (bike virada à direita). */
function tangentOf(normal: Vec2): Vec2 {
  return { x: -normal.y, y: normal.x };
}

function totalMass(bike: Bike): number {
  return bikeBodies(bike).reduce((sum, body) => sum + body.mass, 0);
}

function applyForceMeters(body: Body, at: Body, force: Vec2): void {
  Body.applyForce(body, at.position, { x: forceToMatter(force.x), y: forceToMatter(force.y) });
}

/**
 * Converte o input abstrato em forças sobre a bike, antes do próximo passo de física.
 * `contacts` são os do passo anterior. Devolve `true` se um bunny hop foi disparado.
 *
 * Como as rodas não giram no matter (ver `Bike`), "torque na roda traseira" vira a
 * força equivalente de tração aplicada no eixo traseiro, ao longo do chão.
 */
export function applyBikeInput(bike: Bike, input: BikeInput, contacts: BikeContacts, time: number): boolean {
  const rearNormal = averageNormal(contacts.rearWheel);
  const frontNormal = averageNormal(contacts.frontWheel);
  const grounded = rearNormal !== null || frontNormal !== null;
  const velocity = velocityOf(bike.frame);
  const mass = totalMass(bike);

  // Inclinar: torque no quadro (ângulo positivo = horário na tela = nariz para baixo).
  const lean = clamp(input.lean, -1, 1);
  if (lean !== 0) {
    // getAngularVelocity devolve rad por passo-base de 1000/60 ms.
    const spin = Body.getAngularVelocity(bike.frame) * 60;
    const spinningTooFast = !grounded && Math.sign(spin) === Math.sign(lean) && Math.abs(spin) > BIKE_CONTROL.maxAirSpin;
    if (!spinningTooFast) {
      const torque = lean * (grounded ? BIKE_CONTROL.groundLeanTorque : BIKE_CONTROL.airLeanTorque);
      bike.frame.torque += torqueToMatter(torque);
    }
  }

  // Pedalar: tração no eixo traseiro, só com a roda traseira no chão.
  if (input.pedal && !input.brake && rearNormal !== null) {
    const forward = tangentOf(rearNormal);
    const speed = dot(velocity, forward);
    const strength = BIKE_CONTROL.pedalForce * clamp(1 - speed / BIKE_CONTROL.maxPedalSpeed, 0, 1);
    applyForceMeters(bike.frame, bike.rearWheel, { x: forward.x * strength, y: forward.y * strength });
  }

  // Frear: cada roda no chão segura metade, sem nunca inverter o sentido do movimento.
  if (input.brake) {
    for (const [wheel, normal] of [
      [bike.rearWheel, rearNormal],
      [bike.frontWheel, frontNormal],
    ] as const) {
      if (normal === null) continue;
      const forward = tangentOf(normal);
      const speed = dot(velocity, forward);
      const maxForce = (mass * BIKE_CONTROL.brakeDecel) / 2;
      const stopForce = (mass * Math.abs(speed)) / STEP_SECONDS / 2;
      const strength = -Math.sign(speed) * Math.min(maxForce, stopForce);
      applyForceMeters(bike.frame, wheel, { x: forward.x * strength, y: forward.y * strength });
    }
  }

  // Bunny hop: impulso ao longo da normal do chão, com as duas rodas apoiadas.
  if (input.jump && rearNormal !== null && frontNormal !== null && time >= bike.control.hopReadyAt) {
    const n = averageNormal([...contacts.rearWheel, ...contacts.frontWheel]) ?? rearNormal;
    const dv = metersPerSecondToMatterVelocity(BIKE_CONTROL.hopSpeed);
    for (const body of bikeBodies(bike)) {
      const v = Body.getVelocity(body);
      Body.setVelocity(body, { x: v.x + n.x * dv, y: v.y + n.y * dv });
    }
    bike.control.hopReadyAt = time + BIKE_CONTROL.hopCooldown;
    return true;
  }
  return false;
}
