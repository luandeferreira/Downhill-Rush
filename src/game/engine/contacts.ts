import type { Body, Collision, Engine, Pair } from 'matter-js';

import { TERRAIN_LABEL, type TerrainKind } from '../track/terrain';
import { fromMatter } from './physics-scale';
import type { Vec2 } from './types';

/** Contato de uma peça da bike com o terreno, no passo atual. */
export type TerrainContact = {
  /** Normal unitária da superfície, apontando para fora do chão (em direção à bike). */
  readonly normal: Vec2;
  /** Pontos de contato, em metros. */
  readonly points: readonly Vec2[];
  readonly surface: TerrainKind;
};

/**
 * `@types/matter-js` não tipa `engine.pairs` nem `collision.supportCount`
 * (o array `supports` é reaproveitado entre passos; só os primeiros `supportCount` valem).
 */
type MatterPair = Pair & { collision: Collision & { supportCount: number } };

const SURFACE_BY_LABEL = new Map<string, TerrainKind>(
  (Object.entries(TERRAIN_LABEL) as [TerrainKind, string][]).map(([kind, label]) => [label, kind]),
);

/**
 * Lista os contatos com o terreno de cada corpo pedido, a partir dos pares ativos do
 * último `Engine.update`. Corpos sem contato ficam com lista vazia.
 */
export function collectTerrainContacts<K extends string>(
  engine: Engine,
  bodies: Readonly<Record<K, Body>>,
): Record<K, TerrainContact[]> {
  const keys = Object.keys(bodies) as K[];
  const result = {} as Record<K, TerrainContact[]>;
  const keyById = new Map<number, K>();
  for (const key of keys) {
    result[key] = [];
    keyById.set(bodies[key].id, key);
  }

  const pairs = (engine.pairs as { list: MatterPair[] }).list;
  for (const pair of pairs) {
    if (!pair.isActive || pair.isSensor) continue;
    const { collision } = pair;
    const a = collision.bodyA.parent;
    const b = collision.bodyB.parent;

    const keyA = keyById.get(a.id);
    const keyB = keyById.get(b.id);
    const surfaceA = SURFACE_BY_LABEL.get(a.label);
    const surfaceB = SURFACE_BY_LABEL.get(b.label);

    // A normal do matter aponta do corpo B para o corpo A.
    let key: K;
    let surface: TerrainKind;
    let sign: number;
    if (keyA !== undefined && surfaceB !== undefined) {
      [key, surface, sign] = [keyA, surfaceB, 1];
    } else if (keyB !== undefined && surfaceA !== undefined) {
      [key, surface, sign] = [keyB, surfaceA, -1];
    } else {
      continue;
    }

    const points: Vec2[] = [];
    for (let i = 0; i < collision.supportCount; i++) {
      const p = collision.supports[i];
      points.push({ x: fromMatter(p.x), y: fromMatter(p.y) });
    }
    result[key].push({
      normal: { x: collision.normal.x * sign, y: collision.normal.y * sign },
      points,
      surface,
    });
  }
  return result;
}

/** Normal média de uma lista de contatos (ou `null` se não houver contato). */
export function averageNormal(contacts: readonly TerrainContact[]): Vec2 | null {
  if (contacts.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const c of contacts) {
    x += c.normal.x;
    y += c.normal.y;
  }
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : contacts[0].normal;
}
