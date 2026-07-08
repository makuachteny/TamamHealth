import path from 'node:path';

/**
 * Monorepo pre-commit config. Each app has its own eslint config and
 * node_modules, so we run eslint from *inside* the owning package on that
 * package's staged files. Type-checking runs at the project level (tsc needs
 * the whole tsconfig graph, so it can't be scoped to individual files) whenever
 * any of a package's TS files are staged.
 *
 * Covered: platform + website (the TS/Next apps where lint/type breakages have
 * bitten CI). Mobile is intentionally left out for now — it lints via
 * `expo lint`, which doesn't take file arguments the way lint-staged expects.
 *
 * Escape hatch: `git commit --no-verify` skips all of this for emergencies.
 */

const eslintFix = (pkg) => (files) => {
  const rel = files.map((f) => JSON.stringify(path.relative(pkg, f)));
  return `bash -c 'cd ${pkg} && npx eslint --fix ${rel.join(' ')}'`;
};

// Ignores the file list on purpose: tsc must see the whole project.
const typecheck = (pkg) => () => `bash -c 'cd ${pkg} && npx tsc --noEmit'`;

export default {
  'platform/**/*.{ts,tsx,js,jsx}': [eslintFix('platform'), typecheck('platform')],
  'website/**/*.{ts,tsx,js,jsx}': [eslintFix('website'), typecheck('website')],
};
