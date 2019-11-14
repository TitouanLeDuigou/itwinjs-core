/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { XAndY } from "@bentley/geometry-core";
import {
  AccuSnap,
  IModelApp,
  IModelAppOptions,
  MessageBoxIconType,
  MessageBoxType,
  MessageBoxValue,
  NotificationManager,
  NotifyMessageDetails,
  SelectionTool,
  SnapMode,
  TileAdmin,
  Tool,
  ToolTipOptions,
} from "@bentley/imodeljs-frontend";
import { FrontendDevTools } from "@bentley/frontend-devtools";
import ToolTip from "tooltip.js";
import { DrawingAidTestTool } from "./DrawingAidTestTool";
import { showError, showStatus } from "./Utils";
import { MarkupSelectTestTool } from "./MarkupSelectTestTool";
import { VersionComparisonTool } from "./VersionComparison";
import { IncidentMarkerDemoTool } from "./IncidentMarkerDemo";
import { ToggleFrustumIntersectionTool } from "./FrustumIntersectionDecoration";
import { MarkupTool, SaveImageTool, ZoomToSelectedElementsTool } from "./Viewer";
import { ToggleShadowMapTilesTool } from "./ShadowMapDecoration";
import {
  CloneViewportTool,
  CloseWindowTool,
  CreateWindowTool,
  DockWindowTool,
  FocusWindowTool,
  MaximizeWindowTool,
  ResizeWindowTool,
  RestoreWindowTool,
  Surface,
} from "./Surface";

declare var BUILD_SEMVER: string;

class DisplayTestAppAccuSnap extends AccuSnap {
  private readonly _activeSnaps: SnapMode[] = [SnapMode.NearestKeypoint];

  public get keypointDivisor() { return 2; }
  public getActiveSnapModes(): SnapMode[] { return this._activeSnaps; }
  public setActiveSnapModes(snaps: SnapMode[]): void {
    this._activeSnaps.length = snaps.length;
    for (let i = 0; i < snaps.length; i++)
      this._activeSnaps[i] = snaps[i];
  }
}

class Notifications extends NotificationManager {
  private _toolTip?: ToolTip;
  private _el?: HTMLElement;
  private _tooltipDiv?: HTMLDivElement;

  public outputPrompt(prompt: string) { showStatus(prompt); }

  /** Output a message and/or alert to the user. */
  public outputMessage(message: NotifyMessageDetails) {
    showError(message.briefMessage);
    DisplayTestApp.surface.notifications.addMessage(message);
  }

  public async openMessageBox(_mbType: MessageBoxType, message: HTMLElement | string, _icon: MessageBoxIconType): Promise<MessageBoxValue> {
    const rootDiv = document.getElementById("root") as HTMLDivElement;
    if (!rootDiv)
      return MessageBoxValue.Cancel;

    // create a dialog element.
    const dialog = document.createElement("dialog") as HTMLDialogElement;
    dialog.className = "notification-messagebox";

    // set up the message
    const span = document.createElement("span");
    if (typeof message === "string")
      span.innerHTML = message;
    else
      span.appendChild(message);
    span.className = "notification-messageboxtext";
    dialog.appendChild(span);

    // make the ok button
    const button = document.createElement("button");
    button.className = "notification-messageboxbutton";
    button.innerHTML = "Ok";
    dialog.appendChild(button);

    const promise = new Promise<MessageBoxValue>((resolve, _rej) => {
      button.addEventListener("click", () => {
        dialog.close();
        rootDiv.removeChild(dialog);
        resolve(MessageBoxValue.Ok);
      });
    });

    // add the dialog to the root div element and show it.
    rootDiv.appendChild(dialog);
    dialog.showModal();
    return promise;
  }

  public get isToolTipSupported() { return true; }
  public get isToolTipOpen() { return undefined !== this._toolTip; }

  public clearToolTip(): void {
    if (!this.isToolTipOpen)
      return;

    this._toolTip!.dispose();
    this._el!.removeChild(this._tooltipDiv!);
    this._toolTip = undefined;
    this._el = undefined;
    this._tooltipDiv = undefined;
  }

  protected _showToolTip(el: HTMLElement, message: HTMLElement | string, pt?: XAndY, options?: ToolTipOptions): void {
    this.clearToolTip();

    if (undefined === pt) {
      const rect = el.getBoundingClientRect();
      pt = { x: rect.width / 2, y: rect.height / 2 };
    }

    const location = document.createElement("div");
    const height = 20;
    const width = 20;
    location.style.position = "absolute";
    location.style.top = (pt.y - height / 2) + "px";
    location.style.left = (pt.x - width / 2) + "px";
    location.style.width = width + "px";
    location.style.height = height + "px";

    el.appendChild(location);

    this._el = el;
    this._tooltipDiv = location;
    this._toolTip = new ToolTip(location, { trigger: "manual", html: true, placement: (options && options.placement) ? options.placement as any : "right-start", title: message });
    this._toolTip!.show();
  }
}

