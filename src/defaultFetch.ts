import axios from "axios";

export default async function fetch(options: {
  url: string;
  query: any;
  body?: any;
  headers?: any;
  cookie?: any;
}): Promise<{ body: any }> {
  const res = await axios.request({
    url: options.url,
    headers: options.headers,
    data: options.body,
    params: options.query,
  });
  return {
    body: res.data,
  };
}
