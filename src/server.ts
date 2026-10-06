import dotenv from 'dotenv';
dotenv.config();

import { loadConfig } from './config';
import { createApp } from './app';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`GitHub audit dashboard listening on port ${config.port}`);
});
