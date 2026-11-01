// Fails when a dependency shared with @adobe/aio-cli differs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const AIO_PACKAGE = "@adobe/aio-cli";

// Accepted drifts and their reason
const EXCEPTIONS = {
  chalk: "chalk 5 is ESM only, aio-cli is CommonJS and acc is ESM",
  ora: "ora 6 is ESM only, aio-cli is CommonJS and acc is ESM",
};

const ownPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);
const aioPackage = JSON.parse(
  execFileSync(
    "npm",
    ["view", AIO_PACKAGE, "dependencies", "devDependencies", "--json"],
    { encoding: "utf8" },
  ),
);
const own = { ...ownPackage.dependencies, ...ownPackage.devDependencies };
const aio = { ...aioPackage.dependencies, ...aioPackage.devDependencies };

// "^9.39.5" -> "9", "^0.13.0" -> "0.13": below 1.0.0 each minor may break
const releaseLineOf = (range) => range.match(/0\.\d+|\d+/)?.[0];

const shared = Object.keys(own).filter((name) => name in aio);
const isAligned = (name) =>
  releaseLineOf(own[name]) === releaseLineOf(aio[name]);
const drifts = shared.filter(
  (name) => !isAligned(name) && !(name in EXCEPTIONS),
);

for (const name of shared) {
  const versions = `${name}: acc ${own[name]}, aio-cli ${aio[name]}`;
  if (isAligned(name)) {
    console.log(`ok    ${versions}`);
  } else if (name in EXCEPTIONS) {
    console.log(`skip  ${versions} (${EXCEPTIONS[name]})`);
  } else {
    console.log(`DRIFT ${versions}`);
  }
}

if (drifts.length > 0) {
  console.error(`Align ${drifts.join(", ")} with ${AIO_PACKAGE}.`);
  process.exitCode = 1;
}
