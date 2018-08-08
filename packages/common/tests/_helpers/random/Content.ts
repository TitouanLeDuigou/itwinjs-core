/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as c from "@common/content";
import { SelectClassInfoJSON } from "@common/content/Descriptor";
import { createRandomRelationshipPathJSON, createRandomECClassInfoJSON } from "./EC";
import { nullable } from "./Misc";

const createRandomSelectClassInfoJSON = (): SelectClassInfoJSON => {
  return {
    selectClassInfo: createRandomECClassInfoJSON(),
    isSelectPolymorphic: faker.random.boolean(),
    pathToPrimaryClass: createRandomRelationshipPathJSON(),
    relatedPropertyPaths: [createRandomRelationshipPathJSON(1), createRandomRelationshipPathJSON(1)],
  };
};

export const createRandomCategory = (): c.CategoryDescription => {
  return {
    name: faker.random.word(),
    label: faker.random.words(),
    description: faker.lorem.sentence(),
    priority: faker.random.number(),
    expand: faker.random.boolean(),
  } as c.CategoryDescription;
};

export const createRandomPrimitiveTypeDescription = (): c.TypeDescription => {
  return {
    valueFormat: c.PropertyValueFormat.Primitive,
    typeName: faker.database.type(),
  } as c.PrimitiveTypeDescription;
};

export const createRandomEditorDescription = (): c.EditorDescription => {
  return {
    name: faker.random.word(),
  } as c.EditorDescription;
};

const createRandomPrimitiveFieldJson = () => {
  return {
    category: createRandomCategory(),
    name: faker.random.word(),
    label: faker.random.words(),
    type: createRandomPrimitiveTypeDescription(),
    isReadonly: faker.random.boolean(),
    priority: faker.random.number(),
    editor: nullable(createRandomEditorDescription),
  };
};

export const createRandomPrimitiveField = (): c.Field => {
  return c.Field.fromJSON(createRandomPrimitiveFieldJson())!;
};

export const createRandomDescriptorJson = (displayType?: string) => {
  const selectClasses = [createRandomSelectClassInfoJSON(), createRandomSelectClassInfoJSON()];
  const fields = [createRandomPrimitiveFieldJson(), createRandomPrimitiveFieldJson(), createRandomPrimitiveFieldJson()];
  return {
    connectionId: faker.random.uuid(),
    inputKeysHash: faker.random.uuid(),
    contentOptions: faker.random.objectElement(),
    displayType: displayType || faker.lorem.words(),
    selectClasses,
    fields,
    contentFlags: 0,
  };
};

export const createRandomDescriptor = (displayType?: string): c.Descriptor => {
  return c.Descriptor.fromJSON(createRandomDescriptorJson(displayType))!;
};
