import { Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { TerrainPiece } from '@/game/track/terrain';

/** Quanto (m) o preenchimento desce abaixo do ponto mais baixo da pista. */
const FILL_DEPTH = 40;

type Props = { pieces: readonly TerrainPiece[] };

/** Terreno desenhado em metros: deve ficar dentro do grupo de câmera do `WorldCanvas`. */
export function TerrainView({ pieces }: Props) {
  const { fill, surface, pit } = useMemo(() => {
    const bottom = Math.max(...pieces.flatMap((piece) => piece.points.map((p) => p.y))) + FILL_DEPTH;
    const fillPath = Skia.Path.Make();
    const surfacePath = Skia.Path.Make();
    const pitPath = Skia.Path.Make();
    for (const { kind, points } of pieces) {
      const [first, ...rest] = points;
      const last = points[points.length - 1];
      const line = kind === 'pit' ? pitPath : surfacePath;
      fillPath.moveTo(first.x, first.y);
      line.moveTo(first.x, first.y);
      for (const p of rest) {
        fillPath.lineTo(p.x, p.y);
        line.lineTo(p.x, p.y);
      }
      fillPath.lineTo(last.x, bottom);
      fillPath.lineTo(first.x, bottom);
      fillPath.close();
    }
    return { fill: fillPath, surface: surfacePath, pit: pitPath };
  }, [pieces]);

  return (
    <>
      <Path path={fill} color="#5b3a29" />
      <Path path={surface} color="#4caf50" style="stroke" strokeWidth={0.25} strokeJoin="round" />
      <Path path={pit} color="#2b1b12" style="stroke" strokeWidth={0.25} />
    </>
  );
}
