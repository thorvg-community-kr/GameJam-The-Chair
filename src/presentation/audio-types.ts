import type { SfxName } from './sfx';

export type SceneSfxName =
    | 'typing'
    | 'doorOpen'
    | 'doorClose'
    | 'liftArrival'
    | 'birdCall'
    | 'woodCreak'
    | 'metalRattle'
    | 'launchWindup'
    | 'launchKick'
    | 'satelliteAlert'
    | 'gearShift'
    | 'shutter'
    | 'uiTap'
    | 'uiConfirm'
    | 'uiError'
    | 'ventBlow'
    | 'sprayLever';

export type LoopName =
    'gasLoop' | 'wheelLoop' | 'liftMotor' | 'ventMotor' | 'satelliteScan';
export type SoundOptions = {
    gain?: number;
    rate?: number;
    channel?: 'world' | 'ui';
};
export type SoundCue = {
    name: SfxName;
    gain: number;
    rate: number;
    key?: string;
};
export type LoopRequest = {
    id: string;
    name: LoopName;
    gain: number;
    rate: number;
};
export type SceneAudio = { shots: SoundCue[]; loops: LoopRequest[] };
