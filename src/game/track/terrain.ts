import { Bodies, Vertices, type Body } from 'matter-js';

import { toMatter } from '../engine/physics-scale';
import type { Vec2 } from '../engine/types';

/**
 * Trecho contínuo de chão: polilinha da superfície, da esquerda para a direita.
 * Espaços entre trechos são gaps; o fundo de um gap é um trecho `pit` (tocar = queda).
 */
export type TerrainPiece = {
  readonly kind: TerrainKind;
  readonly points: readonly Vec2[];
};

export type TerrainKind = 'ground' | 'pit';

/** Rótulo dos corpos do matter de cada tipo de trecho (usado na detecção de contatos). */
export const TERRAIN_LABEL: Record<TerrainKind, string> = { ground: 'terrain-ground', pit: 'terrain-pit' };

/** Espessura (m) dos blocos físicos sob a superfície. Grossa para fechar o fundo dos gaps. */
const GROUND_THICKNESS = 8;

/**
 * Pista fixa do protótipo (etapa 1). Na etapa 3 vira geração procedural por seed.
 * y cresce para baixo: valores maiores = mais embaixo na montanha.
 */
export const PROTOTYPE_TERRAIN: readonly TerrainPiece[] = [
  // Largada em descida, vale curto e rampa (kicker) do gap 1.
  {
    kind: 'ground',
    points: [
      { x: -8, y: -2.5 },
      { x: 0, y: 0 },
      { x: 14, y: 5 },
      { x: 26, y: 9.5 },
      { x: 31, y: 11.0 },
      { x: 35, y: 11.9 },
      { x: 38, y: 12.2 },
      { x: 41, y: 12.0 },
      { x: 44, y: 11.4 },
      { x: 47, y: 10.7 },
    ],
  },
  // Fundo do gap 1.
  {
    kind: 'pit',
    points: [
      { x: 46, y: 18 },
      { x: 54, y: 18 },
    ],
  },
  // Aterrissagem em descida, ondulações, e kicker do gap 2.
  {
    kind: 'ground',
    points: [
      { x: 53, y: 13.5 },
      { x: 58, y: 15.4 },
      { x: 66, y: 18.6 },
      { x: 76, y: 22 },
      { x: 82, y: 23.2 },
      { x: 86, y: 23.4 },
      { x: 90, y: 22.9 },
      { x: 93, y: 22.8 },
      { x: 97, y: 23.6 },
      { x: 104, y: 26 },
      { x: 118, y: 31 },
      { x: 126, y: 33.2 },
      { x: 131, y: 33.8 },
      { x: 135, y: 33.5 },
      { x: 139, y: 32.6 },
    ],
  },
  // Fundo do gap 2.
  {
    kind: 'pit',
    points: [
      { x: 138, y: 42 },
      { x: 147, y: 42 },
    ],
  },
  // Aterrissagem íngreme (o gap 2 é um drop alto), descida final, chegada e rampa de frenagem.
  {
    kind: 'ground',
    points: [
      { x: 146, y: 37 },
      { x: 156, y: 42.5 },
      { x: 168, y: 49 },
      { x: 180, y: 54 },
      { x: 190, y: 56.6 },
      { x: 200, y: 57.8 },
      { x: 210, y: 58.2 },
      { x: 245, y: 58.2 },
      { x: 253, y: 57.4 },
      { x: 260, y: 55 },
      { x: 265, y: 50 },
      { x: 267, y: 42 },
    ],
  },
];

/** Centro do quadro da bike na largada, já apoiada na primeira rampa. */
export const PROTOTYPE_SPAWN = { position: { x: -5, y: -2.4 }, angle: Math.atan2(2.5, 8) } as const;

/**
 * Converte cada segmento da superfície num bloco estático: um quadrilátero com o topo
 * exatamente sobre o segmento e laterais verticais. Blocos vizinhos compartilham a
 * mesma aresta vertical, então a superfície fica contínua, sem degraus nas emendas.
 *
 * Atenção: o matter orienta a normal de contato pelo centroide dos corpos, então o bloco
 * precisa ser fundo em relação ao comprimento do segmento (espessura ≳ metade do
 * comprimento) — senão, perto da ponta de um segmento longo, a normal pode sair invertida.
 */
export function createTerrainBodies(pieces: readonly TerrainPiece[]): Body[] {
  const bodies: Body[] = [];
  for (const { kind, points } of pieces) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const quad = [
        { x: toMatter(a.x), y: toMatter(a.y) },
        { x: toMatter(b.x), y: toMatter(b.y) },
        { x: toMatter(b.x), y: toMatter(b.y + GROUND_THICKNESS) },
        { x: toMatter(a.x), y: toMatter(a.y + GROUND_THICKNESS) },
      ];
      const centre = Vertices.centre(quad);
      bodies.push(
        Bodies.fromVertices(centre.x, centre.y, [quad], {
          label: TERRAIN_LABEL[kind],
          isStatic: true,
          friction: 0.9,
          frictionStatic: 1,
          restitution: 0,
        }),
      );
    }
  }
  return bodies;
}
