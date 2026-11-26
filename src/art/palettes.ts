import { ChapterId } from '../core/types';

export interface ChapterPalette {
  skyTop: string;
  skyMid: string;
  skyBot: string;
  farBuilding: string;
  farWindow: string;
  midBuilding: string;
  midAccent: string;
  tileMain: string;
  tileTop: string;
  tileDark: string;
  platformMain: string;
  platformAccent: string;
  climbWall: string;
  climbRung: string;
}

export const CHAPTER_PALETTES: Record<ChapterId, ChapterPalette> = {
  1: {
    // 黃昏騎樓巷弄
    skyTop: '#2f1e42',
    skyMid: '#9e4756',
    skyBot: '#f09459',
    farBuilding: '#3d2447',
    farWindow: '#ffd37d',
    midBuilding: '#59334d',
    midAccent: '#f2b866',
    tileMain: '#7d4438',
    tileTop: '#c97b5d',
    tileDark: '#4d2723',
    platformMain: '#475978',
    platformAccent: '#d94c4c',
    climbWall: '#595066',
    climbRung: '#c4b8d1',
  },
  2: {
    // 霓虹熱鬧夜市
    skyTop: '#100c24',
    skyMid: '#241845',
    skyBot: '#3d235c',
    farBuilding: '#1c1438',
    farWindow: '#40f2e6',
    midBuilding: '#2e1d4f',
    midAccent: '#ff4f8b',
    tileMain: '#38324d',
    tileTop: '#6c628a',
    tileDark: '#211d30',
    platformMain: '#d93848',
    platformAccent: '#fff0d6',
    climbWall: '#353e5c',
    climbRung: '#5ef2e6',
  },
  3: {
    // 深夜雨天屋頂
    skyTop: '#080e1f',
    skyMid: '#12223d',
    skyBot: '#1d3659',
    farBuilding: '#0d192e',
    farWindow: '#ffe07d',
    midBuilding: '#182b47',
    midAccent: '#5aa6d6',
    tileMain: '#364559',
    tileTop: '#68829e',
    tileDark: '#202b38',
    platformMain: '#8c9eb5',
    platformAccent: '#e6f2ff',
    climbWall: '#4b6175',
    climbRung: '#b8d4e8',
  },
};
