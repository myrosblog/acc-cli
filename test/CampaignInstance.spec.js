import { expect } from "chai";
import sinon from "sinon";
import CampaignInstance from "../src/CampaignInstance.js";
import CampaignError from "../src/CampaignError.js";
import fs from "fs-extra";

describe("CampaignInstance", function () {
  let mockClient, mockConfig, instance;

  beforeEach(function () {
    // Mock client
    mockClient = {
      registerObserver: sinon.stub(),
      NLWS: {
        xtkQueryDef: {
          create: sinon.stub().returns({
            executeQuery: sinon.stub().resolves({ count: 10 }),
            selectAll: sinon.stub().resolves(),
            executeQuery: sinon.stub().resolves({
              // Mock DOMDocument
              childNodes: []
            })
          })
        },
        xml: {
          xtkQueryDef: {
            create: sinon.stub().returns({
              selectAll: sinon.stub().resolves(),
              executeQuery: sinon.stub().resolves({
                // Mock DOMDocument
                childNodes: []
              })
            })
          }
        }
      },
      DomUtil: {
        getFirstChildElement: sinon.stub().returns(null),
        getNextSiblingElement: sinon.stub().returns(null),
        getAttributeAsString: sinon.stub().returns(""),
        toXMLString: sinon.stub().returns("<test></test>"),
        fromJSON: sinon.stub().returns("<queryDef></queryDef>")
      }
    };

    // Mock campaign config
    mockConfig = {
      default: {
        filename: "%schema%_%name%.xml"
      },
      "nms:recipient": {
        filename: "recipient_%name%.xml"
      }
    };

    instance = new CampaignInstance(mockClient, mockConfig);
  });

  describe("constructor", function () {
    it("should initialize with client and config", function () {
      expect(instance.client).to.equal(mockClient);
      expect(instance.campaignConfig).to.equal(mockConfig);
      expect(instance.schemas).to.deep.equal(["nms:recipient"]);
    });

    it("should register observer on client", function () {
      expect(mockClient.registerObserver.calledOnce).to.be.true;
    });
  });

  describe("_getQueryDefForSchema", function () {
    it("should return default queryDef when schema has no config", function () {
      const baseQueryDef = { schema: "test:schema", operation: "count" };
      const result = instance._getQueryDefForSchema("test:schema", baseQueryDef);
      expect(result).to.deep.equal({ ...baseQueryDef, ...mockConfig.default.queryDef });
    });

    it("should merge schema-specific config with base queryDef", function () {
      const baseQueryDef = { schema: "nms:recipient", operation: "count" };
      const result = instance._getQueryDefForSchema("nms:recipient", baseQueryDef);
      expect(result).to.deep.equal({ ...baseQueryDef, ...mockConfig["nms:recipient"].queryDef });
    });
  });

  describe("check", function () {
    it("should check instance and count records for each schema", async function () {
      // Mock console.log to avoid output during tests
      const consoleLogStub = sinon.stub(console, "log");

      await instance.check("/test/path");

      expect(mockClient.NLWS.xtkQueryDef.create.called).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/Checking instance/))).to.be.true;

      consoleLogStub.restore();
    });

    // it("should throw CampaignError when directory is not empty", async function () {
    //   // Create a non-empty directory
    //   const testDir = "/tmp/test-campaign-check";
    //   fs.ensureDirSync(testDir);
    //   fs.writeFileSync(`${testDir}/test.txt`, "test");

    //   try {
    //     await instance.check(testDir);
    //     expect.fail("Should have thrown CampaignError");
    //   } catch (err) {
    //     expect(err).to.be.instanceOf(CampaignError);
    //     expect(err.message).to.include("not empty");
    //   } finally {
    //     // Cleanup
    //     fs.removeSync(testDir);
    //   }
    // });

    it("should handle query execution errors gracefully", async function () {
      const consoleLogStub = sinon.stub(console, "log");
      
      mockClient.NLWS.xtkQueryDef.create.returns({
        executeQuery: sinon.stub().rejects(new Error("Test error"))
      });

      await instance.check("/tmp/test-empty");

      expect(consoleLogStub.calledWith(sinon.match(/Error executing query/))).to.be.true;
      consoleLogStub.restore();
    });
  });

  describe("pull", function () {
    it("should pull data for each schema with pagination", async function () {
      const consoleLogStub = sinon.stub(console, "log");
      const testDir = "/tmp/test-campaign-pull";
      
      // Mock fs to return empty directory
      sinon.stub(fs, "existsSync").returns(false);
      sinon.stub(fs, "mkdirSync").returns(undefined);
      sinon.stub(fs, "readdirSync").returns([]);

      // Mock download to return less than lineCount to stop pagination
      sinon.stub(instance, "download").resolves(5);

      await instance.pull(testDir);

      expect(consoleLogStub.calledWith(sinon.match(/Pulling instance/))).to.be.true;
      expect(instance.download.called).to.be.true;

      // Restore stubs
      instance.download.restore();
      fs.existsSync.restore();
      fs.mkdirSync.restore();
      fs.readdirSync.restore();
      consoleLogStub.restore();
    });

    it("should handle empty directory case", async function () {
      const testDir = "/tmp/test-empty-dir";
      fs.ensureDirSync(testDir);

      const consoleLogStub = sinon.stub(console, "log");
      sinon.stub(instance, "download").resolves(0);

      await instance.pull(testDir);

      expect(instance.download.called).to.be.true;

      instance.download.restore();
      consoleLogStub.restore();
      fs.removeSync(testDir);
    });
  });

  describe("download", function () {
    it("should download records and save to files", async function () {
      // Mock child element
      const mockChild = {
        getAttribute: sinon.stub(),
        childNodes: []
      };

      mockClient.DomUtil.getFirstChildElement.returns(mockChild);
      mockClient.DomUtil.getNextSiblingElement.onCall(0).returns(null); // Return null immediately to only process 1 record
      mockClient.DomUtil.getAttributeAsString.withArgs(mockChild, "namespace").returns("test");
      mockClient.DomUtil.getAttributeAsString.withArgs(mockChild, "name").returns("testName");
      mockClient.DomUtil.getAttributeAsString.withArgs(mockChild, "internalName").returns("testInternal");

      const testDir = "/tmp/test-download";
      fs.ensureDirSync(testDir);

      // Spy on fs.outputFileSync
      const outputFileSyncSpy = sinon.spy(fs, "outputFileSync");

      const result = await instance.download("nms:recipient", testDir, 1);

      expect(result).to.equal(1);
      expect(outputFileSyncSpy.called).to.be.true;

      // Restore the spy
      outputFileSyncSpy.restore();
      fs.removeSync(testDir);
    });

    it("should handle query execution errors", async function () {
      mockClient.NLWS.xml.xtkQueryDef.create.returns({
        selectAll: sinon.stub().rejects(new Error("Test error")),
        executeQuery: sinon.stub().rejects(new Error("Test error"))
      });

      const testDir = "/tmp/test-download-error";
      fs.ensureDirSync(testDir);

      const result = await instance.download("nms:recipient", testDir, 1);

      expect(result).to.equal(0);

      fs.removeSync(testDir);
    });
  });

  describe("isFolderEmpty", function () {
    it("should return true for non-existent directory", function () {
      const result = instance.isFolderEmpty("/non/existent/path");
      expect(result).to.be.true;
    });

    it("should return true for empty directory", function () {
      const testDir = "/tmp/test-empty-folder";
      fs.ensureDirSync(testDir);
      
      const result = instance.isFolderEmpty(testDir);
      expect(result).to.be.true;

      fs.removeSync(testDir);
    });

    it("should return false for non-empty directory", function () {
      const testDir = "/tmp/test-non-empty";
      fs.ensureDirSync(testDir);
      fs.writeFileSync(`${testDir}/test.txt`, "test");

      const result = instance.isFolderEmpty(testDir);
      expect(result).to.be.false;

      fs.removeSync(testDir);
    });
  });

  describe("archive methods", function () {
    it("should save archive request", function () {
      const testRequest = "<test>request</test>";
      const spy = sinon.spy(fs, "outputFileSync");

      instance.saveArchiveRequest(testRequest);

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[1]).to.equal(testRequest);

      spy.restore();
    });

    it("should save archive response", function () {
      const testResponse = "<test>response</test>";
      const spy = sinon.spy(fs, "outputFileSync");

      instance.saveArchiveResponse(testResponse);

      expect(spy.calledOnce).to.be.true;
      expect(spy.firstCall.args[1]).to.equal(testResponse);

      spy.restore();
    });

    it("should generate correct archive date format", function () {
      // Note: sinon.useFakeTimers doesn't affect new Date() calls, so we need to stub Date directly
      const originalDate = global.Date;
      
      // Create a mock Date that returns our fixed time
      class MockDate extends Date {
        constructor() {
          super("2023-01-15T14:30:45.123Z");
        }
      }
      
      global.Date = MockDate;

      try {
        const result = instance.getArchiveDate();
        // The actual time will depend on the system timezone, so we'll check the format instead
        expect(result).to.match(/^2023\/01\/15\/\d{2}-\d{2}-\d{2}_\d{3}$/);
      } finally {
        global.Date = originalDate;
      }
    });
  });
});