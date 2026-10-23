// npm
import neostandard from "neostandard";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

const jsdocRecommended = jsdoc.configs["flat/recommended"];

/**
 * ESLint flat config: neostandard and eslint-plugin-jsdoc
 */
export default [
  // Mirrors .prettierignore
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "dist/",
      "test/dist/",
      "test/mocks/",
      "scripts/",
    ],
  },

  // Correctness half of standard. Prettier formats, and there is no JSX.
  ...neostandard({ noStyle: true, noJsx: true }),
  {
    // ESM resolves imports literally: a forgotten `.js` only fails at runtime
    rules: {
      "n/no-missing-import": "error",
      "n/no-extraneous-import": "error",
    },
  },

  // src: Airbnb and neostandard
  {
    files: ["src/**/*.js"],
    ...jsdocRecommended,
    // @private blocks are internal notes, as in the Adobe config
    settings: { jsdoc: { ignorePrivate: true } },
    rules: {
      ...jsdocRecommended.rules,
      "jsdoc/tag-lines": ["warn", "never", { startLines: null }],
      "jsdoc/informative-docs": "warn",
      // Types that cannot be imported: AioLogger (aio-lib-core-logging),
      // Client, ConnectionParameters, CampaignException, XtkSchema, XtkSchemaKey
      // (acc-js-sdk), Element, Document (@xmldom), NodeJS.ReadStream (Node)
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
      // {Function} types the injected factories (AGENTS.md), and {*} the
      // return of AccAuth._stage
      "jsdoc/reject-any-type": "off",
      "jsdoc/reject-function-type": "off",

      "n/prefer-node-protocol": "warn",
      "no-shadow": "warn",
      // neostandard checks no function argument (`args: "none"`)
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "after-used", ignoreRestSiblings: true },
      ],
      // The result goes to this.log (stdout), diagnostics to the logger (stderr)
      "no-console": "warn",
      "no-loop-func": "warn",
      "default-case": "warn",
      "guard-for-in": "warn",
      "no-useless-concat": "warn",
      "no-duplicate-imports": "warn",
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
      // no TODO or FIXME
      "no-warning-comments": [
        "warn",
        { terms: ["todo", "fixme", "xxx"], location: "start" },
      ],
    },
  },

  // Stricter rules for JSDoc
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

  // Stricter rules, to extend to src/services once its long functions are split
  {
    files: [
      "src/helpers/**/*.js",
      "src/commands/**/*.js",
      "src/adapters/**/*.js",
    ],
    rules: {
      // ESLint's default thresholds
      complexity: "warn",
      "max-depth": "warn",
      "max-lines-per-function": [
        "warn",
        { skipBlankLines: true, skipComments: true },
      ],
      // Airbnb
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
    // Mocha injects describe/it/before, and test/index.js sets a global expect
    files: ["test/**/*.js"],
    languageOptions: {
      globals: { ...globals.mocha, expect: "readonly" },
    },
    rules: {
      // Chai asserts through property access (`expect(x).to.be.true`), which
      // this rule reads as a statement with no effect
      "no-unused-expressions": "off",
    },
  },
];
