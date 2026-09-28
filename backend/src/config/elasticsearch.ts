import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const esClient = new Client({ node: config.elastic.node });
