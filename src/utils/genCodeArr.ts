/**
 * 遍历paths的结构，生成code数组
 */

import { OpenAPIV3 } from 'openapi-types';
import { AllMethods } from '../constants';
import { getFilePath } from './getFilePath';
import { getCodeForInterface } from './getCodeForInterface';
import { toHump } from './toHump';
import { IGenParmas } from './type';
import PathItemObject = OpenAPIV3.PathItemObject;
import OperationObject = OpenAPIV3.OperationObject;

export interface IFileCode {
  code: string;
  dirName?: string;
  fileName?: string;
  summary?: string;
}

interface IProps {
  openApiData: OpenAPIV3.Document;
  options: IGenParmas;
}

export const genCodeArr = async (
  props: IProps,
): Promise<{ fileCodeList: Array<IFileCode>; pathsCode: string[] }> => {
  const result: { fileCodeList: IFileCode[]; pathsCode: string[] } = {
    fileCodeList: [],
    pathsCode: [],
  };
  const { openApiData, options } = props;
  const { paths, info } = openApiData;
  const { handleGenPath } = options;
  await Promise.all(
    Object.keys(paths).map(async urlPath => {
      const pathsObject: PathItemObject = paths[urlPath] as PathItemObject;
      const filterMethods = AllMethods.filter(method => !!(pathsObject as any)[method]);
      const pathsTypesCode: string[] = [];
      await Promise.all(
        filterMethods.map(async method => {
          const objectElement: OperationObject = (pathsObject as any)[method] as OperationObject;
          const { summary } = objectElement;
          // 生成单个接口的代码
          const code = await getCodeForInterface({
            options,
            openApiData,
            urlPath,
            method,
            objectElement,
            pathsTypesCode,
          });
          // 生成单个接口的路径
          const { dirName, fileName } = getFilePath({
            handleGenPath,
            propForGen: {
              operationObject: objectElement,
              info,
              method,
              path: urlPath,
            },
          });
          if (dirName && fileName) {
            result.fileCodeList.push({
              code,
              dirName: toHump(dirName),
              fileName: toHump(fileName),
              summary,
            });
          } else {
            console.log(`${urlPath}-${method}接口没有生成符合规范的路径`);
          }
        }),
      );
      result.pathsCode.push(pathsTypesCode.join('\n'));
    }),
  );

  return result;
};
