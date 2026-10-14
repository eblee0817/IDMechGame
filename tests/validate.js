// Data-integrity and engine tests. Run with: node tests/validate.js
const assert = require('assert');
const IDM = require('./load');
const G = IDM.Game;

let failures = 0, passes = 0;
function test(name, fn) {
  try { fn(); passes++; } catch (e) { failures++; console.error('FAIL ' + name + '\n  ' + e.message); }
}

const orgIds = Object.keys(IDM.ORGANISMS);
const drugIds = Object.keys(IDM.DRUGS);

test('every class lists drugs that point back to it', () => {
  IDM.CLASSES.forEach((c) => c.drugs.forEach((d) => {
    assert(IDM.DRUGS[d], 'missing drug ' + d);
    assert.strictEqual(IDM.DRUGS[d].cls, c.id, d + ' class mismatch');
  }));
});

test('every drug belongs to exactly one listed class', () => {
  drugIds.forEach((d) => {
    const n = IDM.CLASSES.filter((c) => c.drugs.includes(d)).length;
    assert.strictEqual(n, 1, d + ' appears in ' + n + ' classes');
  });
});

test('coverage tables reference real organisms with values 1-3', () => {
  drugIds.forEach((d) => Object.entries(IDM.DRUGS[d].cov).forEach(([o, v]) => {
    assert(IDM.ORGANISMS[o], d + ' covers unknown organism ' + o);
    assert([1, 2, 3].includes(v), d + '|' + o + ' bad value ' + v);
  }));
});

test('site multipliers reference real sites', () => {
  drugIds.forEach((d) => Object.keys(IDM.DRUGS[d].site).forEach((s) => assert(IDM.SITES[s], d + ' unknown site ' + s)));
});

test('every drug has spectrum, adverse effects, abbreviation, toxicity', () => {
  drugIds.forEach((d) => {
    const x = IDM.DRUGS[d];
    assert(x.name && x.abbr && x.spectrum && x.ae, d + ' missing text');
    assert(typeof x.tox.renal === 'number' && typeof x.tox.gut === 'number', d + ' bad tox');
  });
});

test('organisms have stain, teach, failNote, stats', () => {
  orgIds.forEach((o) => {
    const x = IDM.ORGANISMS[o];
    assert(x.stain && x.teach && x.failNote && x.hp > 0 && x.atk > 0 && x.types.length, o);
  });
});

test('notes keys reference real drugs/classes/families/orgs', () => {
  const fams = new Set(IDM.CLASSES.map((c) => c.family));
  const types = new Set(['gp', 'gn', 'anaerobe', 'atypical']);
  const checkLeft = (l, k) => {
    if (l.startsWith('cls:')) assert(IDM.classById(l.slice(4)), 'bad class in ' + k);
    else if (l.startsWith('fam:')) assert(fams.has(l.slice(4)), 'bad family in ' + k);
    else assert(IDM.DRUGS[l], 'bad drug in ' + k);
  };
  Object.keys(IDM.NOTES).forEach((k) => {
    const [l, r] = k.split('|');
    checkLeft(l, k);
    if (r.startsWith('type:')) assert(types.has(r.slice(5)), 'bad type in ' + k);
    else assert(IDM.ORGANISMS[r], 'bad org in ' + k);
  });
  Object.keys(IDM.SITE_NOTES).forEach((k) => {
    const [l, r] = k.split('|');
    checkLeft(l, k);
    assert(r === '*' || IDM.SITES[r], 'bad site in ' + k);
  });
});

test('encounters reference real organisms and sites; each act has all kinds', () => {
  IDM.ENCOUNTERS.forEach((e) => e.enemies.forEach((x) => {
    assert(IDM.ORGANISMS[x.org], e.id + ' bad org');
    assert(IDM.SITES[x.site], e.id + ' bad site');
  }));
  [1, 2, 3].forEach((a) => ['battle', 'elite', 'boss'].forEach((k) => {
    assert(IDM.ENCOUNTERS.some((e) => e.act === a && e.kind === k), 'act ' + a + ' lacks ' + k);
  }));
});

test('every encounter enemy is beatable by at least two drugs at its site', () => {
  // Gonorrhea is the deliberate exception: ceftriaxone really is the one reliable agent.
  const single = new Set(['ngono']);
  IDM.ENCOUNTERS.forEach((e) => e.enemies.forEach((x) => {
    const n = drugIds.filter((d) => G.coverage(d, x.org) >= 2 && G.siteMult(d, x.site) >= 0.75).length;
    assert(n >= (single.has(x.org) ? 1 : 2), e.id + ': ' + x.org + '@' + x.site + ' has only ' + n + ' good drugs');
  }));
});

test('there are enough classes to fill all parts uniquely', () => {
  assert(IDM.CLASSES.length >= IDM.PARTS.length);
});

