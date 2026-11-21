import { Hono } from 'hono';
import { api } from './routes/api';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { scheduler } from './routes/scheduler';
import { telemetryRoutes } from './routes/telemetry';
import { triggers } from './routes/triggers';

/** The whole server as a Hono app. index.ts serves it on Devvit; the preview harness calls it directly. */
export const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);
internal.route('/scheduler', scheduler);

app.route('/api/telemetry', telemetryRoutes);
app.route('/api', api);
app.route('/internal', internal);
