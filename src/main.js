// packages
import { program, Command } from "commander";
import sdk from "@adobe/acc-js-sdk";
import Configstore from "configstore";
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Campaign
import CampaignConfig from "./CampaignConfig.js";
import CampaignError from "./CampaignError.js";
import CampaignAuth from "./CampaignAuth.js";
import CampaignInstance from "./CampaignInstance.js";

const dirMain = path.dirname(fileURLToPath(import.meta.url));
const dirPackage = path.resolve(dirMain, "..");
const packageJsonPath = path.join(dirPackage, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const authFile = new Configstore("campaign-cli.auth");
const auth = new CampaignAuth(sdk, authFile);
const defaultDistRoot = path.join(process.cwd());
const defaultConfigPath = path.join(process.cwd(), "acc.config.json"); // default config path in current working directory, if not specified
const config = new CampaignConfig(defaultConfigPath, dirPackage);

const vAcc = packageJson.version;
const vSdk = sdk.getSDKVersion().version;
console.log(`🏠 acc ${vAcc} initialized with Adobe Campaign SDK ${vSdk}`);
// blog post tracking
const homepage = packageJson.homepage.replace(
  "utm_campaign=package-json",
  "utm_campaign=acc-cli",
);

program
  .name("acc")
  .description(`${packageJson.description}. Documentation on ${homepage}`)
  .version(vAcc);

// AUTH
program
  .command("auth")
  // INIT
  .addCommand(
    new Command()
      .name("init")
      .requiredOption(
        "--alias <alias>",
        "Local alias for this instance, e.g. prod, staging, local",
      )
      .requiredOption(
        "--host <url>",
        "URL of Adobe Campaign root, e.g. http://localhost:8080",
      )
      .requiredOption("--user <user>", "Operator username")
      .requiredOption("--pass <pwd>", "Operator password")
      .action(async (cliOptions) => {
        try {
          await auth.init(cliOptions);
        } catch (err) {
          handleCampaignError(err);
        }
      }),
  )
  // LOGIN
  .addCommand(
    new Command()
      .name("login")
      .requiredOption(
        "--alias <alias>",
        "Local alias for this instance, e.g. prod, staging, local",
      )
      .action(async (cliOptions) => {
        try {
          await auth.login(cliOptions);
        } catch (err) {
          handleCampaignError(err);
        }
      }),
  )
  // LIST
  .addCommand(
    new Command().name("list").action(() => {
      try {
        auth.list();
      } catch (err) {
        handleCampaignError(err);
      }
    }),
  )
  // IP
  .addCommand(
    new Command().name("ip").action(async () => {
      try {
        await auth.ip();
      } catch (err) {
        handleCampaignError(err);
      }
    }),
  );

// INSTANCE
program
  .command("instance")
  // CHECK
  .addCommand(
    new Command()
      .name("check")
      .requiredOption(
        "--alias <alias>",
        "Local alias for this instance, e.g. prod, staging, local",
      )
      .option(
        "--path <path>",
        "Path where the command should run. Defaults to current working directory.",
        defaultDistRoot,
      )
      .option(
        "--config <path>",
        "Path to the configuration file. Defaults ./config/acc.config.json.",
        defaultConfigPath,
      )
      .option(
        "--metadata <schemasIds>",
        "Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation",
      )
      .option(
        "--verbose",
        "Verbose output with details on each configuration item. Defaults to false.",
        false,
      )
      .action(async (cliOptions) => {
        try {
          await pull(cliOptions, true);
        } catch (err) {
          handleCampaignError(err);
        }
      }),
  )
  // PULL
  .addCommand(
    new Command()
      .name("pull")
      .requiredOption(
        "--alias <alias>",
        "Local alias for this instance, e.g. prod, staging, local",
      )
      .option(
        "--path <path>",
        "Path where the command should run. Defaults to current working directory.",
        defaultDistRoot,
      )
      .option(
        "--config <path>",
        "Path to the configuration file. Defaults ./config/acc.config.json.",
        defaultConfigPath,
      )
      .option(
        "--metadata <schemasIds>",
        "Comma-separated list of schema ids to retrieve, e.g. nms:delivery,nms:operation",
      )
      .option(
        "--verbose",
        "Verbose output with details on each configuration item. Defaults to false.",
        false,
      )
      .action(async (cliOptions) => {
        try {
          await pull(cliOptions, false);
        } catch (err) {
          handleCampaignError(err);
        }
      }),
  );

program.parse(process.argv);

async function pull(cliOptions, isPreview) {
  config.init(cliOptions.config);
  const client = await auth.login(cliOptions, config.accJsSdkOptions);
  const instance = new CampaignInstance(client, config, cliOptions);
  await instance.pull(isPreview);
}

/**
 * Handles errors from Campaign CLI operations.
 * Distinguishes between CampaignError and other errors for appropriate handling.
 *
 * @param {Error} err - The error to handle
 * @returns {void}
 *
 * @example
 * try {
 *   await auth.login({ alias: 'prod' });
 * } catch (err) {
 *   handleCampaignError(err);
 * }
 */
function handleCampaignError(err) {
  if (err instanceof CampaignError) {
    console.error(`⚠️ Campaign warning: ${err.message}`);
  } else {
    throw err;
  }
  process.exit(1);
}
