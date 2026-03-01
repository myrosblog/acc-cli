// packages
import { program, Command } from "commander";
import sdk from "@adobe/acc-js-sdk";
import Configstore from "configstore";
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Campaign
import CampaignError from "./CampaignError.js";
import CampaignAuth from "./CampaignAuth.js";
import CampaignInstance from "./CampaignInstance.js";

const dirMain = path.dirname(fileURLToPath(import.meta.url));
const dirPackage = path.resolve(dirMain, "..");

const authFile = new Configstore("campaign-cli.auth");
const auth = new CampaignAuth(sdk, authFile);
const defaultDistRoot = path.join(process.cwd());
const defaultConfigPath = path.join(process.cwd(), "acc.config.json"); // default config path in current working directory, if not specified

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
      .requiredOption("--password <pwd>", "Operator password")
      .action(async (options) => {
        try {
          await auth.init(options);
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
      .action(async (options) => {
        try {
          await auth.login(options);
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
        "--verbose",
        "Verbose output with details on each configuration item. Defaults to false.",
        false,
      )
      .action(async (options) => {
        try {
          // if the config file doesn't exist at the default location, copy the example config there
          if (
            options.config == defaultConfigPath &&
            !fs.existsSync(options.config)
          ) {
            console.log(
              `🛠️ Config not found, initalializing ${options.config}`,
            );
            fs.copySync(
              path.join(dirPackage, "config", "acc.config.json"),
              options.config,
            );
          } else {
            console.log(`🛠️ Using config ${options.config}`);
          }
          const campaignConfig = JSON.parse(fs.readFileSync(options.config));
          const client = await auth.login({ alias: options.alias });
          const instance = new CampaignInstance(
            client,
            campaignConfig,
            options,
          );
          await instance.check(options);
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
      .action(async (options) => {
        try {
          const campaignConfig = JSON.parse(fs.readFileSync(options.config));
          const client = await auth.login({ alias: options.alias });
          const instance = new CampaignInstance(
            client,
            campaignConfig,
            options,
          );
          await instance.pull(options.path);
        } catch (err) {
          handleCampaignError(err);
        }
      }),
  );

program.parse(process.argv);

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
