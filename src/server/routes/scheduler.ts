import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { dailyPost } from '../core/post';

export const scheduler = new Hono();

// cron "0 0 * * *" in devvit.json. dailyPost works out the UTC day itself and is idempotent,
// so a late, early or repeated firing still makes one post per day.
scheduler.post('/daily-post', async (c) => {
  const { name } = await c.req.json<TaskRequest>();
  const post = await dailyPost();
  console.log(
    `${name}: ${post.created ? 'created' : 'already had'} ${post.id}`
  );
  return c.json<TaskResponse>({}, 200);
});
