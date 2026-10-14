// Inlines CSS and JS into one self-contained HTML page (for hosting as a single file).
// Usage: node tools/bundle.js [out.html]
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'dist', 'spectrum-mech.html');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const scripts = ['js/data/drugs.js', 'js/data/organisms.js', 'js/data/encounters.js', 'js/data/relics.js', 'js/game.js', 'js/ui.js'];
const js = scripts.map((f) => '// ---- ' + f + '\n' + read(f)).join('\n').replace(/<\/script/gi, '<\\/script');
const html = `<title>Spectrum Mech</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="A roguelike mech game for learning antibiotic coverage.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
${read('css/style.css')}
</style>
<div id="app"></div>
<script>
${js}
</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
