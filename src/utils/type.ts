import { OpenAPI, OpenAPIV3 } from 'openapi-types';
import { ETemplateCode } from '../constants';
import MediaTypeObject = OpenAPIV3.MediaTypeObject;
import ParameterBaseObject = OpenAPIV3.ParameterBaseObject;
import OperationObject = OpenAPIV3.OperationObject;

export type methods = 'tags' | 'post' | 'options' | 'put' | 'delete' | 'patch' | 'head' | 'get';

export type ContentObject = {
  [media: string]: MediaTypeObject;
};

export interface IParameterMap {
  [name: string]: ParameterBaseObject;
}

export type PostScriptReturnType =
  | {
      [key in ETemplateCode]: string;
    }
  | {
      [key: string]: string;
    };

export interface IPathMapContent {
  summary: string | undefined;
  tags: string[];
  code: string;
  path: string;
}

export type IHandelGenPathResult = {
  dirName?: string;
  fileName?: string;
};

export interface IHandleGenPathProps {
  info: OpenAPIV3.InfoObject; // swagger文档的info信息
  operationObject: OpenAPIV3.OperationObject; // 具体到接口的OperationObjerct对象
  method: methods; // 具体到接口的请求方法
  path: string; // 具体到接口的路径
}

export interface IGenParmas {
  url?: string;
  path?: string;
  version?: string;
  object?: OpenAPI.Document;
  // dir of output files
  outputDir: string;
  // fetch impl file path
  fetchModuleFile?: string;
  pascalCase?: boolean;
  handlePostScript?: (obj: OperationObject, method?: string) => PostScriptReturnType;
  handleGenPath?: (props: IHandleGenPathProps) => IHandelGenPathResult;
}

export interface IFileCode {
  code: string;
  dirName?: string;
  fileName?: string;
  summary?: string;
}

export type IFileMap = {
  [key: string]: IFileCode[];
};

export interface IGetReqParams {
  parameters: (OpenAPIV3.ReferenceObject | OpenAPIV3.ParameterObject)[];
}

export interface IGetReqBody {
  requestBody: any;
  openApiData: OpenAPIV3.Document<{}>;
}

export interface IHandleSchema {
  pascalCase: boolean;
  openApiData: OpenAPIV3.Document;
}

export interface IGetFilePathProps {
  handleGenPath?: (props: IHandleGenPathProps) => IHandelGenPathResult;
  propForGen: IHandleGenPathProps;
}

export type ITagsGenProp = {
  operationObject: IHandleGenPathProps['operationObject'];
  method: IHandleGenPathProps['method'];
  path: IHandleGenPathProps['path'];
};

export type IPathsGenProp = {
  path: IHandleGenPathProps['path'];
  method: IHandleGenPathProps['method'];
};
