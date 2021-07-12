import * as camelcase from 'camelcase';
import * as _ from 'lodash';
import { OpenAPIV3 } from 'openapi-types';
import { AllMethods, SortList } from '../constants';
import { getBaseUrl } from './getBaseUrl';
import { getCodeFromContent, getCodeFromParameters, getContentFromComponents } from './getCode';
import {
  ContentObject,
  IGenParmas,
  IParameterMap,
  IPathMap,
  IPathMapContent,
} from './typeDefinitions';
import PathItemObject = OpenAPIV3.PathItemObject;
import OperationObject = OpenAPIV3.OperationObject;
import ResponseObject = OpenAPIV3.ResponseObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;
import ParameterObject = OpenAPIV3.ParameterObject;

interface IApiContext {
  openApiData: OpenAPIV3.Document;
  options: IGenParmas;
}

function getCamelcase(urlPath: string, arg1: { pascalCase: boolean }) {
  throw new Error('Function not implemented.');
}

export const getApiContent = async (
  props: IApiContext,
): Promise<{
  pathsCode: string[];
  pathsMap: IPathMap;
  pathContentList: IPathMapContent[];
}> => {
  const { openApiData, options } = props;
  const { paths } = openApiData;
  const pathsCode: string[] = [];
  const pathsMap: IPathMap = {};
  const pathContentList: IPathMapContent[] = [];
  await Promise.all(
    Object.keys(paths).map(async urlPath => {
      const pathsObject: PathItemObject = paths[urlPath] as any;
      const filterMethods = AllMethods.filter(method => !!(pathsObject as any)[method]);
      const pathsTypesCode: string[] = [];
      await Promise.all(
        filterMethods.map(async method => {
          const objectElement: OperationObject = (pathsObject as any)[method] as OperationObject;
          const {
            operationId,
            parameters = [],
            requestBody = {},
            responses,
            summary,
            tags,
          } = objectElement;

          let namespaceName =
            operationId ||
            `${method.toLowerCase()}${getCamelcase(urlPath, {
              pascalCase: true,
            })}`;
          namespaceName = camelcase(namespaceName.replace(/[^a-zA-Z0-9_]/g, ''), {
            pascalCase: true,
          });

          // request parameter
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
          const requestHeaderCode = await getCodeFromParameters(
            requestHeaders,
            'RequestHeader',
            true,
          );

          // request body
          const {
            $ref: requestRef,
            content,
            required: requestBodyRequired,
            description: requestBodyDescription,
          }: ReferenceObject & RequestBodyObject = requestBody as any;

          let requestBodyCode = '';
          const requestBodyTypeNames: string[] = [];

          if (requestRef) {
            requestBodyCode = await getContentFromComponents(
              openApiData,
              requestRef,
              `Body`,
              requestBodyTypeNames,
            );
          } else {
            requestBodyCode = await getCodeFromContent(
              content,
              `Body`,
              requestBodyDescription,
              requestBodyTypeNames,
            );
          }

          // response
          const responseTypeNames: string[] = [];
          const responsesArr = Object.keys(responses as Object);
          const responsesCode = (
            await Promise.all(
              responsesArr.map(async statusCode => {
                const responsesObjectElement: ResponseObject & ReferenceObject = (responses as any)[
                  statusCode
                ];
                const { $ref, content, description } = responsesObjectElement;

                const typeNamePrefix = `Response${camelcase(statusCode, {
                  pascalCase: true,
                })}`;
                if ($ref) {
                  const responseCode = await getContentFromComponents(
                    openApiData,
                    requestRef,
                    typeNamePrefix,
                    requestBodyTypeNames,
                  );

                  return responseCode;
                } else {
                  // response
                  const responseCode = await getCodeFromContent(
                    content as ContentObject,
                    typeNamePrefix,
                    description,
                    responseTypeNames,
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
                } }> =>  {
                  let resolvedUrl = '${getBaseUrl(openApiData)}${urlPath}';
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

          const requestUrl = `export const url = \`${getBaseUrl(openApiData)}${urlPath}\``;

          let exportObj: { [key: string]: string } = {
            requestUrl,
            requestPathCode,
            requestQueryCode,
            requestHeaderCode,
            requestCookieCode,
            requestBodyCode,
            responsesCode,
            requestFuncTypeCode,
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
          pathsTypesCode.push(
            `export namespace ${namespaceName} {\n${pathsTypesArr.join('\n')}\n}`,
          );

          const generateClassArr = exportArr.map(exp => {
            const exp1 = exp.replace(/ interface | type = /g, ' class ');
            const exp2 = exp1.replace(
              / type ([^=]+) = components.([a-zA-Z0-9._]+)[;{}]?/g,
              ' class $1 extends $2 {}',
            );
            const exp3 = exp2.replace(/ type ([^=]+) = {/g, ' class $1 {');
            const exp4 = exp3.replace(/components.schemas/g, 'schemas');
            return exp4;
          });

          pathsMap[namespaceName] = {
            summary,
            tags: tags || [],
            code: generateClassArr.join('\n'),
            path: urlPath,
          };

          pathContentList.push({
            summary,
            tags: tags || [],
            code: generateClassArr.join('\n'),
            path: urlPath,
          });
        }),
      );
      pathsCode.push(pathsTypesCode.join('\n'));
    }),
  );
  return { pathsCode, pathsMap, pathContentList };
};
