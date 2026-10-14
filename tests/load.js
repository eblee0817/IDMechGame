// Loads the browser data/engine scripts into Node's global scope.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
['js/data/drugs.js', 'js/data/organisms.js', 'js/data/encounters.js', 'js/data/relics.js', 'js/game.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
});
module.exports = globalThis.IDM;
