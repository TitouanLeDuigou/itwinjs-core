/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient } from "@bentley/imodeljs-clients";
import { ConnectClient, Project, IModelHubClient, Briefcase, DeploymentEnv } from "@bentley/imodeljs-clients";
import { Code } from "@bentley/imodeljs-common/lib/Code";
import { Gateway } from "@bentley/imodeljs-common/lib/Gateway";
import { Element, InformationPartitionElement } from "../Element";
import { IModelDb } from "../IModelDb";
import { AddonRegistry } from "../AddonRegistry";
import { IModelGateway } from "@bentley/imodeljs-common/lib/gateway/IModelGateway";
import { ElementProps, GeometricElementProps } from "@bentley/imodeljs-common/lib/ElementProps";
import { DefinitionModel, Model } from "../Model";
import { SpatialCategory } from "../Category";
import { Appearance } from "@bentley/imodeljs-common/lib/SubCategoryAppearance";
import { IModelJsFs, IModelJsFsStats } from "../IModelJsFs";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelHostConfiguration, IModelHost, iModelHost } from "../IModelHost";
import * as path from "path";
// import { Logger, LogLevel } from "@bentley/bentleyjs-core/lib/Logger";

// Logger.initializeToConsole();
// Logger.setLevel("Performance", LogLevel.Info);
// Logger.setLevelDefault(LogLevel.Error);
// Logger.setLevel("Diagnostics", LogLevel.None);
// Logger.setLevel("ECObjectsNative", LogLevel.None);
// Logger.setLevel("BeSQLite", LogLevel.None);
// Logger.setLevel("ECPresentation", LogLevel.None);

// Initialize the gateway classes used by tests
Gateway.initialize(IModelGateway);

// Initialize the Node addon used by tests
AddonRegistry.loadAndRegisterStandardAddon();

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
  enableTransactions?: boolean;
  openMode?: OpenMode;
}

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

/** Test users with various permissions */
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static readonly regular: UserCredentials = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
  };

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static readonly manager: UserCredentials = {
    email: "Manager.IModelJsTestUser@mailinator.com",
    password: "Manager@iMJs",
  };

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static readonly super: UserCredentials = {
    email: "Super.IModelJsTestUser@mailinator.com",
    password: "Super@iMJs",
  };

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static readonly superManager: UserCredentials = {
    email: "SuperManager.IModelJsTestUser@mailinator.com",
    password: "SuperManager@iMJs",
  };

  /** Just another user */
  public static readonly user1: UserCredentials = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  /** Just another user */
  public static readonly user2: UserCredentials = {
    email: "bentleyvilnius@gmail.com",
    password: "Q!w2e3r4t5",
  };

}

export class IModelTestUtils {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  private static _connectClient: ConnectClient | undefined;
  public static get connectClient(): ConnectClient {
    if (!IModelTestUtils._connectClient)
      IModelTestUtils._connectClient = new ConnectClient(IModelTestUtils.iModelHubDeployConfig);
    return IModelTestUtils._connectClient!;
  }

  private static _hubClient: IModelHubClient | undefined;
  public static get hubClient(): IModelHubClient {
    if (!IModelTestUtils._hubClient)
      IModelTestUtils._hubClient = new IModelHubClient(IModelTestUtils.iModelHubDeployConfig);
    return IModelTestUtils._hubClient!;
  }

  private static _iModelHubDeployConfig: DeploymentEnv = "QA";
  public static set iModelHubDeployConfig(deployConfig: DeploymentEnv) {
    if (iModelHost) {
      throw new Error("Cannot change the deployment configuration after the backend has started up. Set the configuration earlier, or call iModelEngine.shutdown().");
    }
    IModelTestUtils._iModelHubDeployConfig = deployConfig;
    IModelTestUtils._connectClient = undefined;
    IModelTestUtils._hubClient = undefined;
  }
  public static get iModelHubDeployConfig(): DeploymentEnv {
    return IModelTestUtils._iModelHubDeployConfig;
  }

  public static setIModelHubDeployConfig(deployConfig: DeploymentEnv) {
    if (iModelHost) {
      throw new Error("Cannot change the deployment configuration after the backend has started up. Set the configuration earlier, or call iModelEngine.shutdown().");
    }

    const config = new IModelHostConfiguration();
    config.iModelHubDeployConfig = deployConfig;
    IModelTestUtils._connectClient = new ConnectClient(deployConfig);
    IModelTestUtils._hubClient = new IModelHubClient(deployConfig);
  }

  public static async getTestUserAccessToken(userCredentials?: any): Promise<AccessToken> {
    if (userCredentials === undefined)
      userCredentials = IModelTestUtils.user;
    const env = IModelTestUtils._iModelHubDeployConfig;
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(env)).getToken(userCredentials.email, userCredentials.password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient(env)).getToken(authToken!);
    assert(accessToken);

