import axios, { Method } from "axios";

export default async function fetch(options: {
  url: string;
  query: any;
  body?: any;
  headers?: any;
  cookie?: any;
  method?: Method;
}): Promise<{ body: any }> {
  const res = await axios.request({
    url: options.url,
    headers: options.headers,
    data: options.body,
    params: options.query,
    method: options.method,
  });
  return {
    body: res.data,
  };
}
