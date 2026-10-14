// Antibiotic classes and drugs.
//
// Coverage scale (cov):  3 = drug of choice / excellent
//                        2 = reliable activity
//                        1 = weak, variable, or synergy-only (not recommended alone)
//                        0 / absent = no useful activity (intrinsic or expected resistance)
//
// site: multipliers for infection-site penetration (absent = 1.0)
// tox:  per-shot toxicity added to the run meters: renal (nephrotoxicity) and gut (C. difficile risk)
//
// These are teaching simplifications of typical US susceptibility patterns, not clinical guidance.
var IDM = globalThis.IDM = globalThis.IDM || {};

IDM.CLASSES = [
  { id: 'penicillins', name: 'Penicillins', family: 'betalactam', color: '#42a5f5',
    moa: 'Beta-lactam: binds penicillin-binding proteins (PBPs) and blocks cell-wall cross-linking. Time-dependent killing.',
    drugs: ['penG', 'ampicillin', 'nafcillin', 'amoxclav', 'ampsulb', 'piptazo'] },
  { id: 'cephalosporins', name: 'Cephalosporins', family: 'betalactam', color: '#ab47bc',
    moa: 'Beta-lactam: PBP inhibition. Generations trade gram-positive for gram-negative activity. No enterococcal or Listeria activity.',
    drugs: ['cefazolin', 'ceftriaxone', 'ceftazidime', 'cefepime', 'ceftaroline', 'cazavi'] },
  { id: 'carbapenems', name: 'Carbapenems', family: 'betalactam', color: '#ef5350',
    moa: 'Beta-lactam: the broadest beta-lactams, stable against ESBLs and AmpC. Not stable against carbapenemases unless paired with an inhibitor.',
    drugs: ['ertapenem', 'meropenem', 'merovabor'] },
  { id: 'monobactams', name: 'Monobactams', family: 'betalactam', color: '#ffca28',
    moa: 'Beta-lactam with a single ring: gram-negative aerobes only. Minimal cross-reactivity in penicillin allergy (except ceftazidime, which shares a side chain).',
    drugs: ['aztreonam', 'aztavi'] },
  { id: 'glycopeptides', name: 'Glycopeptides', family: 'cellwall', color: '#66bb6a',
    moa: 'Binds D-Ala-D-Ala to block peptidoglycan synthesis. Too large to cross the gram-negative outer membrane.',
    drugs: ['vancIV', 'vancPO'] },
  { id: 'lipopeptides', name: 'Lipopeptides', family: 'membrane', color: '#26a69a',
    moa: 'Calcium-dependent insertion into the gram-positive membrane causes depolarization. Rapidly bactericidal.',
    drugs: ['daptomycin'] },
  { id: 'oxazolidinones', name: 'Oxazolidinones', family: 'protein50s', color: '#8d6e63',
    moa: 'Binds the 50S subunit (23S rRNA) and blocks the initiation complex. Bacteriostatic against most organisms; suppresses toxin production.',
    drugs: ['linezolid', 'tedizolid'] },
  { id: 'aminoglycosides', name: 'Aminoglycosides', family: 'protein30s', color: '#ff7043',
    moa: 'Binds the 30S subunit and causes mRNA misreading. Concentration-dependent. Uptake needs oxygen, so no anaerobic activity.',
    drugs: ['gentamicin', 'tobramycin', 'amikacin'] },
  { id: 'fluoroquinolones', name: 'Fluoroquinolones', family: 'dna', color: '#5c6bc0',
    moa: 'Inhibits DNA gyrase and topoisomerase IV. Excellent oral bioavailability. Boxed warnings: tendons, neuropathy, CNS effects.',
    drugs: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin'] },
  { id: 'macrolides', name: 'Macrolides', family: 'protein50s', color: '#ec407a',
    moa: 'Binds the 50S subunit (23S rRNA) and blocks translocation. Good intracellular and atypical activity. Prolongs the QT interval.',
    drugs: ['azithromycin', 'clarithromycin', 'fidaxomicin'] },
  { id: 'tetracyclines', name: 'Tetracyclines', family: 'protein30s', color: '#9ccc65',
    moa: 'Binds the 30S subunit and blocks aminoacyl-tRNA binding. Chelated by divalent cations. Photosensitivity.',
    drugs: ['doxycycline', 'minocycline', 'tigecycline'] },
  { id: 'lincosamides', name: 'Lincosamides', family: 'protein50s', color: '#d4e157',
    moa: 'Binds the 50S subunit. Strong toxin suppression. Highest C. difficile risk of any class.',
    drugs: ['clindamycin'] },
  { id: 'folate', name: 'Folate Antagonists', family: 'folate', color: '#ffa726',
    moa: 'Sequentially blocks dihydropteroate synthase (SMX) and dihydrofolate reductase (TMP).',
    drugs: ['tmpsmx'] },
  { id: 'nitroimidazoles', name: 'Nitroimidazoles', family: 'dna', color: '#78909c',
    moa: 'Prodrug activated only in anaerobes; the reduced form shreds DNA. Anaerobes and protozoa only.',
    drugs: ['metronidazole'] },
  { id: 'polymyxins', name: 'Polymyxins', family: 'membrane', color: '#b0bec5',
    moa: 'Cationic detergent: binds lipid A (LPS) and disrupts the gram-negative outer membrane. Last-line; highly nephrotoxic.',
    drugs: ['colistin', 'polymyxinB'] },
  { id: 'nitrofurans', name: 'Nitrofurans', family: 'dna', color: '#a1887f',
    moa: 'Reduced by bacterial flavoproteins into reactive intermediates that damage DNA and ribosomes. Concentrates only in the bladder.',
    drugs: ['nitrofurantoin'] },
];

// Non-gut sites, for drugs that never leave the GI tract or the bladder.
var SYSTEMIC_ZERO = { lung: 0, cns: 0, urine: 0, blood: 0, skin: 0, bone: 0, abdomen: 0, sinus: 0, genital: 0 };
var ONLY_URINE = { lung: 0, cns: 0, blood: 0, skin: 0, bone: 0, abdomen: 0, sinus: 0, genital: 0, gut: 0 };

IDM.DRUGS = {
  // ---------------- Penicillins ----------------
  penG: { name: 'Penicillin G', abbr: 'PCN', cls: 'penicillins',
    cov: { gas: 3, spneumo: 2, nmen: 2, listeria: 2, efaecalis: 1 },
    tox: { renal: 0, gut: 2 }, site: {},
    spectrum: 'Narrow. Drug of choice for Group A strep (and syphilis). Covers susceptible pneumococci, meningococci, Listeria. Destroyed by staphylococcal penicillinase.',
    ae: 'Hypersensitivity. Seizures at very high doses.' },
  ampicillin: { name: 'Ampicillin', abbr: 'AMP', cls: 'penicillins',
    cov: { efaecalis: 3, listeria: 3, gas: 2, spneumo: 2, nmen: 2, ecoli: 1, hflu: 1 },
    tox: { renal: 0, gut: 4 }, site: {},
    spectrum: 'Aminopenicillin. Drug of choice for E. faecalis and Listeria. About 50% of E. coli and many H. influenzae make beta-lactamase and resist it.',
    ae: 'Rash (especially with EBV), diarrhea.' },
  nafcillin: { name: 'Nafcillin', abbr: 'NAF', cls: 'penicillins',
    cov: { mssa: 3, gas: 2, spneumo: 1 },
    tox: { renal: 3, gut: 3 }, site: {},
    spectrum: 'Anti-staphylococcal penicillin, penicillinase-stable. Drug of choice for MSSA. No MRSA, enterococcal, or gram-negative activity.',
    ae: 'Interstitial nephritis, hepatotoxicity, phlebitis, hypokalemia.' },
  amoxclav: { name: 'Amoxicillin-clavulanate', abbr: 'AMC', cls: 'penicillins',
    cov: { hflu: 3, mssa: 2, gas: 2, spneumo: 2, ecoli: 2, efaecalis: 2, bfrag: 2, listeria: 1 },
    tox: { renal: 0, gut: 7 }, site: { cns: 0.25, blood: 0.6 },
    spectrum: 'Oral beta-lactam/beta-lactamase inhibitor. Covers beta-lactamase producing H. flu and Moraxella, MSSA, anaerobes. Workhorse for bites, sinusitis, otitis.',
    ae: 'Diarrhea (from clavulanate), cholestatic hepatitis.' },
  ampsulb: { name: 'Ampicillin-sulbactam', abbr: 'SAM', cls: 'penicillins',
    cov: { mssa: 2, gas: 2, spneumo: 2, hflu: 2, efaecalis: 2, bfrag: 2, acineto: 2, ecoli: 1, listeria: 1 },
    tox: { renal: 0, gut: 6 }, site: { cns: 0.5 },
    spectrum: 'IV aminopenicillin plus inhibitor. Gram-positives, anaerobes, H. flu. Sulbactam itself has intrinsic Acinetobacter activity. E. coli resistance is rising.',
    ae: 'Diarrhea, rash.' },
  piptazo: { name: 'Piperacillin-tazobactam', abbr: 'TZP', cls: 'penicillins',
    cov: { pseudo: 3, bfrag: 3, mssa: 2, gas: 2, spneumo: 2, efaecalis: 2, hflu: 2, ecoli: 2, esbl: 1, listeria: 1, nmen: 1 },
    tox: { renal: 2, gut: 8 }, site: { cns: 0.5 },
    spectrum: 'Broad anti-pseudomonal penicillin plus inhibitor. Gram-positives (not MRSA), gram-negatives including Pseudomonas, and anaerobes. Not reliable for ESBL bacteremia (MERINO trial).',
    ae: 'Higher AKI rates when combined with vancomycin. Thrombocytopenia.' },

  // ---------------- Cephalosporins ----------------
  cefazolin: { name: 'Cefazolin', abbr: 'CFZ', cls: 'cephalosporins',
    cov: { mssa: 3, gas: 2, ecoli: 2, spneumo: 1 },
    tox: { renal: 0, gut: 4 }, site: { cns: 0.2 },
    spectrum: '1st generation. Co-drug of choice for MSSA (often better tolerated than nafcillin). Surgical prophylaxis. Some E. coli. Does not cross the blood-brain barrier.',
    ae: 'Well tolerated. Hypersensitivity.' },
  ceftriaxone: { name: 'Ceftriaxone', abbr: 'CRO', cls: 'cephalosporins',
    cov: { spneumo: 3, nmen: 3, ngono: 3, hflu: 3, ecoli: 3, gas: 2, mssa: 1 },
    tox: { renal: 0, gut: 8 }, site: {},
    spectrum: '3rd generation. Pneumococcus, meningococcus, gonorrhea, H. flu, community Enterobacterales. Excellent CNS penetration. No Pseudomonas, enterococci, Listeria, MRSA, or ESBL.',
    ae: 'Biliary sludge. Do not mix with calcium in neonates.' },
  ceftazidime: { name: 'Ceftazidime', abbr: 'CAZ', cls: 'cephalosporins',
    cov: { pseudo: 3, ecoli: 2, hflu: 2, nmen: 1, gas: 1, spneumo: 1 },
    tox: { renal: 0, gut: 6 }, site: {},
    spectrum: '3rd generation, anti-pseudomonal. Strong gram-negative activity but weak gram-positive activity. Shares a side chain with aztreonam.',
    ae: 'Hypersensitivity. Neurotoxicity if not renally adjusted.' },
  cefepime: { name: 'Cefepime', abbr: 'FEP', cls: 'cephalosporins',
    cov: { pseudo: 3, ecoli: 3, mssa: 2, gas: 2, spneumo: 2, hflu: 2, nmen: 2, esbl: 1 },
    tox: { renal: 0, gut: 7 }, site: {},
    spectrum: '4th generation. Anti-pseudomonal and stable against AmpC, while keeping good streptococcal and MSSA activity. Not reliable against ESBL.',
    ae: 'Neurotoxicity (encephalopathy, myoclonus) in renal impairment.' },
  ceftaroline: { name: 'Ceftaroline', abbr: 'CPT', cls: 'cephalosporins',
    cov: { spneumo: 3, mrsa: 2, mssa: 2, gas: 2, hflu: 2, ecoli: 2 },
    tox: { renal: 0, gut: 6 }, site: { cns: 0.5 },
    spectrum: '5th generation. The only beta-lactam that binds PBP2a, so it covers MRSA. Community gram-negatives. No Pseudomonas.',
    ae: 'Neutropenia with prolonged courses, rash.' },
  cazavi: { name: 'Ceftazidime-avibactam', abbr: 'CZA', cls: 'cephalosporins',
    cov: { cre: 3, esbl: 3, pseudo: 3, ecoli: 3, hflu: 2, gas: 1, spneumo: 1 },
    tox: { renal: 0, gut: 7 }, site: { cns: 0.75 },
    spectrum: 'Avibactam inhibits ESBL, AmpC, KPC and OXA-48 (not metallo-beta-lactamases). Reserve agent for CRE and resistant Pseudomonas.',
    ae: 'Generally well tolerated. Stewardship: reserve it.' },

  // ---------------- Carbapenems ----------------
  ertapenem: { name: 'Ertapenem', abbr: 'ETP', cls: 'carbapenems',
    cov: { esbl: 3, ecoli: 3, bfrag: 3, mssa: 2, gas: 2, spneumo: 2, hflu: 2, nmen: 2 },
    tox: { renal: 0, gut: 9 }, site: { cns: 0.5 },
    spectrum: 'Once-daily carbapenem. ESBL Enterobacterales and anaerobes. The gaps to remember are Pseudomonas, Acinetobacter, and enterococci.',
    ae: 'Seizures (lower risk than imipenem). Lowers valproate levels.' },
  meropenem: { name: 'Meropenem', abbr: 'MEM', cls: 'carbapenems',
    cov: { esbl: 3, ecoli: 3, bfrag: 3, pseudo: 2, mssa: 2, gas: 2, spneumo: 2, hflu: 2, nmen: 2, acineto: 1, listeria: 1 },
    tox: { renal: 0, gut: 10 }, site: {},
    spectrum: 'Very broad: gram-positives (not MRSA/VRE), gram-negatives including Pseudomonas and ESBL, and anaerobes. Drug of choice for serious ESBL infections. Fails against carbapenemases and Stenotrophomonas.',
    ae: 'Seizures (rare), crushes valproate levels. Major C. diff and resistance pressure.' },
  merovabor: { name: 'Meropenem-vaborbactam', abbr: 'MEV', cls: 'carbapenems',
    cov: { cre: 3, esbl: 3, ecoli: 3, bfrag: 3, pseudo: 2, mssa: 2, gas: 2, spneumo: 2, hflu: 2, nmen: 2, acineto: 1 },
    tox: { renal: 0, gut: 10 }, site: { cns: 0.75 },
    spectrum: 'Vaborbactam inhibits KPC carbapenemase and restores meropenem against KPC-producing CRE. Adds nothing against Pseudomonas or Acinetobacter resistance.',
    ae: 'As for meropenem. Reserve agent.' },

  // ---------------- Monobactams ----------------
  aztreonam: { name: 'Aztreonam', abbr: 'ATM', cls: 'monobactams',
    cov: { pseudo: 2, ecoli: 2, hflu: 2, nmen: 1 },
    tox: { renal: 0, gut: 4 }, site: {},
    spectrum: 'Gram-negative aerobes only, including Pseudomonas. No gram-positive or anaerobic activity. Useful in severe penicillin allergy.',
    ae: 'Very low cross-reactivity (avoid if allergic to ceftazidime).' },
  aztavi: { name: 'Aztreonam-avibactam', abbr: 'AZA', cls: 'monobactams',
    cov: { cre: 3, esbl: 3, ecoli: 3, pseudo: 2, steno: 2, hflu: 2 },
    tox: { renal: 0, gut: 5 }, site: { cns: 0.75 },
    spectrum: 'Aztreonam evades metallo-beta-lactamases, and avibactam blocks the ESBL/KPC enzymes that would otherwise destroy it. Active against MBL-producing CRE and Stenotrophomonas.',
    ae: 'Hepatic enzyme elevations. Reserve agent.' },

  // ---------------- Glycopeptides ----------------
  vancIV: { name: 'Vancomycin (IV)', abbr: 'VAN', cls: 'glycopeptides',
    cov: { mrsa: 3, gas: 2, spneumo: 2, efaecalis: 2, mssa: 1, listeria: 1 },
    tox: { renal: 8, gut: 3 }, site: { cns: 0.75, gut: 0 },
    spectrum: 'Gram-positives only. Drug of choice for MRSA. Inferior to beta-lactams for MSSA. IV vancomycin does not reach the colon, so it does not treat C. diff.',
    ae: 'Nephrotoxicity (AUC-guided dosing), vancomycin infusion reaction ("red man"/flushing), ototoxicity.' },
  vancPO: { name: 'Vancomycin (PO)', abbr: 'VPO', cls: 'glycopeptides',
    cov: { cdiff: 3 },
    tox: { renal: 0, gut: 0 }, site: SYSTEMIC_ZERO,
    spectrum: 'Not absorbed from the gut. First-line for C. difficile infection and useless anywhere else.',
    ae: 'Minimal systemic toxicity. Selects for VRE in the gut.' },

  // ---------------- Lipopeptides ----------------
  daptomycin: { name: 'Daptomycin', abbr: 'DAP', cls: 'lipopeptides',
    cov: { mrsa: 3, vre: 3, mssa: 2, efaecalis: 2, gas: 2, spneumo: 2 },
    tox: { renal: 0, gut: 2 }, site: { lung: 0, cns: 0.25 },
    spectrum: 'Gram-positives including MRSA and VRE. Rapidly bactericidal, good for bacteremia and endocarditis. Inactivated by pulmonary surfactant, so never use it for pneumonia.',
    ae: 'CPK elevation and myopathy (hold statins), eosinophilic pneumonia.' },

  // ---------------- Oxazolidinones ----------------
  linezolid: { name: 'Linezolid', abbr: 'LZD', cls: 'oxazolidinones', antitoxin: true,
    cov: { mrsa: 3, vre: 3, mssa: 2, gas: 2, spneumo: 2, efaecalis: 2, listeria: 1 },
    tox: { renal: 0, gut: 3 }, site: {},
    spectrum: 'Gram-positives including MRSA and VRE. 100% oral bioavailability. Good lung penetration. Suppresses toxin production.',
    ae: 'Thrombocytopenia after about 2 weeks, serotonin syndrome with SSRIs (weak MAO inhibitor), lactic acidosis, neuropathy.' },
  tedizolid: { name: 'Tedizolid', abbr: 'TZD', cls: 'oxazolidinones', antitoxin: true,
    cov: { mrsa: 2, mssa: 2, gas: 2, vre: 2, efaecalis: 2 },
    tox: { renal: 0, gut: 2 }, site: {},
    spectrum: 'Once-daily oxazolidinone approved for skin infections. Fewer hematologic and serotonergic effects than linezolid.',
    ae: 'Nausea. Less myelosuppression than linezolid.' },

  // ---------------- Aminoglycosides ----------------
  gentamicin: { name: 'Gentamicin', abbr: 'GEN', cls: 'aminoglycosides',
    cov: { ecoli: 2, esbl: 1, pseudo: 1, efaecalis: 1, mssa: 1, ngono: 1 },
    tox: { renal: 15, gut: 1 }, site: { cns: 0.2, lung: 0.5, abdomen: 0.5, urine: 1.25 },
    spectrum: 'Gram-negative aerobes. Gram-positive use is synergy only (with a cell-wall agent, for example in enterococcal endocarditis). Poor penetration into lung, CSF, and acidic abscesses.',
    ae: 'Nephrotoxicity, irreversible ototoxicity, neuromuscular blockade.' },
  tobramycin: { name: 'Tobramycin', abbr: 'TOB', cls: 'aminoglycosides',
    cov: { pseudo: 2, ecoli: 2, esbl: 1 },
    tox: { renal: 14, gut: 1 }, site: { cns: 0.2, lung: 0.5, abdomen: 0.5, urine: 1.25 },
    spectrum: 'The most active aminoglycoside against Pseudomonas. Usually part of combination therapy.',
    ae: 'Nephrotoxicity, ototoxicity.' },
  amikacin: { name: 'Amikacin', abbr: 'AMK', cls: 'aminoglycosides',
    cov: { pseudo: 2, ecoli: 2, esbl: 2, cre: 1, acineto: 1 },
    tox: { renal: 12, gut: 1 }, site: { cns: 0.2, lung: 0.5, abdomen: 0.5, urine: 1.25 },
    spectrum: 'Most resistant to aminoglycoside-modifying enzymes, so it often works when gentamicin and tobramycin fail. Also used for mycobacteria.',
    ae: 'Nephrotoxicity, ototoxicity.' },

  // ---------------- Fluoroquinolones ----------------
  ciprofloxacin: { name: 'Ciprofloxacin', abbr: 'CIP', cls: 'fluoroquinolones',
    cov: { pseudo: 2, ecoli: 2, hflu: 2, legion: 2, nmen: 1, esbl: 1, mssa: 1, myco: 1 },
    tox: { renal: 0, gut: 10 }, site: { cns: 0.75 },
    spectrum: 'Gram-negatives including Pseudomonas (the only oral anti-pseudomonal class). Poor pneumococcal activity, so it is not a "respiratory" FQ. Gonorrhea resistance is widespread.',
    ae: 'Tendinopathy, QT prolongation, dysglycemia, CNS effects, C. diff. Chelated by cations.' },
  levofloxacin: { name: 'Levofloxacin', abbr: 'LVX', cls: 'fluoroquinolones',
    cov: { spneumo: 3, legion: 3, myco: 2, hflu: 2, ecoli: 2, pseudo: 2, mssa: 1, gas: 1, steno: 2, esbl: 1, nmen: 1 },
    tox: { renal: 0, gut: 10 }, site: { cns: 0.75 },
    spectrum: 'Respiratory fluoroquinolone. Pneumococcus plus atypicals plus gram-negatives (including some Pseudomonas). Monotherapy option for CAP.',
    ae: 'Tendinopathy, QT prolongation, dysglycemia, C. diff.' },
  moxifloxacin: { name: 'Moxifloxacin', abbr: 'MXF', cls: 'fluoroquinolones',
    cov: { spneumo: 3, legion: 3, myco: 2, hflu: 2, ecoli: 2, bfrag: 1, mssa: 1, gas: 1 },
    tox: { renal: 0, gut: 10 }, site: { urine: 0.3, cns: 0.75 },
    spectrum: 'Respiratory FQ with some anaerobic activity. No Pseudomonas. Not renally excreted, so it is a poor choice for UTI.',
    ae: 'Most QT prolongation of the class. Hepatotoxicity.' },

  // ---------------- Macrolides ----------------
  azithromycin: { name: 'Azithromycin', abbr: 'AZM', cls: 'macrolides',
    cov: { myco: 3, legion: 3, hflu: 1, spneumo: 1, gas: 1, ngono: 1, mssa: 1 },
    tox: { renal: 0, gut: 3 }, site: { cns: 0.25, urine: 0.5, blood: 0.6 },
    spectrum: 'Atypicals (Mycoplasma, Legionella, Chlamydia). Pneumococcal macrolide resistance runs about 30-40% in the US, so it is not reliable alone for typical CAP.',
    ae: 'QT prolongation, GI upset. Few drug interactions (unlike clarithromycin).' },
  clarithromycin: { name: 'Clarithromycin', abbr: 'CLR', cls: 'macrolides',
    cov: { myco: 2, legion: 2, spneumo: 1, hflu: 1, gas: 1, mssa: 1 },
    tox: { renal: 0, gut: 4 }, site: { cns: 0.25 },
    spectrum: 'Atypicals, H. pylori regimens, MAC. Similar spectrum to azithromycin.',
    ae: 'Strong CYP3A4 inhibitor (many interactions), QT prolongation, metallic taste.' },
  fidaxomicin: { name: 'Fidaxomicin', abbr: 'FDX', cls: 'macrolides',
    cov: { cdiff: 3 },
    tox: { renal: 0, gut: 0 }, site: SYSTEMIC_ZERO,
    spectrum: 'Narrow-spectrum macrocycle that is minimally absorbed. Preferred for C. difficile (lower recurrence) and spares the normal flora.',
    ae: 'Minimal. Expensive.' },

  // ---------------- Tetracyclines ----------------
  doxycycline: { name: 'Doxycycline', abbr: 'DOX', cls: 'tetracyclines',
    cov: { myco: 2, legion: 2, mrsa: 2, mssa: 2, spneumo: 1, hflu: 1, gas: 1, steno: 1 },
    tox: { renal: 0, gut: 2 }, site: { cns: 0.5, urine: 0.5 },
    spectrum: 'Atypicals, community MRSA skin infections, tick-borne disease (Rickettsia, Lyme), Chlamydia. Unreliable against Group A strep.',
    ae: 'Photosensitivity, pill esophagitis, tooth discoloration in young children. Chelated by cations.' },
  minocycline: { name: 'Minocycline', abbr: 'MIN', cls: 'tetracyclines',
    cov: { mrsa: 2, mssa: 2, steno: 2, acineto: 2, gas: 1, spneumo: 1, myco: 1 },
    tox: { renal: 0, gut: 2 }, site: { cns: 0.5, urine: 0.5 },
    spectrum: 'More lipophilic than doxycycline. MRSA, plus IV use against Acinetobacter and Stenotrophomonas.',
    ae: 'Vestibular toxicity (dizziness), skin pigmentation, drug-induced lupus.' },
  tigecycline: { name: 'Tigecycline', abbr: 'TGC', cls: 'tetracyclines',
    cov: { mrsa: 2, vre: 2, esbl: 2, acineto: 2, bfrag: 2, mssa: 2, gas: 2, ecoli: 2, cre: 1, steno: 1, myco: 1, legion: 1, spneumo: 2, efaecalis: 2, hflu: 1 },
    tox: { renal: 0, gut: 5 }, site: { blood: 0.4, urine: 0.3, cns: 0.25 },
    spectrum: 'Glycylcycline. Very broad (MRSA, VRE, ESBL, Acinetobacter, anaerobes) but not Pseudomonas or Proteus. A huge volume of distribution means low serum and urine levels: avoid it in bacteremia and UTI.',
    ae: 'Nausea and vomiting. Boxed warning for increased all-cause mortality.' },

  // ---------------- Lincosamides ----------------
  clindamycin: { name: 'Clindamycin', abbr: 'CLI', cls: 'lincosamides', antitoxin: true,
    cov: { gas: 3, mssa: 2, mrsa: 1, bfrag: 1, spneumo: 1 },
    tox: { renal: 0, gut: 18 }, site: { cns: 0.2, urine: 0.5 },
    spectrum: 'Gram-positives and oral anaerobes. Added for toxin suppression in necrotizing fasciitis and toxic shock. B. fragilis and MRSA resistance (including inducible "D-test") limit it. No aerobic gram-negative activity.',
    ae: 'The classic C. difficile culprit. Diarrhea.' },

  // ---------------- Folate antagonists ----------------
  tmpsmx: { name: 'Trimethoprim-sulfamethoxazole', abbr: 'SXT', cls: 'folate',
    cov: { steno: 3, mrsa: 2, mssa: 2, ecoli: 2, listeria: 2, hflu: 2, gas: 1, spneumo: 1, esbl: 1 },
    tox: { renal: 4, gut: 3 }, site: { cns: 0.75 },
    spectrum: 'Drug of choice for Stenotrophomonas (and PJP). Community MRSA skin infections, UTIs (about 20% E. coli resistance), Listeria alternative. No Pseudomonas, anaerobes, or reliable enterococcal activity.',
    ae: 'Hyperkalemia, false creatinine rise, SJS/TEN, marrow suppression, warfarin interaction.' },

  // ---------------- Nitroimidazoles ----------------
  metronidazole: { name: 'Metronidazole', abbr: 'MTZ', cls: 'nitroimidazoles',
    cov: { bfrag: 3, cdiff: 1 },
    tox: { renal: 0, gut: 2 }, site: {},
    spectrum: 'Anaerobes (B. fragilis below the diaphragm) and protozoa (Giardia, Trichomonas, amoeba). No aerobic activity. No longer first-line for C. difficile.',
    ae: 'Disulfiram-like reaction with alcohol, metallic taste, peripheral neuropathy. Raises the INR on warfarin.' },

  // ---------------- Polymyxins ----------------
  colistin: { name: 'Colistin', abbr: 'CST', cls: 'polymyxins',
    cov: { pseudo: 2, acineto: 2, cre: 2, esbl: 2, ecoli: 2 },
    tox: { renal: 22, gut: 1 }, site: { lung: 0.5, cns: 0.2 },
    spectrum: 'Last-line gram-negative agent (given as the prodrug CMS). Converted and cleared renally, so it is the preferred polymyxin for UTI. No gram-positive activity. Proteus, Serratia and Burkholderia are intrinsically resistant.',
    ae: 'Severe nephrotoxicity, neurotoxicity.' },
  polymyxinB: { name: 'Polymyxin B', abbr: 'PMB', cls: 'polymyxins',
    cov: { pseudo: 2, acineto: 2, cre: 2, esbl: 2, ecoli: 2 },
    tox: { renal: 18, gut: 1 }, site: { lung: 0.5, cns: 0.2, urine: 0.3 },
    spectrum: 'Same spectrum as colistin and given as the active drug. It is not renally excreted, so urine levels are poor: avoid it for UTI.',
    ae: 'Nephrotoxicity (somewhat less than colistin), neurotoxicity, skin hyperpigmentation.' },

  // ---------------- Nitrofurans ----------------
  nitrofurantoin: { name: 'Nitrofurantoin', abbr: 'NIT', cls: 'nitrofurans',
    cov: { ecoli: 3, esbl: 2, efaecalis: 2, vre: 1, mssa: 1 },
    tox: { renal: 0, gut: 1 }, site: ONLY_URINE,
    spectrum: 'First-line for uncomplicated cystitis, often still active against ESBL E. coli and enterococci. Reaches therapeutic levels only in the bladder, so it has no role in pyelonephritis or bacteremia.',
    ae: 'Avoid if CrCl <30. Pulmonary fibrosis, hepatotoxicity with chronic use.' },
};

IDM.PARTS = [
  { id: 'head', name: 'Head', role: 'Targeting Sensor', mult: 0.8, cd: 0,
    desc: '0.8x damage, fires every turn. Precision lock: drug-of-choice hits do 1.5x.' },
  { id: 'torso', name: 'Torso', role: 'Core Cannon', mult: 1.8, cd: 2,
    desc: '1.8x damage. Needs 2 turns to recharge.' },
  { id: 'rarm', name: 'Right Arm', role: 'Primary Weapon', mult: 1.0, cd: 0,
    desc: '1.0x damage, fires every turn.' },
  { id: 'larm', name: 'Left Arm', role: 'Secondary Weapon', mult: 1.0, cd: 0,
    desc: '1.0x damage, fires every turn.' },
  { id: 'legs', name: 'Legs', role: 'Mobility Frame', mult: 1.0, cd: 1,
    desc: '1.0x damage, then evasive: 50% chance to dodge each attack this enemy phase. 1-turn recharge.' },
];

IDM.SITES = {
  lung: { name: 'Lung', icon: '🫁' },
  cns: { name: 'CNS', icon: '🧠' },
  urine: { name: 'Bladder', icon: '💧' },
  blood: { name: 'Bloodstream', icon: '🩸' },
  skin: { name: 'Skin / Soft Tissue', icon: '🩹' },
  bone: { name: 'Bone', icon: '🦴' },
  abdomen: { name: 'Abdomen', icon: '🫃' },
  gut: { name: 'Colon Lumen', icon: '🌀' },
  sinus: { name: 'Sinus / Ear', icon: '👃' },
  genital: { name: 'Genital Tract', icon: '⚧' },
};

IDM.drugClass = function (drugId) {
  var d = IDM.DRUGS[drugId];
  for (var i = 0; i < IDM.CLASSES.length; i++) if (IDM.CLASSES[i].id === d.cls) return IDM.CLASSES[i];
  return null;
};
IDM.classById = function (id) {
  for (var i = 0; i < IDM.CLASSES.length; i++) if (IDM.CLASSES[i].id === id) return IDM.CLASSES[i];
  return null;
};
