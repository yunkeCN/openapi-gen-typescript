// @ts-ignore
import * as swagger2openapi from 'swagger2openapi';
import * as swaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIV3 } from 'openapi-types';
import { IGenParmas } from './type';
import Axios from 'axios';

// 生成openapi的Doc对象
export const getOpenApiDoc = async (options: IGenParmas) => {
  const { url, path: filePath, object, version } = options;
  let openApiData: OpenAPIV3.Document;
  if (url || filePath || object) {
    const { dereference, parse } = swaggerParser;
    // convertUrl响应速度很慢，改为使用convertObj
    const { convertObj, convertFile } = swagger2openapi;
    let params: any;
    let openapi: any;
    if (version === '2') {
      if (url) {
        try {
          const result = await Axios.get(url); // 获取object对象
          if (result.status !== 200) {
            throw Error(`未返回正确的status code ${result.status}: ${url}`);
          }
          params = result.data;
        } catch (e) {
          console.error('e :>> ', e.message);
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
      openApiData = openapi.openapi || (await dereference(openapi.openapi));
    } else {
      openApiData = (await parse(params)) as OpenAPIV3.Document;
    }
  } else {
    throw 'option: url or filePath or object must be specified one';
  }
  return openApiData;
};
