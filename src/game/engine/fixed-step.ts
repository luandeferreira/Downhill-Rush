/**
 * Acumulador de passo fixo: desacopla a taxa da simulação (sempre STEP_HZ)
 * da taxa de quadros da tela, que varia.
 */
export class FixedStepAccumulator {
  private accumulator = 0;

  constructor(
    private readonly stepSeconds: number,
    /** Teto por quadro, para evitar a "espiral da morte" após travadas longas. */
    private readonly maxFrameSeconds = 0.25,
  ) {}

  /** Soma o tempo real do quadro e devolve quantos passos fixos devem rodar agora. */
  advance(frameSeconds: number): number {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), this.maxFrameSeconds);
    const steps = Math.floor(this.accumulator / this.stepSeconds);
    this.accumulator -= steps * this.stepSeconds;
    return steps;
  }

  /** Fração [0, 1) do próximo passo já acumulada — usada para interpolar a renderização. */
  get alpha(): number {
    return this.accumulator / this.stepSeconds;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
