import SetCommand from "@adobe/aio-cli-plugin-config/src/commands/config/set.js";

// Overrides the aio plugin command (same id, so the root package wins) to document it as `acc`.
export default class ConfigSet extends SetCommand {
  static description = "Set a value in the authentication file ";

  // The plugin's `usage` entries carry inline comments, which oclif renders as the command title.
  static usage = undefined;
}
