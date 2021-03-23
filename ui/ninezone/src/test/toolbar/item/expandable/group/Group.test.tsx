/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { Group } from "../../../../../ui-ninezone.js";
import { mount } from "../../../../Utils.js";

describe("<Group />", () => {
  it("should render", () => {
    mount(<Group />);
  });

  it("renders correctly", () => {
    shallow(<Group />).should.matchSnapshot();
  });

  it("renders with title and columns correctly", () => {
    shallow(<Group title="Test" columns={<div>columns</div>} />).should.matchSnapshot();
  });
});
