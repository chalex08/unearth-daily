import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { dailyPost } from '../core/post';

export const menu = new Hono();

// Mod-only (devvit.json): makes today's post if the scheduler hasn't, else opens the existing one.
menu.post('/post-create', async (c) => {
  try {
    const post = await dailyPost();
    return c.json<UiResponse>({
      showToast: post.created
        ? "Today's post is up"
        : "Today's post already exists",
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id.slice(3)}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      { showToast: `Couldn't create today's post: ${error}` },
      400
    );
  }
});

menu.post('/example-form', async (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'exampleForm',
        form: {
          title: 'Example form',
          fields: [{ name: 'message', label: 'Message', type: 'string' }],
        },
      },
    },
    200
  );
});
