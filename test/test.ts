import { gen } from "../src";

(async function () {
  await gen({
    url: 'https://api.myscrm.cn/api/interface/swagger/1989/master?token=495f3669e89b002fedd3&to-definitions=',
    version: "2",
    outputDir: `${__dirname}/gen`
  })
})();
