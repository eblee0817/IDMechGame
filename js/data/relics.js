// Mods (relics) and Grand Rounds events.
var IDM = globalThis.IDM = globalThis.IDM || {};

IDM.RELICS = {
  idconsult: { name: 'ID Consult', icon: '🩺', desc: 'Cultures come back 1 turn sooner.' },
  pcr: { name: 'Rapid PCR Panel', icon: '🧬', desc: 'Pathogens are identified at the start of every battle.' },
  tdm: { name: 'Therapeutic Drug Monitoring', icon: '📈', desc: 'Nephrotoxicity buildup -40%.' },
  probiotic: { name: 'Stewardship Pharmacist', icon: '🧑‍⚕️', desc: 'C. diff risk buildup -40%.' },
  loading: { name: 'Loading Dose', icon: '💉', desc: 'Your first shot each battle deals double damage.' },
  extinf: { name: 'Extended Infusion', icon: '⏳', desc: 'Beta-lactams deal +25% damage (time-dependent killing, longer time above the MIC).' },
  oncedaily: { name: 'Once-Daily Dosing', icon: '🎯', desc: 'Aminoglycosides deal +40% damage (concentration-dependent, high Cmax/MIC).' },
  plating: { name: 'Reinforced Plating', icon: '🛡️', desc: '+20 max integrity.' },
  antibiogram: { name: 'Local Antibiogram', icon: '📋', desc: 'Weak (suboptimal) hits never select for resistance.' },
  sourcectl: { name: 'Source Control', icon: '🔪', desc: 'Enemies in abdomen, skin, and bone start at 75% HP.' },
  vaccine: { name: 'Vaccination Record', icon: '💪', desc: 'Repair 3 integrity at the end of each of your turns.' },
  thirdhand: { name: 'Combination Protocol', icon: '➕', desc: '+1 action on the first turn of each battle.' },
  procalc: { name: 'Procalcitonin Assay', icon: '🔬', desc: 'Gain +10 credits after each battle.' },
};

IDM.RELIC_IDS = Object.keys(IDM.RELICS);

// Narrative events (non-quiz Grand Rounds). Each choice has an effect key handled in game.js.
IDM.EVENTS = [
  { id: 'allergy', title: 'The Penicillin Allergy Label',
    text: 'Your patient has a "penicillin allergy" from childhood (a rash at age 4). About 90% of these labels are not true IgE-mediated allergies. Cross-reactivity with cefazolin is under 1% because the side chains differ.',
    choices: [
      { label: 'Refer for penicillin skin testing and de-label', effect: 'upgradeRandom', desc: 'A random part gains +1 level. Broader options!' },
      { label: 'Leave the label and use vancomycin "to be safe"', effect: 'renalHit', desc: '+25 nephrotoxicity. (Inferior therapy and more toxicity.)' },
    ] },
  { id: 'rep', title: 'Pharmaceutical Representative',
    text: 'A rep offers lunch and "free samples" of a brand-new broad-spectrum agent for your formulary.',
    choices: [
      { label: 'Accept the samples', effect: 'repDeal', desc: 'Gain 40 credits, but +30 C. diff risk.' },
      { label: 'Politely decline and ask for the trial data', effect: 'credits15', desc: 'Gain 15 credits from a stewardship grant.' },
    ] },
  { id: 'deesc', title: 'Day 3: Cultures Are Back',
    text: 'Your patient on vancomycin plus pip-tazo is improving. Cultures grew pan-susceptible E. coli. What now?',
    choices: [
      { label: 'De-escalate to ceftriaxone', effect: 'detox', desc: 'Correct! Toxicity meters are reduced by 40.' },
      { label: 'Continue both "since it\'s working"', effect: 'tox20', desc: '+20 to both toxicity meters.' },
    ] },
  { id: 'ivpo', title: 'IV-to-PO Switch',
    text: 'Your patient with pyelonephritis is afebrile, eating, and the isolate is FQ-susceptible. Oral ciprofloxacin has ~70% bioavailability (levofloxacin ~99%).',
    choices: [
      { label: 'Switch to oral and discharge', effect: 'heal25', desc: 'Repair 25 integrity (shorter stay, fewer line complications).' },
      { label: 'Keep IV "to be sure"', effect: 'none', desc: 'Nothing happens, except a longer length of stay.' },
    ] },
  { id: 'duration', title: 'How Long?',
    text: 'Uncomplicated CAP, clinically stable by day 3. Trials support a 5-day course instead of 10-14 days.',
    choices: [
      { label: 'Stop at 5 days', effect: 'relic', desc: 'Gain a random mod.' },
      { label: 'Give 14 days', effect: 'gutHit', desc: '+25 C. diff risk.' },
    ] },
];
