/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BeEvent } from "@bentley/bentleyjs-core";
import { RpcRequest, RpcRequestStatus } from "./RpcRequest";
import { RpcInvocation } from "./RpcInvocation";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcOperation } from "./RpcOperation";
import { RpcMarshaling } from "./RpcMarshaling";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";

/** A serialized RPC operation descriptor. */
export interface SerializedRpcOperation {
  interfaceDefinition: string;
  operationName: string;
  interfaceVersion: string;
}

/** A serialized RPC operation request. */
export interface SerializedRpcRequest {
  id: string;
  authorization: string;
  operation: SerializedRpcOperation;
  method: string;
  path: string;
  parameters: string;
}

/** An RPCD operation request fulfillment. */
export interface RpcRequestFulfillment {
  /** The RPC interface for the request. */
  interfaceName: string;

  /** The id for the request. */
  id: string;

  /** The serialized result for the request. */
  result: string;

  /** A protocol-specific status code value for the request. */
  status: number;
}

/** RPC protocol event types. */
export enum RpcProtocolEvent {
  RequestCreated,
  ResponseLoaded,
  ResponseLoading,
  ConnectionErrorReceived,
  UnknownErrorReceived,
  BackendErrorReceived,
  ConnectionAborted,
  AcknowledgementReceived,
  RequestReceived,
  BackendResponseCreated,
  BackendReportedPending,
  BackendErrorOccurred,
  AcknowledgementCreated,
  ReleaseResources,
}

/** Handles RPC protocol events. */
export type RpcProtocolEventHandler = (type: RpcProtocolEvent, object: RpcRequest | RpcInvocation) => void;

/** An application protocol for an RPC interface. */
export abstract class RpcProtocol {
  /** Events raised by all protocols. See [[RpcProtocolEvent]] */
  public static readonly events: BeEvent<RpcProtocolEventHandler> = new BeEvent();

  /** Events raised by the protocol. See [[RpcProtocolEvent]] */
  public readonly events: BeEvent<RpcProtocolEventHandler> = new BeEvent();

  /** The configuration for the protocol. */
  public readonly configuration: RpcConfiguration;

  /** The RPC request class for this protocol. */
  public abstract readonly requestType: typeof RpcRequest;

  /** The RPC invocation class for this protocol. */
  public readonly invocationType: typeof RpcInvocation = RpcInvocation;

  /** The name of the request id header. */
  public requestIdHeaderName: string = "X-RequestId";

  /** The name of the authorization header. */
  public get authorizationHeaderName() { return this.configuration.applicationAuthorizationKey; }

  /** Override to supply the status corresponding to a protocol-specific code value. */
  public getStatus(code: number): RpcRequestStatus {
    return code;
  }

  /** Override to supply the protocol-specific code corresponding to a status value. */
  public getCode(status: RpcRequestStatus): number {
    return status;
  }

  /** Override to supply the protocol-specific method value for an RPC operation. */
  public supplyMethodForOperation(_operation: RpcOperation): string {
    return "";
  }

  /** Override to supply the protocol-specific path value for an RPC operation. */
  public supplyPathForOperation(operation: RpcOperation, _request: RpcRequest | undefined): string {
    return JSON.stringify(operation);
  }

  /** Override to supply the operation for a protocol-specific path value. */
  public getOperationFromPath(path: string): SerializedRpcOperation {
    return JSON.parse(path);
  }

  /** Override to supply error objects for protocol events. */
  public supplyErrorForEvent(_event: RpcProtocolEvent, _object: RpcRequest | RpcInvocation): Error {
    return new Error();
  }

  /** Obtains the implementation result on the backend for an RPC operation request. */
  public fulfill(request: SerializedRpcRequest): Promise<RpcRequestFulfillment> {
    return new (this.invocationType)(this, request).fulfillment;
  }

  /** Serializes a request. */
  public serialize(request: RpcRequest): SerializedRpcRequest {
    return {
      id: request.id,
      authorization: this.configuration.applicationAuthorizationValue || "",
      operation: {
        interfaceDefinition: request.operation.interfaceDefinition.name,
        operationName: request.operation.operationName,
        interfaceVersion: request.operation.interfaceVersion,
      },
      method: this.supplyMethodForOperation(request.operation),
      path: this.supplyPathForOperation(request.operation, request),
      parameters: RpcMarshaling.serialize(request.operation, request.protocol, request.parameters),
    };
  }

  /** Constructs a protocol. */
  public constructor(configuration: RpcConfiguration) {
    this.configuration = configuration;
    this.events.addListener((type, object) => RpcProtocol.events.raiseEvent(type, object));
  }

  /** @hidden @internal */
  public onRpcClientInitialized(_definition: RpcInterfaceDefinition, _client: RpcInterface): void { }

  /** @hidden @internal */
  public onRpcImplInitialized(_definition: RpcInterfaceDefinition, _impl: RpcInterface): void { }

  /** @hidden @internal */
  public onRpcClientTerminated(_definition: RpcInterfaceDefinition, _client: RpcInterface): void { }

  /** @hidden @internal */
  public onRpcImplTerminated(_definition: RpcInterfaceDefinition, _impl: RpcInterface): void { }
}
