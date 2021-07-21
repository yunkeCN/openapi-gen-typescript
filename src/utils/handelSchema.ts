import * as camelcase from 'camelcase';
import { IJsonSchema, OpenAPIV3 } from 'openapi-types';
import { transform } from '../schemaToTypes/transform';

interface IProps {
  pascalCase: boolean;
  openApiData: OpenAPIV3.Document;
}

export const handleSchema = (props: IProps) => {
  const { openApiData, pascalCase } = props;
  const { schemas } = openApiData.components || {};
  const schemasTypesCode: string[] = [];
  const schemasClassCode: string[] = [];
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
  return {
    schemasTypesCode,
    schemasClassCode,
  };
};
