/**
 * The Social Hub: a shared plaza where online hikers meet, form parties and set off together.
 * Everything here is game fiction (no real place), so it lives apart from the parks' realData.
 */
export type HubSpotType = 'partyBoard' | 'info' | 'cafe' | 'gate' | 'campfire' | 'home';

export const HUB = {
  W: 26, H: 16, start: [3, 13] as [number, number],
  /** Interactive places (tile coordinates). */
  spots: [
    { id: 'board', type: 'partyBoard', x: 8, y: 4 },
    { id: 'info', type: 'info', x: 13, y: 3 },
    { id: 'cafe', type: 'cafe', x: 18, y: 4 },
    { id: 'fire', type: 'campfire', x: 12, y: 9 },
    { id: 'gate', type: 'gate', x: 21, y: 12 },
    { id: 'home', type: 'home', x: 4, y: 14 },
  ] as { id: string; type: HubSpotType; x: number; y: number }[],
  /** Decoration only (benches around the fire). */
  benches: [[10, 9], [14, 9], [12, 11]] as [number, number][],
  paths: [[2, 12, 3, 15], [2, 12, 22, 12], [11, 5, 13, 12], [7, 5, 19, 6], [21, 6, 22, 12], [10, 8, 14, 10]] as [number, number, number, number][],
  /** Bottom-left gap in the tree border: the path back to camp. */
  exitGap: [2, 3] as [number, number],
};
