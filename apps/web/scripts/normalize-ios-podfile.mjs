/**
 * Capacitor `cap sync ios` rewrites Podfile paths to Bun's hashed store.
 * Normalize them to workspace-stable `../../node_modules/<pkg>` symlinks
 * so CocoaPods resolves the same on every machine after `bun install`.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const podfilePath = join(root, 'ios/App/Podfile');
const webNodeModules = join(root, 'node_modules');

if (!existsSync(podfilePath)) {
  console.warn('[normalize-ios-podfile] Podfile missing — skip');
  process.exit(0);
}

/** Map CocoaPods pod name → npm package path under apps/web/node_modules. */
function discoverPodPackages() {
  const map = new Map([
    ['Capacitor', '@capacitor/ios'],
    ['CapacitorCordova', '@capacitor/ios'],
  ]);

  const scopes = ['@capacitor', '@capacitor-mlkit', '@capgo'];
  for (const scope of scopes) {
    const scopeDir = join(webNodeModules, scope);
    if (!existsSync(scopeDir)) continue;
    for (const name of readdirSync(scopeDir)) {
      const pkgDir = join(scopeDir, name);
      const pkgJsonPath = join(pkgDir, 'package.json');
      if (!existsSync(pkgJsonPath)) continue;
      let podspecName = null;
      try {
        const specs = readdirSync(pkgDir).filter((f) => f.endsWith('.podspec'));
        if (specs[0]) {
          podspecName = specs[0].replace(/\.podspec$/, '');
        }
      } catch {
        // ignore
      }
      if (podspecName) {
        map.set(podspecName, `${scope}/${name}`);
      }
    }
  }
  return map;
}

let text = readFileSync(podfilePath, 'utf8');

text = text.replace(
  /require_relative\s+'[^']*pods_helpers'/,
  "require_relative '../../node_modules/@capacitor/ios/scripts/pods_helpers'",
);

text = text.replace(/platform\s+:ios,\s*'[^']+'/, "platform :ios, '15.5'");

const packages = discoverPodPackages();
for (const [podName, npmPath] of packages) {
  const re = new RegExp(`pod\\s+'${podName}',\\s*:path\\s*=>\\s*'[^']+'`, 'g');
  text = text.replace(re, `pod '${podName}', :path => '../../node_modules/${npmPath}'`);
}

// Fallback: any remaining .bun hashed paths under a known node_modules package folder
text = text.replace(
  /:path\s*=>\s*'[^']*node_modules\/\.bun\/[^']+\/node_modules\/(@[^']+\/[^']+|[^'@][^']*)'/g,
  (_full, pkg) => `:path => '../../node_modules/${pkg}'`,
);

writeFileSync(podfilePath, text);
console.log(
  '[normalize-ios-podfile] Podfile paths normalized for Bun workspaces',
  `(${packages.size} known pods)`,
);
