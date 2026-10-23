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
            "AccAuth",
            "AccConfig",
            "AioLogger",
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
      // AccAuth._stage returns whatever the wrapped stage returns, so a
      // narrower type would be wrong.
      "jsdoc/reject-any-type": "off",
      "jsdoc/reject-function-type": "off",
      // Flags a description that only repeats the name it describes
      "jsdoc/informative-docs": "warn",
    },
  },

  // Services and helpers document every function and method. Constructors and
  // the run() of commands are left out: their params and name say enough.
  {
    files: ["src/services/**/*.js", "src/helpers/**/*.js"],
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          checkConstructors: false,
        },
      ],
    },
  },

  // Node built-ins are imported with the `node:` prefix
  {
    files: ["src/**/*.js"],
    rules: { "n/prefer-node-protocol": "warn" },
  },

  // Airbnb rules that neostandard leaves out or loosens
  {
    files: ["src/**/*.js"],
    rules: {
      "no-shadow": "warn",
      // neostandard checks no function argument (`args: "none"`)
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "after-used", ignoreRestSiblings: true },
      ],
      // Result goes to this.log (stdout), diagnostics to the logger (stderr)
      "no-console": "warn",
      "no-loop-func": "warn",
      "default-case": "warn",
      "guard-for-in": "warn",
      "no-useless-concat": "warn",
      "max-classes-per-file": ["warn", 1],
      "prefer-destructuring": [
        "warn",
        {
          VariableDeclarator: { array: false, object: true },
          AssignmentExpression: { array: true, object: false },
        },
        { enforceForRenamedProperties: false },
      ],
      "spaced-comment": [
        "warn",
        "always",
        {
          line: { exceptions: ["-", "+"], markers: ["=", "!", "/"] },
          block: {
            exceptions: ["-", "+"],
            markers: ["=", "!", ":", "::"],
            balanced: true,
          },
        },
      ],
      // Airbnb sets these terms but leaves the rule off. AGENTS.md: no TODO or FIXME.
      "no-warning-comments": [
        "warn",
        { terms: ["todo", "fixme", "xxx"], location: "start" },
      ],
      "no-duplicate-imports": "warn",
    },
  },

  // Strict rules, starting with helpers, then will be extended to src/
  {
    files: [
      "src/helpers/**/*.js",
      "src/commands/**/*.js",
      "src/adapters/**/*.js",
    ],
    rules: {
      // ESLint's default thresholds.
      complexity: "warn",
      "max-depth": "warn",
      "max-lines-per-function": [
        "warn",
        { skipBlankLines: true, skipComments: true },
      ],
      // Airbnb additional rules
      "consistent-return": "warn",
      "default-param-last": "warn",
      "no-await-in-loop": "warn",
      "no-else-return": ["warn", { allowElseIf: false }],
      "no-lonely-if": "warn",
      "no-multi-assign": "warn",
      "no-nested-ternary": "warn",
      // Without Airbnb's exemptions for req, res, ctx...
      "no-param-reassign": ["warn", { props: true }],
      "no-promise-executor-return": "warn",
      "no-template-curly-in-string": "warn",
      "no-unneeded-ternary": ["warn", { defaultAssignment: false }],
      "no-useless-return": "warn",
      "prefer-object-spread": "warn",
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
