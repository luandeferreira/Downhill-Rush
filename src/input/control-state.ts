import type { BikeInput } from '@/game/engine/input';

import type { ControlMode } from './control-settings';

export type ControlButton = 'leanBack' | 'leanForward' | 'brake' | 'pedal' | 'jump';

/** Estado bruto dos controles físicos (botões e giroscópio), atualizado pelos eventos. */
export type ControlState = Record<ControlButton, boolean> & {
  /** Inclinação lida do giroscópio, −1..1. */
  tiltLean: number;
};

export function createControlState(): ControlState {
  return { leanBack: false, leanForward: false, brake: false, pedal: false, jump: false, tiltLean: 0 };
}

/** Converte o estado dos controles no input abstrato que o jogo entende. */
export function toBikeInput(state: ControlState, mode: ControlMode): BikeInput {
  if (mode === 'tilt') {
    return { lean: state.tiltLean, pedal: state.pedal, brake: state.brake, jump: state.jump };
  }
  // No toque, segurar os dois botões de inclinar ao mesmo tempo = freio.
  const bothLean = state.leanBack && state.leanForward;
  return {
    lean: bothLean ? 0 : (state.leanForward ? 1 : 0) - (state.leanBack ? 1 : 0),
    pedal: state.pedal,
    brake: bothLean,
    jump: state.jump,
  };
}
