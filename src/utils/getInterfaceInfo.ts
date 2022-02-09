// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
import * as _ from 'lodash';
import * as camelcase from 'camelcase';
import { IJsonSchema, OpenAPIV3 } from 'openapi-types';
import { getCamelcase } from './format';
import { transform } from '../schemaToTypes/transform';
import {
  IGetReqBody,
  IGetReqParams,
  IParameterMap,
  ContentObject,
  IGenParmas,
  IHandleSchema,
} from './type';
import Axios from 'axios';
import MediaTypeObject = OpenAPIV3.MediaTypeObject;
import ParameterBaseObject = OpenAPIV3.ParameterBaseObject;
import ParameterObject = OpenAPIV3.ParameterObject;
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

export async function genContentFromComponents(
  openApiData: OpenAPIV3.Document,
  ref: string,
  typename: string,
  arr: string[],
): Promise<string> {
  const splitRef = ref.replace(/^[^/]+\/components\//, '').split('/');
  const result = _.get(openApiData.components, splitRef);
  const { content, description }: ReferenceObject & RequestBodyObject = result as any;
  const requestBodyCode = await genCodeFromContent(content, typename, description, arr);
  return requestBodyCode;
}

export async function genCodeFromContent(
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
        jsonSchema = jsonSchema.replace(/\(|\)|(\[\]$)/g, '');
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

export const getReqParams = async (props: IGetReqParams) => {
  // request parameter
  const { parameters } = props;

  const requestPath: IParameterMap = {};
  const requestHeaders: IParameterMap = {};
  const requestCookies: IParameterMap = {};
  const requestQuery: IParameterMap = {};
  parameters.forEach(parameter => {
    const { in: keyIn, name, ...otherParams } = parameter as ParameterObject;
    switch (keyIn) {
      case 'path':
        requestPath[name] = otherParams;
        break;
      case 'query':
        requestQuery[name] = otherParams;
        break;
      case 'cookie':
        requestCookies[name] = otherParams;
        break;
      case 'header':
        if (['CONTENT-TYPE', 'COOKIE'].indexOf(name.toUpperCase()) === -1) {
          requestHeaders[name] = otherParams;
        }
        break;
    }
  });
  const requestPathCode = await getCodeFromParameters(requestPath, 'Path', true);
  const requestQueryCode = await getCodeFromParameters(requestQuery, 'Query', true);
  const requestCookieCode = await getCodeFromParameters(requestCookies, 'Cookie', true);
  const requestHeaderCode = await getCodeFromParameters(requestHeaders, 'RequestHeader', true);
  return {
    requestPathCode,
    requestQueryCode,
    requestCookieCode,
    requestHeaderCode,
    requestPath,
  };
};

export const getReqBody = async (props: IGetReqBody) => {
  const { requestBody, openApiData } = props;

  const {
    $ref: requestRef,
    content,
    description: requestBodyDescription,
  }: ReferenceObject & RequestBodyObject = requestBody as any;

  let requestBodyCode = '';
  const requestBodyTypeNames: string[] = [];

  if (requestRef) {
    requestBodyCode = await genContentFromComponents(
      openApiData,
      requestRef,
      `Body`,
      requestBodyTypeNames,
    );
  } else {
    requestBodyCode = await genCodeFromContent(
      content,
      `Body`,
      requestBodyDescription,
      requestBodyTypeNames,
    );
  }
  return { requestBodyCode, requestBodyTypeNames };
};

// 生成openapi的Doc对象
export const getOpenApiDoc = async (options: IGenParmas) => {
  const { url, path: filePath, object } = options;
  let openApiData: OpenAPIV3.Document;
  if (url || filePath || object) {
    // convertUrl响应速度很慢，改为使用convertObj
    const { convertObj, convertFile } = swagger2openapi;
    let params: any;
    let openapi: any;
    if (url) {
      try {
        const result = await Axios.get(url); // 获取object对象
        if (result.status !== 200) {
          throw Error(`未返回正确的status code ${result.status}: ${url}`);
        }
        params = result.data;
      } catch (e) {
        console.error('e :>> ', e);
      }
      openapi = await convertObj(params, {
        patch: true,
      });
    }
    if (filePath) {
      params = filePath;
      openapi = await convertFile(params, {
        patch: true,
      });
    }
    if (object) {
      params = object;
      openapi = await convertObj(params, {
        patch: true,
      });
    }
    openApiData = openapi.openapi;
  } else {
    throw 'option: url or filePath or object must be specified one';
  }
  return openApiData;
};

export const handleSchema = (props: IHandleSchema) => {
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
      // 处理当组件为数组的情况
      if (classObject.endsWith('[]')) {
        const classObjectRemoveArrayMark = classObject.substr(0, classObject.length - 2);
        schemasClassCode.push(`export class ${schemaKey}Item ${classObjectRemoveArrayMark}\n`);
        schemasClassCode.push(`export type ${schemaKey} = ${schemaKey}Item[]\n`);
      } else {
        schemasClassCode.push(`export class ${schemaKey} ${classObject}\n`);
      }
    });
  }
  return {
    schemasTypesCode,
    schemasClassCode,
  };
};
