/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { ElementAspectProps, ExternalSourceAspectProps, IModel, IModelError, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { assert } from "chai";
import { SpatialCategory } from "../../Category";
import { Element, PhysicalElement } from "../../Element";
import { ElementAspect, ElementMultiAspect, ElementUniqueAspect, ExternalSourceAspect } from "../../ElementAspect";
import { IModelDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("ElementAspect", () => {

  let iModel: IModelDb;

  before(() => {
    // NOTE: see ElementAspectTests.PresentationRuleScenarios in DgnPlatform\Tests\DgnProject\NonPublished\ElementAspect_Test.cpp for how ElementAspectTest.bim was created
    const seedFileName = IModelTestUtils.resolveAssetFile("ElementAspectTest.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ElementAspect", "ElementAspectTest.bim");
    iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    iModel.closeSnapshot();
  });

  it("should be able to get aspects from test file", () => {
    const element = iModel.elements.getElement("0x17");
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspect1: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestUniqueAspectNoHandler")[0];
    assert.exists(aspect1);
    assert.isTrue(aspect1 instanceof ElementUniqueAspect);
    assert.equal(aspect1.classFullName, "DgnPlatformTest:TestUniqueAspectNoHandler");
    assert.equal(aspect1.asAny.testUniqueAspectProperty, "Aspect1-Updated");
    assert.equal(aspect1.asAny.length, 1);

    const aspect2: ElementAspect = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestUniqueAspect")[0];
    assert.exists(aspect2);
    assert.isTrue(aspect2 instanceof ElementUniqueAspect);
    assert.equal(aspect2.classFullName, "DgnPlatformTest:TestUniqueAspect");
    assert.equal(aspect2.asAny.testUniqueAspectProperty, "Aspect2-Updated");
    assert.isUndefined(aspect2.asAny.length);

    const uniqueAspects: ElementUniqueAspect[] = iModel.elements.getAspects(element.id, ElementUniqueAspect.classFullName);
    assert.equal(uniqueAspects.length, 2);
    uniqueAspects.forEach((aspect) => {
      assert.isTrue(aspect.classFullName === aspect1.classFullName || aspect.classFullName === aspect2.classFullName);
    });

    const multiAspectsA: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestMultiAspectNoHandler");
    assert.exists(multiAspectsA);
    assert.isArray(multiAspectsA);
    assert.equal(multiAspectsA.length, 2);
    multiAspectsA.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspectNoHandler");
      assert.exists(aspect.asAny.testMultiAspectProperty);
    });

    const multiAspectsB: ElementAspect[] = iModel.elements.getAspects(element.id, "DgnPlatformTest:TestMultiAspect");
    assert.exists(multiAspectsB);
    assert.isArray(multiAspectsB);
    assert.equal(multiAspectsB.length, 2);
    multiAspectsB.forEach((aspect) => {
      assert.isTrue(aspect instanceof ElementMultiAspect);
      assert.equal(aspect.schemaName, "DgnPlatformTest");
      assert.equal(aspect.className, "TestMultiAspect");
      assert.exists(aspect.asAny.testMultiAspectProperty);
    });

    const multiAspects: ElementAspect[] = iModel.elements.getAspects(element.id, ElementMultiAspect.classFullName);
    assert.equal(multiAspects.length, 4);
    multiAspects.forEach((aspect) => {
      assert.isTrue(aspect.classFullName === multiAspectsA[0].classFullName || aspect.classFullName === multiAspectsB[0].classFullName);
    });

    const rootSubject = iModel.elements.getRootSubject();
    assert.equal(0, iModel.elements.getAspects(rootSubject.id, "DgnPlatformTest:TestUniqueAspect").length, "Don't expect DgnPlatformTest:TestUniqueAspect aspects on the root Subject");
    assert.equal(0, iModel.elements.getAspects(rootSubject.id, "DgnPlatformTest:TestMultiAspect").length, "Don't expect DgnPlatformTest:TestMultiAspect aspects on the root Subject");
    assert.equal(0, iModel.elements.getAspects(rootSubject.id).length, "Don't expect any aspects on the root Subject");

    // The 'Element' property is introduced by ElementUniqueAspect and ElementMultiAspect, but is not available at the ElementAspect base class.
    // This is unfortunate, but is expected behavior and the reason why the getAllAspects method exists.
    assert.throws(() => iModel.elements.getAspects(element.id, ElementAspect.classFullName), IModelError);

    const allAspects: ElementAspect[] = iModel.elements.getAspects(element.id);
    assert.equal(allAspects.length, 6);
  });

  it("should be able to insert, update, and delete MultiAspects", () => {
    const element: Element = iModel.elements.getElement("0x17");
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspectProps: ElementAspectProps = {
      classFullName: "DgnPlatformTest:TestMultiAspectNoHandler",
      element: { id: element.id },
      testMultiAspectProperty: "MultiAspectInsertTest1",
    };
    iModel.elements.insertAspect(aspectProps);
    let aspects: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isAtLeast(aspects.length, 1);
    const numAspects = aspects.length;

    let found: boolean = false;
    let foundIndex: number = -1;
    for (const aspect of aspects) {
      foundIndex++;
      if (aspect.asAny.testMultiAspectProperty === aspectProps.testMultiAspectProperty) {
        found = true;
        break;
      }
    }
    assert.isTrue(found);

    aspects[foundIndex].asAny.testMultiAspectProperty = "MultiAspectInsertTest1-Updated";
    iModel.elements.updateAspect(aspects[foundIndex]);

    const aspectsUpdated: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.equal(aspectsUpdated.length, aspects.length);
    assert.equal(aspectsUpdated[foundIndex].asAny.testMultiAspectProperty, "MultiAspectInsertTest1-Updated");

    iModel.elements.deleteAspect(aspects[foundIndex].id);
    aspects = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.equal(numAspects, aspects.length + 1);
  });

  it("should be able to insert, update, and delete UniqueAspects", () => {
    const element: Element = iModel.elements.getElement("0x17");
    assert.exists(element);
    assert.isTrue(element instanceof PhysicalElement);

    const aspectProps: ElementAspectProps = {
      classFullName: "DgnPlatformTest:TestUniqueAspectNoHandler",
      element: { id: element.id },
      testUniqueAspectProperty: "UniqueAspectInsertTest1",
    };
    iModel.elements.insertAspect(aspectProps);
    const aspects: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.isTrue(aspects.length === 1);
    assert.equal(aspects[0].asAny.testUniqueAspectProperty, aspectProps.testUniqueAspectProperty);

    aspects[0].asAny.testUniqueAspectProperty = "UniqueAspectInsertTest1-Updated";
    iModel.elements.updateAspect(aspects[0]);
    const aspectsUpdated: ElementAspect[] = iModel.elements.getAspects(element.id, aspectProps.classFullName);
    assert.equal(aspectsUpdated.length, 1);
    assert.equal(aspectsUpdated[0].asAny.testUniqueAspectProperty, "UniqueAspectInsertTest1-Updated");

    iModel.elements.deleteAspect(aspects[0].id);
    try {
      iModel.elements.getAspects(element.id, aspectProps.classFullName);
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      assert.isTrue(error instanceof Error);
    }
  });

  it("should be able to insert ExternalSourceAspects", () => {
    const iModelDb: IModelDb = IModelDb.createSnapshot(IModelTestUtils.prepareOutputFile("ElementAspect", "ExternalSourceAspect.bim"), { rootSubject: { name: "ExternalSourceAspect" } });
    const elementId: Id64String = SpatialCategory.insert(iModelDb, IModel.dictionaryId, "Category", new SubCategoryAppearance());
    assert.isTrue(Id64.isValidId64(elementId));

    const aspectProps: ExternalSourceAspectProps = {
      classFullName: ExternalSourceAspect.classFullName,
      element: { id: elementId },
      scope: { id: IModel.rootSubjectId },
      identifier: "A",
      kind: "Letter",
      checksum: "1",
      version: "1.0",
    };
    const aspect = new ExternalSourceAspect(aspectProps, iModelDb);
    assert.equal(aspect.element.id, aspectProps.element.id);
    assert.equal(aspect.scope.id, aspectProps.scope.id);
    assert.equal(aspect.identifier, aspectProps.identifier);
    assert.equal(aspect.kind, aspectProps.kind);
    assert.equal(aspect.checksum, aspectProps.checksum);
    assert.equal(aspect.version, aspectProps.version);
    iModelDb.elements.insertAspect(aspectProps);

    const aspects: ElementAspect[] = iModelDb.elements.getAspects(elementId, aspectProps.classFullName);
    assert.equal(aspects.length, 1);
    assert.equal(aspects[0].element.id, aspectProps.element.id);
    assert.equal(aspects[0].asAny.scope.id, aspectProps.scope.id);
    assert.isTrue(aspects[0].asAny.scope.relClassName.endsWith("ElementScopesExternalSourceIdentifier"));
    assert.equal(aspects[0].asAny.identifier, aspectProps.identifier);
    assert.equal(aspects[0].asAny.kind, aspectProps.kind);
    assert.equal(aspects[0].asAny.checksum, aspectProps.checksum);
    assert.equal(aspects[0].asAny.version, aspectProps.version);

    const aspectJson = aspect.toJSON();
    assert.equal(aspectJson.classFullName, aspectProps.classFullName);
    assert.equal(aspectJson.element.id, aspectProps.element.id);
    assert.equal(aspectJson.scope.id, aspectProps.scope.id);
    assert.equal(aspectJson.identifier, aspectProps.identifier);
    assert.equal(aspectJson.kind, aspectProps.kind);
    assert.equal(aspectJson.checksum, aspectProps.checksum);
    assert.equal(aspectJson.version, aspectProps.version);
  });
});
