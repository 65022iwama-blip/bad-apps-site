/*
 * cycle.js — ある日付が「巡りの何日目か」を決める
 *
 * ルール
 *  - 新月の日と満月の日に、それぞれ新しい巡りが始まる（その日が1日目＝Nyx）
 *  - 1巡りの長さは日付で数えて13〜16日と毎回変わる
 *  - 15日目以降は「クロノスの延長日」として14日目（Kronos）のまま
 *  - 日付の区切りは端末のタイムゾーン（日本なら日本時間の0時）
 */

const CYCLE_DAYS = 14;

const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a, b) => Math.round((dayStart(a) - dayStart(b)) / 864e5);

/**
 * date の日の情報をまとめて返す。
 * @returns {{
 *   date: Date,          // 対象の日
 *   dayNumber: number,   // 巡りの何日目か（1〜16）
 *   index: number,       // GODS の添字（0〜13）
 *   isExtra: boolean,    // 15日目以降（延長日）か
 *   waxing: boolean,     // true=満ちる巡り（新月始まり） false=欠ける巡り
 *   cycleStart: Date, nextCycleStart: Date, nextIsFull: boolean,
 *   moonPhase: number    // 0=新月 0.5=満月 1=新月
 * }}
 */
function getCycleDay(date) {
  const events = moonEventsAround(date);
  const nextIdx = events.findIndex(e => daysBetween(e.time, date) > 0); // 明日以降で最初の月相
  const start = events[nextIdx - 1];
  const next  = events[nextIdx];

  const dayNumber = daysBetween(date, start.time) + 1;

  // 月の形用：直前の新月から次の新月までのどこにいるか
  const lastNew = [...events].reverse().find(e => !e.isFull && e.time <= date);
  const nextNew = events.find(e => !e.isFull && e.time > date);
  const moonPhase = (date - lastNew.time) / (nextNew.time - lastNew.time);

  return {
    date,
    dayNumber,
    index: Math.min(dayNumber, CYCLE_DAYS) - 1,
    isExtra: dayNumber > CYCLE_DAYS,
    waxing: !start.isFull,
    cycleStart: start.time,
    nextCycleStart: next.time,
    nextIsFull: next.isFull,
    moonPhase,
  };
}
