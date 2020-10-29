import { gen } from "../src";

(async function () {
  await gen({
    url: 'https://petstore.swagger.io/v2/swagger.json',
    version: "2",
    outputDir: `${__dirname}/gen`,
  })
  process.exit(0);
})();
