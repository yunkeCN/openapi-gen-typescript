# openapi-gen-typescript
Generate typescript code for openapi.

## Usage

```javascript
gen({
    url: 'https://petstore.swagger.io/v2/swagger.json',
    version: "2",
    outputDir: `${__dirname}/gen`
});
```

## doc

Param | Description
---|---
url | The url of fetch openapi or swagger data
version | The version of Swagger or OpenApi, example: `2`, `3`
outputDir | Dir of output files
fetchModuleFile | Fetch impl file path


