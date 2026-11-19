# วิธีตั้งค่า Claude Project: THAILAND WILD TRAILS

> โฟลเดอร์นี้ย้ายมาอยู่ใน repo ของเกมแล้ว (`docs/`) เดิมคือ `thailand-wild-trails/` ข้างโฟลเดอร์ `game/` ในเครื่อง · โค้ดเกมจริงอยู่ที่ราก repo, prototype คือ `knowledge/game.html`

## โครงสร้างไฟล์
```
docs/
├── README.md                 ← ไฟล์นี้ (ไม่ต้องอัปโหลด)
├── project-instructions.md   ← คัดลอกเนื้อหาไปวางในช่อง Project Instructions
└── knowledge/                ← อัปโหลดทุกไฟล์ในโฟลเดอร์นี้เข้า Project Knowledge
    ├── 01-vision.md          (เป้าหมาย, Art Style, Retention)        ← Prompt ข้อ 1, 20, Final Objective
    ├── 02-core-gameplay.md   (ตัวละคร, เดินป่า, แคมป์, อาหาร, ภาพ)  ← ข้อ 2, 3, 6, 16, 17
    ├── 03-world-parks.md     (ระบบอุทยานและด่าน)                    ← ข้อ 5
    ├── 04-parks-data.md      (ข้อมูลสถานที่จริงและสถานะตรวจสอบ)     ← ข้อ 5 (รายชื่อสถานที่)
    ├── 05-progression.md     (Level, Quest, Rank, Passport ฯลฯ)    ← ข้อ 7–15, 18
    ├── 06-multiplayer.md     (Co-op, Hub, Guild, Trading)          ← ข้อ 4, บางส่วนของข้อ 19
    ├── 07-ui-ux.md           (เมนูและหน้าจอ)                        ← ข้อ 21
    ├── 08-tech-roadmap.md    (ข้อกำหนดโค้ดและ Roadmap)             ← ข้อ 22, 23
    ├── progress.md           (สถานะปัจจุบัน อัปเดตทุกรอบ)
    ├── gdd.md                (Game Design Document v0.1)
    ├── data-schema.md        (โครงสร้างข้อมูล v0.1)
    └── game.html             (Prototype v0.8: 3 เส้นทาง + แคมป์ + ทักษะ + สมุดบันทึก + ความสำเร็จ/ยศ/ฉายา/เหรียญตรา + จอสัมผัส + เสียง · เปิดในเบราว์เซอร์แล้วเล่นได้เลย ทั้งคอมและมือถือ)
```
**ทำเสร็จแล้ว:** แชท 1–4 ทั้งหมด และ Phase 1 ส่วนใหญ่ (ดู progress.md) ใน Project ให้เริ่มต่อจาก "แชทถัดไป"
ระบบเสริมในข้อ 19 ถูกกระจายไปไว้ในไฟล์ที่เกี่ยวข้องแล้ว เช่น Pet และ Weather Forecast อยู่ใน 02, Museum และ Lost & Found อยู่ใน 05

## ขั้นตอนตั้งค่า
1. claude.ai → Projects → Create Project → ตั้งชื่อ "Thailand Wild Trails"
2. เปิด `project-instructions.md` แล้วคัดลอกเนื้อหาใต้เส้น `---` ไปวางใน Project Instructions
3. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์ `knowledge/` เข้า Project Knowledge
4. เริ่มแชทแรกด้วยข้อความในหัวข้อ "ข้อความเริ่มแชท" ด้านล่าง

## รอบการทำงาน (ทำซ้ำทุกงาน)
```
เปิดแชทใหม่ (1 แชทต่อ 1 งาน)
   → สั่งงาน
   → ตรวจผลงานหรือลองเล่น Artifact
   → ดาวน์โหลดผลงานไปแทนไฟล์เดิมใน Knowledge (เช่น game.html, gdd.md)
   → อัปเดต progress.md ตามที่ Claude สรุปให้
```
**สำคัญ:** Knowledge ไม่อัปเดตเอง ถ้าลืมแทนไฟล์ แชทถัดไปจะทำงานบนเวอร์ชันเก่า

---

## ข้อความเริ่มแชท (คัดลอกไปใช้ทีละแชท)

### แชท 1: ตรวจข้อมูลสถานที่
> ตรวจสอบรายการใน 04-parks-data.md: แต่ละสถานที่อยู่จังหวัดไหน ภูมิภาคไหนตามระบบ 6 ภาค และมีเส้นทางเดินป่าอะไรบ้าง ระบุแหล่งที่มาด้วย อะไรที่ไม่แน่ใจให้บอกตรงๆ แล้วเสนอ 1 เส้นทางระดับ Beginner สำหรับทำ prototype

(แนะนำให้เปิด Web Search ในแชทนี้ และตรวจแหล่งที่มาด้วยตัวเองก่อนกรอกลงไฟล์)

### แชท 2: GDD
> เขียน Game Design Document ฉบับเต็มจากเอกสารทั้งหมดใน Knowledge เน้น Core Gameplay Loop และระบบของ Phase 1–2 ให้ละเอียด ส่วน Phase 3 ขึ้นไปสรุปสั้นๆ ส่งเป็นไฟล์ Markdown

→ บันทึกผลเป็น `gdd.md` แล้วอัปโหลดเข้า Knowledge

### แชท 3: Database / Data Schema
> ออกแบบ data schema สำหรับ Character, Item, Inventory, Trail, Quest และ Save Data ตาม gdd.md ให้รองรับ multiplayer ในอนาคต

→ บันทึกเป็น `data-schema.md`

### แชท 4: Prototype ขั้นแรก
> เริ่ม Phase 1: สร้าง prototype ที่เดินตัวละครบนแผนที่ top-down 1 ด่านได้ ด้วย pixel art ที่วาดด้วยโค้ด ทำตามโครงสร้าง section ใน 08-tech-roadmap.md

→ ดาวน์โหลดเป็น `game.html` แล้วอัปโหลดเข้า Knowledge

### แชทถัดไป (ทีละระบบ)
> อ่าน progress.md แล้วเพิ่มระบบ [Stamina / Hunger / Day-Night / เก็บของ / ...] ลงใน game.html

---

## ข้อควรรู้
- **Multiplayer ทำใน Artifact ไม่ได้จริง** ใน Projects ให้ทำเป็นเอกสารออกแบบ ถ้าจะทำเกมออนไลน์จริงต้องย้ายไปพัฒนาในโปรเจกต์โค้ด (เช่นใช้ Claude Code กับ Godot, Unity หรือ Phaser + server)
- **Prompt ต้นฉบับห้ามรวมทุกระบบไว้ในไฟล์เดียว** แต่ Artifact ต้องเป็นไฟล์เดียว จึงใช้วิธีแบ่ง section ภายในไฟล์ไปก่อน (ดู 08-tech-roadmap.md)
- **ข้อมูลภูมิภาคใน Prompt บางรายการน่าจะคลาดเคลื่อน** เช่น เอราวัณ (กาญจนบุรี) และแก่งกระจาน (เพชรบุรี) ซึ่งระบบ 6 ภาคจัดเป็นภาคตะวันตก รายการเหล่านี้ทำเครื่องหมาย ⚠️ ไว้ใน 04-parks-data.md แล้ว
