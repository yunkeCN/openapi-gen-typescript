import { OpenAPIV3 } from 'openapi-types';
import { IPathMap } from './typeDefinitions';

export function getTagWithPaths(openApiData: OpenAPIV3.Document, pathsMap: IPathMap) {
  const { tags: allTags } = openApiData;
  const commonTag: OpenAPIV3.TagObject = {
    name: 'common',
    description: 'common tag',
  };
  const customTags = allTags ? allTags.concat([commonTag]) : [commonTag];
  const commonfilterPaths = Object.keys(pathsMap).filter(namespaceName => {
    let filter = true;
    customTags.forEach(currTag => {
      if (pathsMap[namespaceName].tags.includes(currTag.name)) {
        filter = false;
      }
    });
    return filter;
  });
  return customTags.map(currTag => {
    const pathsInCurrTag: { [key: string]: any } = {};
    let filterPaths = Object.keys(pathsMap).filter(namespaceName =>
      pathsMap[namespaceName].tags.includes(currTag.name),
    );
    if (currTag.name === 'common') {
      filterPaths = filterPaths.concat(commonfilterPaths);
    }
    filterPaths.map(namespaceName => {
      pathsInCurrTag[namespaceName] = pathsMap[namespaceName];
    });
    return {
      ...currTag,
      pathsInCurrTag,
    };
  });
}
