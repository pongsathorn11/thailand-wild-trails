export const T = { GRASS: 0, PATH: 1, WATER: 2, BRIDGE: 3, ROCK: 4, MOSS: 5, TALL: 6, STEEP: 7 } as const;
export type TileId = (typeof T)[keyof typeof T];

export interface TerrainDef {
  speed: number;
  solid: boolean;
  base: string;
  speck: string[];
  mini: string;
  steep?: boolean;
}

export const TERRAIN: Record<TileId, TerrainDef> = {
  [T.GRASS]: { speed: 0.85, solid: false, base: '#6fa84a', speck: ['#88c05a', '#5a9040'], mini: '#6fa84a' },
  [T.PATH]: { speed: 1.0, solid: false, base: '#c8a878', speck: ['#b89466', '#d8bc8e'], mini: '#e0c690' },
  [T.WATER]: { speed: 0, solid: true, base: '#3d8fc4', speck: ['#5aaee0', '#327bb0'], mini: '#4a9ad0' },
  [T.BRIDGE]: { speed: 1.0, solid: false, base: '#9a6a3a', speck: ['#7a4e28'], mini: '#9a6a3a' },
  [T.ROCK]: { speed: 0, solid: true, base: '#7d7f86', speck: ['#9a9ca2', '#5f6168'], mini: '#85878d' },
  [T.MOSS]: { speed: 0.85, solid: false, base: '#4f8a3c', speck: ['#3f7430', '#6aa64a'], mini: '#4f8a3c' },
  [T.TALL]: { speed: 0.8, solid: false, base: '#a8b85a', speck: ['#c4cf72', '#8c9c48'], mini: '#b0bf62' },
  [T.STEEP]: { speed: 0.6, solid: false, base: '#b0906a', speck: ['#9c7c58', '#c4a47c'], mini: '#d0a870', steep: true },
};
