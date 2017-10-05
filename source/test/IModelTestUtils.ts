/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Element } from "../Element";
import { Model } from "../Model";
import { IModel } from "../IModel";
import { IModelDb } from "../backend/IModelDb";
import { SpatialCategory, DrawingCategory } from "../Category";
// import { Model } from "../Model";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Code } from "../Code";
import { IModelError, IModelStatus } from "../IModelError";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import * as fs from "fs-extra";

declare const __dirname: string;

export class IModelTestUtils {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  private static getStat(name: string) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(name);
    } catch (err) { stat = undefined; }
    return stat;
  }

  public static async openIModel(filename: string): Promise<IModelDb> {
    const destPath = __dirname + "/output";
    if (!fs.existsSync(destPath))
      fs.mkdirSync(destPath);

    const srcName = __dirname + "/assets/" + filename;
    const dbName = destPath + "/" + filename;
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtime.getTime() !== destStat.mtime.getTime()) {
      fs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = await IModelDb.openStandalone(dbName); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static closeIModel(iModel: IModelDb) {
    iModel.closeStandalone();
  }

  // TODO: This neeeds a home
  public static queryCodeSpecId(imodel: IModelDb, name: string): Id64 | undefined {
    return imodel.withPreparedECSqlStatement("SELECT ecinstanceid FROM BisCore.CodeSpec WHERE Name=?", (stmt: ECSqlStatement) => {
      stmt.bindValues([name]);
      if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
        return;
      }
      return new Id64(stmt.getValues().ecinstanceid);
    });
  }

  // TODO: This needs a home
  public static queryElementIdByCodeSync(imodel: IModelDb, code: Code): Id64 | undefined {
    if (!code.spec.isValid()) {
      throw new IModelError(IModelStatus.InvalidCodeSpec);
    }
    if (code.value === undefined) {
      throw new IModelError(IModelStatus.InvalidCode);
    }
    return imodel.withPreparedECSqlStatement("SELECT ecinstanceid FROM " + Element.sqlName + " WHERE CodeSpec=? AND CodeScope=? AND CodeValue=?", (stmt: ECSqlStatement) => {
      stmt.bindValues([code.spec, new Id64(code.scope), code.value!]);
      if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
        return undefined;
      }
      const id = new Id64(stmt.getValues().ecinstanceid);
      imodel.releasePreparedECSqlStatement(stmt);
      return id;
    });
  }

  // TODO: This needs a home
  public static async queryElementIdByCode(imodel: IModel, code: Code): Promise<Id64> {
    if (!code.spec.isValid()) {
      throw new IModelError(IModelStatus.InvalidCodeSpec);
    }
    if (code.value === undefined) {
      throw new IModelError(IModelStatus.InvalidCode);
    }
    const rows: any[] = await imodel.executeQuery("SELECT ecinstanceid as id FROM " + Element.sqlName + " WHERE CodeSpec.Id=? AND CodeScope.Id=? AND CodeValue=?", [code.spec, new Id64(code.scope), code.value!]);
    if (rows.length === 0 || rows[0].id === undefined)
      return Promise.reject(new IModelError(IModelStatus.NotFound));
    const id = new Id64(rows[0].id);
    return id;
  }

  /** Create a Code for a DrawingCategory given a name that is meant to be unique within the scope of the specified DefinitionModel 
   * @param imodel  The IModel
   * @param parentModelId The scope of the category -- *** TODO: should be DefinitionModel
   * @param codeValue The name of the category
   * @return a Promise if the category's Code
   */
  public static async createDrawingCategoryCode(imodel: IModel, definitionModelId: Id64, codeValue: string): Promise<Code> {
    const cspec = await imodel.codeSpecs.getCodeSpecByName(DrawingCategory.getCodeSpecName());
    return new Code({ spec: cspec.id, scope: definitionModelId.toString(), value: codeValue });
  }

  /** Create a Code for a SpatialCategory given a name that is meant to be unique within the scope of the specified DefinitionModel 
   * @param imodel  The IModel
   * @param parentModelId The scope of the category -- *** TODO: should be DefinitionModel
   * @param codeValue The name of the category
   * @return a Promise if the category's Code
   */
  public static async createSpatialCategoryCode(imodel: IModel, definitionModelId: Id64, codeValue: string): Promise<Code> {
    const cspec = await imodel.codeSpecs.getCodeSpecByName(SpatialCategory.getCodeSpecName());
    return new Code({ spec: cspec.id, scope: definitionModelId.toString(), value: codeValue });
  }

  // TODO: This needs a home
  public static async getSpatiallCategoryIdByName(imodel: IModel, catname: string, scopeId?: Id64): Promise<Id64> {
    if (scopeId === undefined)
      scopeId = Model.getDictionaryId();
    const code: Code = await IModelTestUtils.createSpatialCategoryCode(imodel, scopeId, catname);
    const id: Id64 | undefined = await IModelTestUtils.queryElementIdByCode(imodel, code);
    if (id === undefined)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_NOTFOUND));
    return id;
    /*
    const stmt = imodel.getPreparedECSqlStatement("SELECT EcInstanceId as elementId FROM " + SpatialCategory.sqlName + " WHERE codevalue = ?");
    stmt.bindValues([catname]);
    if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND);
    }
    const categoryId: string = stmt.getValues().elementId;
    imodel.releasePreparedECSqlStatement(stmt);

    const id = new Id64(categoryId);
    if (!id.isValid())
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND);

    return id;
    */
  }

}
