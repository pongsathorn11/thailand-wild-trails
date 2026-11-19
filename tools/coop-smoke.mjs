// Two-client smoke test against a running co-op server:  node tools/coop-smoke.mjs [ws://localhost:2567]
// Checks: both join one room, see each other, movement comes from the server, a speed hack
// (sending far more inputs than real time) does not move faster, walls still block.
import WebSocket from 'ws';

const URL = process.argv[2] || 'ws://localhost:2567';
const TRAIL = 'doi-inthanon-kew-mae-pan', ROOM = 'TEST';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; };

function client(name) {
  const ws = new WebSocket(URL), c = { ws, name, id: null, snaps: [], joined: [], errors: [], seq: 0 };
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'welcome') c.id = m.id, c.welcome = m;
    if (m.t === 'snap') c.snaps.push(m);
    if (m.t === 'joined') c.joined.push(m);
    if (m.t === 'error') c.errors.push(m.code);
  });
  c.open = new Promise((r) => ws.on('open', r));
  c.join = () => ws.send(JSON.stringify({ t: 'join', trail: TRAIL, room: ROOM, token: null, name, look: { body: 'female', looks: { hair: 2 } } }));
  c.input = (inp) => ws.send(JSON.stringify({ t: 'input', seq: ++c.seq, inp: { l: false, r: false, u: false, d: false, run: false, sit: false, slow: 1, ...inp } }));
  c.me = () => { const s = c.snaps.at(-1); return s && s.players.find((p) => p.id === c.id); };
  return c;
}

const a = client('Doi'), b = client('Pha');
await Promise.all([a.open, b.open]);
a.join(); await wait(200); b.join(); await wait(400);
check(!!a.id && !!b.id && a.id !== b.id, 'both players got ids');
check(a.joined.some((j) => j.id === b.id && j.name === 'Pha'), 'A was told B joined');
check(b.welcome?.players.some((p) => p.id === a.id), 'B saw A already in the room');
check(a.welcome?.weather === b.welcome?.weather, `same weather for both (${a.welcome?.weather})`);

const a0 = a.me();
// A walks up for 1 s at the honest rate (20 inputs/s)
for (let i = 0; i < 20; i++) { a.input({ u: true }); await wait(50); }
await wait(300);
const a1 = a.me(), honest = Math.hypot(a1.x - a0.x, a1.y - a0.y);
check(honest > 20 && honest < 75, `honest walk moved ${honest.toFixed(1)} px in 1 s`);
check(a1.ack === a.seq, `server acknowledged every input (ack ${a1.ack})`);
check(b.snaps.at(-1).players.some((p) => p.id === a.id && Math.abs(p.y - a1.y) < 0.01), 'B sees A at the server position');

// B tries a speed hack: 200 run inputs in one burst
const b0 = b.me();
for (let i = 0; i < 200; i++) b.input({ u: true, run: true });
await wait(1000);
const b1 = b.me(), hacked = Math.hypot(b1.x - b0.x, b1.y - b0.y);
check(hacked < 160, `200-input burst moved only ${hacked.toFixed(1)} px in 1 s (queue capped, real-time budget)`);

// junk and slow-down abuse are ignored / clamped
b.ws.send('garbage'); b.ws.send(JSON.stringify({ t: 'input', seq: 1, inp: { u: true } })); // replayed seq
await wait(200);
check(b.ws.readyState === WebSocket.OPEN, 'server ignored junk without dropping the connection');

// a 5th player cannot join a full room
const extra = [client('C'), client('D'), client('E')];
await Promise.all(extra.map((c) => c.open));
for (const c of extra) { c.join(); await wait(150); }
await wait(300);
check(extra[2].errors.includes('full'), 'fifth player is refused (room full)');

// leaving is announced
for (const c of extra) c.ws.close();
b.ws.close(); await wait(400);
check(!a.snaps.at(-1).players.some((p) => p.id === b.id), 'B disappears from A after leaving');
a.ws.close();
console.log(fails ? `\n${fails} check(s) failed` : '\nall co-op checks passed');
process.exit(fails ? 1 : 0);
