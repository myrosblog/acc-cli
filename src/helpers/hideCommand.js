/**
 * Derives a command that behaves like its parent but is hidden from help and README.
 * Hidden commands stay callable, so scripts that already use them keep working.
 *
 * oclif registers `aliases` as visible even when their command is hidden, so they
 * are moved to `hiddenAliases`.
 *
 * @param {Function} ParentCommand - oclif command class to hide (typically from a plugin)
 * @returns {Function} Hidden subclass of ParentCommand
 */
export function hideCommand(ParentCommand) {
  return class HiddenCommand extends ParentCommand {
    static hidden = true;
    static aliases = [];
    static hiddenAliases = [
      ...(ParentCommand.aliases ?? []),
      ...(ParentCommand.hiddenAliases ?? []),
    ];
  };
}
