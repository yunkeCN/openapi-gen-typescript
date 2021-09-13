# openapi-gen-typescript

Generate typescript code for openapi.

## Usage

```javascript
gen({
  url: 'https://petstore.swagger.io/v2/swagger.json',
  version: '2',
  outputDir: `${__dirname}/gen`,
});
```

## doc

| Param            | Description                                          |
| ---------------- | ---------------------------------------------------- |
| url              | The url of fetch openapi or swagger data             |
| path             | The filePath of fetch openapi or swagger data        |
| object           | The docs of fetch openapi or swagger data            |
| outputDir        | Dir of output files                                  |
| fetchModuleFile  | Fetch impl file path                                 |
| handleGenPath    | Processing generated paths                           |
| handlePostScript | post script to customize the result                  |
