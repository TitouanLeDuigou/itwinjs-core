/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import { GroupingNodeKey, LabelDefinition, Node } from "@bentley/presentation-common";
import { createRandomECInstancesNode, createRandomGroupingNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random/index.js";
import { PageOptions } from "@bentley/ui-components";
import { createTreeNodeItem, createTreeNodeItems, pageOptionsUiToPresentation } from "../../presentation-components/tree/Utils";

describe("Utils", () => {

  describe("createTreeNodeItem", () => {

    it("creates tree node", () => {
      const node = createRandomECInstancesNode();
      const treeNode = createTreeNodeItem(node);
      expect(treeNode).to.matchSnapshot();
    });

    it("creates tree node with extended data", () => {
      const node = { ...createRandomECInstancesNode(), extendedData: { test: "value" } };
      const treeNode = createTreeNodeItem(node);
      expect(treeNode.extendedData!.test).to.eq("value");
    });

    it("creates tree node with parent id", () => {
      const node = createRandomECInstancesNode();
      const parentId = faker.random.word();
      const treeNode = createTreeNodeItem(node, parentId);
      expect(treeNode).to.matchSnapshot();
    });

    it("creates tree node with custom label styles", () => {
      const node = createRandomECInstancesNode();
      node.fontStyle = "Bold Italic";
      const treeNode = createTreeNodeItem(node);
      expect(treeNode).to.matchSnapshot();
    });

    it("appends grouped nodes count if requested", () => {
      const node: Node = {
        key: {
          ...createRandomGroupingNodeKey(),
          groupedInstancesCount: 999,
        } as GroupingNodeKey,
        label: LabelDefinition.fromLabelString("test"),
      };
      const treeNode = createTreeNodeItem(node, undefined, { appendChildrenCountForGroupingNodes: true });
      expect(treeNode).to.matchSnapshot();
    });

  });

  describe("createTreeNodeItems", () => {
    it("creates tree nodes", () => {
      const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const treeNode = createTreeNodeItems(nodes);
      expect(treeNode).to.matchSnapshot();
    });

    it("creates tree nodes with parentId", () => {
      const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const parentId = faker.random.word();
      const treeNode = createTreeNodeItems(nodes, parentId);
      expect(treeNode).to.matchSnapshot();
    });

  });

  describe("pageOptionsUiToPresentation", () => {
    it("returns undefined if passed undefined parameter", () => {
      const result = pageOptionsUiToPresentation(undefined);
      expect(result).to.be.equal(undefined);
    });

    it("converts ui page options to presentation page options", () => {
      const size = faker.random.number();
      const start = faker.random.number();
      const pageOptions: PageOptions = { size, start };
      const result = pageOptionsUiToPresentation(pageOptions);

      expect(result).to.not.be.undefined;
      expect(result!.size).to.be.equal(size);
      expect(result!.start).to.be.equal(start);
    });

  });

});
