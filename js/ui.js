// Rendering and input. All game rules live in game.js; this file only draws state and dispatches actions.
(function () {
  var G = IDM.Game, DRUGS = IDM.DRUGS, ORGS = IDM.ORGANISMS;
  var app = document.getElementById('app');

  var S = {
    screen: 'title',
    loadout: G.storage.get('idm_loadout', null) || {},
    difficulty: G.storage.get('idm_difficulty', 'resident'),
    selPart: 'head', selClass: null, selDrug: null,
    run: null, combat: null, reward: null, shop: null, event: null, modal: null,
    codexTab: 'organisms', codexSel: null, score: 0, lastFlash: 0, from: 'title',
  };
  if (G.loadoutErrors(S.loadout).length) S.loadout = sanitizeLoadout(S.loadout);

  function sanitizeLoadout(lo) {
    var out = {};
    G.PART_IDS.forEach(function (p) {
      var x = lo && lo[p];
      if (x && DRUGS[x.drug] && DRUGS[x.drug].cls === x.cls) out[p] = { cls: x.cls, drug: x.drug };
    });
    return out;
  }

  // ---------- save / load ----------
  var SAVE_KEYS = ['screen', 'run', 'combat', 'reward', 'shop', 'event'];
  function save() {
    if (!S.run) return; // the save is cleared explicitly when a run ends or a new one starts
    var o = {};
    SAVE_KEYS.forEach(function (k) { o[k] = S[k]; });
    G.storage.set('idm_save', o);
  }
  function load() {
    var o = G.storage.get('idm_save', null);
    if (!o || !o.run) return false;
    SAVE_KEYS.forEach(function (k) { S[k] = o[k]; });
    if (['codex', 'title', 'help'].indexOf(S.screen) >= 0) S.screen = 'map';
    return true;
  }

  // ---------- helpers ----------
  function h(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cls(id) { return IDM.classById(id); }
  function bar(v, max, kind) {
    var pct = Math.max(0, Math.min(100, 100 * v / max));
    return '<div class="bar ' + (kind || '') + '"><div class="fill" style="width:' + pct + '%"></div><span>' + Math.round(v) + ' / ' + max + '</span></div>';
  }
  function btn(act, label, extra, data) {
    var d = '';
    if (data) Object.keys(data).forEach(function (k) { d += ' data-' + k + '="' + h(data[k]) + '"'; });
    return '<button class="btn ' + (extra || '') + '" data-act="' + act + '"' + d + '>' + label + '</button>';
  }
  function relicChip(id) {
    var r = IDM.RELICS[id];
    return '<span class="relic" title="' + h(r.name + ': ' + r.desc) + '">' + r.icon + '</span>';
  }

  // ---------- mech SVG ----------
  function mechSVG(parts, opts) {
    opts = opts || {};
    function fill(pid) { var p = parts[pid]; return p && p.cls ? cls(p.cls).color : '#2a3350'; }
    function label(pid) { var p = parts[pid]; return p && p.drug ? DRUGS[p.drug].abbr : '+'; }
    function lvl(pid) { var p = parts[pid]; return p && p.level ? ' +' + p.level : ''; }
    function g(pid, inner, tx, ty) {
      var sel = opts.sel === pid ? ' sel' : '';
      var dim = opts.dim && opts.dim[pid] ? ' dim' : '';
      return '<g class="mpart' + sel + dim + '" data-act="' + (opts.act || 'selPart') + '" data-part="' + pid + '" style="--pc:' + fill(pid) + '">' +
        '<title>' + G.part(pid).name + '</title>' + inner +
        '<text x="' + tx + '" y="' + ty + '" class="mlabel">' + label(pid) + lvl(pid) + '</text></g>';
    }
    return '<svg class="mech" viewBox="0 0 240 280" role="img" aria-label="Mech loadout">' +
      g('legs', '<rect x="84" y="150" width="72" height="16" rx="5"/><rect x="86" y="168" width="28" height="78" rx="7"/><rect x="126" y="168" width="28" height="78" rx="7"/><rect x="78" y="246" width="40" height="14" rx="4"/><rect x="122" y="246" width="40" height="14" rx="4"/>', 120, 212) +
      g('torso', '<path d="M68 56 H172 L162 148 H78 Z"/><circle cx="120" cy="96" r="15" class="core"/>', 120, 134) +
      g('rarm', '<rect x="26" y="58" width="40" height="30" rx="7"/><rect x="28" y="90" width="32" height="60" rx="7"/><rect x="31" y="150" width="26" height="28" rx="4"/>', 44, 124) +
      g('larm', '<rect x="174" y="58" width="40" height="30" rx="7"/><rect x="180" y="90" width="32" height="60" rx="7"/><rect x="183" y="150" width="26" height="28" rx="4"/>', 196, 124) +
      g('head', '<rect x="94" y="8" width="52" height="42" rx="10"/><rect x="102" y="22" width="36" height="10" rx="4" class="visor"/>', 120, 46) +
      '</svg>';
  }

  // ---------- top bar ----------
  function topbar() {
    var r = S.run;
    if (!r) return '';
    var A = IDM.ACTS[r.act - 1];
    return '<header class="topbar">' +
      '<div class="tb-act"><b>ACT ' + r.act + '</b> · ' + A.name + '</div>' +
      '<div class="tb-hp"><label>Integrity</label>' + bar(r.hp, r.maxHp, 'hp') + '</div>' +
      '<div class="tb-tox"><label title="Nephrotoxicity. At 100: acute kidney injury (-15 integrity).">🫘 Renal</label>' + bar(r.tox.renal, 100, 'renal') + '</div>' +
      '<div class="tb-tox"><label title="C. difficile risk. At 100: C. diff superinfection.">☣ C. diff</label>' + bar(r.tox.gut, 100, 'gut') + '</div>' +
      '<div class="tb-cred">💰 ' + r.credits + '</div>' +
      '<div class="tb-relics">' + r.relics.map(relicChip).join('') + (r.cdiff ? '<span class="relic bad" title="C. difficile colonization: joins your next battle">☣</span>' : '') + '</div>' +
      '<div class="tb-btns">' + btn('codex', '📖 Codex', 'small') + '</div>' +
      '</header>';
  }

  // ---------- screens ----------
  var screens = {};

  screens.title = function () {
    var cx = G.codex(), hasSave = !!G.storage.get('idm_save', null);
    return '<div class="title-screen">' +
      '<div class="title-mech">' + mechSVG(S.loadout, { act: 'noop' }) + '</div>' +
      '<h1>SPECTRUM<span>MECH</span></h1>' +
      '<p class="tagline">Build an antibiotic war-machine. Cover the pathogen. Don\'t breed resistance.</p>' +
      '<div class="title-btns">' +
      (hasSave ? btn('continue', '▶ Continue Run', 'primary') : '') +
      btn('hangar', hasSave ? 'New Run' : '▶ New Run', hasSave ? '' : 'primary') +
      btn('help', 'How to Play') + btn('codex', 'Codex') +
      '</div>' +
      '<p class="muted small">Runs: ' + cx.runs + ' · Victories: ' + cx.wins + ' · Best score: ' + (cx.best || 0) +
      ' · Organisms catalogued: ' + Object.keys(cx.orgs).length + '/' + Object.keys(ORGS).length + '</p>' +
      '<p class="disclaimer">Educational game. Coverage is simplified from typical US susceptibility patterns. Always follow local antibiograms and current guidelines for patient care.</p>' +
      '</div>';
  };

  screens.help = function () {
    return '<div class="panel help">' +
      '<h2>How to Play</h2>' +
      '<ol>' +
      '<li><b>Build your mech.</b> Each of the 5 parts (Head, Torso, Right Arm, Left Arm, Legs) gets an <b>antibiotic class</b>, and each part has a <b>sub-part</b>: a specific drug in that class. Every part must use a different class, so plan your spectrum.</li>' +
      '<li><b>Choose your path.</b> The map branches. ⚔ Infections, 💀 Elite infections, ❓ Grand Rounds (quiz and events), 💊 Pharmacy (shop and refits), ⛑ Clinic (rest). The <b>boss is previewed</b> on the map so you can prepare.</li>' +
      '<li><b>Treat empirically.</b> At the start of a battle you see only the clinical vignette, the Gram stain, and the infection site. Cultures return after 2 turns, and then the organism is named.</li>' +
      '<li><b>Fire drugs.</b> You get ' + G.ACTIONS + ' actions per turn, and each part fires at most once. Damage depends on <b>coverage</b> (none / weak / effective / drug of choice) × <b>site penetration</b> (for example, daptomycin does nothing in the lung, and nitrofurantoin works only in the bladder).</li>' +
      '<li><b>Stewardship matters.</b> Weak hits can <b>select for resistance</b>. Every shot adds <b>nephrotoxicity</b> and <b>C. diff risk</b>. Overflow means acute kidney injury or a C. diff superinfection.</li>' +
      '<li><b>Mechanics from real pharmacology:</b> beta-lactam (or vancomycin) plus aminoglycoside <b>synergy</b> against gram-positives, <b>toxin suppression</b> by clindamycin and linezolid in necrotizing fasciitis, <b>biofilm</b> in endocarditis, vancomycin plus pip-tazo AKI.</li>' +
      '<li><b>Stuck?</b> "Retreat & Consult" (not in boss fights) costs integrity but shows which drugs would have worked.</li>' +
      '</ol>' +
      '<h3>Parts</h3><ul>' + IDM.PARTS.map(function (p) { return '<li><b>' + p.name + ' (' + p.role + '):</b> ' + p.desc + '</li>'; }).join('') + '</ul>' +
      btn('back', '← Back', 'primary') + '</div>';
  };

  // ----- Hangar / loadout picker -----
  function pickerHTML(parts, selPart, opts) {
    opts = opts || {};
    var cur = parts[selPart] || {};
    var selClass = S.selClass || cur.cls || null;
    var usedBy = {};
    G.PART_IDS.forEach(function (p) { if (p !== selPart && parts[p] && parts[p].cls) usedBy[parts[p].cls] = G.part(p).name; });
    var classes = IDM.CLASSES.map(function (c) {
      var used = G.UNIQUE_CLASSES && usedBy[c.id];
      return '<button class="cls-chip' + (selClass === c.id ? ' on' : '') + (used ? ' used' : '') + '" style="--cc:' + c.color + '" data-act="selClass" data-cls="' + c.id + '"' +
        (used ? ' disabled title="Used by ' + used + '"' : '') + '>' + c.name + (used ? '<small>' + used + '</small>' : '') + '</button>';
    }).join('');
    var drugs = '', detail = '';
    if (selClass) {
      var C = cls(selClass);
      drugs = '<p class="moa">' + C.moa + '</p><div class="drug-list">' + C.drugs.map(function (d) {
        var D = DRUGS[d], on = cur.drug === d;
        return '<button class="drug-chip' + (on ? ' on' : '') + (S.selDrug === d ? ' focus' : '') + '" style="--cc:' + C.color + '" data-act="selDrug" data-drug="' + d + '"><b>' + D.abbr + '</b> ' + D.name + '</button>';
      }).join('') + '</div>';
      var show = S.selDrug && DRUGS[S.selDrug] && DRUGS[S.selDrug].cls === selClass ? S.selDrug : (cur.cls === selClass ? cur.drug : null);
      if (show) detail = drugDetail(show, opts);
    }
    return '<div class="picker"><h3>' + G.part(selPart).name + ' <small>' + G.part(selPart).role + ': ' + G.part(selPart).desc + '</small></h3>' +
      '<div class="cls-grid">' + classes + '</div>' + drugs + detail + '</div>';
  }

  function drugDetail(d, opts) {
    var D = DRUGS[d];
    var pen = Object.keys(D.site).filter(function (s) { return D.site[s] < 1; });
    var poor = pen.length ? '<p><b>Penetration:</b> ' + pen.map(function (s) {
      return '<span class="tag ' + (D.site[s] === 0 ? 'bad' : 'warn') + '">' + IDM.SITES[s].name + (D.site[s] === 0 ? ' ✕' : ' ↓') + '</span>';
    }).join(' ') + '</p>' : '';
    var tox = '<span class="tag renal">🫘 ' + D.tox.renal + '</span> <span class="tag gut">☣ ' + D.tox.gut + '</span>' + (D.antitoxin ? ' <span class="tag good">🧪 toxin suppression</span>' : '');
    return '<div class="drug-detail"><h4>' + D.name + '</h4>' +
      '<p><b>Spectrum:</b> ' + D.spectrum + '</p>' +
      '<p><b>Adverse effects:</b> ' + D.ae + '</p>' + poor +
      '<p><b>Toxicity per shot:</b> ' + tox + '</p>' +
      (opts.equipLabel ? btn(opts.equipAct || 'equip', opts.equipLabel, 'primary', { drug: d }) : '') + '</div>';
  }

  screens.hangar = function () {
    var errs = G.loadoutErrors(S.loadout);
    var diffs = Object.keys(G.DIFFICULTY).map(function (k) {
      var D = G.DIFFICULTY[k];
      return '<button class="diff' + (S.difficulty === k ? ' on' : '') + '" data-act="difficulty" data-d="' + k + '" title="' + h(D.desc) + '">' + D.name + '</button>';
    }).join('');
    return '<div class="hangar">' +
      '<div class="hangar-left panel"><h2>Hangar</h2><p class="muted small">Select a part, then a class, then a drug.</p>' +
      mechSVG(S.loadout, { sel: S.selPart }) +
      '<div class="part-tabs">' + G.PART_IDS.map(function (p) {
        var x = S.loadout[p];
        return '<button class="part-tab' + (S.selPart === p ? ' on' : '') + '" data-act="selPart" data-part="' + p + '" style="--cc:' + (x ? cls(x.cls).color : '#3a4466') + '">' +
          '<b>' + G.part(p).name + '</b><span>' + (x ? DRUGS[x.drug].name : '<i>empty</i>') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="diff-row"><label>Difficulty</label>' + diffs + '</div><p class="muted small">' + G.DIFFICULTY[S.difficulty].desc + '</p>' +
      (errs.length ? '<p class="err">' + errs[0] + '</p>' : '<p class="ok">Loadout ready.</p>') +
      '<div class="row">' + btn('randomize', '🎲 Randomize') + btn('clearLoadout', 'Clear') + btn('back', '← Title') + '</div>' +
      btn('launch', '🚀 Launch Run', 'primary big' + (errs.length ? ' disabled' : '')) +
      '</div>' +
      '<div class="hangar-right panel">' + pickerHTML(S.loadout, S.selPart, {}) + '</div>' +
      '</div>';
  };

  // ----- Map -----
  var NODE_ICON = { battle: '⚔', elite: '💀', event: '❓', shop: '💊', rest: '⛑', boss: '👑' };
  var NODE_NAME = { battle: 'Infection', elite: 'Elite Infection', event: 'Grand Rounds', shop: 'Pharmacy', rest: 'Clinic', boss: 'Boss' };
  screens.map = function () {
    var r = S.run, m = r.map, avail = G.availableNodes(r);
    var R = m.rows.length, W = 600, rowH = 74, H = (R + 1) * rowH + 40;
    function pos(n) { return { x: 40 + n.x * (W - 80), y: H - 40 - n.row * rowH }; }
    var lines = '', nodes = '';
    Object.keys(m.nodes).forEach(function (id) {
      var n = m.nodes[id], p = pos(n);
      n.next.forEach(function (nid) {
        var q = pos(m.nodes[nid]);
        var on = m.visited.indexOf(id) >= 0 && (m.visited.indexOf(nid) >= 0 || avail.indexOf(nid) >= 0);
        lines += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" class="edge' + (on ? ' on' : '') + '"/>';
      });
    });
    Object.keys(m.nodes).forEach(function (id) {
      var n = m.nodes[id], p = pos(n), a = avail.indexOf(id) >= 0, v = m.visited.indexOf(id) >= 0, here = r.pos === id;
      var rad = n.type === 'boss' ? 26 : 19;
      nodes += '<g class="node ' + n.type + (a ? ' avail' : '') + (v ? ' visited' : '') + (here ? ' here' : '') + '"' + (a ? ' data-act="go" data-node="' + id + '"' : '') + '>' +
        '<title>' + NODE_NAME[n.type] + '</title>' +
        '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + rad + '"/>' +
        '<text x="' + p.x + '" y="' + (p.y + 7) + '">' + NODE_ICON[n.type] + '</text></g>';
    });
    var boss = IDM.ENCOUNTERS.filter(function (e) { return e.id === m.bossId; })[0];
    var intel = '<div class="panel boss-intel"><h3>👑 Boss Intel</h3><b>' + boss.name.replace('BOSS: ', '') + '</b><p>' + boss.vignette + '</p>' +
      boss.enemies.map(function (e) { return '<div class="tag">' + ORGS[e.org].full + ' @ ' + IDM.SITES[e.site].icon + ' ' + IDM.SITES[e.site].name + '</div>'; }).join(' ') +
      '<p class="muted small">Refit parts at a 💊 Pharmacy or ⛑ Clinic to prepare. Consider site penetration!</p></div>';
    return '<div class="map-screen">' +
      '<div class="map-wrap panel"><h2>Act ' + r.act + ': ' + IDM.ACTS[r.act - 1].name + '</h2><p class="muted">' + IDM.ACTS[r.act - 1].blurb + ' Choose a highlighted node.</p>' +
      '<svg class="map" viewBox="0 0 ' + W + ' ' + H + '">' + lines + nodes + '</svg>' +
      '<div class="legend">' + Object.keys(NODE_ICON).map(function (k) { return '<span>' + NODE_ICON[k] + ' ' + NODE_NAME[k] + '</span>'; }).join('') + '</div></div>' +
      '<div class="map-side">' + intel + loadoutPanel() + '</div></div>';
  };

  function loadoutPanel() {
    var r = S.run;
    return '<div class="panel loadout-mini"><h3>Loadout</h3>' + mechSVG(r.parts, { act: 'noop' }) +
      G.PART_IDS.map(function (p) {
        var x = r.parts[p], D = DRUGS[x.drug];
        return '<div class="lo-row" style="--cc:' + cls(x.cls).color + '"><b>' + G.part(p).name + '</b> ' + D.name + (x.level ? ' <span class="lvl">+' + x.level + '</span>' : '') + '</div>';
      }).join('') +
      (r.relics.length ? '<h4>Mods</h4>' + r.relics.map(function (id) { var R = IDM.RELICS[id]; return '<div class="small">' + R.icon + ' <b>' + R.name + '</b>: ' + R.desc + '</div>'; }).join('') : '') +
      '</div>';
  }

  // ----- Combat -----
  screens.combat = function () {
    var r = S.run, c = S.combat, hints = G.DIFFICULTY[r.difficulty].hints;
    var target = c.enemies.filter(function (e) { return e.uid === c.target && !e.dead; })[0] || G.alive(c)[0];
    var enemies = c.enemies.map(function (e) {
      var o = ORGS[e.org], isT = target && e.uid === target.uid;
      var flash = c.flash && c.flash.uid === e.uid && c.flash.n !== S.lastFlash ? '<div class="pop' + (c.flash.dmg === 0 ? ' zero' : '') + '">' + (c.flash.dmg || 'IMMUNE') + '<small>' + c.flash.label + '</small></div>' : '';
      var intent = e.dead ? '' : e.intent.type === 'attack'
        ? '<div class="intent atk" title="Will attack">⚔ ' + e.intent.value + '</div>'
        : '<div class="intent rep" title="Will replicate (heal)">🧬 +' + e.intent.value + '</div>';
      var status = [];
      if (e.toxin) status.push('<span class="tag bad" title="Attacks 1.5x until a toxin-suppressing drug hits">☠ Toxin</span>');
      if (e.biofilm) status.push('<span class="tag warn" title="Takes 25% less damage">🧱 Biofilm</span>');
      if (e.secondary) status.push('<span class="tag warn" title="Superinfection. Not required for victory, but it lingers.">Superinfection</span>');
      Object.keys(e.resist).forEach(function (d) { status.push('<span class="tag bad" title="Selected resistance">R: ' + DRUGS[d].abbr + '</span>'); });
      return '<div class="enemy' + (e.dead ? ' dead' : '') + (isT ? ' target' : '') + (flash ? ' hit' : '') + '" data-act="target" data-uid="' + e.uid + '">' +
        flash + intent +
        '<div class="glyph">' + o.glyph + '</div>' +
        '<div class="ename">' + (e.identified ? o.name : '???') + '</div>' +
        '<div class="efull">' + (e.identified ? '<i>' + o.full + '</i>' : o.stain) + '</div>' +
        '<div class="esite">' + IDM.SITES[e.site].icon + ' ' + IDM.SITES[e.site].name + '</div>' +
        bar(e.hp, e.maxHp, 'ehp') + '<div class="status">' + status.join(' ') + '</div></div>';
    }).join('');
    if (c.flash) S.lastFlash = c.flash.n;

    var dim = {};
    var parts = G.PART_IDS.map(function (pid) {
      var x = r.parts[pid], D = DRUGS[x.drug], P = G.part(pid), C = cls(x.cls), can = G.canFire(r, c, pid);
      if (!can) dim[pid] = true;
      var state = c.firedThisTurn[pid] ? 'fired' : c.cooldowns[pid] > 0 ? 'recharging ' + c.cooldowns[pid] : '';
      var hint = '';
      if (hints && target) {
        var pr = G.calcDamage(r, c, pid, target);
        var lab = pr.cov > 0 && pr.site < 1 ? (pr.site === 0 ? "can't reach site" : 'poor penetration') : G.COV_LABEL[pr.cov];
        hint = '<span class="hint cov' + (pr.site < 1 && pr.cov > 0 ? 'p' : pr.cov) + '">' + lab + ' · ' + pr.dmg + '</span>';
      }
      return '<button class="part-btn' + (can ? '' : ' off') + '" data-act="fire" data-part="' + pid + '" style="--cc:' + C.color + '"' + (can ? '' : ' disabled') + '>' +
        '<span class="pb-part">' + P.name + (x.level ? ' +' + x.level : '') + '</span>' +
        '<span class="pb-drug">' + D.name + '</span>' +
        '<span class="pb-cls">' + C.name + ' · ' + P.mult + 'x' + (P.cd ? ' · cd ' + P.cd : '') + '</span>' +
        (state ? '<span class="pb-state">' + state + '</span>' : '') + hint + '</button>';
    }).join('');

    var pips = '';
    for (var i = 0; i < Math.max(c.actions, G.ACTIONS); i++) pips += '<span class="pip' + (i < c.actions ? ' on' : '') + '"></span>';

    var over = '';
    if (c.over) {
      over = '<div class="overlay"><div class="panel center">' +
        (c.over === 'win' ? '<h2 class="ok">Infection Cleared</h2>' + btn('collect', 'Collect Rewards', 'primary big')
          : c.over === 'retreat' ? '<h2 class="warn">Patient Transferred</h2><p>Read the consult notes in the log, then return to the map.</p>' + btn('toMap', 'Return to Map', 'primary big')
            : '<h2 class="err">Mech Destroyed</h2>' + btn('gameover', 'Debrief', 'primary big')) +
        '</div></div>';
    }

    return '<div class="combat">' +
      '<div class="combat-main">' +
      '<div class="panel enc"><h2>' + c.enc.name + (c.kind !== 'battle' ? ' <span class="tag ' + (c.kind === 'boss' ? 'bad' : 'warn') + '">' + c.kind.toUpperCase() + '</span>' : '') + '</h2>' +
      '<p>' + c.enc.vignette + '</p>' +
      '<p class="muted small">Turn ' + c.turn + ' · ' + (c.culture > 0 ? '🧫 Cultures in ' + c.culture + ' turn' + (c.culture > 1 ? 's' : '') : '🧫 Cultures final') +
      (c.evasive ? ' · 🦿 Evasive' : '') + '</p></div>' +
      '<div class="enemies">' + enemies + '</div>' +
      '<div class="panel controls">' +
      '<div class="ctl-row"><div class="pips">Actions ' + pips + '</div>' +
      '<div class="row">' + (c.kind !== 'boss' ? btn('retreat', S.confirmRetreat ? '⚠ Confirm retreat (−' + G.RETREAT_COST + ' integrity, no rewards)' : '🚑 Retreat & Consult', 'small' + (S.confirmRetreat ? ' danger' : ''), {}) : '') + btn('endTurn', 'End Turn ⏭', 'primary') + '</div></div>' +
      '<div class="parts">' + parts + '</div></div>' +
      '</div>' +
      '<div class="combat-side">' +
      '<div class="panel mech-mini">' + mechSVG(r.parts, { act: 'fire', dim: dim }) + '</div>' +
      '<div class="panel log" id="log">' + c.log.map(function (l) { return '<div class="l-' + l.k + '">' + h(l.t) + '</div>'; }).join('') + '</div>' +
      '</div>' + over + '</div>';
  };

  // ----- Reward -----
  screens.reward = function () {
    var rw = S.reward;
    var cards = rw.choices.map(function (ch, i) {
      var t, d;
      if (ch.type === 'upgrade') { var x = S.run.parts[ch.part]; t = '⬆ Dose Optimization'; d = G.part(ch.part).name + ' (' + DRUGS[x.drug].name + ') +1 level: +20% damage.'; }
      else if (ch.type === 'repair') { t = '🔧 Field Repair'; d = 'Repair ' + ch.amount + ' integrity.'; }
      else if (ch.type === 'relic') { var R = IDM.RELICS[ch.id]; t = R.icon + ' ' + R.name; d = R.desc; }
      else { t = '💰 Grant Funding'; d = '+' + ch.amount + ' credits.'; }
      return '<button class="card" data-act="choose" data-i="' + i + '"><b>' + t + '</b><span>' + d + '</span></button>';
    }).join('');
    return '<div class="panel center reward"><h2>Rewards</h2><p>+' + rw.credits + ' credits' +
      (rw.relic ? ' · New mod: ' + IDM.RELICS[rw.relic].icon + ' <b>' + IDM.RELICS[rw.relic].name + '</b> (' + IDM.RELICS[rw.relic].desc + ')' : '') + '</p>' +
      '<p class="muted">Choose one:</p><div class="cards">' + cards + '</div>' + btn('skipReward', 'Skip', 'small') + '</div>';
  };

  // ----- Shop -----
  screens.shop = function () {
    var r = S.run, sh = S.shop, P = G.PRICES;
    function item(act, title, desc, price, disabled, data) {
      return '<button class="card' + (disabled || r.credits < price ? ' disabled' : '') + '" data-act="' + act + '"' +
        (data ? Object.keys(data).map(function (k) { return ' data-' + k + '="' + data[k] + '"'; }).join('') : '') + '>' +
        '<b>' + title + '</b><span>' + desc + '</span><em>💰 ' + price + '</em></button>';
    }
    return '<div class="panel center shop"><h2>💊 Pharmacy</h2><p class="muted">The formulary is open. Credits: 💰 ' + r.credits + '</p><div class="cards">' +
      item('openRefit', '🔁 Refit a Part', 'Swap any part to a new class or drug. You keep its level if the class stays the same.', P.refit) +
      item('openUpgrade', '⬆ Dose Optimization', '+1 level to a part (+20% damage).', P.upgrade) +
      item('buy', '🔧 Repair', 'Repair 25 integrity.', P.repair, r.hp >= r.maxHp, { what: 'repair' }) +
      item('buy', '🧹 Antimicrobial Holiday', 'Clear nephrotoxicity, reduce C. diff risk by 60, and cure C. diff colonization.', P.detox, false, { what: 'detox' }) +
      sh.relics.map(function (x, i) { var R = IDM.RELICS[x.id]; return item('buyRelic', R.icon + ' ' + R.name, R.desc, x.price, x.sold, { i: i }); }).join('') +
      '</div>' + btn('toMap', 'Leave Pharmacy →', 'primary') + '</div>';
  };

  // ----- Rest -----
  screens.rest = function () {
    var r = S.run;
    return '<div class="panel center rest"><h2>⛑ Clinic</h2><p class="muted">A quiet moment between consults. Choose one:</p><div class="cards">' +
      '<button class="card" data-act="restRepair"><b>🔧 Recover</b><span>Repair ' + Math.round(r.maxHp * 0.35) + ' integrity.</span></button>' +
      '<button class="card" data-act="restDetox"><b>🧹 Antimicrobial Holiday</b><span>Clear nephrotoxicity, reduce C. diff risk by 60, and cure C. diff colonization.</span></button>' +
      '<button class="card" data-act="openUpgrade" data-free="1"><b>⬆ Dose Optimization</b><span>+1 level to a part.</span></button>' +
      '<button class="card" data-act="openRefit" data-free="1"><b>🔁 Formulary Review</b><span>Refit one part for free.</span></button>' +
      '</div></div>';
  };

  // ----- Event -----
  screens.event = function () {
    var ev = S.event;
    if (ev.quiz) {
      var q = ev.quiz;
      var opts = q.options.map(function (o, i) {
        var c = '';
        if (ev.answered != null) c = i === q.answer ? ' correct' : i === ev.answered ? ' wrong' : ' faded';
        return '<button class="quiz-opt' + c + '" data-act="answer" data-i="' + i + '"' + (ev.answered != null ? ' disabled' : '') + '>' + String.fromCharCode(65 + i) + '. ' + h(o) + '</button>';
      }).join('');
      var res = ev.answered == null ? '' : '<div class="quiz-res ' + (ev.answered === q.answer ? 'ok' : 'err') + '">' +
        (ev.answered === q.answer ? '✔ Correct! +25 credits, +10 integrity.' : '✘ Not quite. +5 credits for showing up.') +
        '<p>' + h(q.explain) + '</p></div>' + btn('toMap', 'Continue →', 'primary');
      return '<div class="panel center event"><h2>❓ Grand Rounds</h2><p class="muted">The attending turns to you…</p><h3>' + h(q.q) + '</h3><div class="quiz">' + opts + '</div>' + res + '</div>';
    }
    var E = ev.story;
    return '<div class="panel center event"><h2>❓ ' + E.title + '</h2><p>' + E.text + '</p>' +
      (ev.result ? '<div class="quiz-res ok">' + ev.result + '</div>' + btn('toMap', 'Continue →', 'primary')
        : '<div class="cards">' + E.choices.map(function (ch, i) { return '<button class="card" data-act="eventChoice" data-i="' + i + '"><b>' + ch.label + '</b><span>' + ch.desc + '</span></button>'; }).join('') + '</div>') +
      '</div>';
  };

  // ----- Codex -----
  screens.codex = function () {
    var cx = G.codex();
    var tabs = '<div class="tabs">' + [['organisms', '🦠 Pathogens'], ['drugs', '💊 Drug Library'], ['stats', '📊 Record']].map(function (t) {
      return '<button class="tab' + (S.codexTab === t[0] ? ' on' : '') + '" data-act="codexTab" data-t="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
    var body = '';
    if (S.codexTab === 'organisms') {
      body = '<p class="muted small">Pathogens are catalogued when cultures identify them. Drugs you have fired at each one are recorded with the observed effect.</p><div class="codex-grid">' +
        Object.keys(ORGS).map(function (id) {
          var o = ORGS[id], known = cx.orgs[id];
          if (!known) return '<div class="codex-card unknown"><div class="glyph">?</div><b>???</b><span class="small">' + o.stain + '</span></div>';
          var tested = Object.keys(cx.pairs).filter(function (k) { return k.split('|')[1] === id; }).map(function (k) {
            var d = k.split('|')[0], v = cx.pairs[k];
            return '<span class="tag cov' + v + '" title="' + G.COV_LABEL[v] + '">' + DRUGS[d].abbr + '</span>';
          }).join(' ');
          return '<div class="codex-card"><div class="glyph">' + o.glyph + '</div><b>' + o.name + '</b><i class="small">' + o.full + '</i>' +
            '<span class="small">🔬 ' + o.stain + '</span><p class="small">' + o.teach + '</p>' +
            '<div class="small">Tested: ' + (tested || '<i>none yet</i>') + '</div></div>';
        }).join('') + '</div>';
    } else if (S.codexTab === 'drugs') {
      body = IDM.CLASSES.map(function (C) {
        return '<div class="codex-class" style="--cc:' + C.color + '"><h3>' + C.name + '</h3><p class="moa">' + C.moa + '</p>' +
          C.drugs.map(function (d) { return drugDetail(d, {}); }).join('') + '</div>';
      }).join('');
    } else {
      body = '<div class="stats"><p>Runs started: <b>' + cx.runs + '</b></p><p>Victories: <b>' + cx.wins + '</b></p><p>Best score: <b>' + (cx.best || 0) + '</b></p>' +
        '<p>Pathogens catalogued: <b>' + Object.keys(cx.orgs).length + ' / ' + Object.keys(ORGS).length + '</b></p>' +
        '<p>Drug–bug pairs tested: <b>' + Object.keys(cx.pairs).length + '</b></p>' +
        '<p>Penetration failures observed: <b>' + Object.keys(cx.sites).length + '</b></p>' +
        btn('resetCodex', S.confirmReset ? '⚠ Click again to erase codex & record' : 'Reset codex & record', 'small danger') + '</div>';
    }
    return '<div class="panel codex"><div class="row spread"><h2>📖 Codex</h2>' + btn('closeCodex', '✕ Close', 'small') + '</div>' + tabs + body + '</div>';
  };

  screens.gameover = function () {
    var r = S.run, won = S.won, s = r.stats;
    return '<div class="panel center end"><h2 class="' + (won ? 'ok' : 'err') + '">' + (won ? '🏆 All Infections Cleared!' : '💥 Run Over') + '</h2>' +
      '<p>' + (won ? 'Your mech survived the ICU. The stewardship committee approves.' : 'Reached Act ' + r.act + '. Every failure taught you a coverage gap. Check the Codex.') + '</p>' +
      '<div class="stats"><p>Infections cleared: <b>' + s.battles + '</b> · Elites: <b>' + s.elites + '</b> · Bosses: <b>' + s.bosses + '</b></p>' +
      '<p>Grand Rounds: <b>' + s.quizRight + ' / ' + s.quizTotal + '</b> correct</p>' +
      '<p>"No effect" shots: <b>' + s.noEffect + '</b></p>' +
      '<p class="big-score">Score: ' + S.score + '</p></div>' +
      btn('hangar', 'Back to Hangar', 'primary big') + btn('codex', 'Open Codex') + '</div>';
  };

  // ----- Modals (refit / upgrade) -----
  function modalHTML() {
    var m = S.modal;
    if (!m) return '';
    var inner;
    if (m.type === 'upgrade') {
      inner = '<h2>⬆ Dose Optimization</h2><p class="muted">Choose a part to upgrade (+20% damage per level).</p><div class="cards">' +
        G.PART_IDS.map(function (p) {
          var x = S.run.parts[p];
          return '<button class="card" data-act="doUpgrade" data-part="' + p + '" style="border-color:' + cls(x.cls).color + '"><b>' + G.part(p).name + ' +' + x.level + ' → +' + (x.level + 1) + '</b><span>' + DRUGS[x.drug].name + '</span></button>';
        }).join('') + '</div>';
    } else {
      var temp = {};
      G.PART_IDS.forEach(function (p) { temp[p] = S.run.parts[p]; });
      inner = '<h2>🔁 Refit ' + (m.free ? '(free)' : '(💰 ' + G.PRICES.refit + ')') + '</h2>' +
        '<div class="part-tabs inline">' + G.PART_IDS.map(function (p) {
          var x = S.run.parts[p];
          return '<button class="part-tab' + (S.selPart === p ? ' on' : '') + '" data-act="selPart" data-part="' + p + '" style="--cc:' + cls(x.cls).color + '"><b>' + G.part(p).name + '</b><span>' + DRUGS[x.drug].name + '</span></button>';
        }).join('') + '</div>' +
        pickerHTML(temp, S.selPart, { equipLabel: 'Install on ' + G.part(S.selPart).name, equipAct: 'doRefit' }) +
        (m.err ? '<p class="err">' + m.err + '</p>' : '');
    }
    return '<div class="overlay"><div class="panel modal">' + inner + '<div class="row">' + btn('closeModal', 'Cancel', 'small') + '</div></div></div>';
  }

  // ---------- actions ----------
  var A = {};
  A.noop = function () {};
  A.back = function () { S.screen = S.screen === 'help' ? S.from || 'title' : 'title'; };
  A.help = function () { S.from = S.screen; S.screen = 'help'; };
  A.hangar = function () {
    S.run = null; S.combat = null; G.storage.del('idm_save');
    S.screen = 'hangar'; S.selClass = null; S.selDrug = null;
  };
  A['continue'] = function () { if (!load()) S.screen = 'hangar'; };
  A.codex = function () { S.from = S.screen; S.screen = 'codex'; };
  A.closeCodex = function () { S.screen = S.from || 'title'; if (S.screen === 'codex') S.screen = 'title'; };
  A.codexTab = function (d) { S.codexTab = d.t; };
  A.resetCodex = function () {
    if (!S.confirmReset) { S.confirmReset = true; return; }
    S.confirmReset = false;
    G.storage.del('idm_codex');
  };

  A.selPart = function (d) {
    if (!d.part) return;
    S.selPart = d.part; S.selDrug = null;
    var cur = S.modal ? S.run.parts[d.part] : S.loadout[d.part];
    S.selClass = cur ? cur.cls : null;
    if (S.modal) S.modal.err = null;
  };
  A.selClass = function (d) { S.selClass = d.cls; S.selDrug = null; };
  A.selDrug = function (d) {
    S.selDrug = d.drug;
    if (S.screen === 'hangar') A.equip(d);
  };
  A.equip = function (d) {
    S.loadout[S.selPart] = { cls: DRUGS[d.drug].cls, drug: d.drug };
    G.storage.set('idm_loadout', S.loadout);
  };
  A.randomize = function () { S.loadout = G.randomLoadout(); S.selClass = S.loadout[S.selPart].cls; S.selDrug = null; G.storage.set('idm_loadout', S.loadout); };
  A.clearLoadout = function () { S.loadout = {}; S.selClass = null; S.selDrug = null; G.storage.set('idm_loadout', S.loadout); };
  A.difficulty = function (d) { S.difficulty = d.d; G.storage.set('idm_difficulty', d.d); };
  A.launch = function () {
    if (G.loadoutErrors(S.loadout).length) return;
    S.run = G.newRun(S.loadout, S.difficulty);
    S.screen = 'map';
  };

  A.go = function (d) {
    var r = S.run, node = G.enterNode(r, d.node);
    if (!node) return;
    var t = node.type;
    if (t === 'battle' || t === 'elite' || t === 'boss') {
      S.combat = G.startCombat(r, G.encounterFor(r, node));
      S.lastFlash = 0;
      S.screen = 'combat';
    } else if (t === 'shop') { S.shop = G.genShop(r); S.screen = 'shop'; }
    else if (t === 'rest') { S.screen = 'rest'; }
    else if (t === 'event') {
      S.event = G.rand() < 0.65 ? { quiz: G.genQuiz(), answered: null } : { story: G.pick(IDM.EVENTS), result: null };
      S.screen = 'event';
    }
  };

  A.target = function (d) { G.setTarget(S.combat, d.uid); };
  A.fire = function (d) { G.fire(S.run, S.combat, d.part); };
  A.endTurn = function () { G.endTurn(S.run, S.combat); };
  A.retreat = function () {
    // Two-step confirmation inside the page (browser confirm dialogs are not always available)
    if (!S.confirmRetreat) { S.confirmRetreat = true; return; }
    S.confirmRetreat = false;
    G.retreat(S.run, S.combat);
  };
  A.collect = function () {
    var r = S.run, c = S.combat;
    S.reward = G.finishCombat(r, c);
    S.reward.boss = c.kind === 'boss';
    S.combat = null;
    S.screen = 'reward';
  };
  function afterReward() {
    if (S.reward && S.reward.boss) {
      S.reward = null;
      if (!G.advanceAct(S.run)) { S.won = true; S.score = G.recordEnd(S.run, true); S.screen = 'gameover'; G.storage.del('idm_save'); return; }
    }
    S.reward = null;
    S.screen = 'map';
  }
  A.choose = function (d) { G.applyChoice(S.run, S.reward.choices[+d.i]); afterReward(); };
  A.skipReward = function () { afterReward(); };
  A.toMap = function () { S.combat = null; S.event = null; S.shop = null; S.screen = 'map'; };
  A.gameover = function () { S.won = false; S.score = G.recordEnd(S.run, false); S.combat = null; S.screen = 'gameover'; G.storage.del('idm_save'); };

  A.buy = function (d) { G.buy(S.run, d.what, S.shop); };
  A.buyRelic = function (d) { G.buy(S.run, 'relic', S.shop, S.shop.relics[+d.i]); };
  A.openRefit = function (d) {
    if (!d.free && S.run.credits < G.PRICES.refit) return;
    S.modal = { type: 'refit', free: !!d.free }; S.selPart = 'head'; S.selClass = S.run.parts.head.cls; S.selDrug = null;
  };
  A.openUpgrade = function (d) {
    if (!d.free && S.run.credits < G.PRICES.upgrade) return;
    S.modal = { type: 'upgrade', free: !!d.free };
  };
  A.closeModal = function () { S.modal = null; S.selDrug = null; };
  A.doRefit = function (d) {
    var m = S.modal, drug = d.drug;
    var errs = G.refit(S.run, S.selPart, DRUGS[drug].cls, drug);
    if (errs.length) { m.err = errs[0]; return; }
    if (!m.free) S.run.credits -= G.PRICES.refit;
    S.modal = null; S.selDrug = null;
    if (m.free) S.screen = 'map';
  };
  A.doUpgrade = function (d) {
    var m = S.modal;
    if (m.free) { S.run.parts[d.part].level++; S.modal = null; S.screen = 'map'; return; }
    G.buy(S.run, 'upgrade', S.shop, d.part);
    S.modal = null;
  };
  A.restRepair = function () { G.restRepair(S.run); S.screen = 'map'; };
  A.restDetox = function () { G.restDetox(S.run); S.screen = 'map'; };

  A.answer = function (d) {
    var ev = S.event, r = S.run, i = +d.i;
    if (ev.answered != null) return;
    ev.answered = i;
    r.stats.quizTotal++;
    if (i === ev.quiz.answer) { r.stats.quizRight++; r.credits += 25; G.heal(r, 10); }
    else r.credits += 5;
  };
  A.eventChoice = function (d) {
    var ev = S.event;
    if (ev.result) return;
    ev.result = G.applyEventEffect(S.run, ev.story.choices[+d.i].effect);
  };

  // ---------- render loop ----------
  function render() {
    var s = S.screen;
    var body = (screens[s] || screens.title)();
    app.className = 'screen-' + s;
    app.innerHTML = (S.run && ['map', 'combat', 'reward', 'shop', 'rest', 'event'].indexOf(s) >= 0 ? topbar() : '') +
      '<main>' + body + '</main>' + modalHTML();
    var lg = document.getElementById('log');
    if (lg) lg.scrollTop = lg.scrollHeight;
    save();
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled || el.classList.contains('disabled')) return;
    var fn = A[el.dataset.act];
    if (!fn) return;
    if (el.dataset.act !== 'retreat') S.confirmRetreat = false;
    if (el.dataset.act !== 'resetCodex') S.confirmReset = false;
    fn(el.dataset);
    render();
  });

  // Keyboard: 1-5 fire parts, E ends turn, Tab cycles target
  document.addEventListener('keydown', function (ev) {
    if (S.screen !== 'combat' || !S.combat || S.combat.over || S.modal) return;
    var n = parseInt(ev.key, 10);
    if (n >= 1 && n <= 5) { G.fire(S.run, S.combat, G.PART_IDS[n - 1]); render(); }
    else if (ev.key === 'e' || ev.key === 'E') { G.endTurn(S.run, S.combat); render(); }
    else if (ev.key === 'Tab') {
      ev.preventDefault();
      var al = G.alive(S.combat), i = al.map(function (e) { return e.uid; }).indexOf(S.combat.target);
      if (al.length) G.setTarget(S.combat, al[(i + 1) % al.length].uid);
      render();
    }
  });

  render();
})();
