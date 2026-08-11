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
  // The acc-js-sdk throws a CampaignException whose real reason is in
  // `faultString` (the SOAP <faultstring>) or `errorCode`. aio's ErrorWrapper
  // DROPS `cause` and never prints `sdkDetails`, so on its own the server's
  // message is swallowed. Fold it into the message via messageValues: aio fills
  // a trailing `%s` or, when the template has none, appends it after a space —
  // so every wrapped SDK error now surfaces the underlying server fault.
  const detail =
    error?.faultString || error?.errorCode || error?.message || undefined;
  return new ErrorClass({
    messageValues: detail ? [detail] : [],
    sdkDetails: {
      ...context,

      // extraction CampaignException
      statusCode: error?.statusCode,
      faultCode: error?.faultCode,
      errorCode: error?.errorCode,
      faultString: error?.faultString,
      // `detail` holds the actionable part (e.g. "WDB-200011 ... record does
      // not exist" + the SQL); faultString is often just a generic wrapper.
      detail: error?.detail,
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
E(
  "AUTH_LOGIN_TOKEN_MISSING",
  "Login failed: IMS bearer token missing for this instance. Re-run 'acc auth init' or update 'acc.auth.instances' with a valid token.",
);
E(
  "AUTH_LOGIN_IMS_CREDENTIALS_MISSING",
  "Login failed: incomplete IMS Server-to-Server credentials for this instance. Re-run 'acc auth init' with --client-id, --client-secret, --org-id and --scopes.",
);
E(
  "AUTH_LOGIN_IMS_TOKEN_GENERATION_FAILED",
  "Login failed: could not generate an IMS access token (OAuth Server-to-Server). Check the clientId/clientSecret/orgId/scopes stored in 'acc.auth.instances'. Cause:",
);
E(
  "AUTH_LOGIN_INVALID_METHOD",
  "Login failed: unknown authMethod. Expected 'UserPassword', 'ImsBearerToken' or 'ImsServerToServer'.",
);
E(
  "AUTH_INIT_INVALID_METHOD",
  "Init failed: unsupported auth method. Expected 'UserPassword', 'ImsBearerToken' or 'ImsServerToServer'.",
);
E(
  "AUTH_DECODE_INVALID",
  "Decode failed: not a valid JWT (expected 3 dot-separated base64url segments). Cause: %s",
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
E(
  "INSTANCE_ALIAS_UNRESOLVED",
  'No instance alias provided. Pass --alias <name> or set "alias" in acc.config.json.',
);
E(
  "INSTANCE_INFO_SDK_TESTCNX_FAILED",
  "Instance info failed: xtk:session#TestCnx error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_INFO_SDK_SERVERTIME_FAILED",
  "Instance info failed: xtk:session#GetServerTime error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_INFO_SDK_CNXINFO_FAILED",
  "Instance info failed: xtk:session#GetCnxInfo error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_INFO_SDK_DUMPSTATE_FAILED",
  "Instance info failed: nl:monitoring#DumpCurrentInstanceState error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_QUERYDEF_NO_QUERY",
  "queryDef failed: no query provided. Use --query <json> or --file <path>.",
);
E(
  "INSTANCE_QUERYDEF_BOTH_QUERY",
  "queryDef failed: --query and --file are mutually exclusive. Provide only one.",
);
E(
  "INSTANCE_QUERYDEF_FILE_NOT_FOUND",
  "queryDef failed: queryDef file not found: %s",
);
E(
  "INSTANCE_QUERYDEF_SDK_CREATE_FAILED",
  "queryDef failed: unable to create the SDK query (xtk:queryDef#create). Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_QUERYDEF_SDK_EXECUTE_FAILED",
  "queryDef failed: server-side xtk:queryDef#ExecuteQuery error. Add the config option 'acc-js-sdk.traceAPICalls' to troubleshoot.",
);
E(
  "INSTANCE_SOAP_NO_TARGET",
  "soap failed: --schema and --method are both required.",
);
E("INSTANCE_SOAP_BAD_ARGS", "soap failed: --args is not valid JSON: %s");
E(
  "INSTANCE_SOAP_ARGS_NOT_ARRAY",
  "soap failed: --args must be a JSON array, e.g. '[1234, \"<params/>\"]'.",
);
E(
  "INSTANCE_SOAP_SDK_CALL_FAILED",
  "soap failed: could not complete the SOAP call. Check --args (parameter count and types — pass XML parameters with --json so they serialize correctly); note that non-static methods (operating on a loaded entity) are not supported. Enable 'acc-js-sdk.traceAPICalls' for the full trace. Cause:",
);

// MONITOR
E(
  "MONITOR_HOST_UNRESOLVED",
  "No target instance. Pass --host <url> or --alias <name>.",
);
E(
  "MONITOR_ALIAS_UNKNOWN",
  "Unknown alias. Use 'acc auth list' to see configured instances.",
);
E(
  "MONITOR_TEST_FAILED",
  "Health check failed: could not reach /r/test. Note: this endpoint targets the Apache front server, not Tomcat (:8080).",
);

export { codes, messages, wrapSdkError };
