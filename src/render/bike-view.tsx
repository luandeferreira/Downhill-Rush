import { Circle, Group, Line, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { BodyPose, Vec2 } from '@/game/engine/types';
import { BIKE, type BikePart } from '@/game/entities/Bike';

import type { RenderFrame } from './race-runner';

type Props = { frame: SharedValue<RenderFrame> };

const COLORS = {
  tire: '#1d1d1f',
  rim: '#c7ced6',
  frame: '#fca311',
  fork: '#e5e5e5',
  rider: '#2a6fdb',
  skin: '#f1c27d',
  helmet: '#e63946',
} as const;

/** Pontos no sistema local do quadro (m) usados para ligar peças que se movem entre si. */
const BOTTOM_BRACKET: Vec2 = { x: -0.05, y: 0.18 };
const HEAD_TUBE: Vec2 = { x: 0.42, y: -0.12 };
const SHOULDER: Vec2 = { x: 0.04, y: -0.1 }; // no sistema local do ciclista
const HEAD_RADIUS = 0.14;

/** Quadro desenhado no sistema local do corpo `frame` (m). */
const FRAME_PATH = (() => {
  const p = Skia.Path.Make();
  p.moveTo(BOTTOM_BRACKET.x, BOTTOM_BRACKET.y);
  p.lineTo(HEAD_TUBE.x, HEAD_TUBE.y); // tubo inferior
  p.moveTo(BOTTOM_BRACKET.x, BOTTOM_BRACKET.y);
  p.lineTo(-0.2, -0.22); // tubo do selim
  p.lineTo(HEAD_TUBE.x, -0.16); // tubo superior
  p.moveTo(HEAD_TUBE.x, HEAD_TUBE.y);
  p.lineTo(0.38, -0.3); // mesa
  p.lineTo(BIKE.handsAnchor.x, -0.3); // guidão
  return p;
})();

function toWorld(pose: BodyPose, local: Vec2): Vec2 {
  'worklet';
  const c = Math.cos(pose.angle);
  const s = Math.sin(pose.angle);
  return { x: pose.x + local.x * c - local.y * s, y: pose.y + local.x * s + local.y * c };
}

function usePoseTransform(frame: SharedValue<RenderFrame>, part: BikePart) {
  return useDerivedValue(() => {
    const p = frame.value.snapshot.bike[part];
    return [{ translateX: p.x }, { translateY: p.y }, { rotate: p.angle }];
  });
}

function usePointOn(frame: SharedValue<RenderFrame>, part: BikePart, local: Vec2) {
  return useDerivedValue(() => toWorld(frame.value.snapshot.bike[part], local));
}

function Wheel({ transform }: { transform: ReturnType<typeof usePoseTransform> }) {
  const r = BIKE.wheelRadius;
  const spokes = [0, Math.PI / 3, (2 * Math.PI) / 3];
  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={r - 0.04} color={COLORS.tire} style="stroke" strokeWidth={0.08} />
      <Circle cx={0} cy={0} r={r - 0.1} color={COLORS.rim} style="stroke" strokeWidth={0.025} />
      {spokes.map((a) => (
        <Line
          key={a}
          p1={{ x: Math.cos(a) * (r - 0.1), y: Math.sin(a) * (r - 0.1) }}
          p2={{ x: -Math.cos(a) * (r - 0.1), y: -Math.sin(a) * (r - 0.1) }}
          color={COLORS.rim}
          strokeWidth={0.015}
        />
      ))}
      <Circle cx={0} cy={0} r={0.045} color={COLORS.fork} />
    </Group>
  );
}

/** Bike + ciclista, em metros: deve ficar dentro do grupo de câmera do `WorldCanvas`. */
export function BikeView({ frame }: Props) {
  const frameTransform = usePoseTransform(frame, 'frame');
  const rearTransform = usePoseTransform(frame, 'rearWheel');
  const frontTransform = usePoseTransform(frame, 'frontWheel');
  const riderTransform = usePoseTransform(frame, 'rider');

  // Peças ligadas pela suspensão: desenhadas no mundo, entre pontos de corpos diferentes.
  const bottomBracket = usePointOn(frame, 'frame', BOTTOM_BRACKET);
  const headTube = usePointOn(frame, 'frame', HEAD_TUBE);
  const hands = usePointOn(frame, 'frame', { x: BIKE.handsAnchor.x, y: -0.3 });
  const shoulder = usePointOn(frame, 'rider', SHOULDER);
  // Na queda o ciclista se solta: o braço não liga mais ombro e guidão.
  const armOpacity = useDerivedValue(() => (frame.value.snapshot.status.kind === 'riding' ? 1 : 0));
  const rearAxle = useDerivedValue(() => frame.value.snapshot.bike.rearWheel);
  const frontAxle = useDerivedValue(() => frame.value.snapshot.bike.frontWheel);

  return (
    <Group>
      <Wheel transform={rearTransform} />
      <Wheel transform={frontTransform} />

      <Line p1={bottomBracket} p2={rearAxle} color={COLORS.frame} strokeWidth={0.07} strokeCap="round" />
      <Line p1={headTube} p2={frontAxle} color={COLORS.fork} strokeWidth={0.06} strokeCap="round" />
      <Group transform={frameTransform}>
        <Path path={FRAME_PATH} color={COLORS.frame} style="stroke" strokeWidth={0.07} strokeCap="round" strokeJoin="round" />
      </Group>

      <Group transform={riderTransform}>
        {/* A cápsula física inclui a cabeça: tronco embaixo, capacete dentro da `headZone`. */}
        <RoundedRect
          x={-BIKE.riderWidth / 2}
          y={-BIKE.riderHeight / 2 + BIKE.headZone - 0.02}
          width={BIKE.riderWidth}
          height={BIKE.riderHeight - BIKE.headZone + 0.02}
          r={BIKE.riderWidth / 2}
          color={COLORS.rider}
        />
        <Circle cx={0.02} cy={-BIKE.riderHeight / 2 + HEAD_RADIUS} r={HEAD_RADIUS} color={COLORS.helmet} />
        <Circle cx={0.09} cy={-BIKE.riderHeight / 2 + HEAD_RADIUS + 0.05} r={0.07} color={COLORS.skin} />
      </Group>
      <Line p1={shoulder} p2={hands} color={COLORS.rider} strokeWidth={0.09} strokeCap="round" opacity={armOpacity} />
    </Group>
  );
}
