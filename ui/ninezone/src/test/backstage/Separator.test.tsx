/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { BackstageSeparator } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

describe("<BackstageSeparator />", () => {
  it("should render", () => {
    mount(<BackstageSeparator />);
  });

  it("renders correctly", () => {
    shallow(<BackstageSeparator />).should.matchSnapshot();
  });
});
