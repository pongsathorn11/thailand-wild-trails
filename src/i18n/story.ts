/**
 * Text for NPC stories and seasonal events (Thai and English).
 * The characters are fictional. Place facts only repeat what docs/knowledge/04-parks-data.md already
 * sources (Kew Mae Pan: montane forest, grassland, sea of mist, rhododendrons; Phu Kradueng: steep climb,
 * pine forest and grassland on the plateau, Pha Lom Sak cliff). Leave No Trace lines are its general principles.
 */
type Dict = Record<string, string | string[]>;

const th: Dict = {
  // ----- NPC names and roles -----
  npc_kham: 'ลุงคำ', npc_kham_role: 'อดีตเจ้าหน้าที่อุทยาน',
  npc_daeng: 'ป้าแดง', npc_daeng_role: 'แม่ค้าข้าวเหนียวริมทาง',
  npc_fah: 'น้องฟ้า', npc_fah_role: 'ช่างภาพธรรมชาติ',
  act_talk_npc: 'คุยกับ{n}',
  story_heart: 'ความสนิท',

  // ----- Uncle Kham: the ranger -----
  story_kham1_intro: [
    'อ้าว นักเดินทางหน้าใหม่ ลุงชื่อคำ เคยเป็นเจ้าหน้าที่อุทยานมาเกือบทั้งชีวิต',
    'สิ่งที่ลุงเห็นบ่อยที่สุดบนทางเดินป่า ไม่ใช่เสือ ไม่ใช่งู... แต่เป็นขวดพลาสติกกับถุงขนม',
    'กติกาข้อแรกของคนรักป่า: เอาอะไรเข้าไป ก็เอาสิ่งนั้นกลับออกมา',
    'ลองเก็บขยะบนเส้นทางให้ได้ 5 ชิ้นนะ แล้วกลับมาเล่าให้ลุงฟัง',
  ],
  story_kham1_wait: ['เก็บขยะได้กี่ชิ้นแล้ว? ครบ 5 ชิ้นเมื่อไรค่อยมาคุยกัน', 'ขยะชิ้นเล็กๆ ก็สำคัญนะ สัตว์อาจกินเข้าไปได้'],
  story_kham1_done: ['เก่งมาก! ป่าสะอาดขึ้นเพราะมือของเรานี่แหละ', 'รับนี่ไปเป็นค่าขนม แล้วว่างๆ แวะมาคุยกับลุงอีกนะ'],
  story_kham1_goal: 'เก็บขยะบนเส้นทาง',
  story_kham2_intro: [
    'รู้ไหม เส้นทางกิ่วแม่ปานที่ดอยอินทนนท์ เป็นทางวนสั้นๆ แต่ผ่านทั้งป่าดิบเขาและทุ่งหญ้า',
    'พืชบนนั้นโตช้า ถ้าคนเดินลัดออกนอกทางทีละนิด ทุ่งหญ้าก็จะเป็นรอยถาวร',
    'ลองไปเดินกิ่วแม่ปานให้จบสักรอบ อย่าออกนอกทางนะ แล้วกลับมาบอกลุงว่าเห็นอะไรบ้าง',
  ],
  story_kham2_wait: ['ยังไม่ได้ไปกิ่วแม่ปานเหรอ? เช้าๆ ถ้าโชคดีจะเห็นทะเลหมอกนะ'],
  story_kham2_done: [
    'ได้เห็นกุหลาบพันปีไหม? สมัยลุงยังหนุ่ม ลุงเฝ้ามันทุกฤดูหนาว',
    'การเดินตามทางเดิม คือการบอกป่าว่า "เรามาเยี่ยม ไม่ได้มาเปลี่ยนแปลง"',
  ],
  story_kham2_goal: 'เดินเส้นทางกิ่วแม่ปานให้จบ',
  story_kham3_intro: [
    'คราวนี้เป็นงานใหญ่ ภูกระดึง ทางขึ้นชันมาก ลุงเคยแบกของขึ้นไปช่วยเพื่อนเจ้าหน้าที่อยู่หลายปี',
    'บนยอดเป็นที่ราบกว้าง มีป่าสน ทุ่งหญ้า และหน้าผา ที่ผาหล่มสักตอนเย็นสวยจนลืมเหนื่อย',
    'เตรียมน้ำให้พอ ค่อยๆ เดิน แล้วไปให้ถึงผาหล่มสักให้ได้นะ',
  ],
  story_kham3_wait: ['ภูกระดึงไม่หนีไปไหนหรอก เตรียมตัวให้พร้อม เติมน้ำ เติมแรง แล้วค่อยไป'],
  story_kham3_done: [
    'ไปถึงผาหล่มสักแล้ว! ลุงภูมิใจในตัวหลานมาก',
    'ตั้งแต่วันนี้ หลานคือเพื่อนของผู้พิทักษ์ป่า ดูแลป่าแทนลุงด้วยนะ',
  ],
  story_kham3_goal: 'พิชิตภูกระดึงถึงผาหล่มสัก',
  story_kham_locked: ['เรื่องต่อไปยังเหนื่อยเกินไปสำหรับหลาน ลองเก็บประสบการณ์ให้ถึงเลเวล 3 ก่อนนะ'],
  story_kham_done: ['ป่าจะอยู่ได้ ถ้ามีคนอย่างหลานคอยดูแล', 'จำไว้นะ: เดินตามทาง เก็บขยะกลับ ไม่รบกวนสัตว์ป่า'],

  // ----- Auntie Daeng: the trail cook -----
  story_daeng1_intro: [
    'มาๆ หิวไหมลูก ป้าแดงขายข้าวเหนียวอยู่ริมทางเดินป่ามาหลายปีแล้ว',
    'คนเดินป่าที่ดีต้องกินให้อิ่ม อาหารที่ทำเองอร่อยกว่าแล้วก็ไม่มีขยะห่อมาด้วย',
    'ลองทำอาหารที่กองไฟสัก 2 อย่างสิ ป้าจะได้ชิมฝีมือ',
  ],
  story_daeng1_wait: ['ยังไม่ได้ทำกับข้าวเลยเหรอ? กองไฟอยู่ตรงนั้นเอง ลองดู'],
  story_daeng1_done: ['หอมจัง! ใช้ได้เลยลูก', 'เอาเมล็ดกะเพราไปปลูกเพิ่มนะ ผักที่ปลูกเองอร่อยที่สุด'],
  story_daeng1_goal: 'ทำอาหารที่กองไฟ',
  story_daeng2_intro: [
    'ป้าว่าแปลงผักของลูกมีที่ว่างอีกเยอะ',
    'ปลูก รดน้ำทุกวัน รอให้โต แล้วเก็บเกี่ยวสัก 3 ครั้งนะ ป้าจะสอนสูตรลับให้',
  ],
  story_daeng2_wait: ['อย่าลืมรดน้ำทุกวันนะ ผักไม่ได้น้ำก็ไม่โต'],
  story_daeng2_done: ['ผักงามมาก! มือเย็นจริงๆ', 'เอาเมล็ดสตรอว์เบอร์รีไปด้วย ปลูกตอนหน้าหนาวจะงามที่สุด'],
  story_daeng2_goal: 'เก็บเกี่ยวผักจากแปลง',
  story_daeng3_intro: [
    'ป้าจะเล่าความลับให้ฟัง ร้านข้าวเหนียวของป้าเริ่มจากหม้อใบเดียว',
    'สิ่งที่ทำให้คนกลับมาไม่ใช่สูตร แต่เป็นการแบ่งปัน',
    'ทำอาหารอีก 4 จาน แล้วพกไปแบ่งเพื่อนร่วมทางนะลูก',
  ],
  story_daeng3_wait: ['อีกนิดเดียว ทำอาหารให้ครบแล้วกลับมาหาป้า'],
  story_daeng3_done: ['ตั้งแต่วันนี้ ลูกคือแม่ครัวประจำแคมป์แล้ว', 'ใครหิวมา ก็อย่าลืมแบ่งเขากินนะ'],
  story_daeng3_goal: 'ทำอาหารเพิ่มอีก',
  story_daeng_locked: ['เรื่องต่อไปป้าจะเล่าเมื่อลูกเลเวล 3 นะ ไปเที่ยวให้สนุกก่อน'],
  story_daeng_done: ['ป้าดีใจที่มีลูกเป็นเพื่อนบ้าน', 'กินข้าวกินปลาให้อิ่มก่อนออกเดินนะ'],

  // ----- Fah: the young photographer -----
  story_fah1_intro: [
    'สวัสดีค่ะ! ฟ้าชอบถ่ายรูปธรรมชาติ แต่ยังถ่ายไม่ค่อยเก่งเลย',
    'ครูของฟ้าบอกว่า ภาพที่ดีเริ่มจากการหยุดเดิน แล้วมองดีๆ',
    'ช่วยถ่ายภาพธรรมชาติมาให้ฟ้าดูสัก 3 ภาพได้ไหมคะ',
  ],
  story_fah1_wait: ['ไม่ต้องรีบนะคะ ค่อยๆ เดิน แล้วจะเจอมุมสวยเอง'],
  story_fah1_done: ['ว้าว สวยมากเลยค่ะ! ฟ้าขอเก็บไว้เป็นแรงบันดาลใจนะ'],
  story_fah1_goal: 'ถ่ายภาพธรรมชาติ',
  story_fah2_intro: [
    'ฟ้าฝันอยากถ่ายทะเลหมอกมาตลอดเลยค่ะ',
    'เขาว่าต้องไปถึงจุดชมวิวแต่เช้า ตอนที่อากาศหนาวและมีหมอก',
    'ถ้าพี่เจอทะเลหมอก ถ่ายมาให้ฟ้าดูหน่อยนะคะ',
  ],
  story_fah2_wait: ['ทะเลหมอกต้องตื่นเช้านะคะ ลองดูพยากรณ์อากาศก่อนออกเดิน'],
  story_fah2_done: ['นี่แหละทะเลหมอก! เหมือนเดินอยู่บนเมฆเลย ขอบคุณมากค่ะ'],
  story_fah2_goal: 'ถ่ายภาพทะเลหมอก',
  story_fah3_intro: [
    'ภาพสุดท้ายที่ฟ้าอยากได้คือนกค่ะ แต่นกตกใจง่ายมาก',
    'ถ้าวิ่งเข้าไป นกจะบินหนีทันที ต้องเดินช้าๆ แล้วอดทนรอ',
    'ช่วยถ่ายภาพนกในป่ามาให้ฟ้าได้ไหมคะ โดยไม่ทำให้มันตกใจนะ',
  ],
  story_fah3_wait: ['ใจเย็นๆ นะคะ เดินช้าๆ นกจะไม่หนี'],
  story_fah3_done: ['สวยที่สุดเลยค่ะ! พี่คือนักล่าแสงตัวจริง', 'ภาพที่ดีที่สุดคือภาพที่ไม่ทำร้ายใคร ฟ้าจะจำไว้ค่ะ'],
  story_fah3_goal: 'ถ่ายภาพนกในป่า',
  story_fah_locked: ['ภาพต่อไปยากมากค่ะ รอพี่เลเวล 3 ก่อนนะคะ'],
  story_fah_done: ['วันหลังไปถ่ายรูปด้วยกันอีกนะคะ!'],

  // ----- dialogue UI and messages -----
  story_next: 'E / Enter ถัดไป',
  story_progress: '{g} {n}/{m}',
  msg_storyReady: '{i} {n}: ภารกิจเสร็จแล้ว กลับไปคุยที่แคมป์',
  msg_storyReward: '{i} ได้รับรางวัลจาก{n}: +{e} EXP +{c}🪙',
  msg_storyHeart: '♥ สนิทกับ{n}มากขึ้น',
  story_tracker: 'เรื่องราว',

  // ----- titles -----
  title_rangerFriend: 'เพื่อนผู้พิทักษ์ป่า', tcond_rangerFriend: 'ฟังเรื่องของลุงคำจนจบ',
  title_campCook: 'แม่ครัวประจำแคมป์', tcond_campCook: 'ฟังเรื่องของป้าแดงจนจบ',
  title_lightChaser: 'นักล่าแสง', tcond_lightChaser: 'ฟังเรื่องของน้องฟ้าจนจบ',

  // ----- seasonal events -----
  event_mistFestival: 'เทศกาลทะเลหมอก',
  event_mistFestival_desc: 'ภาคเหนือและอีสานมีหมอกบ่อยขึ้น · ภาพทะเลหมอกและจุดชมวิวได้ EXP ×2',
  event_hikeFestival: 'เทศกาลเดินป่า',
  event_hikeFestival_desc: 'เดินป่าให้จบ 2 เส้นทาง และเก็บขยะ 6 ชิ้น รับตราประทับเทศกาล',
  event_plantingSeason: 'ฤดูปลูกป่า',
  event_plantingSeason_desc: 'ฝนมาแล้ว ปลูกผักและเก็บเกี่ยว · ภาพน้ำตกได้ EXP ×1.5',
  event_banner: '{i} {e} · เหลือ {d} วัน',
  event_done: '✅ ทำครบแล้ว',
  event_next: 'กิจกรรมถัดไป: {i} {e} ในอีก {d} วัน',
  msg_eventStart: '🎉 {i} {e} เริ่มแล้ว! (เหลือ {d} วัน)',
  msg_eventGoal: '{i} {e}: ทำเป้าหมายสำเร็จ 1 ข้อ',
  msg_eventDone: '🏅 {e} สำเร็จ! +{x} EXP +{c}🪙 ได้ตราประทับเทศกาล',
  qk_completeTrail: "เดินจบเส้นทาง", qk_takePhoto: "ถ่ายภาพ", qk_collectLitter: "เก็บขยะ", qk_harvest: "เก็บเกี่ยว", qk_cook: "ทำอาหาร", qk_plant: "ปลูกผัก", qk_placeFurniture: "ตกแต่งแคมป์",
  ui_days_left: "เหลือ {n} วัน",
  stamps_title: "ตราประทับเทศกาล",
};

