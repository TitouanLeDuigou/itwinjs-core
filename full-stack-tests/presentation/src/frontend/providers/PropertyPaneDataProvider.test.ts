/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import { PresentationPropertyDataProvider } from "@bentley/presentation-components";
import { DEFAULT_PROPERTY_GRID_RULESET } from "@bentley/presentation-components/lib/presentation-components/propertygrid/DataProvider";
import { initialize, terminate } from "../../IntegrationTests";

describe("PropertyDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationPropertyDataProvider;
  let physicalModelProps: ModelProps;

  before(async () => {
    await initialize();

    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    physicalModelProps = (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0];
    provider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  const runTests = (configName: string, setup: () => void) => {

    describe(configName, () => {

      beforeEach(setup);

      afterEach(() => {
        sinon.restore();
      });

      it("creates empty result when properties requested for 0 instances", async () => {
        provider.keys = new KeySet();
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("creates property data when given key with concrete class", async () => {
        provider.keys = new KeySet([physicalModelProps]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("creates property data when given key with base class", async () => {
        provider.keys = new KeySet([{ className: "BisCore:Element", id: "0x75" }]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("favorites properties", async () => {
        sinon.stub(provider as any, "isFieldFavorite").returns(true);
        provider.keys = new KeySet([physicalModelProps]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

    });

  };

  runTests("with flat property categories", () => provider.isNestedPropertyCategoryGroupingEnabled = false);
  runTests("with nested property categories", () => provider.isNestedPropertyCategoryGroupingEnabled = true);

});
