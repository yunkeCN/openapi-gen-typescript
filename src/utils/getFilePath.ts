import * as camelcase from 'camelcase';
import { getCamelcase } from './format';
import { IGetFilePathProps, IHandelGenPathResult, IPathsGenProp, ITagsGenProp } from './type';

// 生成文件路径
export const getFilePath = (props: IGetFilePathProps): IHandelGenPathResult => {
  const { handleGenPath, propForGen } = props;
  const { method, operationObject, path } = propForGen;
  let result: IHandelGenPathResult = {};
  if (handleGenPath) {
    result = handleGenPath(propForGen);
    return result;
  }
  return genTags({ method, operationObject, path });
};

// 以tags方式生成路径
export const genTags = (props: ITagsGenProp): IHandelGenPathResult => {
  const { operationObject, method, path } = props;
  const { operationId, tags } = operationObject;
  const dirName = tags?.[0] || 'common';
  let fileName =
    operationId ||
    `${method.toLowerCase()}${getCamelcase(path, {
      pascalCase: true,
    })}`;
  fileName = camelcase(fileName.replace(/[^a-zA-Z0-9_]/g, ''), {
    pascalCase: true,
  });
  return { dirName, fileName };
};

// 以path方式生成路径
export const genPaths = (props: IPathsGenProp): IHandelGenPathResult => {
  const { path, method } = props;
  const pathArr = path.split('/');
  const dirName = path[0] === '/' ? pathArr?.[1] : pathArr[0];
  let fileName = `${method.toLowerCase()}${getCamelcase(path, {
    pascalCase: true,
  })}`;
  fileName = camelcase(fileName.replace(/[^a-zA-Z0-9_]/g, ''), {
    pascalCase: true,
  });
  return { fileName, dirName };
};
