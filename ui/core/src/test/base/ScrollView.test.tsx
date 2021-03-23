/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { ScrollView } from "../../ui-core.js";

describe("<ScrollView />", () => {
  it("should render", () => {
    const wrapper = mount(<ScrollView />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<ScrollView />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<ScrollView>Test content</ScrollView>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<ScrollView />);
    wrapper.find(".uicore-scrollview").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<ScrollView>Test Content</ScrollView>);
    wrapper.find(".uicore-scrollview").text().should.equal("Test Content");
  });
});
