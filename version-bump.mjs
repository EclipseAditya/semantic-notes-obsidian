import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.argv[2];
if (!targetVersion) {
  console.error("Please provide a target version");
  process.exit(1);
}

// Read minAppVersion from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
const currentVersion = manifest.version;

// Update manifest.json
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2));

// Update versions.json
let versions = {};
try {
  versions = JSON.parse(readFileSync("versions.json", "utf8"));
} catch (e) {
  console.log("Could not find versions.json, creating a new one");
}
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2));

console.log(`Updated version from ${currentVersion} to ${targetVersion}`);