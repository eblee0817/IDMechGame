// Balance simulation: an "expert" bot that knows the coverage table plays full runs.
// Usage: node tests/simulate.js [runs]
const IDM = require('./load');
const G = IDM.Game;
const RUNS = +process.argv[2] || 400;

const LOADOUTS = {
  broad: {
    head: { cls: 'cephalosporins', drug: 'ceftriaxone' }, torso: { cls: 'carbapenems', drug: 'merovabor' },
    rarm: { cls: 'oxazolidinones', drug: 'linezolid' }, larm: { cls: 'macrolides', drug: 'azithromycin' },
    legs: { cls: 'folate', drug: 'tmpsmx' },
  },
  icu: {
    head: { cls: 'cephalosporins', drug: 'cazavi' }, torso: { cls: 'penicillins', drug: 'ampsulb' },
    rarm: { cls: 'lipopeptides', drug: 'daptomycin' }, larm: { cls: 'fluoroquinolones', drug: 'levofloxacin' },
    legs: { cls: 'glycopeptides', drug: 'vancPO' },
  },
  random: null,
};

function playCombat(run, c) {
  let guard = 0;
  while (!c.over && guard++ < 60) {
    while (c.actions > 0 && !c.over) {
      let best = null;
      G.alive(c).forEach((e) => G.PART_IDS.forEach((pid) => {
        if (!G.canFire(run, c, pid)) return;
        const d = G.calcDamage(run, c, pid, e).dmg;
        const score = d * 1000 - e.hp; // prefer big hits, then lower-hp targets
        if (d > 0 && (!best || score > best.score)) best = { pid, uid: e.uid, score };
      }));
      if (!best) { if (!G.retreat(run, c) && c.actions > 0) c.actions = 0; break; }
      G.setTarget(c, best.uid);
      G.fire(run, c, best.pid);
    }
    if (!c.over) G.endTurn(run, c);
  }
  if (!c.over) c.over = 'lose';
  return c.over === 'win';
}

// At the pharmacy, refit toward the previewed boss: aim for two parts that hit each boss organism.
function botRefit(run, free) {
  const boss = IDM.ENCOUNTERS.find((e) => e.id === run.map.bossId);
  const eff = (d, x) => G.COV_MULT[G.coverage(d, x.org)] * G.siteMult(d, x.site);
  const worth = (d) => boss.enemies.reduce((s, y) => s + eff(d, y), 0);
  for (const x of boss.enemies) {
    if (!free && run.credits < G.PRICES.refit) return;
    const covering = G.PART_IDS.filter((p) => eff(run.parts[p].drug, x) >= 1);
    if (covering.length >= 2) continue;
    const victim = G.PART_IDS.filter((p) => !covering.includes(p)).sort((a, b) => worth(run.parts[a].drug) - worth(run.parts[b].drug))[0];
    const used = new Set(G.PART_IDS.filter((p) => p !== victim).map((p) => run.parts[p].cls));
    const drug = Object.keys(IDM.DRUGS).filter((d) => eff(d, x) >= 1 && !used.has(IDM.DRUGS[d].cls))
      .sort((a, b) => worth(b) - worth(a))[0];
    if (drug && !G.refit(run, victim, IDM.DRUGS[drug].cls, drug).length) { if (free) return true; run.credits -= G.PRICES.refit; }
  }
}

function playRun(lo) {
  const run = G.newRun(lo || G.randomLoadout());
  for (;;) {
    const avail = G.availableNodes(run);
    const id = G.pick(avail);
    const node = G.enterNode(run, id);
    const t = node.type;
    if (t === 'boss') bossHp.push(run.hp / run.maxHp);
    if (t === 'battle' || t === 'elite' || t === 'boss') {
      const c = G.startCombat(run, G.encounterFor(run, node));
      if (!playCombat(run, c) && c.over !== 'retreat') return { won: false, act: run.act, where: c.enc.id };
      if (c.over === 'retreat') continue;
      const rw = G.finishCombat(run, c);
      const up = rw.choices.find((x) => x.type === 'upgrade');
      const rep = rw.choices.find((x) => x.type === 'repair');
      G.applyChoice(run, run.hp < run.maxHp * 0.5 && rep ? rep : up || rw.choices[0]);
      if (t === 'boss' && !G.advanceAct(run)) return { won: true, act: 3 };
    } else if (t === 'rest') {
      if (run.hp >= run.maxHp * 0.5 && botRefit(run, true)) continue;
      if (run.cdiff || run.tox.renal > 60) G.restDetox(run);
      else if (run.hp < run.maxHp * 0.6) G.restRepair(run); else run.parts[G.pick(G.PART_IDS)].level++;
    } else if (t === 'shop') {
      botRefit(run);
      if (run.cdiff && run.credits >= G.PRICES.detox) G.buy(run, 'detox');
      if (run.credits >= G.PRICES.upgrade) { run.credits -= G.PRICES.upgrade; run.parts[G.pick(G.PART_IDS)].level++; }
    } else if (t === 'event') {
      if (G.rand() < 0.7) run.credits += 25;
    }
  }
}

let bossHp = [];
Object.entries(LOADOUTS).forEach(([name, lo]) => {
  bossHp = [];
  let wins = 0; const deaths = {}; const acts = [0, 0, 0, 0];
  for (let i = 0; i < RUNS; i++) {
    const r = playRun(lo);
    if (r.won) wins++; else { deaths[r.where] = (deaths[r.where] || 0) + 1; acts[r.act]++; }
  }
  const top = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ':' + v).join(' ');
  console.log(name.padEnd(7) + ' win ' + (100 * wins / RUNS).toFixed(0) + '%  deaths by act ' + acts.slice(1).join('/') + '  avg HP% at boss ' + (100 * bossHp.reduce((a, b) => a + b, 0) / bossHp.length).toFixed(0) + '  top: ' + top);
});
