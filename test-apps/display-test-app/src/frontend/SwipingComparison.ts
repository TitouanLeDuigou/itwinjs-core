/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClipStyle, ColorDef, CutStyle, FeatureAppearance, Frustum, RenderMode, RgbColor } from "@itwin/core-common";
import { AccuDrawHintBuilder, FeatureOverrideProvider, FeatureSymbology, GraphicBranch, IModelApp, RenderClipVolume, SceneContext, ScreenViewport, TiledGraphicsProvider, TileTreeReference, Viewport } from "@itwin/core-frontend";
import { ClipPlane, ClipPrimitive, ClipVector, ConvexClipPlaneSet, Point3d, Transform, Vector3d } from "@itwin/core-geometry";

export enum ComparisonType {
  Wireframe,
  // RealityData,
  AppearanceOverrides,
  AlwaysDrawn,
  ClipStyles,
}

class FeatureComparison implements FeatureOverrideProvider {
  public static dimFeatures = false;
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _viewport: Viewport) {
    if (FeatureComparison.dimFeatures)
      overrides.setDefaultOverrides(FeatureAppearance.fromTransparency(0.75));
    else
      overrides.setDefaultOverrides(FeatureAppearance.defaults);
  }
}
export default class SwipingComparisonApi {
  private static _provider: SampleTiledGraphicsProvider | undefined;
  private static _viewport?: Viewport;

  /** Called by the showcase before swapping to another sample. */
  public static teardown(): void {
    if (undefined !== SwipingComparisonApi._viewport && undefined !== SwipingComparisonApi._provider) {
      SwipingComparisonApi.disposeProvider(SwipingComparisonApi._viewport, SwipingComparisonApi._provider);
      SwipingComparisonApi._provider = undefined;
    }
  }

  /** Adds a listener that will be triggered when the viewport is updated. Returns a functions to remove that listener. */
  public static listerForViewportUpdate(viewport: Viewport, onUpdate: (viewport: Viewport) => void): () => void {
    // There is event in the viewport called onViewChanged.  As stated in the js docs, the function is invoked, VERY frequently.
    //  Using that event when doing heavy changes in that event, performance can start to suffer.
    return viewport.onRender.addListener(onUpdate);
  }

  /** Get the frustum of the camera using the viewport API. */
  public static getFrustum(vp: Viewport): Frustum {
    return vp.getFrustum().clone();
  }

  /** Get the rectangle defining the area of the HTML canvas using the viewport API. */
  public static getRect(vp: ScreenViewport): DOMRect {
    // Calling DOMRect.fromRect to clone the rect so the state in the App will update properly.
    return DOMRect.fromRect(vp.getClientRect());
  }

  /** Convert a point in the view space to the world space using the viewport API. */
  public static getWorldPoint(vp: Viewport, screenPoint: Point3d): Point3d {
    return vp.viewToWorld(screenPoint);
  }

  /** Return a vector perpendicular to the view considering the camera's perspective. */
  public static getPerpendicularNormal(vp: Viewport, screenPoint: Point3d): Vector3d {
    const point = SwipingComparisonApi.getWorldPoint(vp, screenPoint);

    const boresite = AccuDrawHintBuilder.getBoresite(point, vp);
    const viewY = vp.rotation.rowY();
    const normal = viewY.crossProduct(boresite.direction);
    return normal;
  }

  /** Will create an effect allowing for different views on either side of an arbitrary point in the view space.  This will allows us to compare the effect the views have on the iModel. */
  public static compare(screenPoint: Point3d, viewport: Viewport, comparisonType: ComparisonType, negate: boolean) {
    if (viewport.viewportId !== SwipingComparisonApi._viewport?.viewportId)
      SwipingComparisonApi.teardown();
    SwipingComparisonApi._viewport = viewport;
    const provider = SwipingComparisonApi._provider;
    if (!viewport.view.isSpatialView())
      return;

    if (undefined !== provider && provider.comparisonType !== comparisonType) {
      SwipingComparisonApi.disposeProvider(viewport, SwipingComparisonApi._provider!);
      SwipingComparisonApi._provider = undefined;
    }

    if (undefined === SwipingComparisonApi._provider) {
      SwipingComparisonApi._provider = SwipingComparisonApi.createProvider(screenPoint, viewport, comparisonType, negate);
      viewport.addTiledGraphicsProvider(SwipingComparisonApi._provider);
    }

    SwipingComparisonApi.updateProvider(screenPoint, viewport, SwipingComparisonApi._provider);
  }

