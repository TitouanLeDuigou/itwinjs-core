/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { EMPTY } from "rxjs/internal/observable/empty";
import { Observable } from "../Observable";
import { CheckboxStateChange } from "../TreeEvents";
import { TreeModelSource } from "../TreeModelSource";
import { ITreeNodeLoader, LoadedNodeHierarchy } from "../TreeNodeLoader";
import { TreeNodeItem } from "../../TreeDataProvider";

/** @internal */
export class TreeModelMutator {
  private _modelSource: TreeModelSource;
  private _nodeLoader: ITreeNodeLoader;
  private _collapsedChildrenDisposalEnabled: boolean;

  constructor(modelSource: TreeModelSource, nodeLoader: ITreeNodeLoader, collapsedChildrenDisposalEnabled: boolean) {
    this._modelSource = modelSource;
    this._nodeLoader = nodeLoader;
    this._collapsedChildrenDisposalEnabled = collapsedChildrenDisposalEnabled;
  }

  public expandNode(nodeId: string): Observable<LoadedNodeHierarchy> {
    let needToLoadChildren = false;
    this._modelSource.modifyModel((model) => {
      const node = model.getNode(nodeId);
      if (node === undefined || node.isExpanded) {
        return;
      }

      needToLoadChildren = node.numChildren === undefined;

      node.isExpanded = true;
      if (needToLoadChildren) {
        node.isLoading = true;
      }
    });

    const expandedNode = this._modelSource.getModel().getNode(nodeId);
    return needToLoadChildren && expandedNode ? this._nodeLoader.loadNode(expandedNode, 0) : EMPTY;
  }

  public collapseNode(nodeId: string) {
    this._modelSource.modifyModel((model) => {
      const node = model.getNode(nodeId);
      if (node === undefined || !node.isExpanded) {
        return;
      }

      node.isExpanded = false;
      if (this._collapsedChildrenDisposalEnabled) {
        model.clearChildren(node.id);
      }
    });
  }

  public modifySelection(nodesToSelect: TreeNodeItem[], nodesToDeselect: TreeNodeItem[]) {
    this._modelSource.modifyModel((model) => {
      for (const nodeItem of nodesToSelect) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.isSelected = true;
        }
      }

      for (const nodeItem of nodesToDeselect) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.isSelected = false;
        }
      }
    });
  }

  public replaceSelection(nodesToSelect: TreeNodeItem[]) {
    this._modelSource.modifyModel((model) => {
      for (const node of model.iterateTreeModelNodes()) {
        node.isSelected = false;
      }

      for (const nodeItem of nodesToSelect) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.isSelected = true;
        }
      }
    });
  }

  public clearNodeSelection() {
    this._modelSource.modifyModel((model) => {
      for (const node of model.iterateTreeModelNodes()) {
        node.isSelected = false;
      }
    });
  }

  public setCheckboxStates(stateChanges: CheckboxStateChange[]) {
    this._modelSource.modifyModel((model) => {
      for (const { nodeItem, newState } of stateChanges) {
        const node = model.getNode(nodeItem.id);
        if (node !== undefined) {
          node.checkbox.state = newState;
        }
      }
    });
  }
}
