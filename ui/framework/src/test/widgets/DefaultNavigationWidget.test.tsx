/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef.js";
import { ItemList } from "../../ui-framework/shared/ItemMap.js";
import { DefaultNavigationWidget } from "../../ui-framework/widgets/DefaultNavigationWidget.js";
import TestUtils, { mount } from "../TestUtils.js";

describe("DefaultNavigationWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("DefaultNavigationWidget should render", () => {
    mount(<DefaultNavigationWidget />); // eslint-disable-line deprecation/deprecation
  });

  it("DefaultNavigationWidget should render correctly", () => {
    shallow(<DefaultNavigationWidget />).should.matchSnapshot(); // eslint-disable-line deprecation/deprecation
  });

  it("DefaultNavigationWidget with suffix and prefix items should render correctly", () => {
    const testH1Def = new CommandItemDef({
      commandId: "test-h1-tool",
      execute: (): void => { },
      iconSpec: "icon-developer",
      label: "test-h1-tool",
    });

    const testV1Def = new CommandItemDef({
      commandId: "test-v1-tool",
      execute: (): void => { },
      iconSpec: "icon-developer",
      label: "test-v1-tool",
    });

    const testV2Def = new CommandItemDef({
      commandId: "test-v1-tool",
      execute: (): void => { },
      iconSpec: "icon-developer",
      label: "test-v1-tool",
    });

    const testH2Def = new CommandItemDef({
      commandId: "test-h2-tool",
      execute: (): void => { },
      iconSpec: "icon-developer",
      label: "test-h2-tool",
    });

    shallow(<DefaultNavigationWidget prefixVerticalItems={new ItemList([testV1Def])} suffixVerticalItems={new ItemList([testV2Def])} // eslint-disable-line deprecation/deprecation
      prefixHorizontalItems={new ItemList([testH1Def])} suffixHorizontalItems={new ItemList([testH2Def])} />).should.matchSnapshot();
  });

});
