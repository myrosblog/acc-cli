import { AioCoreSDKErrorWrapper } from "@adobe/aio-lib-core-errors";
const { ErrorWrapper, createUpdater } = AioCoreSDKErrorWrapper;

const codes = {};
const messages = new Map();

/**
 * Create an Updater for the Error wrapper
 */
const Updater = createUpdater(codes, messages);

/**
 * Custom error
 */
const E = ErrorWrapper(
  // The class name for your SDK Error. Your Error objects will be these objects
  "AccError",
  // The name of your SDK. This will be a property in your Error objects
  "acc",
  // the object returned from the CreateUpdater call above
  Updater,
  // the base class that your Error class is extending. AioCoreSDKError is the default
  /* , AioCoreSDKError */
);

function wrapSdkError(error, ErrorClass, context = {}) {
  return new ErrorClass({
    sdkDetails: {
      ...context,

      // extraction CampaignException
      statusCode: error?.statusCode,
      faultCode: error?.faultCode,
      errorCode: error?.errorCode,
      faultString: error?.faultString,
      method: error?.methodCall?.methodName,
      urn: error?.methodCall?.urn,
    },
    cause: error,
  });
}

// AUTH
E("AUTH_CONSTR_SDK_MISSING", "SDK required to initialize CampaignAuth.");
E(
  "AUTH_INIT_EXISTING_ALIAS",
  "Instance with alias already exists. Use 'acc config get acc.auth.instances' to see all configured instances.",
);
E(
  "AUTH_LOGIN_ALIAS_MISSING",
  "Instance with alias not found. Use 'acc config get acc.auth.instances' to see all configured instances.",
);
E(
  "AUTH_LOGIN_ALIAS_EMPTY",
  "Login failed: alias empty. Use 'acc config get acc.auth.instances' to see the path to the authentication file.",
);
E(
  "AUTH_LOGIN_ALIAS_INVALID",
  "Login failed: alias invalid. Use 'acc config get acc.auth.instances' to see the path to the authentication file.",
);
E(
  "AUTH_LOGIN_SDK_CONNECTIONPARAMETERS_FAILED",
  "Login failed: Invalid connection parameters. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "AUTH_LOGIN_SDK_INIT_FAILED",
  "Login failed: SDK.init error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "AUTH_LOGIN_SDK_LOGON_FAILED",
  "Login failed: SDK.logon error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "AUTH_LOGIN_SDK_SERVERINFO_FAILED",
  "Login failed: Getting server info error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "AUTH_LOGIN_SDK_SERVERINFO_EMPTY",
  "Login failed: Getting empty server info. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);

// CONFIG
E(
  "CONFIG_CONSTR_DEFAULT_PATH_MISSING",
  "defaultConfigPath is required for new CampaignConfig().",
);
E(
  "CONFIG_INIT_CONFIG_PATH_MISSING",
  "configPath is required for CampaignConfig.init().",
);
E("CONFIG_PARSE_ERROR", "Unable to parse the config file: %s");
E("CONFIG_VALIDATE_ERRORS", "Invalid config: %s");

// INSTANCE
E(
  "INSTANCE_PULL_SDK_XMLFROMJSON_FAILED",
  "Pull failed: unable to convert the JSON queryDef to XML. Review the queryDef in the pull logs with AIO_LOG_LEVEL=debug.",
);
E(
  "INSTANCE_PULL_SDK_CREATEQUERY_FAILED",
  "Pull failed: unable to create SDK query. Review the queryDef in the pull logs with AIO_LOG_LEVEL=debug.",
);
E(
  "INSTANCE_PULL_SDK_SELECTALL_FAILED",
  "Pull failed: unable to select all fields with SDK query. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_PULL_SDK_EXECUTEQUERY_FAILED",
  "Pull failed: unable to execute SDK query. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_EXEC_NO_SCRIPT",
  "Exec failed: no script provided. Use --file <path> or --script <code>.",
);
E(
  "INSTANCE_EXEC_BOTH_SCRIPT",
  "Exec failed: --file and --script are mutually exclusive. Provide only one.",
);
E("INSTANCE_EXEC_FILE_NOT_FOUND", "Exec failed: script file not found: %s");
E(
  "INSTANCE_EXEC_SDK_EVALUATE_FAILED",
  "Exec failed: server-side EvaluateJavaScript error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);

export { codes, messages, wrapSdkError };
