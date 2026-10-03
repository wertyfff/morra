// Publishes the built site (dist/) to the `gh-pages` branch, which GitHub Pages serves.
// Run with `npm run deploy` (it builds first). The branch holds only the build output and is
// overwritten on every deploy; the source lives on `main`.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const read = (cmd, cwd) => execSync(cmd, { cwd }).toString().trim();

if (!existsSync(`${dist}index.html`)) throw new Error('dist/ is empty: run the build first');
const remote = read('git remote get-url origin', root);
const name = read('git config user.name', root);
const email = read('git config user.email', root);

// tells GitHub Pages to serve the files as they are, without running Jekyll over them
writeFileSync(`${dist}.nojekyll`, '');
rmSync(`${dist}.git`, { recursive: true, force: true });
run('git init --quiet --initial-branch=gh-pages', dist);
run(`git config user.name "${name}"`, dist);
run(`git config user.email "${email}"`, dist);
run('git add --all', dist);
run('git commit --quiet -m "Deploy site"', dist);
run(`git push --force --quiet "${remote}" gh-pages`, dist);
rmSync(`${dist}.git`, { recursive: true, force: true });
console.log('Deployed to the gh-pages branch.');
