/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { parsePrimitiveType, PrimitiveType } from "../source/ECObjects";

describe("Test parse utils", () => {
  it("primitive types", () => {
    expect(parsePrimitiveType("binary")).equal(PrimitiveType.Binary);
    expect(parsePrimitiveType("bool")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("boolean")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("dateTime")).equal(PrimitiveType.DateTime);
    expect(parsePrimitiveType("double")).equal(PrimitiveType.Double);
    expect(parsePrimitiveType("Bentley.Geometry.Common.IGeometry")).equal(PrimitiveType.IGeometry);
    expect(parsePrimitiveType("int")).equal(PrimitiveType.Integer);
    expect(parsePrimitiveType("long")).equal(PrimitiveType.Long);
    expect(parsePrimitiveType("point2d")).equal(PrimitiveType.Point2d);
    expect(parsePrimitiveType("point3d")).equal(PrimitiveType.Point3d);
    expect(parsePrimitiveType("string")).equal(PrimitiveType.String);
  });
});
