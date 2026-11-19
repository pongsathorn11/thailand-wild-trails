# 08 · TECH REQUIREMENTS & ROADMAP

## ลำดับก่อนเขียนโค้ด
1. วิเคราะห์และวางโครงสร้างเกมทั้งหมด
2. จัดทำ Game Design Document (GDD)
3. วาง Gameplay Loop
4. ออกแบบ Database
5. วางระบบ Character และ Inventory
6. วางระบบ Map และ Level
7. ออกแบบระบบ Multiplayer
8. ออกแบบ UI/UX
9. วางแผนผลิต Pixel Art Assets
10. แบ่งระบบเป็น Module

## หลักการโค้ด
- ห้ามรวมทุกระบบไว้ในที่เดียว ต้องแยกเป็น module อย่างเป็นระเบียบ
- เพิ่มเนื้อหาใหม่ (ด่าน ไอเทม เควส) ได้โดยไม่ต้องแก้ระบบหลัก → data-driven
- แยกข้อมูลจริงออกจากเนื้อหาสมมติของเกมอย่างชัดเจน
- ให้ความสำคัญกับ Multiplayer, Data Persistence, Server Authority และการป้องกันการโกง

---

## ข้อจำกัดของการพัฒนาบน Claude Projects (อ่านก่อนเขียนโค้ด)

Artifact บน claude.ai ใช้ทำ **prototype ที่เล่นในเบราว์เซอร์** ได้ แต่ยังไม่ใช่เกมจริงที่พร้อมปล่อย จึงใช้แนวทางนี้:

| เรื่อง | แนวทางใน Projects |
|---|---|
| Engine | HTML5 Canvas + JavaScript ล้วน (ไม่ใช้ไลบรารีภายนอก) |
| โครงสร้างไฟล์ | Artifact ต้องเป็นไฟล์เดียว จึงแบ่ง module ภายในไฟล์ด้วย section ชัดเจน (เช่น `const Input = {...}`, `const World = {...}`) และเก็บข้อมูลเกมเป็น data object แยกไว้ด้านบน |
| Pixel Art | วาดด้วยโค้ด (sprite เป็น array ของสี หรือวาดบน Canvas) ใช้แทนจนกว่าจะมีภาพจริง |
| Save | ใช้ localStorage (ครอบด้วย try/catch) |
| Multiplayer | ยังทำจริงใน Artifact ไม่ได้ Phase 3 ให้ทำเป็นเอกสารออกแบบ (protocol, schema, server authority) และย้ายไปพัฒนาในโปรเจกต์โค้ดจริง |
| ขนาด | ถ้าไฟล์ใหญ่เกินไป ให้ส่งเฉพาะส่วนที่แก้ พร้อมบอกตำแหน่งที่ต้องวาง |

### ลำดับ section ในไฟล์ prototype
```
1. CONFIG        ค่าคงที่ ขนาด tile ความเร็ว
2. DATA          ไอเทม ด่าน NPC ข้อความ i18n (แก้ส่วนนี้เพื่อเพิ่มเนื้อหา)
3. ASSETS        pixel sprite ที่วาดด้วยโค้ด
4. STATE         game state ทั้งหมด (serialize ได้ → save / multiplayer ในอนาคต)
5. SYSTEMS       Input, Movement, Stats, Weather, Time, Inventory, ...
6. RENDER        วาดภาพเท่านั้น ไม่แก้ state
7. UI            HUD และเมนู
8. MAIN LOOP     update → render
```

เมื่อ prototype พร้อมแล้ว ค่อยย้ายไปพัฒนาจริงด้วย engine (เช่น Godot, Unity, Phaser) และแยกไฟล์ตาม module

---

## ROADMAP

### Phase 0: Design (เริ่มที่นี่)
- GDD ฉบับเต็ม
- Gameplay Loop
- เลือก 1 เส้นทางสำหรับ prototype (ตรวจสอบข้อมูลจริงก่อน)

### Phase 1: Core Prototype
- ระบบเดิน
- ระบบตัวละคร
- ระบบ Pixel Art
- ระบบแผนที่
- ระบบเดินป่าพื้นฐาน (Stamina, Hunger, Thirst, Day/Night)
- ระบบเก็บของ

### Phase 2: Camping & Progression
- สร้างแคมป์
- ทำสวน
- Inventory
- Level
- Quest

### Phase 3: Multiplayer
- Co-op
- Party
- Social Hub
- แลกเปลี่ยนไอเทม

### Phase 4: Exploration
- ระบบอุทยาน
- เส้นทางจริง
- สมุดอุทยาน
- Achievement
- Rank และ Medal

### Phase 5: Advanced Systems
- Guild
- Collection
- NPC Story
- Event
- Leaderboard

### Phase 6: Polish & Release
- ปรับปรุง Animation และ UI
- ทดสอบ Multiplayer และประสิทธิภาพ
- แก้ Bug
- เตรียมระบบอัปเดตเนื้อหาในอนาคต
