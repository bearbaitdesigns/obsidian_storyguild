#!/usr/bin/env node
// Bump the plugin version in manifest.json and record it in versions.json.
// Usage: node scripts/bump.mjs 1.0.1            (stable release)
//        node scripts/bump.mjs 1.1.0-beta.1     (pre-release for BRAT beta testers; not added to versions.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version || '')) {
  console.error('Usage: node scripts/bump.mjs <version>   e.g. 1.0.1 or 1.1.0-beta.1');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.version = version;
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

if (!version.includes('-')) {
  const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
  versions[version] = manifest.minAppVersion;
  writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
}

execSync('node scripts/build.mjs', { stdio: 'inherit' });

console.log(`Version set to ${version} and main.js rebuilt. Next:
  git commit -am "Release ${version}"
  git tag ${version}
  git push && git push origin ${version}`);
