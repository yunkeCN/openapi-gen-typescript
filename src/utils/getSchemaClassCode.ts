import * as camelcase from 'camelcase';
import { IJsonSchema, OpenAPIV3 } from 'openapi-types';
import { transform } from '../schemaToTypes/transform';

export interface IGetSchemaClassCode {
  openApiData: OpenAPIV3.Document;
  pascalCase?: boolean;
}

export const getSchemaClassCode = (props: IGetSchemaClassCode) => {
  const schemasClassCode: string[] = [];
  const schemasTypesCode: string[] = [];
  const { openApiData, pascalCase } = props;
  const { schemas } = openApiData.components || {};
  if (schemas) {
    Object.keys(schemas).forEach(schemaKey => {
      const schemaObject = schemas[schemaKey] as IJsonSchema;
      if (pascalCase) {
        schemaKey = camelcase(schemaKey, { pascalCase: true });
      }
      const transformObject = transform(schemaObject);
      schemasTypesCode.push(`export type ${schemaKey} = ${transformObject}`);
      const classObject = transformObject.replace(/[()]/g, '').replace(/components.schemas./g, '');
      schemasClassCode.push(`export class ${schemaKey} ${classObject}\n`);
    });
  }
  return { schemasClassCode, schemasTypesCode };
};
