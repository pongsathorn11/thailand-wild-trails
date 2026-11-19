# DATA SCHEMA: THAILAND WILD TRAILS
เวอร์ชัน 0.1 · 2026-11-18

> Schema นี้ใช้ได้ทั้งกับ prototype (localStorage) และกับ server จริงใน Phase 3
> หลักการ:
> 1. **Definition** (ข้อมูลเกมที่คงที่ เช่น ไอเทม ด่าน เควส) แยกจาก **Instance** (ข้อมูลของผู้เล่นแต่ละคน)
> 2. ทุก entity มี `id` เป็น string และไม่เปลี่ยน (เช่น `item.water_bottle`)
> 3. ข้อมูลจริงอยู่ใน `realData` และต้องมี `source` ส่วนเนื้อหาเกมอยู่ใน `game`
> 4. ค่าที่โกงได้ (เงิน, EXP, ไอเทม) ใน Phase 3 ให้ server เป็นผู้คำนวณ ส่วน client ส่งแค่ action

---

## 1. Definitions (ข้อมูลเกม, อ่านอย่างเดียว)

### ItemDef
```ts
{
  id: "water_bottle",
  nameKey: "item_water_bottle",      // i18n key
  category: "consumable" | "gear" | "clothing" | "collectible" | "litter" | "material",
  weightKg: 0.6,
  stack: 1,                          // จำนวนสูงสุดต่อช่อง
  charges?: 1,                       // ใช้ได้กี่ครั้งต่อชิ้น
  effects?: { thirst?: 35, hunger?: 0, stamina?: 0, warmth?: 0 },
  wearable?: { slot: "body" | "head" | "rain", warmth?: 10, rainProof?: true },
  buff?: { stat: "staminaDrain", mult: 0.8, durationSec: 60 },
  rarity?: "common" | "rare" | "legendary",
  cosmeticOnly?: true                // ไอเทมจากร้าน/อีเวนต์ ห้ามให้ความได้เปรียบ (no Pay-to-Win)
}
```

### ParkDef
```ts
{
  id: "doi-inthanon",
  nameKey: "park_inthanon",
  region: "north" | "central" | "northeast" | "east" | "west" | "south",
  realData: { province: "เชียงใหม่", source: "url", verifiedAt: "2026-11-18" | null },
  stampId: "stamp.doi-inthanon",
  trails: ["doi-inthanon-kew-mae-pan"]
}
```

### TrailDef
```ts
{
  id: "doi-inthanon-kew-mae-pan",
  parkId: "doi-inthanon",
  difficulty: 1,                     // 1–5
  realData: {
    distanceKm: 3, elevationM: 2200, loop: true,
    seasonClosed: { from: "06-01", to: "10-31" },
    guideRequired: true | null,
    source: "url", verifiedAt: null
  },
  game: {
    mapSeed: 20261118, mapW: 64, mapH: 48,
    waypoints: [[8,42], ...],        // tile coords
    steepSegments: [[5,9]],
    pois: [PoiDef],
    events: ["slippery", "wildlife", "coldWind", "lostItem", "fogRoll"],
    litterCount: 5,
    climate: { baseTempC: { dawn: 8, noon: 18, night: 6 }, ridgeOffset: -2 }
  }
}
```

### PoiDef
```ts
{
  id: "view", type: "sign" | "npc" | "bench" | "viewpoint" | "photo" | "secret" | "item" | "goal" | "water",
  x: 48, y: 6,
  checkpoint?: true,
  subject?: "rhodo",                 // PhotoSubjectDef id
  itemId?: "flashlight",
  real?: true                        // true = มีอยู่จริง (ต้องอ้างอิงใน realData ของ Trail)
}
```

### PhotoSubjectDef
```ts
{ id: "seaOfMist", nameKey: "ph_seaOfMist", exp: 40, rarity: "rare",
  condition?: { weather: "fog", hourBefore: 9 } }
```

### EventDef (เหตุการณ์ระหว่างเดิน)
```ts
{
  id: "slippery", weight: 3, durationSec: 20,
  condition?: { weather?: [...], zone?: "forest" | "ridge", hourFrom?: 0, hourTo?: 24 },
  effect: { speedMult?: 0.8, ambientTempDelta?: -5, fogDelta?: 0.2, spawn?: "photo:muntjac" | "item:trail_mix" },
  messageKey: "ev_slippery"
}
```

