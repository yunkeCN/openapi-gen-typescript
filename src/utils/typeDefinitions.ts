import { OpenAPI, OpenAPIV3 } from 'openapi-types';
import { ETemplateCode } from '../constants';
import MediaTypeObject = OpenAPIV3.MediaTypeObject;
import ParameterBaseObject = OpenAPIV3.ParameterBaseObject;
import OperationObject = OpenAPIV3.OperationObject;

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

export interface IPathMap {
  [key: string]: IPathMapContent;
}

export interface IGenParmas {
  url?: string;
  path?: string;
  version: string;
  object?: OpenAPI.Document;
  // dir of output files
  outputDir: string;
  // fetch impl file path
  fetchModuleFile?: string;
  pascalCase?: boolean;
  handlePostScript?: (obj: OperationObject, method?: string) => PostScriptReturnType;
}
