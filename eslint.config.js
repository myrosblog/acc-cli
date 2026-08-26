// npm
import neostandard from "neostandard";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

/**
 * ESLint flat config.
 *
 * Based on `adobe/aio-cli` that imports `@adobe/eslint-config-aio-lib-config`
 * But recreated here because it enables the standard style, which contradicts
 * .prettierrc.json on semicolons and quotes, and it configures Jest where this
 * repo runs Mocha. The two parts worth reusing are taken directly instead:
 * neostandard without its style rules, and eslint-plugin-jsdoc.
 */
export default [
  {
    // Mirrors .prettierignore. `dist` is not optional: dist/logs/*.js hold
    // server-side Campaign scripts written in E4X (`context.@result = ...`),
    // which no JavaScript parser can read.
    ignores: [
      "node_modules/",
      "coverage/",
      "dist/",
      "test/dist/",
      "test/mocks/",
      "scripts/",
    ],
  },

  // Correctness half of standard: the n (Node), promise and core rules.
  // `noStyle` leaves every formatting decision to Prettier, `noJsx` drops the
  // React block this CLI has no use for. Node globals and ESM module scope come
  // with it, so they are not repeated below.
  ...neostandard({ noStyle: true, noJsx: true }),
  {
    rules: {
      // ESM resolves relative imports literally, so a forgotten `.js` extension
      // only fails at runtime, inside whichever command imports the file.
      // Neither rule is part of the neostandard defaults.
      "n/no-missing-import": "error",
      "n/no-extraneous-import": "error",
    },
  },

  // The code is densely documented, so JSDoc drift is a real source of
  // misleading comments. flat/recommended ships every rule at `warn`, which is
  // the level to keep while the existing stock is brought up to date.
  // Scoped to src: a spec documents itself through its describe/it names.
  { files: ["src/**/*.js"], ...jsdoc.configs["flat/recommended"] },
  {
    files: ["src/**/*.js"],
    settings: {
      // Same choice as the Adobe config: @private blocks are internal notes.
      jsdoc: { ignorePrivate: true },
    },
    rules: {
      "jsdoc/tag-lines": ["warn", "never", { startLines: null }],
      // Types that exist but that a JS-only project cannot import:
      // - aio-lib-core-logging: AioLogger
      // - acc-js-sdk: Client, ConnectionParameters, CampaignException,
      //   XtkSchema, XtkSchemaKey
      // - @xmldom: Element, Document
      // - Node: DOM, NodeJS.ReadStream
      "jsdoc/no-undefined-types": [
        "warn",
        {
          definedTypes: [
            "AioLogger",
            "CampaignAuth",
            "CampaignConfig",
            "CampaignException",
            "Client",
            "ConnectionParameters",
            "Document",
            "Element",
            "NodeJS.ReadStream",
            "PromptAdapter",
            "XtkSchema",
            "XtkSchemaKey",
          ],
        },
      ],
      // {Function} describes the injected factories (makeCache, createSpinner),
      // which are the dependency injection convention of AGENTS.md. The {*} of
      // CampaignAuth._stage returns whatever the wrapped stage returns, so a
      // narrower type would be wrong.
      "jsdoc/reject-any-type": "off",
      "jsdoc/reject-function-type": "off",
    },
  },

  {
    // Mocha injects describe/it/before, and test/index.js sets a global expect.
    files: ["test/**/*.js"],
    languageOptions: {
      globals: { ...globals.mocha, expect: "readonly" },
    },
    rules: {
      // Chai asserts through property access (`expect(x).to.be.true`), which
      // this rule reads as a statement with no effect. Keeping it on would
      // report almost every assertion in the suite.
      "no-unused-expressions": "off",
    },
  },
];
