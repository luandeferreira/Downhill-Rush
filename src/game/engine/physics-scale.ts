/**
 * Passo fixo da simulação e escala interna do matter-js.
 *
 * O matter-js foi calibrado para objetos de dezenas de "unidades" (slop, limiares de
 * repouso etc.), então simular direto em metros (rodas de 0,36) fica instável.
 * Internamente o mundo do matter usa MATTER_UNITS_PER_METER unidades por metro;
 * essa conversão fica restrita a `src/game/` — todo o resto do jogo enxerga metros.
 * (Não tem relação com pixels: isso continua só em `src/render/units.ts`.)
 */
export const STEP_HZ = 60;
export const STEP_SECONDS = 1 / STEP_HZ;
export const STEP_MS = STEP_SECONDS * 1000;

export const MATTER_UNITS_PER_METER = 50;

export function toMatter(meters: number): number {
  return meters * MATTER_UNITS_PER_METER;
}

export function fromMatter(units: number): number {
  return units / MATTER_UNITS_PER_METER;
}

/**
 * `Body.getVelocity` do matter devolve unidades por passo-base de 1000/60 ms,
 * independente do passo real. Converte para m/s.
 */
export function matterVelocityToMetersPerSecond(units: number): number {
  return fromMatter(units) * 60;
}

export function metersPerSecondToMatterVelocity(metersPerSecond: number): number {
  return toMatter(metersPerSecond) / 60;
}

/*
 * Forças e torques: no matter, Δv = (força / massa) · Δt², com Δt em ms e distância em
 * unidades. Com massa em kg, isso dá as conversões abaixo a partir de N e N·m.
 */
export function forceToMatter(newtons: number): number {
  return (newtons * MATTER_UNITS_PER_METER) / 1_000_000;
}

export function torqueToMatter(newtonMeters: number): number {
  return (newtonMeters * MATTER_UNITS_PER_METER * MATTER_UNITS_PER_METER) / 1_000_000;
}
