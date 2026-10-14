# Spectrum Mech

A roguelike mech game for learning **antibiotic coverage**. Build a mech whose five parts are antibiotic classes, then fight your way through branching maps of infections, from community pneumonia to KPC-producing CRE septic shock.

> Educational game. Coverage is simplified from typical US susceptibility patterns. Always follow local antibiograms and current guidelines for patient care.

## Play

No build step. Open `index.html` in a browser, or serve the folder:

```bash
npm start            # python3 -m http.server 8000 → http://localhost:8000
```

Progress (codex, saved run, last loadout) is stored in `localStorage`.

To build a single self-contained HTML file (handy for sharing or hosting): `node tools/bundle.js` writes `dist/spectrum-mech.html`.

## Core loop

1. **Hangar.** Pick an antibiotic **class** for each part (Head, Torso, Right Arm, Left Arm, Legs), then a **specific drug** within that class (the sub-part). Each part must use a different class.
   | Part | Role |
   |---|---|
   | Head | Targeting sensor: 0.8x damage, 1.5x on drug-of-choice hits |
   | Torso | Core cannon: 1.8x damage, 2-turn recharge |
   | Right / Left Arm | 1.0x, fires every turn |
   | Legs | 1.0x, then 50% dodge for the enemy phase, 1-turn recharge |
2. **Branching map** (3 acts: Community Clinic, then Hospital Ward, then ICU). ⚔ infection · 💀 elite · ❓ Grand Rounds (quiz or event) · 💊 Pharmacy (refit, upgrades, mods) · ⛑ Clinic (rest, detox, free refit) · 👑 boss. The boss is previewed so you can refit for it.
3. **Combat.** You see the vignette, Gram stain, and infection site. Cultures name the organism after 2 turns, so you treat empirically first. Damage = coverage (none / weak / effective / drug of choice) × site penetration × part multiplier × level.

## Teaching mechanics

- **Site penetration.** Daptomycin is useless in the lung, nitrofurantoin works only in the bladder, cefazolin and aminoglycosides don't reach the CSF, tigecycline is poor in blood, and oral vancomycin and fidaxomicin work only in the colon.
- **Resistance selection.** Weak (suboptimal) hits have a 25% chance to make that organism resistant to the drug.
- **Toxicity meters.** Every shot adds nephrotoxicity and C. diff risk. Overflow causes AKI (integrity loss) or a C. diff superinfection that lingers until you treat it or detox. Vancomycin plus pip-tazo adds extra renal load.
- **Synergy.** A cell-wall agent plus an aminoglycoside on the same gram-positive target in one turn gives a bonus.
- **Toxin suppression.** Clindamycin and linezolid shut off toxin in necrotizing fasciitis.
- **Biofilm.** Endocarditis vegetations take reduced damage.
- **Retreat & Consult.** You can abandon a non-boss fight for an integrity cost, and the game then lists which drugs would have worked.
- **Explanations everywhere.** Every "no effect" or "poor penetration" hit explains why (e.g. *"Enterococci are intrinsically resistant to ALL cephalosporins"*).
- **Codex.** Records every pathogen you identify and every drug–bug pair you've tested. It also includes a full drug library.

Difficulty: **Student** (150 integrity + effectiveness hints before firing), **Resident** (120), **Attending** (100).

## Project layout

```
index.html
css/style.css
js/data/drugs.js        16 classes, 40 drugs: coverage table, site penetration, toxicity, spectrum/AE text
js/data/organisms.js    20 pathogens, Gram-stain clues, teaching notes, resistance explanations
js/data/encounters.js   acts and clinical-vignette encounters (battles, elites, bosses)
js/data/relics.js       mods and narrative Grand Rounds events
js/game.js              engine (no DOM): runs, map generation, combat, rewards, quizzes
js/ui.js                rendering and input
tests/validate.js       data-integrity and engine tests      (npm test)
tests/simulate.js       expert-bot balance simulation         (npm run sim)
```

### Editing content

- **Coverage:** edit `cov` in `js/data/drugs.js` (3 = drug of choice, 2 = reliable, 1 = weak, absent = none).
- **New pathogen:** add it to `IDM.ORGANISMS`, then reference it in drug `cov` tables and an encounter.
- **New explanation:** add to `IDM.NOTES` (keys like `drug|org`, `cls:<class>|org`, `cls:<class>|type:gn`) or `IDM.SITE_NOTES`.
- **Allow duplicate classes:** set `G.UNIQUE_CLASSES = false` in `js/game.js`.

Run `npm test` after editing data. It checks that every reference resolves and that every encounter is beatable.
