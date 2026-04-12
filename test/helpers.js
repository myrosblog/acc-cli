import { DomUtil } from "@adobe/acc-js-sdk/src/domUtil.js";
import sinon from "sinon";

const makeClient = () => ({
  DomUtil: DomUtil,
});

const makeLogger = () => ({
  info: sinon.stub(),
  verbose: sinon.stub(),
  error: sinon.stub(),
  debug: sinon.stub(),
});

const makeSpinner = () => ({
  start() {
    return this;
  },
  succeed() {},
  fail() {},
  get text() {
    return "";
  },
  set text(_) {},
});

export { makeClient, makeLogger, makeSpinner };
