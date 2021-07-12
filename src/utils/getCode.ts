import { Options } from 'camelcase';
import * as camelcase from 'camelcase';
import * as _ from 'lodash';
import { IJsonSchema, OpenAPIV3 } from 'openapi-types';
import { transform } from '../schemaToTypes/transform';
import { ContentObject, IParameterMap } from './typeDefinitions';
import ParameterBaseObject = OpenAPIV3.ParameterBaseObject;
import MediaTypeObject = OpenAPIV3.MediaTypeObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;

function getCodeFromParameter(parameter: ParameterBaseObject, name: string): string {
  const { description, required } = parameter;

  let code = '';

  if (description) {
    code += `/* ${description} */\n`;
  }

  code += `${name}${!!required ? '' : '?'}: string;`;

  return code;
}

export async function getCodeFromParameters(
  parameters: IParameterMap | undefined,
  name: string,
  exportKey: boolean = false,
): Promise<string> {
  if (!parameters) {
    return '';
  }

  const bodyCode = await Promise.all(
    Object.keys(parameters).map(parameterName => {
      return getCodeFromParameter(parameters[parameterName], parameterName);
    }),
  );
  return `${exportKey ? 'export' : ''} interface ${name} {\n${bodyCode.join('\n')}\n}`;
}

function getCamelcase(urlPath: string, options?: Options): string {
  return camelcase(urlPath.split('/').join('_'), options);
}

export async function getCodeFromContent(
  content: ContentObject,
  typeNamePrefix: string,
  comment: string = '',
  responseTypeNames: string[] = [],
): Promise<string> {
  if (!content) {
    return '';
  }

  const contentCode = await Promise.all(
    Object.keys(content).map(async (mediaType, index) => {
      const responseTypeName = `${typeNamePrefix}${
        index > 0 ? getCamelcase(mediaType, { pascalCase: true }) : ''
      }`;
      let jsonSchema = transform((content[mediaType] as MediaTypeObject).schema as IJsonSchema);
      if (jsonSchema.lastIndexOf('[]') === jsonSchema.length - 2) {
        jsonSchema = jsonSchema.replace(/\(|\)|(\[\])+/g, '');
        responseTypeNames.push(`${responseTypeName}[]`);
      } else if (/^\(([\s\S]+)\)$/.test(jsonSchema)) {
        jsonSchema = jsonSchema.replace(/^\(([\s\S]+)\)$/, '$1');
        responseTypeNames.push(responseTypeName);
      } else {
        responseTypeNames.push(responseTypeName);
      }
      return `export type ${responseTypeName} = ${jsonSchema}`;
    }),
  );
  return contentCode.join('\n');
}

export async function getContentFromComponents(
  openApiData: OpenAPIV3.Document,
  ref: string,
  typename: string,
  arr: string[],
): Promise<string> {
  const splitRef = ref.replace(/^[^/]+\/components\//, '').split('/');
  const result = _.get(openApiData.components, splitRef.join('.'));
  const { content, description }: ReferenceObject & RequestBodyObject = result as any;
  const requestBodyCode = await getCodeFromContent(content, typename, description, arr);
  return requestBodyCode;
}
