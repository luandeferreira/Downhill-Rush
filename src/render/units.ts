/**
 * Único ponto de conversão entre unidades de física (metros) e de tela (pixels).
 * A lógica de jogo trabalha sempre em metros; só a camada de renderização chama estas funções.
 */
export const PIXELS_PER_METER = 40;

export function metersToPixels(meters: number): number {
  'worklet';
  return meters * PIXELS_PER_METER;
}

export function pixelsToMeters(pixels: number): number {
  'worklet';
  return pixels / PIXELS_PER_METER;
}
