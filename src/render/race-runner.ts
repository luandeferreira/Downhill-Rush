import { FixedStepAccumulator } from '@/game/engine/fixed-step';
import type { BikeInput } from '@/game/engine/input';
import { STEP_SECONDS } from '@/game/engine/physics-scale';
import {
  createRace,
  lerpSnapshot,
  snapshotRace,
  stepRace,
  type RaceEvent,
  type RaceSnapshot,
  type RaceState,
} from '@/game/engine/race';
import type { TerrainPiece } from '@/game/track/terrain';

import { cameraTarget, followCamera, type Camera } from './camera';

/** Tudo que a renderização precisa para desenhar um quadro. */
export type RenderFrame = {
  readonly snapshot: RaceSnapshot;
  readonly camera: Camera;
};

type RunnerState = {
  race: RaceState;
  previous: RaceSnapshot;
  current: RaceSnapshot;
  camera: Camera;
};

function initialState(): RunnerState {
  const race = createRace();
  const snapshot = snapshotRace(race);
  return {
    race,
    previous: snapshot,
    current: snapshot,
    camera: cameraTarget(snapshot.bike.frame, snapshot.bike.velocity),
  };
}

/**
 * Ponte entre o tempo real (quadros da tela, duração variável) e a simulação em passo
 * fixo. A cada quadro roda 0..N passos de física e devolve um estado interpolado entre
 * os dois últimos passos, mais a câmera suavizada.
 */
export class RaceRunner {
  private readonly clock = new FixedStepAccumulator(STEP_SECONDS);
  private state = initialState();

  get terrain(): readonly TerrainPiece[] {
    return this.state.race.terrain;
  }

  reset(): void {
    this.state = initialState();
    this.clock.reset();
  }

  /** Quadro atual sem avançar o tempo. */
  peek(): RenderFrame {
    return { snapshot: this.state.current, camera: this.state.camera };
  }

  /**
   * Avança pelo tempo real do quadro. O mesmo `input` vale para todos os passos fixos
   * deste quadro; os eventos de todos eles são devolvidos juntos.
   */
  advance(frameSeconds: number, input: BikeInput): { frame: RenderFrame; events: RaceEvent[] } {
    const s = this.state;
    const events: RaceEvent[] = [];
    const steps = this.clock.advance(frameSeconds);
    for (let i = 0; i < steps; i++) {
      s.previous = s.current;
      events.push(...stepRace(s.race, input));
      s.current = snapshotRace(s.race);
    }

    const snapshot = lerpSnapshot(s.previous, s.current, this.clock.alpha);
    s.camera = followCamera(s.camera, cameraTarget(snapshot.bike.frame, snapshot.bike.velocity), frameSeconds);
    return { frame: { snapshot, camera: s.camera }, events };
  }
}
