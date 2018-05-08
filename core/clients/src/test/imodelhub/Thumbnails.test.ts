/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { TestConfig } from "../TestConfig";

import { IModelHubClient } from "../../imodelhub/Client";
import { AccessToken } from "../../Token";
import { ResponseBuilder, RequestType, ScopeType } from "../ResponseBuilder";
import * as utils from "./TestUtils";

chai.should();

const pngPrefixStr = "data:image/png;base64,iVBORw0KGgo";
function mockGetThumbnail(projectId: string, imodelId: string, size: "Small" | "Large") {
  if (!TestConfig.enableMocks)
    return;

  const requestPath = utils.createRequestUrl(ScopeType.Project, projectId, `${size}Thumbnail`, imodelId + "/$file");
  let response = pngPrefixStr; // From 64bit encoding of bytes [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  for (let i = 0; i < 3500; i++) { response += "a"; }
  ResponseBuilder.mockResponse(utils.defaultUrl, RequestType.Get, requestPath, { response });
}

describe("iModelHub ThumbnailHandler", () => {
  let accessToken: AccessToken;
  let projectId: string;
  let iModelId: string;
  const imodelName = "imodeljs-clients Thumbnails test";
  const imodelHubClient: IModelHubClient = utils.getDefaultClient();

  before(async () => {
    accessToken = await utils.login();
    projectId = await utils.getProjectId();
    await utils.createIModel(accessToken, imodelName, projectId);
    iModelId = await utils.getIModelId(accessToken, imodelName);
  });

  afterEach(() => {
    ResponseBuilder.clearMocks();
  });

  it("should get the thumbnail as a PNG file", async () => {
    mockGetThumbnail(projectId, iModelId, "Small");
    const smallImage: string = await imodelHubClient.Thumbnails().get(accessToken, projectId, iModelId, "Small");
    chai.expect(smallImage.length).greaterThan(1000);
    chai.expect(smallImage.startsWith(pngPrefixStr));

    mockGetThumbnail(projectId, iModelId, "Large");
    const largeImage: string = await imodelHubClient.Thumbnails().get(accessToken, projectId, iModelId, "Large");
    chai.expect(largeImage.length).greaterThan(3500);
    chai.expect(largeImage.startsWith(pngPrefixStr));
  });
});
