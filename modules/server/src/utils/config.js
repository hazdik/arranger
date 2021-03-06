export const PORT = process.env.PORT || 5050;
export const ES_HOST = process.env.ES_HOST || 'http://localhost:9200';
export const PROJECT_ID = process.env.PROJECT_ID;
export const PING_MS = process.env.PING_MS || 2200;
export const ES_LOG = process.env.ES_LOG?.split?.(',') || 'error';
export const MAX_LIVE_VERSIONS = process.env.MAX_LIVE_VERSIONS || 3;
export const DOWNLOAD_STREAM_BUFFER_SIZE =
  process.env.DOWNLOAD_STREAM_BUFFER_SIZE || 2000;