  /** Creates a [ClipVector] based on the arguments. */
  private static createClip(vec: Vector3d, pt: Point3d): ClipVector {
    const plane = ClipPlane.createNormalAndPoint(vec, pt)!;
    const planes = ConvexClipPlaneSet.createPlanes([plane]);
    return ClipVector.createCapture([ClipPrimitive.createCapture(planes)]);
  }

  /** Updates the location of the clipping plane in both the provider and viewport. */
  private static updateProvider(screenPoint: Point3d, viewport: Viewport, provider: SampleTiledGraphicsProvider) {
    // Update Clipping plane in provider and in the view.
    const normal = SwipingComparisonApi.getPerpendicularNormal(viewport, screenPoint);
    const worldPoint = SwipingComparisonApi.getWorldPoint(viewport, screenPoint);

    // Update in Provider
    const clip = SwipingComparisonApi.createClip(normal.clone().negate(), worldPoint);
    provider.setClipVector(clip);

    // Update in Viewport
    viewport.view.setViewClip(SwipingComparisonApi.createClip(normal.clone(), worldPoint));

    viewport.synchWithView();
  }

  /** Creates a [TiledGraphicsProvider] and adds it to the viewport.  This also sets the clipping plane used for the comparison. */
  private static createProvider(screenPoint: Point3d, viewport: Viewport, type: ComparisonType, negate: boolean): SampleTiledGraphicsProvider {
    let normal = SwipingComparisonApi.getPerpendicularNormal(viewport, screenPoint);
    let rtnProvider;

    if (negate)
      normal = normal.negate();
    // Note the normal is negated, this is flip the clipping plane created from it.
    const negatedClip = SwipingComparisonApi.createClip(normal.clone().negate(), SwipingComparisonApi.getWorldPoint(viewport, screenPoint));
    switch (type) {
      case ComparisonType.Wireframe:
      default:
        rtnProvider = new ComparisonWireframeProvider(negatedClip, viewport);
        break;
      // case ComparisonType.RealityData:
      //   rtnProvider = new ComparisonRealityModelProvider(negatedClip);
      //   break;
      case ComparisonType.AppearanceOverrides:
        rtnProvider = new FeatureOverrideComparisonProvider(negatedClip, viewport);
        break;
      case ComparisonType.AlwaysDrawn:
        rtnProvider = new AlwaysDrawnComparisonProvider(negatedClip, viewport);
        break;
      case ComparisonType.ClipStyles:
        rtnProvider = new ClipStyleComparisonProvider(negatedClip, viewport);
        break;
    }
    return rtnProvider;
  }

  /** Removes the provider from the viewport, and disposed of any resources it has. */
  private static disposeProvider(viewport: Viewport, provider: SampleTiledGraphicsProvider) {
    viewport.dropTiledGraphicsProvider(provider);
  }

  /** Get first available reality models and attach it to displayStyle. */
  // public static async attachRealityData(viewport: Viewport) {
  //   const imodel = viewport.iModel;
  //   const style = viewport.displayStyle.clone();
  //   const RealityDataClient = new RealityDataAccessClient();
  //   const available: RealityDataResponse = await RealityDataClient.getRealityDatas(await IModelApp.authorizationClient!.getAccessToken(), imodel.iTwinId, undefined);

  //   const availableModels: ContextRealityModelProps[] = [];

