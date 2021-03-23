/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { ItemProps } from "./ItemProps.js";

/** Definition for a Custom item that renders a React component.
 * @beta
 */
export interface CustomItemProps extends ItemProps {
  customId?: string;
  // @deprecated - use popupPanelNode
  reactElement?: React.ReactNode;
  popupPanelNode?: React.ReactNode;
}
