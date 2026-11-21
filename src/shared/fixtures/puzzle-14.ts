// Sample puzzle #14 (SPEC §9), for tests. Each layer's pool narrows the one before it.
import type { AnswerEntry, Commonness, Puzzle } from '../puzzle';

const a = (
  canonical: string,
  commonness: Commonness,
  ...aliases: string[]
): AnswerEntry => ({
  canonical,
  aliases,
  commonness,
});

const l10 = [a('chinotto', 'rare', 'myrtle-leaved orange')];
const l9 = [
  ...l10,
  a('calamondin', 'rare', 'calamansi'),
  a('rangpur', 'rare', 'rangpur lime'),
];
const l8 = [
  ...l9,
  a('kumquat', 'rare', 'cumquat'),
  a('satsuma', 'uncommon'),
  a('mandarin', 'common', 'mandarin orange'),
];
const l7 = [
  ...l8,
  a('clementine', 'common', 'clemmie'),
  a('tangerine', 'common'),
];
const l6 = [
  ...l7,
  a('navel orange', 'common', 'naval orange', 'orange'),
  a('blood orange', 'uncommon'),
  a('seville orange', 'rare', 'bitter orange'),
];
const l5 = [
  ...l6,
  a('persimmon', 'rare', 'sharon fruit'),
  a('mango', 'common'),
  a('peach', 'uncommon'),
];
const l4 = [
  ...l5,
  a('apricot', 'uncommon'),
  a('cantaloupe', 'uncommon', 'rockmelon'),
  a('pumpkin', 'common'),
];
const l3 = [
  ...l4,
  a('sweet potato', 'common', 'kumara'),
  a('carrot', 'common'),
];
const l2 = [...l3, a('cheddar', 'uncommon', 'cheddar cheese')];
const l1 = [
  ...l2,
  a('traffic cone', 'uncommon', 'road cone'),
  a('basketball', 'common'),
  a('goldfish', 'common'),
];

const clues = [
  'Name something orange',
  '…that you can eat',
  '…that grows on a plant',
  "…that's a fruit",
  '…that grows on a tree',
  "…that's a citrus fruit",
  '…smaller than a tennis ball',
  '…whose name has no letter E',
  '…not usually eaten raw',
  '…mostly grown in Italy',
];

export const puzzle14: Puzzle = {
  number: 14,
  date: '2026-12-05',
  layers: [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10].map((pool, i) => ({
    clue: clues[i]!,
    pool,
  })),
};
