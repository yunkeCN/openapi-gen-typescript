/**
 * 根据单个接口的信息，生成需要导出的代码
 */

import * as camelcase from 'camelcase';
import * as _ from 'lodash';
import { isEmpty } from 'lodash';
import { OpenAPIV3 } from 'openapi-types';
import { SortList } from '../constants';
import { getBaseUrl, getCamelcase, pathSplicing } from './format';
import {
  genCodeFromContent,
  genCodeFromHeaders,
  genContentFromComponents,
  getReqBody,
  getReqParams,
} from './getInterfaceInfo';
import { ContentHeaders, ContentObject, IGenParmas } from './type';
import OperationObject = OpenAPIV3.OperationObject;
import ResponseObject = OpenAPIV3.ResponseObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;

interface IProps {
  objectElement: OperationObject;
  method: string;
  urlPath: string;
  openApiData: OpenAPIV3.Document;
  options: IGenParmas;
  pathsTypesCode: string[];
}

// 生成单个接口的代码
export const genCodeForInterface = async (props: IProps) => {
  const { objectElement, method, urlPath, openApiData, options, pathsTypesCode } = props;
  const { operationId, parameters = [], requestBody = {}, responses } = objectElement;

  let result = '';

  let namespaceName =
    operationId ||
    `${method.toLowerCase()}${getCamelcase(urlPath, {
      pascalCase: true,
    })}`;
  namespaceName = camelcase(namespaceName.replace(/[^a-zA-Z0-9_]/g, ''), {
    pascalCase: true,
  });

  // request parameter
  const {
    requestCookieCode,
    requestHeaderCode,
    requestPathCode,
    requestQueryCode,
    requestPath,
  } = await getReqParams({ parameters });

  const {
    $ref: requestRef,
    required: requestBodyRequired,
  }: ReferenceObject & RequestBodyObject = requestBody as any;

  // request body
  const { requestBodyCode, requestBodyTypeNames } = await getReqBody({ requestBody, openApiData });

  // response
  const responseTypeNames: string[] = [];
  const responseTypeHeaderNames: string[] = [];
  const responsesArr = Object.keys(responses as Object);
  let responseHeaderCode = '';
  const responsesCode = (
    await Promise.all(
      responsesArr.map(async statusCode => {
        const responsesObjectElement: ResponseObject & ReferenceObject = (responses as any)[
          statusCode
        ];
        const { $ref, content, description, headers } = responsesObjectElement;

        const typeNamePrefix = `Response${camelcase(statusCode, {
          pascalCase: true,
        })}`;
        if (!isEmpty(headers)) {
          responseTypeHeaderNames.push(`${typeNamePrefix}Headers`);
        }
        if ($ref) {
          const responseCode = await genContentFromComponents(
            openApiData,
            requestRef,
            typeNamePrefix,
            requestBodyTypeNames,
          );
          return responseCode;
        } else {
          // response
          const responseCode = await genCodeFromContent(
            content as ContentObject,
            typeNamePrefix,
            description,
            responseTypeNames,
          );

          responseHeaderCode = await genCodeFromHeaders(
            headers as ContentHeaders,
            `${typeNamePrefix}Headers`,
          );

          return responseCode;
        }
      }),
    )
  ).join('\n');

  const requestFuncTypeCode = `
              export const request = async (options: {
                path?: Path;
                query?: Query;
                body${requestBodyRequired ? '' : '?'}: ${
    requestBodyTypeNames.length > 0 ? requestBodyTypeNames.join('|') : 'any'
  };
                headers?: RequestHeader;
                cookie?: Cookie;
              }, otherOptions?: any): Promise<{ body: ${
                responseTypeNames.length > 0 ? responseTypeNames.join('|') : 'any'
              }, headers?: ${
    responseTypeHeaderNames.length > 0 ? responseTypeHeaderNames.join('|') : 'any'
  } }> =>  {
                let resolvedUrl = '${pathSplicing(getBaseUrl(openApiData), urlPath)}';
                ${
                  _.isEmpty(requestPath)
                    ? ''
                    : `if (!!options.path) {
                  Object.keys(options.path).map(key => {
                    const regex = new RegExp(\`({(\${key})})|(:(\${key}))\`, 'g');
                    resolvedUrl = url.replace(regex, options.path[key]);
                  });
                }`
                }
                return fetchImpl({
                  url: resolvedUrl, 
                  method: '${method.toLowerCase()}',
                  ...options, 
                  ...otherOptions 
                });
              };
            `;

  const requestUrl = `export const url = \`${pathSplicing(getBaseUrl(openApiData), urlPath)}\``;

  const requestMethod = `export const method = '${method.toUpperCase()}'`;

  let exportObj: { [key: string]: string } = {
    requestUrl,
    requestMethod,
    requestPathCode,
    requestQueryCode,
    requestHeaderCode,
    requestCookieCode,
    requestBodyCode,
    responsesCode,
    requestFuncTypeCode,
    responseHeaderCode,
  };

  if (options.handlePostScript) {
    const result = await options.handlePostScript(objectElement, method);

    exportObj = Object.assign({}, exportObj, result);
  }

  const exportArr: string[] = [];

  SortList.forEach(item => {
    exportArr.push(exportObj[item]);
  });

  Object.keys(exportObj).forEach(item => {
    if (!SortList.includes(item)) {
      exportArr.unshift(exportObj[item]);
    }
  });

  const pathsTypesArr = exportArr.map(exp => {
    return exp
      .replace(/export const request = async/, 'export type request =')
      .replace(/: Promise<([^>]+)>((\s|\S)+)/g, '=> Promise<$1>;');
  });
  pathsTypesCode.push(`export namespace ${namespaceName} {\n${pathsTypesArr.join('\n')}\n}`);

  const generateClassArr = exportArr.map(exp => {
    const exp4 = exp.replace(/components.schemas/g, 'schemas');
    return exp4;
  });

  result = generateClassArr.join('\n');
  return result;
};
