/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Code } from "../Code";
import { EntityMetaData } from "../Entity";
import { IModelDb } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";

describe("Class Registry", () => {
  let imodel: IModelDb;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("test.bim");
    assert.exists(imodel);
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("should verify the Entity metadata of known element subclasses", async () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await imodel.elements.getElement(code1);
    assert.exists(el);
    if (el) {
      const metaData: EntityMetaData | undefined = await el.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.ecclass, el.classFullName);
      // I happen to know that this is a BisCore:RepositoryLink
      assert.equal(metaData.ecclass, "BisCore:RepositoryLink");
      //  Check the metadata on the class itself
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0], "BisCore:UrlLink");
      assert.equal(metaData.customAttributes![0].ecclass, "BisCore:ClassHasHandler");
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.repositoryGuid);
      const p = metaData.properties.repositoryGuid;
      assert.equal(p.extendedType, "BeGuid");
      assert.equal(p.customAttributes![1].ecclass, "CoreCustomAttributes:HiddenProperty");
    }
    const el2 = await imodel.elements.getElement(new Id64("0x34"));
    assert.exists(el2);
    if (el2) {
      const metaData = await el2.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.ecclass, el2.classFullName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(metaData.ecclass, "BisCore:SpatialViewDefinition");
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0], "BisCore:ViewDefinition3d");
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.modelSelector);
      const n = metaData.properties.modelSelector;
      assert.equal(n.relationshipClass, "BisCore:SpatialViewDefinitionUsesModelSelector");
    }
  });

});

class Base {
  public static staticProperty: string = "base";
  public static get sqlName(): string { return "s." + this.staticProperty; }
}

class Derived extends Base {
}

describe("Static Properties", () => {

  it("should be inherited, and the subclass should get its own copy", async () => {
    assert.equal(Base.staticProperty, "base");
    assert.equal(Derived.staticProperty, "base"); // Derived inherits Base's staticProperty (via its prototype)
    Derived.staticProperty = "derived";           // Derived now gets its own copy of staticProperty
    assert.equal(Base.staticProperty, "base");      // Base's staticProperty remains as it was
    assert.equal(Derived.staticProperty, "derived"); // Derived's staticProperty is now different
    assert.equal(Base.sqlName, "s.base");
    const d = new Derived();
    assert.equal(Object.getPrototypeOf(d).constructor.staticProperty, "derived"); // Instances of Derived see Derived.staticProperty
    const b = new Base();
    assert.equal(Object.getPrototypeOf(b).constructor.staticProperty, "base"); // Instances of Base see Base.staticProperty
  });

});
