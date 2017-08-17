/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel } from "../IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import * as fs from "fs-extra";

declare const __dirname: string;

export class IModelTestUtils {
  public static async openIModel(filename: string, expectSuccess: boolean, mode: OpenMode = OpenMode.ReadWrite): Promise<IModel> {
    const destPath = __dirname + "/output";
    if (!fs.existsSync(destPath))
      fs.mkdirSync(destPath);

    const srcName = __dirname + "/assets/" + filename;
    // const dbName = destPath + "/" + filename;
    // fs.copySync(__dirname + "/assets/" + filename, dbName);
    const imodel = new IModel();
    const { error } = await imodel.openDgnDb(srcName, mode);
    assert(!expectSuccess || !error);
    return imodel;
  }
}
