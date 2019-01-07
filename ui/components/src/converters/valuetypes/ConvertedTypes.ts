/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { Id64String } from "@bentley/bentleyjs-core";

export interface Point2d {
  x: number;
  y: number;
}

export interface Point3d extends Point2d {
  z: number;
}

export type Point = Point2d | Point3d;

export type Value = boolean | number | string | Date | Point | Id64String;
