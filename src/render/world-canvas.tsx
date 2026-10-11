import { Canvas, Fill, Group } from '@shopify/react-native-skia';
import type { StyleProp, ViewStyle } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { TerrainPiece } from '@/game/track/terrain';

import { BikeView } from './bike-view';
import { CAMERA } from './camera';
import type { RenderFrame } from './race-runner';
import { TerrainView } from './terrain-view';
import { metersToPixels } from './units';

type Props = {
  frame: SharedValue<RenderFrame>;
  terrain: readonly TerrainPiece[];
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Canvas do mundo. Os filhos do grupo de câmera desenham em METROS: a transformação
 * (âncora na tela → escala px/m → −posição da câmera) é a única conversão para pixels.
 */
export function WorldCanvas({ frame, terrain, width, height, style }: Props) {
  const camera = useDerivedValue(() => {
    const { x, y } = frame.value.camera;
    return [
      { translateX: width * CAMERA.anchor.x - metersToPixels(x) },
      { translateY: height * CAMERA.anchor.y - metersToPixels(y) },
      { scale: metersToPixels(1) },
    ];
  });

  return (
    <Canvas style={[{ width, height }, style]}>
      <Fill color="#8ecae6" />
      <Group transform={camera}>
        <TerrainView pieces={terrain} />
        <BikeView frame={frame} />
      </Group>
    </Canvas>
  );
}
