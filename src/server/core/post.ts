import { reddit, redis } from '@devvit/web/server';
import { dayKey } from '../../shared/game';
import { keys, TTL_SECONDS } from './keys';
import { puzzleFor } from './puzzles';

/** How long a half-made daily post blocks a retry, should creating it crash. */
const CLAIM_SECONDS = 120;

/**
 * Today's daily post, created once per UTC day however often this runs (cron, mod menu, install).
 * The post carries its puzzle day in postData, so a run started on it before midnight
 * keeps answering that day's puzzle afterwards (SPEC §2).
 */
export async function dailyPost(
  now = new Date()
): Promise<{ id: string; created: boolean }> {
  const day = dayKey(now);
  const puzzle = puzzleFor(day);
  if (!puzzle) throw new Error(`No puzzle for ${day}`);
  const key = keys.daily(day);
  if (!(await redis.hSetNX(key, 'post', 'creating'))) {
    const id = await redis.hGet(key, 'post');
    if (!id || id === 'creating')
      throw new Error(`Today’s post is being created`);
    return { id, created: false };
  }
  await redis.expire(key, CLAIM_SECONDS);
  let post;
  try {
    post = await reddit.submitCustomPost({
      title: `Unearth #${puzzle.number} — ${puzzle.layers[0]!.clue}`,
      postData: { day },
    });
  } catch (e) {
    await redis.del(key);
    throw e;
  }
  await redis.hSet(key, { post: post.id });
  await redis.expire(key, TTL_SECONDS);
  // Pinning and distinguishing need the app's mod rights; the post stands without them.
  try {
    await post.sticky(1);
  } catch (e) {
    console.error(`sticky failed: ${e}`);
  }
  try {
    await stickyId(post.id);
  } catch (e) {
    console.error(`sticky comment failed: ${e}`);
  }
  return { id: post.id, created: true };
}

export const isId = <P extends 't1' | 't3'>(
  p: P,
  id: string | undefined
): id is `${P}_${string}` => !!id?.startsWith(`${p}_`);

/** The stickied app comment that shared results reply to (Devvit rules: score comments go under a sticky). */
export async function stickyId(
  postId: `t3_${string}`
): Promise<`t1_${string}`> {
  const known = await redis.hGet(keys.sticky(postId), 'id');
  if (isId('t1', known)) return known;
  // Made by dailyPost; this fallback covers older posts and a failed first attempt.
  const sticky = await reddit.submitComment({
    id: postId,
    text: 'Share your result below. Replies here are yours alone: delete yours any time.',
    runAs: 'APP',
  });
  await sticky.distinguish(true);
  await redis.hSet(keys.sticky(postId), { id: sticky.id });
  await redis.expire(keys.sticky(postId), TTL_SECONDS);
  return sticky.id;
}
