/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Guid, GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { ColorDef, IModel, IModelVersion } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import * as semver from "semver";
import {
  AuthorizedBackendRequestContext, BackendLoggerCategory, BisCoreSchema, BriefcaseManager, ConcurrencyControl, ECSqlStatement, Element, ElementRefersToElements, ExternalSourceAspect,
  GenericSchema, IModelDb, IModelExporter, IModelJsFs, IModelTransformer, KeepBriefcase, NativeLoggerCategory, OpenParams,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { CountingIModelImporter, IModelToTextFileExporter, IModelTransformerUtils, TestIModelTransformer } from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUsers } from "../TestUsers";
import { HubUtility } from "./HubUtility";

describe("IModelTransformerHub (#integration)", () => {

  before(async () => {
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
      Logger.setLevel(NativeLoggerCategory.Changeset, LogLevel.Trace);
    }
  });

  it("Transform source iModel to target iModel", async () => {
    const requestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);
    const projectId: GuidString = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }

    // Create and push seed of source IModel
    const sourceIModelName: string = HubUtility.generateUniqueName("TransformerSource");
    const sourceSeedFileName: string = path.join(outputDir, `${sourceIModelName}.bim`);
    if (IModelJsFs.existsSync(sourceSeedFileName)) {
      IModelJsFs.removeSync(sourceSeedFileName);
    }
    const sourceSeedDb: IModelDb = IModelDb.createSnapshot(sourceSeedFileName, { rootSubject: { name: "TransformerSource" } });
    assert.isTrue(IModelJsFs.existsSync(sourceSeedFileName));
    await IModelTransformerUtils.prepareSourceDb(sourceSeedDb);
    sourceSeedDb.closeSnapshot();
    const sourceIModelId: GuidString = await HubUtility.pushIModel(requestContext, projectId, sourceSeedFileName);
    assert.isTrue(Guid.isGuid(sourceIModelId));

    // Create and push seed of target IModel
    const targetIModelName: string = HubUtility.generateUniqueName("TransformerTarget");
    const targetSeedFileName: string = path.join(outputDir, `${targetIModelName}.bim`);
    if (IModelJsFs.existsSync(targetSeedFileName)) {
      IModelJsFs.removeSync(targetSeedFileName);
    }
    const targetSeedDb: IModelDb = IModelDb.createSnapshot(targetSeedFileName, { rootSubject: { name: "TransformerTarget" } });
    assert.isTrue(IModelJsFs.existsSync(targetSeedFileName));
    await IModelTransformerUtils.prepareTargetDb(targetSeedDb);
    targetSeedDb.closeSnapshot();
    const targetIModelId: GuidString = await HubUtility.pushIModel(requestContext, projectId, targetSeedFileName);
    assert.isTrue(Guid.isGuid(targetIModelId));

    try {
      const sourceDb: IModelDb = await IModelDb.open(requestContext, projectId, sourceIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      const targetDb: IModelDb = await IModelDb.open(requestContext, projectId, targetIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      assert.exists(sourceDb);
      assert.exists(targetDb);
      sourceDb.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);
      targetDb.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);

      if (true) { // initial import
        IModelTransformerUtils.populateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, () => "Populate source");

        // Use IModelExporter.exportChanges to verify the changes to the sourceDb
        const sourceExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerSource-ExportChanges-1.txt");
        assert.isFalse(IModelJsFs.existsSync(sourceExportFileName));
        const sourceExporter = new IModelToTextFileExporter(sourceDb, sourceExportFileName);
        await sourceExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(sourceExportFileName));
        const sourceDbChanges: any = (sourceExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(sourceDbChanges);
        // expect inserts and 1 update from populateSourceDb
        assert.isAtLeast(sourceDbChanges.codeSpec.insertIds.size, 1);
        assert.isAtLeast(sourceDbChanges.element.insertIds.size, 1);
        assert.isAtLeast(sourceDbChanges.aspect.insertIds.size, 1);
        assert.isAtLeast(sourceDbChanges.model.insertIds.size, 1);
        assert.equal(sourceDbChanges.model.updateIds.size, 1, "Expect the RepositoryModel to be updated");
        assert.isTrue(sourceDbChanges.model.updateIds.has(IModel.repositoryModelId));
        assert.isAtLeast(sourceDbChanges.relationship.insertIds.size, 1);
        // expect no other updates nor deletes from populateSourceDb
        assert.equal(sourceDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(sourceDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(sourceDbChanges.element.updateIds.size, 0);
        assert.equal(sourceDbChanges.element.deleteIds.size, 0);
        assert.equal(sourceDbChanges.aspect.updateIds.size, 0);
        assert.equal(sourceDbChanges.aspect.deleteIds.size, 0);
        assert.equal(sourceDbChanges.model.deleteIds.size, 0);
        assert.equal(sourceDbChanges.relationship.updateIds.size, 0);
        assert.equal(sourceDbChanges.relationship.deleteIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        transformer.processAll();
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, () => "Import #1");
        IModelTransformerUtils.assertTargetDbContents(sourceDb, targetDb);

        // Use IModelExporter.exportChanges to verify the changes to the targetDb
        const targetExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerTarget-ExportChanges-1.txt");
        assert.isFalse(IModelJsFs.existsSync(targetExportFileName));
        const targetExporter = new IModelToTextFileExporter(targetDb, targetExportFileName);
        await targetExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(targetExportFileName));
        const targetDbChanges: any = (targetExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(targetDbChanges);
        // expect inserts and a few updates from transforming the result of populateSourceDb
        assert.isAtLeast(targetDbChanges.codeSpec.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.element.insertIds.size, 1);
        assert.equal(targetDbChanges.element.updateIds.size, 2, "Expect FederationGuid updates for the Dictionary and RealityDataSources InformationPartitionElements");
        assert.isAtLeast(targetDbChanges.aspect.insertIds.size, 1);
        assert.isAtLeast(targetDbChanges.model.insertIds.size, 1);
        assert.equal(targetDbChanges.model.updateIds.size, 1, "Expect the RepositoryModel to be updated");
        assert.isTrue(targetDbChanges.model.updateIds.has(IModel.repositoryModelId));
        assert.isAtLeast(targetDbChanges.relationship.insertIds.size, 1);
        // expect no other changes from transforming the result of populateSourceDb
        assert.equal(targetDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(targetDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(targetDbChanges.element.deleteIds.size, 0);
        assert.equal(targetDbChanges.aspect.updateIds.size, 0);
        assert.equal(targetDbChanges.aspect.deleteIds.size, 0);
        assert.equal(targetDbChanges.model.deleteIds.size, 0);
        assert.equal(targetDbChanges.relationship.updateIds.size, 0);
        assert.equal(targetDbChanges.relationship.deleteIds.size, 0);
      }

      if (true) { // second import with no changes to source, should be a no-op
        const numTargetElements: number = count(targetDb, Element.classFullName);
        const numTargetExternalSourceAspects: number = count(targetDb, ExternalSourceAspect.classFullName);
        const numTargetRelationships: number = count(targetDb, ElementRefersToElements.classFullName);
        const targetImporter = new CountingIModelImporter(targetDb);
        const transformer = new TestIModelTransformer(sourceDb, targetImporter);
        await transformer.processChanges(requestContext);
        assert.equal(targetImporter.numModelsInserted, 0);
        assert.equal(targetImporter.numModelsUpdated, 0);
        assert.equal(targetImporter.numElementsInserted, 0);
        assert.equal(targetImporter.numElementsUpdated, 0);
        assert.equal(targetImporter.numElementsDeleted, 0);
        assert.equal(targetImporter.numElementAspectsInserted, 0);
        assert.equal(targetImporter.numElementAspectsUpdated, 0);
        assert.equal(targetImporter.numRelationshipsInserted, 0);
        assert.equal(targetImporter.numRelationshipsUpdated, 0);
        assert.equal(numTargetElements, count(targetDb, Element.classFullName), "Second import should not add elements");
        assert.equal(numTargetExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Second import should not add aspects");
        assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Second import should not add relationships");
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        assert.isFalse(targetDb.briefcase.nativeDb.hasSavedChanges());
        await targetDb.pushChanges(requestContext, () => "Should not actually push because there are no changes");
      }

      if (true) { // update source db, then import again
        IModelTransformerUtils.updateSourceDb(sourceDb);
        await sourceDb.concurrencyControl.request(requestContext);
        sourceDb.saveChanges();
        await sourceDb.pushChanges(requestContext, () => "Update source");

        // Use IModelExporter.exportChanges to verify the changes to the sourceDb
        const sourceExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerSource-ExportChanges-2.txt");
        assert.isFalse(IModelJsFs.existsSync(sourceExportFileName));
        const sourceExporter = new IModelToTextFileExporter(sourceDb, sourceExportFileName);
        await sourceExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(sourceExportFileName));
        const sourceDbChanges: any = (sourceExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(sourceDbChanges);
        // expect no inserts from updateSourceDb
        assert.equal(sourceDbChanges.codeSpec.insertIds.size, 0);
        assert.equal(sourceDbChanges.element.insertIds.size, 0);
        assert.equal(sourceDbChanges.aspect.insertIds.size, 0);
        assert.equal(sourceDbChanges.model.insertIds.size, 0);
        assert.equal(sourceDbChanges.relationship.insertIds.size, 0);
        // expect some updates from updateSourceDb
        assert.isAtLeast(sourceDbChanges.element.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.aspect.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.model.updateIds.size, 1);
        assert.isAtLeast(sourceDbChanges.relationship.updateIds.size, 1);
        // expect some deletes from updateSourceDb
        assert.isAtLeast(sourceDbChanges.element.deleteIds.size, 1);
        assert.equal(sourceDbChanges.relationship.deleteIds.size, 1);
        // don't expect other changes from updateSourceDb
        assert.equal(sourceDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(sourceDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(sourceDbChanges.aspect.deleteIds.size, 0);
        assert.equal(sourceDbChanges.model.deleteIds.size, 0);

        const transformer = new TestIModelTransformer(sourceDb, targetDb);
        await transformer.processChanges(requestContext);
        transformer.dispose();
        await targetDb.concurrencyControl.request(requestContext);
        targetDb.saveChanges();
        await targetDb.pushChanges(requestContext, () => "Import #2");
        IModelTransformerUtils.assertUpdatesInTargetDb(targetDb);

        // Use IModelExporter.exportChanges to verify the changes to the targetDb
        const targetExportFileName: string = IModelTestUtils.prepareOutputFile("IModelTransformer", "TransformerTarget-ExportChanges-2.txt");
        assert.isFalse(IModelJsFs.existsSync(targetExportFileName));
        const targetExporter = new IModelToTextFileExporter(targetDb, targetExportFileName);
        await targetExporter.exportChanges(requestContext);
        assert.isTrue(IModelJsFs.existsSync(targetExportFileName));
        const targetDbChanges: any = (targetExporter.exporter as any)._sourceDbChanges; // access private member for testing purposes
        assert.exists(targetDbChanges);
        // expect no inserts from transforming the result of updateSourceDb
        assert.equal(targetDbChanges.codeSpec.insertIds.size, 0);
        assert.equal(targetDbChanges.element.insertIds.size, 0);
        assert.equal(targetDbChanges.aspect.insertIds.size, 0);
        assert.equal(targetDbChanges.model.insertIds.size, 0);
        assert.equal(targetDbChanges.relationship.insertIds.size, 0);
        // expect some updates from transforming the result of updateSourceDb
        assert.isAtLeast(targetDbChanges.element.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.model.updateIds.size, 1);
        assert.isAtLeast(targetDbChanges.relationship.updateIds.size, 1);
        // expect some deletes from transforming the result of updateSourceDb
        assert.isAtLeast(targetDbChanges.element.deleteIds.size, 1);
        assert.isAtLeast(targetDbChanges.aspect.deleteIds.size, 1);
        assert.equal(targetDbChanges.relationship.deleteIds.size, 1);
        // don't expect other changes from transforming the result of updateSourceDb
        assert.equal(targetDbChanges.codeSpec.updateIds.size, 0);
        assert.equal(targetDbChanges.codeSpec.deleteIds.size, 0);
        assert.equal(targetDbChanges.model.deleteIds.size, 0);
      }

      await sourceDb.close(requestContext, KeepBriefcase.No);
      await targetDb.close(requestContext, KeepBriefcase.No);
    } finally {
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, sourceIModelId);
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, targetIModelId);
    }
  });

  it("Clone/upgrade test", async () => {
    const requestContext: AuthorizedBackendRequestContext = await IModelTestUtils.getTestUserRequestContext(TestUsers.manager);
    const projectId: GuidString = await HubUtility.queryProjectIdByName(requestContext, "iModelJsIntegrationTest");
    const sourceIModelName: string = HubUtility.generateUniqueName("CloneSource");
    const sourceIModelId: GuidString = await HubUtility.recreateIModel(requestContext, projectId, sourceIModelName);
    assert.isTrue(Guid.isGuid(sourceIModelId));
    const targetIModelName: string = HubUtility.generateUniqueName("CloneTarget");
    const targetIModelId: GuidString = await HubUtility.recreateIModel(requestContext, projectId, targetIModelName);
    assert.isTrue(Guid.isGuid(targetIModelId));

    try {
      // open/upgrade sourceDb
      const sourceDb: IModelDb = await IModelDb.open(requestContext, projectId, sourceIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      assert.isTrue(semver.satisfies(sourceDb.querySchemaVersion(BisCoreSchema.schemaName)!, ">= 1.0.1"));
      assert.isFalse(sourceDb.containsClass(ExternalSourceAspect.classFullName), "Expect iModelHub to be using an old version of BisCore before ExternalSourceAspect was introduced");
      sourceDb.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);
      assert.isFalse(await sourceDb.concurrencyControl.hasSchemaLock(requestContext));
      await sourceDb.importSchemas(requestContext, [BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(await sourceDb.concurrencyControl.hasSchemaLock(requestContext));
      assert.isTrue(semver.satisfies(sourceDb.querySchemaVersion(BisCoreSchema.schemaName)!, ">= 1.0.8"));
      assert.isTrue(sourceDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");

      // push sourceDb schema changes
      await sourceDb.concurrencyControl.request(requestContext);
      assert.isTrue(sourceDb.nativeDb.hasSavedChanges(), "Expect importSchemas to have saved changes");
      assert.isFalse(sourceDb.nativeDb.hasUnsavedChanges(), "Expect no unsaved changes after importSchemas");
      await sourceDb.pushChanges(requestContext, () => "Import schemas to upgrade BisCore"); // should actually push schema changes
      assert.isFalse(await sourceDb.concurrencyControl.hasSchemaLock(requestContext));

      // import schemas again to test common scenario of not knowing whether schemas are up-to-date or not..
      await sourceDb.importSchemas(requestContext, [BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(await sourceDb.concurrencyControl.hasSchemaLock(requestContext));
      assert.isTrue(await sourceDb.concurrencyControl.hasSchemaLock(requestContext));
      assert.isFalse(sourceDb.nativeDb.hasSavedChanges(), "Expect importSchemas to be a no-op");
      assert.isFalse(sourceDb.nativeDb.hasUnsavedChanges(), "Expect importSchemas to be a no-op");
      sourceDb.saveChanges(); // will be no changes to save in this case
      await sourceDb.pushChanges(requestContext, () => "Import schemas again"); // will be no changes to push in this case
      assert.isTrue(await sourceDb.concurrencyControl.hasSchemaLock(requestContext)); // NOTE - pushChanges does not currently release locks if there are no changes to push. It probably should.

      // populate sourceDb
      IModelTransformerUtils.populateTeamIModel(sourceDb, "Test", Point3d.createZero(), ColorDef.green);
      IModelTransformerUtils.assertTeamIModelContents(sourceDb, "Test");
      await sourceDb.concurrencyControl.request(requestContext);
      sourceDb.saveChanges();
      await sourceDb.pushChanges(requestContext, () => "Populate Source");
      assert.isFalse(await sourceDb.concurrencyControl.hasSchemaLock(requestContext));

      // open/upgrade targetDb
      const targetDb: IModelDb = await IModelDb.open(requestContext, projectId, targetIModelId, OpenParams.pullAndPush(), IModelVersion.latest());
      assert.isFalse(targetDb.containsClass(ExternalSourceAspect.classFullName), "Expect iModelHub to be using an old version of BisCore before ExternalSourceAspect was introduced");
      targetDb.concurrencyControl.setPolicy(ConcurrencyControl.OptimisticPolicy);
      await targetDb.importSchemas(requestContext, [BisCoreSchema.schemaFilePath, GenericSchema.schemaFilePath]);
      assert.isTrue(targetDb.containsClass(ExternalSourceAspect.classFullName), "Expect BisCore to be updated and contain ExternalSourceAspect");

      // push targetDb schema changes
      await targetDb.concurrencyControl.request(requestContext);
      targetDb.saveChanges();
      await targetDb.pushChanges(requestContext, () => "Upgrade BisCore");

      // import sourceDb changes into targetDb
      const transformer = new IModelTransformer(new IModelExporter(sourceDb), targetDb);
      transformer.processAll();
      transformer.dispose();
      IModelTransformerUtils.assertTeamIModelContents(targetDb, "Test");
      await targetDb.concurrencyControl.request(requestContext);
      targetDb.saveChanges();
      await targetDb.pushChanges(requestContext, () => "Import changes from sourceDb");

      // close iModel briefcases
      await sourceDb.close(requestContext, KeepBriefcase.No);
      await targetDb.close(requestContext, KeepBriefcase.No);
    } finally {
      // delete iModel briefcases
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, sourceIModelId);
      await BriefcaseManager.imodelClient.iModels.delete(requestContext, projectId, targetIModelId);
    }
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }
});

// cspell:words ecchange
