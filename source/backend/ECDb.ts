/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError, IModelStatus } from "../common/IModelError";
import { AddonECDb } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";
import { NodeAddonRegistry } from "./NodeAddonRegistry";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { IDisposable } from "@bentley/bentleyjs-core/lib/Disposable";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

/** Allows performing CRUD operations in an ECDb */
export class ECDb implements IDisposable {
  private _nativeDb: AddonECDb | undefined;
  private readonly _statementCache: ECSqlStatementCache;

  constructor() {
    this._nativeDb = new (NodeAddonRegistry.getAddon()).AddonECDb();
    this._statementCache = new ECSqlStatementCache();
  }

  /** Call this function when finished with this ECDb object. This releases the native resources held by the
   *  ECDb object.
   */
  public dispose(): void {
    if (this._nativeDb == null)
      return;

    this.closeDb();
    this._nativeDb!.dispose();
    this._nativeDb = undefined;
  }

  /** Create an ECDb
   * @param pathname  The pathname of the Db.
   * @throws [[IModelError]] if the operation failed.
   */
  public createDb(pathname: string): void {
    const status = this.nativeDb.createDb(pathname);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to created ECDb");
  }

  /** Open the ECDb.
   * @param pathname The pathname of the Db
   * @param openMode  Open mode
   * @throws [[IModelError]] if the operation failed.
   */
  public openDb(pathname: string, openMode: OpenMode = OpenMode.Readonly): void {
    const status = this.nativeDb.openDb(pathname, openMode);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to open ECDb");
  }

  /** Returns true if the ECDb is open */
  public isOpen(): boolean {
    return this.nativeDb.isOpen();
  }

  /** Close the Db after saving any uncommitted changes.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   * @throws [[IModelError]] if the database is not open.
   */
  public closeDb(): void {
    this._statementCache.clearOnClose();
    this.nativeDb.closeDb();
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the transaction.
   * @param changeSetName The name of the operation that generated these changes.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public saveChanges(changeSetName?: string): void {
    const status: DbResult = this.nativeDb.saveChanges(changeSetName);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to save changes");
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public abandonChanges(): void {
    const status = this.nativeDb.abandonChanges();
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to abandon changes");
  }

  /** Import a schema. If the import was successful, the database is automatically saved to disk.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public importSchema(pathname: string): void {
    const status = this.nativeDb.importSchema(pathname);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to import schema");
  }

  /** Use a prepared statement. This function takes care of preparing the statement and then releasing it.
   * @param ecsql The ECSql statement to execute
   * @param cb the callback to invoke on the prepared statement
   * @return the value returned by cb
   */
  public withPreparedStatement<T>(ecsql: string, cb: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(ecsql);
    try {
      const val: T = cb(stmt);
      this._statementCache.release(stmt);
      return val;
    } catch (err) {
      this._statementCache.release(stmt);
      Logger.logError(err.toString());
      throw err;
    }
  }

  /** Get a prepared ECSql statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSql statement to prepare
   * @return the prepared statement
   * @throws IModelError if the statement cannot be prepared. Normally, prepare fails due to ECSql syntax errors or references to tables or properties that do not exist. The error.message property will describe the property.
   */
  private getPreparedStatement(ecsql: string): ECSqlStatement {
    const cachedStmt = this._statementCache.find(ecsql);
    if (cachedStmt !== undefined && cachedStmt.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cachedStmt.statement.isShared());
      assert(cachedStmt.statement.isPrepared());
      cachedStmt.useCount++;
      return cachedStmt.statement;
    }

    this._statementCache.removeUnusedStatementsIfNecessary();

    const stmt = this.prepareStatement(ecsql);
    this._statementCache.add(ecsql, stmt);
    return stmt;
  }
  /** Prepare an ECSql statement.
   * @param ecsql The ECSql statement to prepare
   * @throws [[IModelError]] if there is a problem preparing the statement.
   */
  public prepareStatement(ecsql: string): ECSqlStatement {
    const stmt = new ECSqlStatement();
    stmt.prepare(this.nativeDb, ecsql);
    return stmt;
  }

  public get nativeDb(): AddonECDb {
    if (this._nativeDb == null)
      throw new IModelError(IModelStatus.BadRequest, "ECDb object has already been disposed.");

    return this._nativeDb!;
  }
}