test('key teaching facts are encoded', () => {
  assert.strictEqual(G.coverage('ceftriaxone', 'efaecalis'), 0);
  assert.strictEqual(G.coverage('ceftriaxone', 'listeria'), 0);
  assert.strictEqual(G.coverage('ertapenem', 'pseudo'), 0);
  assert.strictEqual(G.coverage('vancIV', 'cdiff'), 0);
  assert.strictEqual(G.coverage('vancPO', 'cdiff'), 3);
  assert.strictEqual(G.siteMult('daptomycin', 'lung'), 0);
  assert.strictEqual(G.coverage('ceftaroline', 'mrsa') >= 2, true);
  assert.strictEqual(G.coverage('meropenem', 'steno'), 0);
  assert.strictEqual(G.coverage('tmpsmx', 'steno'), 3);
  assert.strictEqual(G.siteMult('nitrofurantoin', 'blood'), 0);
  IDM.CLASSES.filter((c) => c.family === 'betalactam').forEach((c) => c.drugs.forEach((d) => {
    assert.strictEqual(G.coverage(d, 'myco'), 0, d + ' should not cover Mycoplasma');
  }));
});

test('note lookup prefers specific over class notes', () => {
  assert(/PBP2a/.test(G.note('ceftaroline', 'mrsa')));
  assert(/cephalosporins/.test(G.note('cefepime', 'efaecalis')));
  assert(/oxygen/.test(G.note('gentamicin', 'bfrag')));
  assert(/surfactant/.test(G.siteNote('daptomycin', 'lung')));
});

test('loadout validation', () => {
  const lo = G.randomLoadout();
  assert.deepStrictEqual(G.loadoutErrors(lo), []);
  const dup = JSON.parse(JSON.stringify(lo));
  dup.torso = { cls: dup.head.cls, drug: dup.head.drug };
  assert(G.loadoutErrors(dup).length > 0);
  const bad = JSON.parse(JSON.stringify(lo));
  bad.legs = { cls: 'penicillins', drug: 'meropenem' };
  assert(G.loadoutErrors(bad).length > 0);
});

test('map: connected rows, boss reachable from every node', () => {
  for (let i = 0; i < 200; i++) {
    const m = G.genMap(1);
    m.rows.forEach((row, r) => row.forEach((id) => {
      const n = m.nodes[id];
      assert(n.next.length > 0, 'dead end ' + id);
      if (r > 0) assert(m.rows[r - 1].some((pid) => m.nodes[pid].next.includes(id)), 'unreachable ' + id);
    }));
    m.rows[m.rows.length - 1].forEach((id) => assert(m.nodes[id].next.includes('boss')));
    const all = Object.values(m.nodes);
    assert(all.some((n) => n.type === 'shop'), 'no shop');
    assert(all.some((n) => n.type === 'elite'), 'no elite');
  }
});

test('combat: effective drug damages, ineffective does nothing, culture reveals', () => {
  const lo = {
    head: { cls: 'cephalosporins', drug: 'ceftriaxone' }, torso: { cls: 'carbapenems', drug: 'meropenem' },
    rarm: { cls: 'glycopeptides', drug: 'vancIV' }, larm: { cls: 'macrolides', drug: 'azithromycin' },
    legs: { cls: 'nitroimidazoles', drug: 'metronidazole' },
  };
  const run = G.newRun(lo);
  const enc = IDM.ENCOUNTERS.find((e) => e.id === 'cap');
  const c = G.startCombat(run, enc);
  const e = c.enemies[0];
  assert(!e.identified);
  const hp0 = e.hp;
  G.fire(run, c, 'legs'); // metronidazole vs pneumococcus
  assert.strictEqual(e.hp, hp0);
  G.fire(run, c, 'head'); // ceftriaxone, DOC + precision lock
  assert.strictEqual(e.hp, hp0 - Math.round(G.BASE_DMG * 0.8 * 1.5 * 1.5));
  assert(!G.fire(run, c, 'head'), 'a part fires once per turn');
  while (c.actions > 0) c.actions--;
  assert(!G.fire(run, c, 'rarm'), 'no actions left');
  G.endTurn(run, c);
  assert(!G.canFire(run, c, 'legs'), 'legs cooling down');
  assert(G.canFire(run, c, 'head'));
  G.endTurn(run, c);
  assert(e.identified, 'culture after 2 turns');
  assert(G.canFire(run, c, 'legs'));
});

test('combat: C. diff spawns when gut meter overflows', () => {
  const run = G.newRun(G.randomLoadout());
  run.parts.head = { cls: 'lincosamides', drug: 'clindamycin', level: 0 };
  run.tox.gut = 95;
  const c = G.startCombat(run, IDM.ENCOUNTERS.find((e) => e.id === 'cellulitis'));
  G.fire(run, c, 'head');
  assert(c.enemies.some((e) => e.org === 'cdiff'), 'C. diff should join');
  assert(!c.over || c.over === null);
});

test('quiz generator produces valid questions', () => {
  for (let i = 0; i < 300; i++) {
    const q = G.genQuiz();
    assert(q.q && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length && q.explain);
    assert.strictEqual(new Set(q.options).size, q.options.length, 'duplicate options: ' + q.q);
  }
});

console.log(passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
