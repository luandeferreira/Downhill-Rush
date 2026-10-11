import { Composite, Engine, type Body, type Constraint } from 'matter-js';

import { STEP_MS, toMatter } from './physics-scale';

/**
 * Gravidade um pouco acima da real (9,81) para a bike "assentar" rápido e os saltos
 * não parecerem flutuantes — clima arcade.
 */
export const GRAVITY_MPS2 = 14;

export type PhysicsWorld = { readonly engine: Engine };

export function createPhysicsWorld(): PhysicsWorld {
  const engine = Engine.create({
    // Mais iterações que o padrão: as constraints da suspensão ficam firmes sem tremer.
    positionIterations: 8,
    velocityIterations: 6,
    constraintIterations: 4,
    enableSleeping: false,
  });

  // No matter, aceleração = gravity.y * gravity.scale, em unidades/ms².
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  engine.gravity.scale = toMatter(GRAVITY_MPS2) / 1_000_000;

  return { engine };
}

export function addToWorld(world: PhysicsWorld, items: readonly (Body | Constraint)[]): void {
  Composite.add(world.engine.world, [...items]);
}

export function removeFromWorld(world: PhysicsWorld, items: readonly (Body | Constraint)[]): void {
  Composite.remove(world.engine.world, [...items]);
}

/** Avança exatamente um passo fixo. */
export function stepPhysicsWorld(world: PhysicsWorld): void {
  Engine.update(world.engine, STEP_MS);
}
