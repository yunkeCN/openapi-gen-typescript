import axios from "axios";

export default async function fetch(options: {
  url: string;
  query: any;
  body?: any;
  header?: any;
  cookie?: any;
}): Promise<{ body: any }> {
  const res = await axios.request({
    url: options.url,
    headers: options.header,
    data: options.body,
    params: options.query,
  });
  return {
    body: res.data,
  };
}