### QuestDef (Phase 2)
```ts
{
  id: "daily.hike_once", type: "daily" | "weekly" | "exploration" | "social" | "story",
  giverNpcId?: "npc.guide",
  goals: [{ kind: "completeTrail" | "takePhoto" | "collectLitter" | "cook" | "harvest", target?: "any", count: 1 }],
  rewards: { exp: 30, items?: [{ id, qty }], honor?: 5 },
  requires?: { level?: 2, questDone?: ["..."] }
}
```

### AchievementDef / MedalDef / TitleDef (Phase 4)
```ts
{ id: "ach.walk_10km", tier: "bronze" | "silver" | "gold" | "platinum",
  stat: "totalDistanceKm", threshold: 10, rewardTitleId?: "title.trail_walker" }
```

---

## 2. Instances (ข้อมูลผู้เล่น)

### PlayerProfile (บันทึกถาวร)
```ts
{
  schemaVersion: 1,
  playerId: "local" | "uuid",        // Phase 3: มาจาก server
  name: "string",
  look: { skin: 0, hair: 0, shirt: 1, hat: 1 },   // index ของ LOOK_OPTIONS
  outfitPresets: [{ name, look }],
  level: 1, exp: 0, skillPoints: 0,
  skills: { hiking: 0, survival: 0, camping: 0, cooking: 0, gardening: 0, exploration: 0, photography: 0, social: 0 },
  honor: 0, rankId: "rank.rookie_hiker", activeTitleId: null,
  stats: { totalDistanceKm: 0, trailsCompleted: 0, litterCollected: 0, photosTaken: 0 },
  passport: { [parkId]: { stamped: true, firstDate: "ISO", trails: { [trailId]: { completions: 1, bestTimeSec: 300 } } } },
  album: [{ subjectId: "seaOfMist", trailId, date: "ISO" }],
  collection: { [itemId]: qty },
  storage: [InventorySlot],          // ของที่เก็บไว้ที่แคมป์
  camp: CampState,                   // Phase 2
  quests: { active: [QuestProgress], done: ["id"] },
  achievements: { [id]: "ISO date" },
  settings: { lang: "th" | "en" }
}
```

### InventorySlot
```ts
{ itemId: "water_bottle", qty: 2, charges?: [1, 0] }
```

### HikeSession (ระหว่างเดิน 1 รอบ, ไม่ต้องบันทึกถาวร)
```ts
{
  trailId, startedAt: "ISO", weather: "clear" | "fog" | "drizzle",
  timeSec: 0,
  player: { x, y, dir, stamina, hunger, thirst, warmth, wearing: { body: "jacket" | null, rain: null } },
  backpack: { slots: [InventorySlot], maxSlots: 12, maxWeightKg: 10 },
  checkpoint: false, poiDone: { [poiId]: true }, photos: ["id"],
  litter: [{ x, y, taken }],
  activeEvents: [{ id, endsAt }],
  distancePx: 0
}
```

### CampState (Phase 2)
```ts
{ gridW: 20, gridH: 15,
  placed: [{ itemId, x, y, rot: 0 | 1 | 2 | 3 }],
  plots: [{ x, y, cropId, plantedDay, wateredDay, stage: 0 }] }
```

---

## 3. ตัวอย่าง Save (prototype ใช้ localStorage key `twt_save_v1`)
ปัจจุบัน prototype ใช้ schema แบบย่อ:
```json
{ "totalExp": 120, "completions": 1, "album": ["view","rhodo"], "lang": "th",
  "look": { "skin": 0, "hair": 0, "shirt": 1, "hat": 1 } }
```
เมื่อถึง Phase 2 ให้ migrate ไปใช้ `PlayerProfile` (`schemaVersion: 1`) โดยแปลงค่าเดิม:
`totalExp → exp`, `completions → stats.trailsCompleted`, `album[] → album[{subjectId}]`

---

## 4. Multiplayer (Phase 3): สิ่งที่ schema นี้รองรับไว้แล้ว
- Client ส่ง **action** (`move`, `interact(poiId)`, `useItem(itemId)`, `photo(subjectId)`) ไม่ส่งผลลัพธ์
- Server ตรวจ: ระยะห่างจาก POI, ความเร็วเคลื่อนที่สูงสุด, เงื่อนไขของภาพถ่าย (weather/hour) แล้วคำนวณ EXP เอง
- `HikeSession` 1 ก้อนต่อปาร์ตี้ และ `player` เปลี่ยนเป็น `players: { [playerId]: ... }`
- Trading: ใช้ transaction `{ id, from, to, items, status }` ที่ server ยืนยันทั้งสองฝั่ง