  //   for (const rdEntry of available.realityDatas) {
  //     const name = undefined !== rdEntry.displayName ? rdEntry.displayName : rdEntry.id;
  //     const rdSourceKey = {
  //       provider: RealityDataProvider.ContextShare,
  //       format: rdEntry.type === "OPC" ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile,
  //       id: rdEntry.id,
  //     };
  //     const tilesetUrl = await IModelApp.realityDataAccess?.getRealityDataUrl(imodel.iTwinId, rdSourceKey.id);
  //     if (tilesetUrl) {
  //       const entry: ContextRealityModelProps = {
  //         rdSourceKey,
  //         tilesetUrl,
  //         name,
  //         description: rdEntry?.description,
  //         realityDataId: rdSourceKey.id,
  //       };

  //       availableModels.push(entry);
  //       break;
  //     }
  //   }

  //   for (const crmProp of availableModels) {
  //     style.attachRealityModel(crmProp);
  //     viewport.displayStyle = style;
  //   }
  // }

  /** Set the transparency of the reality models using the Feature Override API. */
  // public static setRealityModelTransparent(vp: Viewport, transparent: boolean): void {
  //   const override = { transparency: transparent ? 1.0 : 0.0 };
  //   vp.displayStyle.settings.contextRealityModels.models.forEach((model) => {
  //     model.appearanceOverrides = model.appearanceOverrides ? model.appearanceOverrides.clone(override) : FeatureAppearance.fromJSON(override);
  //   });
  // }
}

abstract class SampleTiledGraphicsProvider implements TiledGraphicsProvider {
  public readonly abstract comparisonType: ComparisonType;
  // // Do not apply the view's clip to this provider's graphics - it applies its own (opposite) clip to its graphics.
  public viewFlagOverrides = { renderMode: RenderMode.Wireframe, showClipVolume: false };
  public clipVolume: RenderClipVolume | undefined;
  constructor(clipVector: ClipVector, _vp: Viewport) {
    // Create the object that will be used later by the "addToScene" method.
    this.setClipVector(clipVector);
  }

  /** Apply the supplied function to each [[TileTreeReference]] to be drawn in the specified [[Viewport]]. */
  public forEachTileTreeRef(viewport: ScreenViewport, func: (ref: TileTreeReference) => void): void {
    viewport.view.forEachTileTreeRef(func);

    // this.viewFlagOverrides.showClipVolume = false;
  }

  /** Overrides the logic for adding this provider's graphics into the scene. */
  public addToScene(output: SceneContext): void {

    // Save view to be replaced after comparison is drawn
    const vp = output.viewport;
    // const clip = vp.view.getViewClip();

    // Replace the clipping plane with a flipped one.
    // vp.view.setViewClip(this.clipVolume?.clipVector);

    this.prepareNewBranch(vp);

    const context: SceneContext = new SceneContext(vp);
    vp.view.createScene(context);

    // This graphics branch contains the graphics that were excluded by the flipped clipping plane
    const gfx = context.graphics;
    if (0 < gfx.length) {
      const ovrs = new FeatureSymbology.Overrides(vp);

      const branch = new GraphicBranch();
      branch.symbologyOverrides = ovrs;
      for (const gf of gfx)
        branch.entries.push(gf);

      // Overwrites the view flags for this view branch.
      branch.setViewFlagOverrides(this.viewFlagOverrides);
      // Draw the graphics to the screen.
      output.outputGraphic(IModelApp.renderSystem.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume: this.clipVolume }));
    }

    // Return the old clip to the view.
    // vp.view.setViewClip(clip);

    this.resetOldView(vp);
  }

  protected abstract prepareNewBranch(vp: Viewport): void;
  protected abstract resetOldView(vp: Viewport): void;

  /** The clip vector passed in should be flipped with respect to the normally applied clip vector.
   * It could be calculated in the "addToScene(...)" but we want to optimize that method.
   */
  public setClipVector(clipVector: ClipVector): void {
    this.clipVolume = IModelApp.renderSystem.createClipVolume(clipVector);
  }
}

/** Should render on the comparison of the divider with Wireframe. */
class ComparisonWireframeProvider extends SampleTiledGraphicsProvider {
  public comparisonType = ComparisonType.Wireframe;

