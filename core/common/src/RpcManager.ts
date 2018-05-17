/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface, RpcInterfaceDefinition, RpcInterfaceImplementation } from "./RpcInterface";
import { RpcRegistry } from "./rpc/core/RpcRegistry";

/** RPC interface management is concerned with coordination of access and configuration for RPC interfaces. */
export class RpcManager {
  /**
   * Initializes an RPC interface class.
   * <em>note:</em> This function must be called on the frontend and on the backend for each RPC interface class used by an application.
   */
  public static initializeInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void {
    RpcRegistry.instance.initializeRpcInterface(definition);
  }

  /** Terminates an RPC interface class. */
  public static terminateInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void {
    RpcRegistry.instance.terminateRpcInterface(definition);
  }

  /** Returns the RPC client instance for the frontend. */
  public static getClientForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T {
    return RpcRegistry.instance.getClientForInterface(definition);
  }

  /** Registers the RPC implementation class for the backend. */
  public static registerImpl<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, implementation: RpcInterfaceImplementation<TImplementation>): void {
    RpcRegistry.instance.registerImpl(definition, implementation);
  }

  /** Supply the instance of the RPC interface implementation class for the backend (optional). */
  public static supplyImplInstance<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, instance: TImplementation): void {
    RpcRegistry.instance.supplyImplInstance(definition, instance);
  }

  /** Unregisters the RPC implementation class for the backend. */
  public static unregisterImpl<TDefinition extends RpcInterface>(definition: RpcInterfaceDefinition<TDefinition>): void {
    RpcRegistry.instance.unregisterImpl(definition);
  }
}
