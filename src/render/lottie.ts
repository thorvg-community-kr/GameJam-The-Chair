import type { LottieAsset } from './types';

const sources = new Map<LottieAsset, string>();

/** Lottie JSON is fetched with the ThorVG engine and handed to the painter here. */
export function registerLottie(asset: LottieAsset, json: string): void {
    sources.set(asset, json);
}

export function lottieSource(asset: LottieAsset): string | null {
    return sources.get(asset) ?? null;
}
