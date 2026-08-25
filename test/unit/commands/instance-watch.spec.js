import { expect } from "chai";
import sinon from "sinon";
import CampaignAuth from "../../../src/CampaignAuth.js";
import CampaignConfig from "../../../src/CampaignConfig.js";
import CampaignWatch from "../../../src/CampaignWatch.js";
import InstanceWatch from "../../../src/commands/instance/watch.js";

describe("InstanceWatch", () => {
  it("should have correct description", () => {
    expect(InstanceWatch.description).to.include("Watch decomposed files");
    expect(InstanceWatch.description).to.include("acc.config.json");
  });

  it("should have correct examples", () => {
    expect(InstanceWatch.examples).to.be.an("array");
    expect(InstanceWatch.examples.length).to.be.at.least(1);
    expect(InstanceWatch.examples[0].command).to.include("instance watch");
    expect(InstanceWatch.examples[0].description).to.include("Watch");
  });

  it("should have inherited baseFlags from InstanceCommand", () => {
    expect(InstanceWatch.baseFlags.alias).to.exist;
    expect(InstanceWatch.baseFlags.path).to.exist;
    expect(InstanceWatch.baseFlags.config).to.exist;
  });

  it("should have debounce flag", () => {
    expect(InstanceWatch.flags.debounce).to.exist;
    expect(InstanceWatch.flags.debounce.description).to.include("debounce");
    expect(InstanceWatch.flags.debounce.default).to.equal(300);
  });

  it("should run and start watching", async () => {
    const argv = ["--alias", "test"];

    // Mock dependencies
    sinon.stub(CampaignAuth.prototype, "login").resolves({});

    sinon.stub(CampaignConfig.prototype, "init").resolves();

    // Mock CampaignConfig to return a config with schemas
    const configInstance = {
      schemas: [
        {
          schemaId: "xtk:javascript",
          filename:
            "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
          decompose: {
            data: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
          },
        },
      ],
      accJsSdkOptions: {},
      alias: "test",
      configPath: "/fake/path/acc.config.json",
    };

    // Mock the makeConfig method to return our config
    sinon.stub(InstanceWatch.prototype, "makeConfig").returns({
      init: () => Promise.resolve(),
      accJsSdkOptions: {},
      alias: "test",
      schemas: configInstance.schemas,
    });

    // Mock client
    const mockClient = {
      NLWS: {
        xml: {
          xtkSession: {
            write: sinon.stub().resolves({}),
          },
        },
      },
    };

    // Mock CampaignWatch
    sinon.stub(CampaignWatch.prototype, "startWatching").resolves();

    // Mock getInstance to return instance with client and config
    sinon.stub(InstanceWatch.prototype, "getInstance").resolves({
      client: mockClient,
      accConfig: configInstance,
    });

    // Run the command
    const result = await InstanceWatch.run(argv);

    expect(result).to.be.undefined;
    sinon.assert.calledOnce(CampaignWatch.prototype.startWatching);

    sinon.restore();
  });

  it("should run with custom debounce value", async () => {
    const argv = ["--alias", "test", "--debounce", "500"];

    sinon.stub(CampaignAuth.prototype, "login").resolves({});

    sinon.stub(CampaignConfig.prototype, "init").resolves();

    const configInstance = {
      schemas: [
        {
          schemaId: "xtk:javascript",
          filename:
            "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
          decompose: {
            data: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
          },
        },
      ],
      accJsSdkOptions: {},
      alias: "test",
      configPath: "/fake/path/acc.config.json",
    };

    const mockClient = {
      NLWS: {
        xml: {
          xtkSession: {
            write: sinon.stub().resolves({}),
          },
        },
      },
    };

    sinon.stub(CampaignWatch.prototype, "startWatching").resolves();

    sinon.stub(InstanceWatch.prototype, "getInstance").resolves({
      client: mockClient,
      accConfig: configInstance,
    });

    const result = await InstanceWatch.run(argv);

    expect(result).to.be.undefined;
    sinon.assert.calledOnce(CampaignWatch.prototype.startWatching);

    // Check that custom debounce was passed
    sinon.assert.calledWith(CampaignWatch.prototype.startWatching, 500);

    sinon.restore();
  });

  it("should exit with error when startWatching throws", async () => {
    const argv = ["--alias", "test"];

    sinon.stub(CampaignAuth.prototype, "login").resolves({});

    sinon.stub(CampaignConfig.prototype, "init").resolves();

    const configInstance = {
      schemas: [], // No schemas with decompose
      accJsSdkOptions: {},
      alias: "test",
      configPath: "/fake/path/acc.config.json",
    };

    const mockClient = {
      NLWS: {
        xml: {
          xtkSession: {
            write: sinon.stub().resolves({}),
          },
        },
      },
    };

    // Mock CampaignWatch to throw error
    const error = new Error("No schemas with 'decompose' configuration found");
    sinon.stub(CampaignWatch.prototype, "startWatching").rejects(error);

    sinon.stub(InstanceWatch.prototype, "getInstance").resolves({
      client: mockClient,
      accConfig: configInstance,
    });

    // Mock logger.error
    const loggerErrorStub = sinon.stub();
    sinon.stub(InstanceWatch.prototype, "logger").get(() => ({
      error: loggerErrorStub,
    }));

    // Mock process.exit
    const processExitStub = sinon.stub(process, "exit");

    try {
      await InstanceWatch.run(argv);
      expect.fail("Should have exited with error");
    } catch {
      // May or may not throw
    } finally {
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(processExitStub.calledWith(1)).to.be.true;
      sinon.restore();
    }
  });

  it("should handle SIGINT gracefully", async () => {
    const argv = ["--alias", "test"];

    sinon.stub(CampaignAuth.prototype, "login").resolves({});

    sinon.stub(CampaignConfig.prototype, "init").resolves();

    const configInstance = {
      schemas: [
        {
          schemaId: "xtk:javascript",
          filename:
            "/Admin/Config/JavaScript codes/{@namespace}/{@name}.meta.xml",
          decompose: {
            data: "/Admin/Config/JavaScript codes/{@namespace}/{@name}.js",
          },
        },
      ],
      accJsSdkOptions: {},
      alias: "test",
      configPath: "/fake/path/acc.config.json",
    };

    const mockClient = {
      NLWS: {
        xml: {
          xtkSession: {
            write: sinon.stub().resolves({}),
          },
        },
      },
    };

    sinon.stub(CampaignWatch.prototype, "startWatching").resolves();

    sinon.stub(InstanceWatch.prototype, "getInstance").resolves({
      client: mockClient,
      accConfig: configInstance,
    });

    // Mock process.on
    const onStub = sinon.stub(process, "on");

    // Run the command
    await InstanceWatch.run(argv);

    // Check that SIGINT handler was set up
    expect(onStub.calledWith("SIGINT")).to.be.true;

    sinon.restore();
  });
});
