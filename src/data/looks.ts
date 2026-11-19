/** Character creator options. Body type changes only the look; both have the same stats. */
export const LOOK_OPTIONS = {
  hairStyle: ['short', 'spiky', 'ponytail', 'bun', 'long'],
  hair: ['#2b1d14', '#5a3a22', '#8a3a22', '#d8a83a', '#d8d8e0', '#a08060'],
  skin: ['#f6d7b8', '#e8bc94', '#c48a5e', '#8d5a3b'],
  face: ['round', 'smile', 'brave', 'calm'],
  outfit: [
    { shirt: '#5f8f3e', dark: '#466e2c', pants: '#c8b48a', pack: '#3b5a8a' },
    { shirt: '#b8404e', dark: '#8e2e3a', pants: '#2e2f3a', pack: '#a8483a' },
    { shirt: '#3b7dd8', dark: '#2a5ea8', pants: '#4a4f5e', pack: '#c0582a' },
    { shirt: '#6b7a3a', dark: '#525e2a', pants: '#5a4a3a', pack: '#7a5a3a' },
    { shirt: '#e8a33d', dark: '#b87a22', pants: '#3e4a5e', pack: '#3b5a8a' },
  ],
  acc: ['none', 'bucket', 'cap', 'glasses', 'sunglasses'],
} as const;

export type Body = 'male' | 'female';
export type LookRow = 'hairStyle' | 'hair' | 'skin' | 'face' | 'outfit' | 'acc';
export type LookIndices = Record<LookRow, number>;

export const BODY_PRESETS: Record<Body, LookIndices> = {
  male: { hairStyle: 1, hair: 1, skin: 1, face: 0, outfit: 0, acc: 0 },
  female: { hairStyle: 2, hair: 1, skin: 0, face: 1, outfit: 1, acc: 0 },
};

/** Resolved colors and styles used by the sprite painters. */
export interface Look {
  body?: Body; hairStyle: string; hair: string; skin: string; face?: string;
  shirt: string; shirtDark?: string; pants?: string; packColor?: string; pack?: boolean;
  acc?: string; hat?: string; hatColor?: string;
}

export function resolveLook(body: Body, L: LookIndices): Look {
  const o = LOOK_OPTIONS.outfit[L.outfit], acc = LOOK_OPTIONS.acc[L.acc];
  return {
    body, hairStyle: LOOK_OPTIONS.hairStyle[L.hairStyle], hair: LOOK_OPTIONS.hair[L.hair], skin: LOOK_OPTIONS.skin[L.skin],
    face: LOOK_OPTIONS.face[L.face], shirt: o.shirt, shirtDark: o.dark, pants: o.pants, packColor: o.pack, acc,
    hat: acc === 'bucket' || acc === 'cap' ? acc : 'none', hatColor: acc === 'cap' ? '#3b7dd8' : '#d8b878',
  };
}

export const GUIDE_LOOK: Look = { hairStyle: 'short', hair: '#2b1d14', skin: '#c48a5e', shirt: '#4f6b3a', pants: '#5a4a3a', hat: 'bucket', hatColor: '#b8a070', pack: false, acc: 'bucket' };