const en: Dict = {
  npc_kham: 'Uncle Kham', npc_kham_role: 'retired park ranger',
  npc_daeng: 'Auntie Daeng', npc_daeng_role: 'trail-side sticky-rice cook',
  npc_fah: 'Fah', npc_fah_role: 'nature photographer',
  act_talk_npc: 'Talk to {n}',
  story_heart: 'Friendship',

  story_kham1_intro: [
    "Ah, a new hiker! I'm Kham. I was a park ranger for most of my life.",
    'Do you know what I saw most on the trails? Not tigers, not snakes... plastic bottles and snack wrappers.',
    'First rule for anyone who loves the forest: whatever you carry in, you carry out.',
    'Pick up 5 pieces of litter on the trails, then come back and tell me about it.',
  ],
  story_kham1_wait: ["How many pieces so far? Come back when you've got 5.", 'Even small litter matters. Animals can eat it.'],
  story_kham1_done: ['Well done! The forest is cleaner because of your hands.', 'Take this for snacks, and drop by for a chat anytime.'],
  story_kham1_goal: 'Pick up litter on the trails',
  story_kham2_intro: [
    'Kew Mae Pan at Doi Inthanon is a short loop, but it passes montane forest and grassland.',
    'Plants up there grow slowly. If people keep stepping off the path, the grassland scars for good.',
    "Walk Kew Mae Pan to the end, stay on the trail, then tell me what you saw.",
  ],
  story_kham2_wait: ["Haven't been to Kew Mae Pan yet? Early in the morning, you might see a sea of mist."],
  story_kham2_done: [
    'Did you see the rhododendrons? When I was young, I watched over them every cool season.',
    'Staying on the trail tells the forest: "we came to visit, not to change you."',
  ],
  story_kham2_goal: 'Finish the Kew Mae Pan trail',
  story_kham3_intro: [
    'This one is big: Phu Kradueng. The climb is steep. I carried supplies up for my fellow rangers for years.',
    'The top is a wide plateau with pine forest, grassland and cliffs. Sunset at Pha Lom Sak makes you forget you were tired.',
    'Bring enough water, take it slow, and make it to Pha Lom Sak.',
  ],
  story_kham3_wait: ["Phu Kradueng isn't going anywhere. Refill your water, rest up, then go."],
  story_kham3_done: ['You reached Pha Lom Sak! I am so proud of you.', "From today you're a friend of the forest rangers. Look after the forest for me."],
  story_kham3_goal: 'Climb Phu Kradueng to Pha Lom Sak',
  story_kham_locked: ['The next part is a tough trip. Gain some experience and come back at level 3.'],
  story_kham_done: ['The forest will be fine with people like you looking after it.', 'Remember: stay on the trail, carry your litter out, leave wildlife be.'],

  story_daeng1_intro: [
    "Come, come, are you hungry? I'm Auntie Daeng. I've sold sticky rice beside the trails for years.",
    'A good hiker eats well. Home cooking tastes better, and it comes without wrappers to throw away.',
    'Cook 2 dishes at the campfire. Let me taste your cooking!',
  ],
  story_daeng1_wait: ["Haven't cooked yet? The campfire is right there, give it a try."],
  story_daeng1_done: ["Smells wonderful! You've got it.", 'Take some holy basil seeds and grow more. Vegetables you grow yourself taste the best.'],
  story_daeng1_goal: 'Cook at the campfire',
  story_daeng2_intro: [
    'Your garden has plenty of room left.',
    "Plant, water every day, wait for it to grow, and harvest 3 times. Then I'll teach you a secret recipe.",
  ],
  story_daeng2_wait: ["Don't forget to water every day. No water, no growth."],
  story_daeng2_done: ['Such healthy plants! You have a green thumb.', 'Take strawberry seeds too. They do best in the cool season.'],
  story_daeng2_goal: 'Harvest from your garden',
  story_daeng3_intro: [
    "Let me tell you a secret. My sticky-rice stall started with a single pot.",
    "What brings people back isn't the recipe. It's sharing.",
    'Cook 4 more dishes and share them with the people you hike with.',
  ],
  story_daeng3_wait: ['Almost there. Finish cooking, then come back to me.'],
  story_daeng3_done: ["From today, you're the camp's cook.", "If someone comes by hungry, don't forget to share."],
  story_daeng3_goal: 'Cook more dishes',
  story_daeng_locked: ["I'll tell you the next part at level 3. Go have some fun first!"],
  story_daeng_done: ["I'm glad you're my neighbour.", 'Eat well before you set off!'],

  story_fah1_intro: [
    "Hi! I'm Fah. I love photographing nature, but I'm not very good yet.",
    'My teacher says a good photo starts when you stop walking and really look.',
    'Could you take 3 nature photos for me to see?',
  ],
  story_fah1_wait: ["No rush. Walk slowly, and you'll find the beautiful angles."],
  story_fah1_done: ["Wow, these are beautiful! I'll keep them for inspiration."],
  story_fah1_goal: 'Take nature photos',
  story_fah2_intro: [
    "I've always dreamed of photographing a sea of mist.",
    'They say you have to reach a viewpoint early, when it is cold and misty.',
    'If you find a sea of mist, please photograph it for me!',
  ],
  story_fah2_wait: ['A sea of mist needs an early start. Check the forecast before you set off.'],
  story_fah2_done: ['That\'s a sea of mist! Like walking on clouds. Thank you so much!'],
  story_fah2_goal: 'Photograph a sea of mist',
  story_fah3_intro: [
    'The last photo I want is a bird, but birds scare so easily.',
    'If you run at them, they fly off. You have to move slowly and be patient.',
    'Could you photograph a forest bird for me, without frightening it?',
  ],
  story_fah3_wait: ["Stay calm. Walk slowly and the bird won't fly away."],
  story_fah3_done: ["It's the best one! You're a true light chaser.", "The best photo is one that doesn't hurt anyone. I'll remember that."],
  story_fah3_goal: 'Photograph a forest bird',
  story_fah_locked: ['The next photo is really hard. Come back at level 3!'],
  story_fah_done: ["Let's go take photos together again sometime!"],

  story_next: 'E / Enter next',
  story_progress: '{g} {n}/{m}',
  msg_storyReady: '{i} {n}: task done, go back and talk at camp',
  msg_storyReward: '{i} Reward from {n}: +{e} EXP +{c}🪙',
  msg_storyHeart: '♥ You and {n} are closer now',
  story_tracker: 'Stories',

  title_rangerFriend: 'Friend of the Rangers', tcond_rangerFriend: "Finish Uncle Kham's story",
  title_campCook: 'Camp Cook', tcond_campCook: "Finish Auntie Daeng's story",
  title_lightChaser: 'Light Chaser', tcond_lightChaser: "Finish Fah's story",

  event_mistFestival: 'Sea of Mist Festival',
  event_mistFestival_desc: 'More fog on northern and northeastern trails · sea-of-mist and viewpoint photos give ×2 EXP',
  event_hikeFestival: 'Hiking Festival',
  event_hikeFestival_desc: 'Finish 2 trails and pick up 6 pieces of litter for the festival stamp',
  event_plantingSeason: 'Planting Season',
  event_plantingSeason_desc: 'The rains are here: plant and harvest · waterfall photos give ×1.5 EXP',
  event_banner: '{i} {e} · {d} days left',
  event_done: '✅ All done',
  event_next: 'Next event: {i} {e} in {d} days',
  msg_eventStart: '🎉 {i} {e} has begun! ({d} days left)',
  msg_eventGoal: '{i} {e}: one goal complete',
  msg_eventDone: '🏅 {e} complete! +{x} EXP +{c}🪙 festival stamp earned',
  qk_completeTrail: "Finish trails", qk_takePhoto: "Photos", qk_collectLitter: "Litter", qk_harvest: "Harvest", qk_cook: "Cook", qk_plant: "Plant", qk_placeFurniture: "Decorate",
  ui_days_left: "{n} days left",
  stamps_title: "Festival stamps",
};

export const STORY_TEXT: Record<'th' | 'en', Dict> = { th, en };
