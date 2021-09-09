import * as camelcase from 'camelcase';
import { getCamelcase } from './genCode';
import { IHandelGenPathResult, IHandleGenPathProps } from './type';

interface IGetGenPathProps {
  handleGenPath?: (props: IHandleGenPathProps) => IHandelGenPathResult;
  propForGen: IHandleGenPathProps;
}

type ITagsGenPathProp = {
  operationObject: IHandleGenPathProps['operationObject'];
  method: IHandleGenPathProps['method'];
  path: IHandleGenPathProps['path'];
};

type IGenPath = {
  path: IHandleGenPathProps['path'];
  method: IHandleGenPathProps['method'];
};

// 生成文件路径
export const getFilePath = (props: IGetGenPathProps): IHandelGenPathResult => {
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
export const genTags = (props: ITagsGenPathProp): IHandelGenPathResult => {
  const { operationObject, method, path } = props;
  const { operationId, tags } = operationObject;
  const dirName = tags?.[0];
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
export const genPaths = (props: IGenPath): IHandelGenPathResult => {
  const { path } = props;
  const pathArr = path.split('/');
  const dirName = pathArr.slice(0, -1).join('/');
  const fileName = pathArr[pathArr.length - 1];
  return { fileName, dirName };
};
