/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Toast, Stage } from "../../../ui-ninezone";

describe("<Toast />", () => {
  it("should render", () => {
    mount(<Toast stage={Stage.Visible} />);
  });

  it("renders correctly", () => {
    shallow(<Toast stage={Stage.Visible} />).should.matchSnapshot();
  });
});
