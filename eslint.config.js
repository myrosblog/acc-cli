// npm
import adobeConfig from "@adobe/eslint-config-aio-lib-config";
import globals from "globals";

// helper to turn off adobeConfig rules
const rulesOff = (prefix) =>
  Object.fromEntries(
    adobeConfig
      .flatMap((config) => Object.keys(config.rules ?? {}))
      .filter((rule) => rule.startsWith(prefix))
      .map((rule) => [rule, "off"]),
  );

// Turn off the eslint format rules (neostandard { noStyle: true }) because Prettier already formats
const stylisticRulesOff = rulesOff("@stylistic/");

/**
 * ESLint flat config: Adobe aio-lib-config (neostandard and eslint-plugin-jsdoc)
 */
export default [
  // Ignore list mirrors .prettierignore
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "dist/",
      "test/dist/",
      "test/mocks/",
    ],
  },

  // use adobeConfig as base, but turn off format rules
  ...adobeConfig,
  {
    rules: {
      ...stylisticRulesOff,
      // ESM resolves imports literally: a forgotten `.js` only fails at runtime
      "n/no-missing-import": "error",
      "n/no-extraneous-import": "error",
    },
  },

  // Turn off adobeConfig JSDoc outside of src/
  {
    files: ["bin/**", "test/**/*.js", "*.js", "scripts/**", ".github/**"],
    rules: rulesOff("jsdoc/"),
  },

  // acc
  {
    files: ["src/**/*.js"],
    rules: {
      "jsdoc/informative-docs": "warn",
      // Types that cannot be imported: AioLogger (aio-lib-core-logging),
      // Client, ConnectionParameters, CampaignException, XtkSchema, XtkSchemaKey
      // (acc-js-sdk), Element, Document (@xmldom), NodeJS namespace (Node)
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
            "NodeJS",
            "PromptAdapter",
            "XtkSchema",
            "XtkSchemaKey",
          ],
        },
      ],

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

  // Tests
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
