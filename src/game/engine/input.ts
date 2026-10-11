/**
 * Comando abstrato de um ciclista num passo de simulação. Toque, giroscópio, bots e
 * jogadores remotos produzem todos este mesmo formato — o jogo não sabe a origem.
 */
export type BikeInput = {
  /** −1 = inclinar para trás, +1 = para frente. */
  readonly lean: number;
  readonly pedal: boolean;
  readonly brake: boolean;
  /** Enquanto verdadeiro, dá bunny hop sempre que possível (respeitando o cooldown). */
  readonly jump: boolean;
};

export const NEUTRAL_INPUT: BikeInput = { lean: 0, pedal: false, brake: false, jump: false };
