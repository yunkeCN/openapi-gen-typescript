import * as camelcase from 'camelcase';
import { Options } from 'camelcase';
import * as _ from 'lodash';
import { OpenAPIV3 } from 'openapi-types';
import { AllMethods, SortList } from '../constants';
import { getBaseUrl } from './getBaseUrl';
import { getCodeFromContent, getContentFromComponents } from './genCode';
import { getReqBody, getReqParams } from './getInterfaceInfo';
import { ContentObject, IGenParmas, IPathMap } from './type';
import PathItemObject = OpenAPIV3.PathItemObject;
import OperationObject = OpenAPIV3.OperationObject;
import ResponseObject = OpenAPIV3.ResponseObject;
import ReferenceObject = OpenAPIV3.ReferenceObject;
import RequestBodyObject = OpenAPIV3.RequestBodyObject;

interface IApiContext {
  openApiData: OpenAPIV3.Document;
  options: IGenParmas;
}

function getCamelcase(urlPath: string, options?: Options): string {
  return camelcase(urlPath.split('/').join('_'), options);
}

export const getApiContent = async (
  props: IApiContext,
): Promise<{
  pathsCode: string[];
  pathsMap: IPathMap;
}> => {
  const { openApiData, options } = props;
  const { paths } = openApiData;
  const pathsCode: string[] = [];
  const pathsMap: IPathMap = {};
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
          const requestBodyCode = await getReqBody({ requestBody, openApiData });
          const requestBodyTypeNames: string[] = [];

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
        }),
      );
      pathsCode.push(pathsTypesCode.join('\n'));
    }),
  );
  return { pathsCode, pathsMap };
};
