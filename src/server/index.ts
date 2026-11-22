import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { menu } from './routes/menu';
import { devApi, devForms, seed } from './routes/seed';
import { scheduler } from './routes/scheduler';
import { triggers } from './routes/triggers';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/menu', seed);
internal.route('/form', devForms);
internal.route('/triggers', triggers);
internal.route('/scheduler', scheduler);

app.route('/api/dev', devApi);
app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
