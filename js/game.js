// Game engine: run state, map generation, combat, rewards. No DOM access, so it is testable in Node.
var IDM = globalThis.IDM = globalThis.IDM || {};

(function () {
  var G = IDM.Game = {};
  var DRUGS = IDM.DRUGS, ORGS = IDM.ORGANISMS;

  G.rand = Math.random;
  function ri(n) { return Math.floor(G.rand() * n); }
  function pick(a) { return a[ri(a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = ri(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  G.pick = pick; G.shuffle = shuffle;

  G.COV_MULT = [0, 0.35, 1.0, 1.5];
  G.COV_LABEL = ['No effect', 'Weak', 'Effective', 'Drug of choice!'];
  G.BASE_DMG = 10;
  G.ATK_SCALE = 0.55;
  G.RETREAT_COST = 20;
  G.ACTIONS = 3;
  G.MAP_ROWS = 7;
  G.UNIQUE_CLASSES = true; // each part must use a different antibiotic class
  G.PART_IDS = IDM.PARTS.map(function (p) { return p.id; });

  G.part = function (id) { return IDM.PARTS.filter(function (p) { return p.id === id; })[0]; };
  G.coverage = function (drugId, orgId) { return DRUGS[drugId].cov[orgId] || 0; };
  G.siteMult = function (drugId, site) {
    var m = DRUGS[drugId].site[site];
    return m == null ? 1 : m;
  };
  function family(drugId) { return IDM.drugClass(drugId).family; }
  G.isBetaLactam = function (drugId) { return family(drugId) === 'betalactam'; };

  // ---------- persistent storage (codex, saved loadout, saved run) ----------
  var mem = {};
  G.storage = {
    get: function (k, dflt) {
      try {
        if (globalThis.localStorage) { var v = localStorage.getItem(k); return v == null ? dflt : JSON.parse(v); }
      } catch (e) { /* storage unavailable */ }
      return k in mem ? mem[k] : dflt;
    },
    set: function (k, v) {
      try { if (globalThis.localStorage) { localStorage.setItem(k, JSON.stringify(v)); return; } } catch (e) { /* ignore */ }
      mem[k] = v;
    },
    del: function (k) {
      try { if (globalThis.localStorage) { localStorage.removeItem(k); return; } } catch (e) { /* ignore */ }
      delete mem[k];
    },
  };

  G.codex = function () {
    var c = G.storage.get('idm_codex', null);
    if (!c) c = { orgs: {}, pairs: {}, sites: {}, runs: 0, wins: 0, best: 0 };
    return c;
  };
  function codexUpdate(fn) { var c = G.codex(); fn(c); G.storage.set('idm_codex', c); }

  // ---------- teaching notes ----------
  G.note = function (drugId, orgId) {
    var d = DRUGS[drugId], cls = d.cls, fam = family(drugId), o = ORGS[orgId], N = IDM.NOTES;
    var keys = [drugId + '|' + orgId, 'cls:' + cls + '|' + orgId, 'fam:' + fam + '|' + orgId];
    o.types.forEach(function (t) { keys.push('cls:' + cls + '|type:' + t); });
    o.types.forEach(function (t) { keys.push('fam:' + fam + '|type:' + t); });
    for (var i = 0; i < keys.length; i++) if (N[keys[i]]) return N[keys[i]];
    return null;
  };
  G.siteNote = function (drugId, site) {
    var S = IDM.SITE_NOTES, cls = DRUGS[drugId].cls;
    return S[drugId + '|' + site] || S['cls:' + cls + '|' + site] || S[drugId + '|*'] || null;
  };

  // ---------- loadout ----------
  G.loadoutErrors = function (lo) {
    var errs = [], seen = {};
    G.PART_IDS.forEach(function (pid) {
      var p = lo && lo[pid];
      if (!p || !p.cls || !p.drug) { errs.push(G.part(pid).name + ' is empty.'); return; }
      if (!DRUGS[p.drug] || DRUGS[p.drug].cls !== p.cls) { errs.push(G.part(pid).name + ' has an invalid drug.'); return; }
      if (G.UNIQUE_CLASSES && seen[p.cls]) errs.push(IDM.classById(p.cls).name + ' is used twice. Each part needs a different class.');
      seen[p.cls] = true;
    });
    return errs;
  };

  G.randomLoadout = function () {
    var classes = shuffle(IDM.CLASSES), lo = {};
    G.PART_IDS.forEach(function (pid, i) { var c = classes[i]; lo[pid] = { cls: c.id, drug: pick(c.drugs) }; });
    return lo;
  };

  // ---------- run ----------
  G.DIFFICULTY = {
    student: { name: 'Student', hp: 150, hints: true, desc: '150 integrity. Shows expected effectiveness before you fire.' },
    resident: { name: 'Resident', hp: 120, hints: false, desc: '120 integrity. Learn coverage from the feedback.' },
    attending: { name: 'Attending', hp: 100, hints: false, desc: '100 integrity. For people who already know their antibiogram.' },
  };
  G.newRun = function (loadout, difficulty) {
    var diff = G.DIFFICULTY[difficulty] ? difficulty : 'resident';
    var parts = {};
    G.PART_IDS.forEach(function (pid) { parts[pid] = { cls: loadout[pid].cls, drug: loadout[pid].drug, level: 0 }; });
    var run = {
      act: 1, difficulty: diff, maxHp: G.DIFFICULTY[diff].hp, hp: G.DIFFICULTY[diff].hp, credits: 40, relics: [], parts: parts,
      tox: { renal: 0, gut: 0 }, map: G.genMap(1), pos: null, seen: [], cdiff: false,
      stats: { battles: 0, elites: 0, bosses: 0, quizRight: 0, quizTotal: 0, noEffect: 0, kills: 0, floors: 0 },
    };
    run.map.bossId = G.pickEncounter(run, 'boss').id;
    codexUpdate(function (c) { c.runs++; });
    return run;
  };
  G.has = function (run, relicId) { return run.relics.indexOf(relicId) >= 0; };
  G.addRelic = function (run, id) {
    if (G.has(run, id)) return false;
    run.relics.push(id);
    if (id === 'plating') { run.maxHp += 20; run.hp += 20; }
    return true;
  };
  G.randomRelic = function (run) {
    var pool = IDM.RELIC_IDS.filter(function (id) { return !G.has(run, id); });
    return pool.length ? pick(pool) : null;
  };
  G.heal = function (run, n) { run.hp = Math.min(run.maxHp, run.hp + Math.round(n)); };

  // ---------- map ----------
  G.genMap = function (act) {
    var rows = [], R = G.MAP_ROWS, id = 0;
    for (var r = 0; r < R; r++) {
      var count = r === 0 ? 3 : 2 + ri(3), row = [];
      for (var i = 0; i < count; i++) {
        var x = (i + 1) / (count + 1) + (G.rand() - 0.5) * 0.08;
        row.push({ id: 'n' + (id++), row: r, x: x, type: nodeType(r, R), next: [] });
      }
      rows.push(row);
    }
    var boss = { id: 'boss', row: R, x: 0.5, type: 'boss', next: [] };
    // edges
    for (r = 0; r < R - 1; r++) {
      var cur = rows[r], nxt = rows[r + 1];
      cur.forEach(function (n) {
        var sorted = nxt.slice().sort(function (a, b) { return Math.abs(a.x - n.x) - Math.abs(b.x - n.x); });
        link(n, sorted[0]);
        if (sorted[1] && G.rand() < 0.45 && Math.abs(sorted[1].x - n.x) < 0.4) link(n, sorted[1]);
      });
      nxt.forEach(function (m) {
        var has = cur.some(function (n) { return n.next.indexOf(m.id) >= 0; });
        if (!has) {
          var near = cur.slice().sort(function (a, b) { return Math.abs(a.x - m.x) - Math.abs(b.x - m.x); })[0];
          link(near, m);
        }
      });
    }
    rows[R - 1].forEach(function (n) { link(n, boss); });
    // guarantee at least one shop and one elite
    var mids = [];
    for (r = 2; r < R - 1; r++) mids = mids.concat(rows[r]);
    ['shop', 'elite'].forEach(function (t) {
      if (!mids.some(function (n) { return n.type === t; })) {
        var cand = mids.filter(function (n) { return n.type === 'battle' || n.type === 'event'; });
        if (cand.length) pick(cand).type = t;
      }
    });
    var nodes = {};
    rows.forEach(function (row) { row.forEach(function (n) { nodes[n.id] = n; }); });
    nodes.boss = boss;
    return { act: act, rows: rows.map(function (row) { return row.map(function (n) { return n.id; }); }), nodes: nodes, visited: [] };

    function link(a, b) { if (a.next.indexOf(b.id) < 0) a.next.push(b.id); }
  };
  function nodeType(r, R) {
    if (r === 0) return 'battle';
    if (r === R - 1) return 'rest';
    var w = [['battle', 44], ['event', 22], ['shop', 11]];
    if (r >= 2) w.push(['elite', 14]);
    if (r >= 2 && r < R - 2) w.push(['rest', 9]);
    var total = w.reduce(function (s, x) { return s + x[1]; }, 0), roll = G.rand() * total;
    for (var i = 0; i < w.length; i++) { roll -= w[i][1]; if (roll < 0) return w[i][0]; }
    return 'battle';
  }
  G.availableNodes = function (run) {
    var m = run.map;
    if (!run.pos) return m.rows[0].slice();
    return m.nodes[run.pos].next.slice();
  };
  G.enterNode = function (run, nodeId) {
    if (G.availableNodes(run).indexOf(nodeId) < 0) return null;
    run.pos = nodeId;
    run.map.visited.push(nodeId);
    run.stats.floors++;
    return run.map.nodes[nodeId];
  };

  G.encounterFor = function (run, node) {
    if (node.type === 'boss') return IDM.ENCOUNTERS.filter(function (e) { return e.id === run.map.bossId; })[0];
    return G.pickEncounter(run, node.type);
  };
  G.pickEncounter = function (run, kind) {
    var pool = IDM.ENCOUNTERS.filter(function (e) { return e.act === run.act && e.kind === kind; });
    var fresh = pool.filter(function (e) { return run.seen.indexOf(e.id) < 0; });
    var e = pick(fresh.length ? fresh : pool);
    run.seen.push(e.id);
    return e;
  };

  // ---------- combat ----------
  var uid = 0;
  function makeEnemy(run, spec, kind) {
    var o = ORGS[spec.org], A = IDM.ACTS[run.act - 1];
    var atkKind = kind === 'boss' ? 1.1 : kind === 'elite' ? 1.1 : 1;
    var maxHp = Math.round(o.hp * A.hpMult * (spec.hpMult || 1));
    var e = {
      uid: 'e' + (uid++), org: spec.org, site: spec.site, maxHp: maxHp, hp: maxHp,
      atk: Math.max(1, Math.round(o.atk * A.atkMult * atkKind * G.ATK_SCALE)), toxin: !!spec.toxin, biofilm: !!spec.biofilm,
      identified: false, resist: {}, dead: false, intent: null,
    };
    if (G.has(run, 'sourcectl') && ['abdomen', 'skin', 'bone'].indexOf(spec.site) >= 0) e.hp = Math.round(maxHp * 0.75);
    return e;
  }
  function rollIntent(e) {
    if (e.hp < e.maxHp * 0.6 && G.rand() < 0.25) {
      e.intent = { type: 'replicate', value: Math.max(1, Math.round(e.maxHp * 0.1)) };
    } else {
      var v = Math.round(e.atk * (0.8 + G.rand() * 0.4));
      if (e.toxin) v = Math.round(v * 1.5);
      e.intent = { type: 'attack', value: v };
    }
  }
  G.alive = function (c) { return c.enemies.filter(function (e) { return !e.dead; }); };

  G.startCombat = function (run, enc) {
    var culture = G.has(run, 'pcr') ? 0 : G.has(run, 'idconsult') ? 1 : 2;
    var c = {
      enc: enc, kind: enc.kind, turn: 1, actions: G.ACTIONS + (G.has(run, 'thirdhand') ? 1 : 0),
      enemies: enc.enemies.map(function (s) { return makeEnemy(run, s, enc.kind); }),
      cooldowns: {}, firedThisTurn: {}, culture: culture, log: [], fired: {}, firstShot: true,
      evasive: false, hits: {}, over: null, flash: null, warned: {},
    };
    G.PART_IDS.forEach(function (p) { c.cooldowns[p] = 0; });
    c.target = c.enemies[0].uid;
    c.enemies.forEach(rollIntent);
    if (run.cdiff) addSecondaryCdiff(run, c);
    log(c, 'info', enc.name + ': ' + enc.vignette);
    if (culture === 0) identifyAll(c, true);
    else log(c, 'info', 'Gram stain only. Cultures pending (' + culture + ' turn' + (culture > 1 ? 's' : '') + '). Treat empirically!');
    return c;
  };
  function log(c, kind, text) { c.log.push({ k: kind, t: text }); }
  G.log = log;

  function identify(c, e, quiet) {
    if (e.identified) return;
    e.identified = true;
    var o = ORGS[e.org];
    if (!quiet) log(c, 'info', '🧫 Culture: ' + o.full + ' (' + IDM.SITES[e.site].name + ').');
    log(c, 'teach', '📘 ' + o.teach);
    codexUpdate(function (cx) { cx.orgs[e.org] = true; });
  }
  function identifyAll(c, quiet) { c.enemies.forEach(function (e) { identify(c, e, quiet); }); }

  G.canFire = function (run, c, pid) {
    return !c.over && c.actions > 0 && c.cooldowns[pid] === 0 && !c.firedThisTurn[pid];
  };

  // Damage preview without side effects (used by simulation and tests)
  G.calcDamage = function (run, c, pid, e) {
    var part = run.parts[pid], P = G.part(pid), drug = part.drug;
    var cov = e.resist[drug] ? 0 : G.coverage(drug, e.org);
    var site = G.siteMult(drug, e.site);
    var mult = P.mult * (1 + 0.2 * part.level) * G.COV_MULT[cov] * site;
    var tags = [];
    if (G.has(run, 'extinf') && G.isBetaLactam(drug)) mult *= 1.25;
    if (G.has(run, 'oncedaily') && DRUGS[drug].cls === 'aminoglycosides') mult *= 1.4;
    if (G.has(run, 'loading') && c.firstShot && cov > 0) { mult *= 2; tags.push('Loading dose x2'); }
    if (pid === 'head' && cov === 3 && site >= 1) { mult *= 1.5; tags.push('Precision lock x1.5'); }
    var hits = c.hits[e.uid] || [];
    var isAG = DRUGS[drug].cls === 'aminoglycosides';
    var isCW = G.isBetaLactam(drug) || DRUGS[drug].cls === 'glycopeptides';
    if (cov > 0 && ORGS[e.org].types.indexOf('gp') >= 0 &&
        ((isAG && hits.indexOf('cellwall') >= 0) || (isCW && hits.indexOf('ag') >= 0))) {
      mult *= 1.75; tags.push('Synergy x1.75');
    }
    if (e.biofilm) { mult *= 0.75; tags.push('Biofilm -25%'); }
    var dmg = Math.round(G.BASE_DMG * mult);
    if (mult > 0 && dmg < 1) dmg = 1;
    return { dmg: dmg, cov: cov, site: site, tags: tags };
  };

  G.fire = function (run, c, pid) {
    if (!G.canFire(run, c, pid)) return false;
    var e = c.enemies.filter(function (x) { return x.uid === c.target && !x.dead; })[0] || G.alive(c)[0];
    if (!e) return false;
    var part = run.parts[pid], P = G.part(pid), drug = part.drug, D = DRUGS[drug], o = ORGS[e.org];
    var r = G.calcDamage(run, c, pid, e);
    var name = e.identified ? o.name : 'Unknown ' + shortStain(o);

    e.hp = Math.max(0, e.hp - r.dmg);
    var label = G.COV_LABEL[r.cov];
    if (r.cov > 0 && r.site < 1) label = r.site === 0 ? "Can't reach site" : 'Poor penetration';
    log(c, r.dmg === 0 ? 'bad' : r.cov >= 2 && r.site >= 1 ? 'good' : 'warn',
      P.name + ' fires ' + D.name + ' → ' + name + ': ' + r.dmg + ' dmg. ' + label + (r.tags.length ? ' [' + r.tags.join(', ') + ']' : ''));
    c.flash = { uid: e.uid, dmg: r.dmg, label: label, n: (c.flash ? c.flash.n + 1 : 1) };

    // teaching feedback
    if (r.site < 1) {
      var sn = G.siteNote(drug, e.site);
      if (sn) log(c, 'teach', '📍 ' + sn);
    }
    if (r.cov === 0) {
      run.stats.noEffect++;
      if (e.identified) log(c, 'teach', '📘 ' + (G.note(drug, e.org) || o.failNote));
      else log(c, 'teach', '📘 No activity. Think about what this Gram stain could be: ' + o.stain + '.');
    } else if (r.cov === 1) {
      var wn = G.note(drug, e.org);
      if (wn && e.identified) log(c, 'teach', '📘 ' + wn);
      if (!G.has(run, 'antibiogram') && G.rand() < 0.25) {
        e.resist[drug] = true;
        log(c, 'bad', '⚠ Resistance selected! ' + name + ' is now resistant to ' + D.name + '. Suboptimal therapy enriches resistant subpopulations.');
      }
    }
    if (D.antitoxin && e.toxin && r.cov > 0) {
      e.toxin = false;
      if (e.intent && e.intent.type === 'attack') e.intent.value = Math.round(e.intent.value / 1.5);
      log(c, 'good', '🧪 Toxin production suppressed! ' + D.name + ' inhibits ribosomal toxin synthesis.');
    }
    codexUpdate(function (cx) {
      cx.pairs[drug + '|' + e.org] = r.cov;
      if (r.site < 1) cx.sites[drug + '|' + e.site] = r.site;
    });

    // synergy bookkeeping
    var h = c.hits[e.uid] = c.hits[e.uid] || [];
    if (D.cls === 'aminoglycosides') h.push('ag');
    if ((G.isBetaLactam(drug) || D.cls === 'glycopeptides') && r.cov >= 2) h.push('cellwall');

    applyTox(run, c, drug);

    c.cooldowns[pid] = P.cd > 0 ? P.cd + 1 : 0;
    c.firedThisTurn[pid] = true;
    c.fired[drug] = true;
    c.actions--;
    c.firstShot = false;
    if (pid === 'legs') { c.evasive = true; log(c, 'info', '🦿 Legs engage evasive maneuvers.'); }

    if (e.hp <= 0) {
      e.dead = true;
      run.stats.kills++;
      if (!e.identified) identify(c, e);
      log(c, 'good', '✔ ' + o.name + ' eradicated!');
      var next = G.alive(c)[0];
      if (next) c.target = next.uid;
    }
    if (run.hp <= 0) { c.over = 'lose'; return true; }
    checkWin(run, c);
    return true;
  };

  function shortStain(o) {
    var s = o.stain;
    return s.length > 34 ? s.slice(0, 32) + '…' : s;
  }

  function applyTox(run, c, drug) {
    var t = DRUGS[drug].tox;
    var renal = t.renal * (G.has(run, 'tdm') ? 0.6 : 1);
    var gut = t.gut * (G.has(run, 'probiotic') ? 0.6 : 1);
    if ((drug === 'vancIV' && c.fired.piptazo) || (drug === 'piptazo' && c.fired.vancIV)) {
      renal += 6;
      if (!c.warned.vp) { c.warned.vp = true; log(c, 'teach', '⚠ Vancomycin plus piperacillin-tazobactam is associated with higher rates of AKI than vancomycin with cefepime or meropenem.'); }
    }
    run.tox.renal += renal;
    run.tox.gut += gut;
    if (run.tox.renal >= 100) {
      run.tox.renal = 30;
      run.hp = Math.max(0, run.hp - 15);
      log(c, 'bad', '🫘 ACUTE KIDNEY INJURY! Nephrotoxic load overwhelmed the mech: -15 integrity. (Monitor levels, avoid nephrotoxin stacking.)');
    }
    if (run.tox.gut >= 100) {
      run.tox.gut = 0;
      if (!c.enemies.some(function (e) { return e.org === 'cdiff' && !e.dead; })) {
        addSecondaryCdiff(run, c);
        log(c, 'bad', '☣ C. DIFFICILE SUPERINFECTION! Broad-spectrum pressure wiped out the protective gut flora. Treat it (oral vancomycin or fidaxomicin) or it will linger.');
      }
    }
  }

  // Abandon the fight: costs integrity, grants nothing, but shows what would have worked.
  G.retreat = function (run, c) {
    if (c.over || c.kind === 'boss') return false;
    run.hp = Math.max(0, run.hp - G.RETREAT_COST);
    log(c, 'bad', '🚑 You call for an ID consult and transfer the patient (-' + G.RETREAT_COST + ' integrity).');
    var seen = {};
    G.alive(c).forEach(function (e) {
      if (seen[e.org + e.site]) return;
      seen[e.org + e.site] = true;
      identify(c, e);
      log(c, 'teach', '💡 For ' + ORGS[e.org].full + ' (' + IDM.SITES[e.site].name + '), good options were: ' + G.goodDrugs(e.org, e.site).map(function (d) { return DRUGS[d].name; }).join(', ') + '.');
    });
    c.over = run.hp <= 0 ? 'lose' : 'retreat';
    return true;
  };
  G.goodDrugs = function (orgId, site) {
    return Object.keys(DRUGS).filter(function (d) { return G.coverage(d, orgId) >= 2 && G.siteMult(d, site) >= 0.75; })
      .sort(function (a, b) { return G.coverage(b, orgId) - G.coverage(a, orgId); });
  };

  function addSecondaryCdiff(run, c) {
    var cd = makeEnemy(run, { org: 'cdiff', site: 'gut', hpMult: 0.7 }, 'battle');
    cd.secondary = true;
    rollIntent(cd);
    c.enemies.push(cd);
    identify(c, cd, true);
  }
  // Victory needs only the primary infection cleared; a surviving superinfection follows you.
  function checkWin(run, c) {
    var primary = c.enemies.filter(function (e) { return !e.secondary && !e.dead; });
    if (primary.length) return;
    var cd = c.enemies.filter(function (e) { return e.secondary && !e.dead; });
    run.cdiff = cd.length > 0;
    c.over = 'win';
    log(c, 'good', 'Infection cleared!');
    if (run.cdiff) log(c, 'bad', '☣ C. difficile persists. It will rejoin your next battle until you treat it or detox at a Clinic.');
  }

  G.setTarget = function (c, uidv) {
    var e = c.enemies.filter(function (x) { return x.uid === uidv && !x.dead; })[0];
    if (e) c.target = uidv;
  };

  G.endTurn = function (run, c) {
    if (c.over) return;
    if (G.has(run, 'vaccine')) G.heal(run, 3);
    G.alive(c).forEach(function (e) {
      var o = ORGS[e.org], name = e.identified ? o.name : 'Unknown pathogen';
      if (e.intent.type === 'attack') {
        if (c.evasive && G.rand() < 0.5) { log(c, 'info', '💨 Dodged ' + name + "'s attack!"); return; }
        run.hp = Math.max(0, run.hp - e.intent.value);
        log(c, 'enemy', name + (e.toxin ? ' releases toxin' : ' attacks') + ': -' + e.intent.value + ' integrity.');
      } else {
        var before = e.hp;
        e.hp = Math.min(e.maxHp, e.hp + e.intent.value);
        log(c, 'enemy', name + ' replicates: +' + (e.hp - before) + ' HP.');
      }
    });
    if (run.hp <= 0) { c.over = 'lose'; log(c, 'bad', 'Mech integrity lost…'); return; }
    c.turn++;
    c.actions = G.ACTIONS;
    c.firedThisTurn = {};
    c.hits = {};
    c.evasive = false;
    G.PART_IDS.forEach(function (p) { if (c.cooldowns[p] > 0) c.cooldowns[p]--; });
    if (c.culture > 0) {
      c.culture--;
      if (c.culture === 0) identifyAll(c);
    }
    G.alive(c).forEach(rollIntent);
  };

  // ---------- after combat ----------
  G.finishCombat = function (run, c) {
    var kind = c.kind, credits = kind === 'boss' ? 60 : kind === 'elite' ? 28 + ri(10) : 12 + ri(8);
    if (G.has(run, 'procalc')) credits += 10;
    run.credits += credits;
    run.tox.renal = Math.max(0, run.tox.renal - 20);
    run.tox.gut = Math.max(0, run.tox.gut - 10);
    if (kind === 'battle') run.stats.battles++;
    if (kind === 'elite') run.stats.elites++;
    if (kind === 'boss') run.stats.bosses++;
    var reward = { credits: credits, relic: null, choices: G.rewardChoices(run, kind) };
    if (kind !== 'battle') {
      var rel = G.randomRelic(run);
      if (rel) { G.addRelic(run, rel); reward.relic = rel; }
    }
    return reward;
  };

  G.rewardChoices = function (run, kind) {
    var out = [];
    var parts = shuffle(G.PART_IDS);
    out.push({ type: 'upgrade', part: parts[0] });
    if (G.rand() < 0.5) out.push({ type: 'upgrade', part: parts[1] });
    out.push({ type: 'repair', amount: kind === 'battle' ? 20 : 30 });
    if (out.length < 3) {
      var rel = G.rand() < (kind === 'battle' ? 0.35 : 0.6) ? G.randomRelic(run) : null;
      out.push(rel ? { type: 'relic', id: rel } : { type: 'credits', amount: 20 });
    }
    return out;
  };

  G.applyChoice = function (run, ch) {
    if (ch.type === 'upgrade') run.parts[ch.part].level++;
    else if (ch.type === 'repair') G.heal(run, ch.amount);
    else if (ch.type === 'relic') G.addRelic(run, ch.id);
    else if (ch.type === 'credits') run.credits += ch.amount;
  };

  G.advanceAct = function (run) {
    if (run.act >= IDM.ACTS.length) return false;
    run.act++;
    run.map = G.genMap(run.act);
    run.map.bossId = G.pickEncounter(run, 'boss').id;
    run.pos = null;
    G.heal(run, (run.maxHp - run.hp) * 0.6);
    run.tox.renal = 0; run.tox.gut = Math.max(0, run.tox.gut - 30);
    return true;
  };

  G.score = function (run, won) {
    var s = run.stats;
    return s.battles * 10 + s.elites * 30 + s.bosses * 100 + s.quizRight * 15 + (won ? 250 + run.hp : 0) - s.noEffect * 2;
  };
  G.recordEnd = function (run, won) {
    var sc = G.score(run, won);
    codexUpdate(function (c) { if (won) c.wins++; c.best = Math.max(c.best || 0, sc); });
    return sc;
  };

  // ---------- shop / rest ----------
  G.restRepair = function (run) { G.heal(run, run.maxHp * 0.35); };
  G.restDetox = function (run) {
    run.tox.renal = 0;
    run.tox.gut = Math.max(0, run.tox.gut - 60);
    run.cdiff = false;
  };
  G.buy = function (run, what, shop, arg) {
    var price = what === 'relic' ? arg.price : G.PRICES[what];
    if (run.credits < price) return false;
    if (what === 'relic') { if (arg.sold) return false; arg.sold = true; G.addRelic(run, arg.id); }
    else if (what === 'repair') { if (run.hp >= run.maxHp) return false; G.heal(run, 25); }
    else if (what === 'detox') G.restDetox(run);
    else if (what === 'upgrade') run.parts[arg].level++;
    else return false;
    run.credits -= price;
    return true;
  };
  G.PRICES = { refit: 35, repair: 25, detox: 30, upgrade: 50 };
  G.genShop = function (run) {
    var relics = shuffle(IDM.RELIC_IDS.filter(function (id) { return !G.has(run, id); })).slice(0, 2);
    return { relics: relics.map(function (id) { return { id: id, price: 70 + ri(25), sold: false }; }), used: {} };
  };
  G.refit = function (run, pid, cls, drug) {
    var lo = {};
    G.PART_IDS.forEach(function (p) { lo[p] = { cls: run.parts[p].cls, drug: run.parts[p].drug }; });
    lo[pid] = { cls: cls, drug: drug };
    var errs = G.loadoutErrors(lo);
    if (errs.length) return errs;
    var keepLevel = run.parts[pid].cls === cls;
    run.parts[pid] = { cls: cls, drug: drug, level: keepLevel ? run.parts[pid].level : Math.max(0, run.parts[pid].level - 1) };
    return [];
  };

  // ---------- Grand Rounds (quiz) ----------
  var QUIZ_EXCLUDE = ['vancPO', 'fidaxomicin', 'nitrofurantoin'];
  G.HAND_QUIZ = [
    { q: 'Which MRSA-active drug must NOT be used for pneumonia?', options: ['Daptomycin', 'Vancomycin', 'Linezolid', 'Ceftaroline'], answer: 0,
      explain: 'Pulmonary surfactant inactivates daptomycin.' },
    { q: 'Which drug is appropriate ONLY for lower UTI (cystitis)?', options: ['Nitrofurantoin', 'Ciprofloxacin', 'Ceftriaxone', 'TMP-SMX'], answer: 0,
      explain: 'Nitrofurantoin concentrates in the bladder and gives no tissue or serum levels, so it is not used for pyelonephritis or bacteremia.' },
    { q: 'Which cephalosporin does NOT adequately penetrate the CSF?', options: ['Cefazolin', 'Ceftriaxone', 'Cefepime', 'Ceftazidime'], answer: 0,
      explain: 'Cefazolin does not cross the blood-brain barrier. It is great for MSSA but not for meningitis.' },
    { q: 'Which fluoroquinolone is a poor choice for UTI?', options: ['Moxifloxacin', 'Ciprofloxacin', 'Levofloxacin'], answer: 0,
      explain: 'Moxifloxacin is mostly hepatically cleared, so urine concentrations are low.' },
    { q: 'Which agent should be avoided in bacteremia because serum levels are low?', options: ['Tigecycline', 'Daptomycin', 'Cefazolin', 'Vancomycin'], answer: 0,
      explain: 'Tigecycline has a huge volume of distribution and low serum concentrations.' },
    { q: 'Which is first-line for C. difficile infection?', options: ['Oral vancomycin', 'IV vancomycin', 'Clindamycin', 'IV ceftriaxone'], answer: 0,
      explain: 'IV vancomycin does not reach the colon lumen. Oral vancomycin or fidaxomicin is first-line.' },
    { q: 'Adding ampicillin to empiric meningitis therapy (age >50) covers which organism?', options: ['Listeria monocytogenes', 'N. meningitidis', 'S. pneumoniae', 'H. influenzae'], answer: 0,
      explain: 'Listeria is intrinsically resistant to cephalosporins.' },
    { q: 'Which carbapenem lacks activity against Pseudomonas?', options: ['Ertapenem', 'Meropenem', 'Imipenem', 'Doripenem'], answer: 0,
      explain: 'Ertapenem has no activity against Pseudomonas, Acinetobacter, or enterococci.' },
    { q: 'Which combination is associated with the highest rates of AKI?', options: ['Vancomycin + piperacillin-tazobactam', 'Vancomycin + cefepime', 'Linezolid + meropenem', 'Daptomycin + ceftriaxone'], answer: 0,
      explain: 'Several observational studies link vancomycin plus pip-tazo to more AKI. Whether the effect is real or partly a creatinine-secretion artifact is debated.' },
    { q: 'Which antibiotic carries a risk of serotonin syndrome with SSRIs?', options: ['Linezolid', 'Daptomycin', 'Vancomycin', 'Cefazolin'], answer: 0,
      explain: 'Linezolid is a weak, reversible MAO inhibitor.' },
    { q: 'Drug of choice for Stenotrophomonas maltophilia?', options: ['TMP-SMX', 'Meropenem', 'Cefepime', 'Ertapenem'], answer: 0,
      explain: 'Stenotrophomonas carries an intrinsic L1 metallo-beta-lactamase that inactivates carbapenems.' },
    { q: 'Which beta-lactam has activity against MRSA?', options: ['Ceftaroline', 'Cefepime', 'Piperacillin-tazobactam', 'Meropenem'], answer: 0,
      explain: 'Ceftaroline binds PBP2a.' },
    { q: 'Which polymyxin is preferred for a CRE urinary tract infection?', options: ['Colistin (CMS)', 'Polymyxin B'], answer: 0,
      explain: 'Colistin is given as the prodrug CMS, which is renally cleared and converted in the urine. Polymyxin B is not renally excreted.' },
    { q: 'Why don\'t beta-lactams treat Mycoplasma pneumoniae?', options: ['It lacks a cell wall', 'It is strictly intracellular', 'It produces beta-lactamase', 'It has efflux pumps'], answer: 0,
      explain: 'Mycoplasma has no peptidoglycan, so beta-lactams have no target.' },
    { q: 'Which antibiotic class is most strongly associated with C. difficile?', options: ['Clindamycin', 'Doxycycline', 'Nitrofurantoin', 'Aminoglycosides'], answer: 0,
      explain: 'Clindamycin, fluoroquinolones, cephalosporins, and carbapenems carry the highest risk. Doxycycline carries the lowest.' },
    { q: 'For ESBL E. coli bacteremia, which is the preferred definitive therapy?', options: ['Meropenem', 'Piperacillin-tazobactam', 'Ceftriaxone', 'Cefepime'], answer: 0,
      explain: 'The MERINO trial found higher 30-day mortality with pip-tazo than with meropenem.' },
    { q: 'Gentamicin is added to ampicillin for enterococcal endocarditis because of…', options: ['Synergy: the cell-wall agent lets the aminoglycoside enter', 'Anaerobic coverage', 'Biofilm penetration', 'Lower nephrotoxicity'], answer: 0,
      explain: 'Aminoglycosides alone barely penetrate gram-positive cells. Pairing them with a cell-wall agent makes the combination bactericidal. (Ampicillin plus ceftriaxone is now often preferred because it avoids nephrotoxicity.)' },
    { q: 'Which pathogen is NOT covered by ceftriaxone?', options: ['Enterococcus faecalis', 'Streptococcus pneumoniae', 'Neisseria meningitidis', 'Haemophilus influenzae'], answer: 0,
      explain: 'Enterococci are intrinsically resistant to cephalosporins.' },
  ];

  G.genQuiz = function () {
    if (G.rand() < 0.45) {
      var hq = pick(G.HAND_QUIZ), order = shuffle(hq.options.map(function (_, i) { return i; }));
      return { q: hq.q, options: order.map(function (i) { return hq.options[i]; }), answer: order.indexOf(hq.answer), explain: hq.explain };
    }
    for (var tries = 0; tries < 40; tries++) {
      var orgId = pick(Object.keys(ORGS)), o = ORGS[orgId];
      var pool = Object.keys(DRUGS).filter(function (d) { return QUIZ_EXCLUDE.indexOf(d) < 0 || orgId === 'cdiff'; });
      var good = pool.filter(function (d) { return G.coverage(d, orgId) >= 2; });
      var bad = pool.filter(function (d) { return G.coverage(d, orgId) === 0; });
      var mode = G.rand() < 0.65 ? 'covers' : 'not';
      var ans, wrong;
      if (mode === 'covers' && good.length >= 1 && bad.length >= 3) { ans = pick(good); wrong = shuffle(bad).slice(0, 3); }
      else if (mode === 'not' && good.length >= 3 && bad.length >= 1) { ans = pick(bad); wrong = shuffle(good).slice(0, 3); }
      else continue;
      var opts = shuffle([ans].concat(wrong));
      var q = mode === 'covers'
        ? 'Which antibiotic reliably covers ' + o.full + '?'
        : 'Which antibiotic does NOT reliably cover ' + o.full + '?';
      var why = mode === 'covers' ? DRUGS[ans].spectrum : (G.note(ans, orgId) || o.failNote);
      return { q: q, options: opts.map(function (d) { return DRUGS[d].name; }), answer: opts.indexOf(ans),
        explain: DRUGS[ans].name + ': ' + why + ' | ' + o.teach };
    }
    return G.genQuiz();
  };

  G.applyEventEffect = function (run, effect) {
    switch (effect) {
      case 'upgradeRandom': run.parts[pick(G.PART_IDS)].level++; return 'A part gained +1 level.';
      case 'renalHit': run.tox.renal = Math.min(95, run.tox.renal + 25); return '+25 nephrotoxicity.';
      case 'repDeal': run.credits += 40; run.tox.gut = Math.min(95, run.tox.gut + 30); return '+40 credits, +30 C. diff risk.';
      case 'credits15': run.credits += 15; return '+15 credits.';
      case 'detox': run.tox.renal = Math.max(0, run.tox.renal - 40); run.tox.gut = Math.max(0, run.tox.gut - 40); return 'Toxicity reduced.';
      case 'tox20': run.tox.renal = Math.min(95, run.tox.renal + 20); run.tox.gut = Math.min(95, run.tox.gut + 20); return '+20 to both toxicity meters.';
      case 'heal25': G.heal(run, 25); return 'Repaired 25.';
      case 'relic': var r = G.randomRelic(run); if (r) { G.addRelic(run, r); return 'Gained ' + IDM.RELICS[r].name + '!'; } run.credits += 30; return '+30 credits.';
      case 'gutHit': run.tox.gut = Math.min(95, run.tox.gut + 25); return '+25 C. diff risk.';
      default: return 'Nothing happens.';
    }
  };
})();
