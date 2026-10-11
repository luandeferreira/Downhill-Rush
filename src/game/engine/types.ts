/**
 * Tipos geométricos compartilhados pela lógica de jogo.
 * Coordenadas em metros, ângulos em radianos. O eixo y aponta para BAIXO
 * (mesma orientação do matter-js e da tela), então "descer a montanha" = y crescente.
 */
export type Vec2 = { readonly x: number; readonly y: number };

/** Posição + rotação de um corpo rígido. */
export type BodyPose = { readonly x: number; readonly y: number; readonly angle: number };