    return accessToken;
  }

  public static async getTestProjectId(accessToken: AccessToken, projectName: string): Promise<string> {
    const project: Project = await IModelTestUtils.connectClient.getProject(accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const iModels = await IModelTestUtils.hubClient.getIModels(accessToken, projectId, {
      $select: "*",
      $filter: "Name+eq+'" + iModelName + "'",
    });
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

  private static async deleteAllBriefcases(accessToken: AccessToken, iModelId: string) {
    const promises = new Array<Promise<void>>();
    const briefcases = await IModelTestUtils.hubClient.getBriefcases(accessToken, iModelId);
    briefcases.forEach((briefcase: Briefcase) => {
      promises.push(IModelTestUtils.hubClient.deleteBriefcase(accessToken, iModelId, briefcase.briefcaseId!));
    });
    await Promise.all(promises);
  }

  /** Deletes all acquired briefcases for specified iModel and User, *if* the maximum limit of briefcases that can be acquired
   * has been reached.
   */
  public static async deleteBriefcasesIfAcquireLimitReached(accessToken: AccessToken, projectName: string, iModelName: string): Promise<void> {
    const projectId: string = await IModelTestUtils.getTestProjectId(accessToken, projectName);
    const iModelId: string = await IModelTestUtils.getTestIModelId(accessToken, projectId, iModelName);

    try {
      const briefcaseIds = new Array<number>();
      let ii = 5; // todo: IModelHub needs to provide a better way for testing this limit. We are arbitrarily testing for 5 briefcases here!
      while (ii-- > 0) {
        const briefcaseId: number = await IModelTestUtils.hubClient.acquireBriefcase(accessToken, iModelId);
        briefcaseIds.push(briefcaseId);
      }
      for (const briefcaseId of briefcaseIds) {
        await IModelTestUtils.hubClient.deleteBriefcase(accessToken, iModelId, briefcaseId);
      }
    } catch (error) {
      console.log(`Reached limit of maximum number of briefcases for ${projectName}:${iModelName}. Deleting all briefcases.`); // tslint:disable-line
      IModelTestUtils.deleteAllBriefcases(accessToken, iModelId);
    }
  }

  private static getStat(name: string) {
    let stat: IModelJsFsStats | undefined;
    try {
      stat = IModelJsFs.lstatSync(name);
    } catch (err) {
      stat = undefined;
    }
    return stat;
  }

  public static createStandaloneIModel(filename: string, rootSubjectName: string): IModelDb {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    const pathname = path.join(destPath, filename);
    if (IModelJsFs.existsSync(pathname))
      IModelJsFs.unlinkSync(pathname);

    const iModel: IModelDb = IModelDb.createStandalone(pathname, rootSubjectName);

    assert.isNotNull(iModel);
    assert.isTrue(IModelJsFs.existsSync(pathname));
    return iModel!;
  }

  public static openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    if (opts === undefined)
      opts = {};

    const srcName = path.join(KnownTestLocations.assetsDir, filename);
    const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename! : filename));
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
      IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static closeIModel(iModel: IModelDb) {
    iModel.closeStandalone();
  }

  public static getUniqueModelCode(testIModel: IModelDb, newModelCodeBase: string): Code {
    let newModelCode: string = newModelCodeBase;
    let iter: number = 0;
    while (true) {
      const modelCode = InformationPartitionElement.createCode(testIModel.elements.getRootSubject(), newModelCode);
      if (testIModel.elements.queryElementIdByCode(modelCode) === undefined)
        return modelCode;

      newModelCode = newModelCodeBase + iter;
      ++iter;
    }
  }

  //
  // Create and insert a PhysicalPartition element (in the repositoryModel) and an associated PhysicalModel.
  //
  public static createAndInsertPhysicalModel(testImodel: IModelDb, newModelCode: Code, privateModel: boolean = false): Id64[] {
    let modeledElementId: Id64;
    let newModelId: Id64;

    //  The modeled element
    const modeledElementProps: ElementProps = {
      classFullName: "BisCore:PhysicalPartition",
      iModel: testImodel,
      parent: { id: testImodel.elements.rootSubjectId, relClassName: "BisCore:SubjectOwnsPartitionElements" },
      model: testImodel.models.repositoryModelId,
      code: newModelCode,
    };
    const modeledElement: Element = testImodel.elements.createElement(modeledElementProps);
    modeledElementId = testImodel.elements.insertElement(modeledElement);

    assert.isTrue(modeledElementId.isValid());

    // The model
    const newModel = testImodel.models.createModel({ modeledElement: modeledElementId, classFullName: "BisCore:PhysicalModel", isPrivate: privateModel });
    newModelId = testImodel.models.insertModel(newModel);

    assert.isTrue(newModelId.isValid());
    assert.isTrue(newModel.id.isValid());
    assert.deepEqual(newModelId, newModel.id);

    return [modeledElementId, newModelId];
  }

  public static getUniqueSpatialCategoryCode(scopeModel: Model, newCodeBaseValue: string): Code {
    let newCodeValue: string = newCodeBaseValue;
    let iter: number = 0;
    while (true) {
      if (SpatialCategory.queryCategoryIdByName(scopeModel, newCodeValue) === undefined)
        return SpatialCategory.createCode(scopeModel, newCodeValue);

      newCodeValue = newCodeBaseValue + iter;
      ++iter;
    }
  }

  // Create a SpatialCategory, insert it, and set its default appearance
  public static createAndInsertSpatialCategory(definitionModel: DefinitionModel, categoryName: string, appearance: Appearance): Id64 {
    const cat: SpatialCategory = SpatialCategory.create(definitionModel, categoryName);
    cat.id = cat.insert();
    cat.setDefaultAppearance(appearance);
    return cat.id;
  }

  // Create a PhysicalObject. (Does not insert it.)
  public static createPhysicalObject(testImodel: IModelDb, modelId: Id64, categoryId: Id64, elemCode?: Code): Element {
    const elementProps: GeometricElementProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: testImodel,
      model: modelId,
      category: categoryId,
      code: elemCode ? elemCode : Code.createEmpty(),
    };

    return testImodel.elements.createElement(elementProps);
  }

  public static startBackend() {
    IModelTestUtils.iModelHubDeployConfig = IModelTestUtils._iModelHubDeployConfig;
    IModelHost.startup(new IModelHostConfiguration());
  }
}

// Start the backend
IModelTestUtils.startBackend();
