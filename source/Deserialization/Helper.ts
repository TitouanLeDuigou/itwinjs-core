/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

// import { DeserializableSchemaInterface, DeserializableClassInterface, DeserializableItem } from "../ECInterfaces/DeserializationInterfaces";
import { SchemaInterface, SchemaChildInterface, ClassInterface } from "../ECInterfaces/Interfaces";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 * The purpose of this helper class is to properly order
 * the various ECObjects deserialization. For example, when deserializing an ECClass
 * most times all base class should be deserialized before the given class.
 *
 * The goal of the class is to remove the implementer of a a deserializer from having to know
 * and/or worry about if they ordered something properly.
 */
export default class DeserializationHelper {
  // private _context?: DeserializableSchemaInterface;
  // private _schemas: { [key: string]: DeserializableSchemaInterface; };
  // private _thingToDeserialiaze: DeserializableSchemaInterface | DeserializableClassInterface;

  // constructor(context?: DeserializableSchemaInterface) {
  //   this._context = context;
  //   // this._schemas = {};
  // }

  /**
   * Populates the given schema object with the information presented in the schemaJson provided. If present, uses the provided context to resolve any references within the schema. Otherwise, those references will be unresovled.
   * @param schema The schema object to populate. Must be an extension of the DeserializableSchemaInterface.
   * @param schemaJson An object, or string representing that object, that follows the SchemaJson format.
   * @param context TODO:
   */
  public static to<T extends SchemaInterface>(schema: T, schemaJson: object | string): T {
    const helper = new DeserializationHelper();

    const jsonObj = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // Loads all of the properties on the SchemaInterface object
    schema.fromJson(jsonObj);

    // Load schema references first
    // Need to figure out if other schemas are present. Need some sort of context? Or when there is a lack of context all references are in string form??
    if (jsonObj.references) {
      // TODO
    }

    // Load all schema children
    if (jsonObj.children) {
      for (const childName in jsonObj.children) {
        if (schema.getChild(childName) !== undefined)
          continue;

        helper.loadSchemaChild(schema, jsonObj.children[childName], childName);
      }
    }

    // TODO: Load CustomAttributes

    return schema;
  }

  /**
   *
   * @param schemaChild The schemaChild object to populate. Must extend from DeserializableItem.
   * @param schemaChildJson The json to deserialize from. Must follow the SchemaChildJson format.
   * @param context The context in which the provided SchemaChild should be deserialized in. If no context is provided, none of the references within the child will be resolved. // TODO: Context should be either an ECSchema or an ECSchemaContext, which contains an entire graph of things.
   */
  // public static loadSchemaChild<T extends DeserializableItem>(schemaChild: T, schemaChildJson: any, context?: DeserializableSchemaInterface): void {
  //   const helper = new DeserializationHelper(context);
  //   helper.loadSchemaChild(schemaChild, schemaChildJson);
  // }

  /**
   *
   * @param schemaChild
   * @param schemaChildJson
   * @param name
   */
  private loadSchemaChild(schema: SchemaInterface, schemaChildJson: any, name?: string) {
    const childName = (schemaChildJson.name) ? schemaChildJson.name : name;
    if (!childName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson);

    switch (schemaChildJson.schemaChildType) {
      case "EntityClass":
        const entityClass: ClassInterface = schema.createEntityClass(childName);
        this.loadEntityClass(entityClass, schemaChildJson);
        break;
      case "StructClass":
        const structClass: ClassInterface = schema.createStructClass(childName);
        this.loadClass(structClass, schemaChildJson);
        break;
      case "Mixin":
        const mixin: ClassInterface = schema.createMixinClass(childName);
        this.loadMixin(mixin, schemaChildJson);
        break;
      case "CustomAttributeClass":
        const caClass: ClassInterface = schema.createCustomAttributeClass(childName);
        this.loadClass(caClass, schemaChildJson);
        break;
      case "RelationshipClass":
        break;
      case "KindOfQuantity":
        break;
      case "PropertyCategory":
        const propCategory: SchemaChildInterface = schema.createPropertyCategory(childName);
        propCategory.fromJson(schemaChildJson);
        break;
      case "Enumeration":
        const enumeration: SchemaChildInterface = schema.createEnumeration(childName);
        enumeration.fromJson(schemaChildJson);
        break;
    }

  }

  /**
   *
   * @param schema The ECSchema to add the class to.
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   */
  private loadClass(classObj: ClassInterface, classJson: any): void {
    // Load base class first
    if (classJson.baseClass) {
      // if (classObj.getChild(classJson.baseClass) === undefined) {
      //   this.loadClass(schema, schemaJson.children[classJson.baseClass], classJson.baseClass);
      // }
    }

    classObj.fromJson(classJson);
  }

  private loadEntityClass(entity: ClassInterface, entityJson: any): void {
    // Load Mixin classes first
    if (entityJson.mixin) {
      // if (typeof(entityJson.mixin) === "string" && entity.schema.getChild(entityJson.mixin) === undefined)
      //   this.loadClass(schema, schemaJson, schemaJson.children[entityJson.mixin]);
      // else if (Array.isArray(entityJson.mixin)) {
      //   entityJson.mixin.array.forEach((mixinName: string) => {
      //     if (schema.getChild(mixinName) !== undefined)
      //       return;
      //     this.loadClass(schema, schemaJson, schemaJson.children[mixinName], mixinName);
      //   });
      // }
    }

    this.loadClass(entity, entityJson);
  }

  private loadMixin(mixin: ClassInterface, mixinJson: any): void {
    if (mixinJson.appliesTo) {
      // if (typeof(mixinJson.appliesTo) === "string" && schema.getChild(mixinJson.appliesTo) === undefined)
      //   this.loadClass(schema, schemaJson, schemaJson.children[mixinJson.appliesTo], mixinJson.appliesTo);
      // else
      //   throw new ECObjectsError(ECObjectsStatus.InvalidECJson, "");
    }

    this.loadClass(mixin, mixinJson);
  }
}