class SVTSelectionTool extends SelectionTool {
  public static toolId = "SVTSelect";
  protected initSelectTool() {
    super.initSelectTool();

    // ###TODO Want to do this only if version comparison enabled, but meh.
    IModelApp.locateManager.options.allowExternalIModels = true;
  }
}

class RefreshTilesTool extends Tool {
  public static toolId = "RefreshTiles";
  public static get maxArgs() { return undefined; }

  public run(changedModelIds?: string[]): boolean {
    if (undefined !== changedModelIds && 0 === changedModelIds.length)
      changedModelIds = undefined;

    IModelApp.viewManager.refreshForModifiedModels(changedModelIds);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
}

class PurgeTileTreesTool extends Tool {
  public static toolId = "PurgeTileTrees";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return undefined; }

  public run(modelIds?: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (undefined !== modelIds && 0 === modelIds.length)
      modelIds = undefined;

    vp.iModel.tiles.purgeTileTrees(modelIds).then(() => { // tslint:disable-line:no-floating-promises
      IModelApp.viewManager.refreshForModifiedModels(modelIds);
    });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
}

class ShutDownTool extends Tool {
  public static toolId = "ShutDown";

  public run(_args: any[]): boolean {
    DisplayTestApp.surface.closeAllViewers();
    IModelApp.shutdown();
    debugger; // tslint:disable-line:no-debugger
    return true;
  }
}

export class DisplayTestApp {
  public static tileAdminProps: TileAdmin.Props = {
    retryInterval: 50,
    enableInstancing: true,
  };

  private static _surface?: Surface;
  public static get surface() { return this._surface!; }
  public static set surface(surface: Surface) { this._surface = surface; }

  public static async startup(opts?: IModelAppOptions): Promise<void> {
    opts = opts ? opts : {};
    opts.accuSnap = new DisplayTestAppAccuSnap();
    opts.notifications = new Notifications();
    opts.tileAdmin = TileAdmin.create(DisplayTestApp.tileAdminProps);
    IModelApp.startup(opts);

    IModelApp.applicationLogoCard = () => {
      const div = document.createElement("div");
      const image = new Image();
      image.src = "DTA.png";
      image.width = 300;
      div.appendChild(image);

      const attr = document.createElement("p");
      attr.style.textAlign = "center";
      attr.style.fontStyle = "italic";
      attr.style.fontWeight = "bold";
      attr.innerHTML = "Display Test App " + BUILD_SEMVER;
      div.appendChild(attr);
      return IModelApp.makeLogoCard(div, "dta-app-name");
    };

    const svtToolNamespace = IModelApp.i18n.registerNamespace("SVTTools");
    DrawingAidTestTool.register(svtToolNamespace);
    MarkupSelectTestTool.register(svtToolNamespace);
    SVTSelectionTool.register(svtToolNamespace);
    ResizeWindowTool.register(svtToolNamespace);
    RefreshTilesTool.register(svtToolNamespace);
    PurgeTileTreesTool.register(svtToolNamespace);
    ShutDownTool.register(svtToolNamespace);

    CreateWindowTool.register(svtToolNamespace);
    FocusWindowTool.register(svtToolNamespace);
    MaximizeWindowTool.register(svtToolNamespace);
    CloneViewportTool.register(svtToolNamespace);
    CloseWindowTool.register(svtToolNamespace);
    RestoreWindowTool.register(svtToolNamespace);
    DockWindowTool.register(svtToolNamespace);

    VersionComparisonTool.register(svtToolNamespace);
    SaveImageTool.register(svtToolNamespace);
    MarkupTool.register(svtToolNamespace);
    ZoomToSelectedElementsTool.register(svtToolNamespace);
    IncidentMarkerDemoTool.register(svtToolNamespace);
    ToggleFrustumIntersectionTool.register(svtToolNamespace);
    ToggleShadowMapTilesTool.register(svtToolNamespace);

    IModelApp.toolAdmin.defaultToolId = SVTSelectionTool.toolId;

    return FrontendDevTools.initialize();
  }

  public static setActiveSnapModes(snaps: SnapMode[]): void {
    (IModelApp.accuSnap as DisplayTestAppAccuSnap).setActiveSnapModes(snaps);
  }

  public static setActiveSnapMode(snap: SnapMode): void { this.setActiveSnapModes([snap]); }
}