  private _oldClip: ClipVector | undefined;

  constructor(clip: ClipVector, vp: Viewport) {
    super(clip, vp);
    // Create the objects that will be used later by the "addToScene" method.
    this.viewFlagOverrides.renderMode = RenderMode.Wireframe;

    vp.viewFlags = vp.viewFlags.with("clipVolume", true);
  }

  protected prepareNewBranch(vp: Viewport): void {
    this._oldClip = vp.view.getViewClip();
    vp.view.setViewClip(this.clipVolume?.clipVector);

  }
  protected resetOldView(vp: Viewport): void {
    vp.view.setViewClip(this._oldClip);
    this._oldClip = undefined;
  }
}

/** Should create two sets of graphics on comparison side of the Divider.  One that was a transparency of .75, and another opaque. */
class FeatureOverrideComparisonProvider extends SampleTiledGraphicsProvider {
  public comparisonType = ComparisonType.AppearanceOverrides;

  constructor(clip: ClipVector, vp: Viewport) {
    super(clip, vp);

    // even if clip volume is not enabled, the graphics branch created by the provider still obeys it.
    vp.viewFlags = vp.viewFlags.with("clipVolume", false);
    vp.addFeatureOverrideProvider(new FeatureComparison());
    FeatureComparison.dimFeatures = true;
  }

  protected prepareNewBranch(_vp: Viewport): void {
    FeatureComparison.dimFeatures = false;
  }
  protected resetOldView(_vp: Viewport): void {
    FeatureComparison.dimFeatures = true;
  }
}

/** Should render nothing on the main side, but render all models on the comparison side. */
class ClipStyleComparisonProvider extends SampleTiledGraphicsProvider {
  public comparisonType = ComparisonType.ClipStyles;
  public readonly compare1ClipStyle = ClipStyle.create(false, CutStyle.defaults, RgbColor.fromColorDef(ColorDef.blue), RgbColor.fromColorDef(ColorDef.green));
  public readonly compare2ClipStyle = ClipStyle.create(true, CutStyle.defaults, RgbColor.fromColorDef(ColorDef.red), RgbColor.fromColorDef(ColorDef.black));

  constructor(clip: ClipVector, vp: Viewport) {
    super(clip, vp);

    // even if clip volume is not enabled, the graphics branch created by the provider still obeys it.
    vp.viewFlags = vp.viewFlags.with("clipVolume", true);
    vp.clipStyle = this.compare1ClipStyle;
  }

  protected prepareNewBranch(vp: Viewport): void {
    vp.clipStyle = this.compare2ClipStyle;
  }
  protected resetOldView(vp: Viewport): void {
    vp.clipStyle = this.compare1ClipStyle;
  }
}

/** Should render nothing on the main side, but render all models on the comparison side. */
class AlwaysDrawnComparisonProvider extends SampleTiledGraphicsProvider {
  public comparisonType = ComparisonType.AlwaysDrawn;

  constructor(clip: ClipVector, vp: Viewport) {
    super(clip, vp);

    // even if clip volume is not enabled, the graphics branch created by the provider still obeys it.
    vp.viewFlags = vp.viewFlags.with("clipVolume", false);
    vp.setAlwaysDrawn(new Set(), true);
  }

  protected prepareNewBranch(vp: Viewport): void {
    vp.setAlwaysDrawn(new Set(), false);
  }
  protected resetOldView(vp: Viewport): void {
    vp.setAlwaysDrawn(new Set(), true);
  }
}

// class ComparisonRealityModelProvider extends SampleTiledGraphicsProvider {
//   public comparisonType = ComparisonType.RealityData;

//   protected prepareNewBranch(vp: Viewport): void {
//     // Hides the reality model while rendering the other graphics branch.
//     SwipingComparisonApi.setRealityModelTransparent(vp, true);
//   }
//   protected resetOldView(vp: Viewport): void {
//     // Makes the reality model visible again in the viewport.
//     SwipingComparisonApi.setRealityModelTransparent(vp, false);
//   }
// }
