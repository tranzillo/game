import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  runBeat,
  cancelAll,
  isPlaying,
  setSpeed,
  getSpeed,
  startSequence,
  endSequence,
  _resetScheduler,
} from "../src/engine/scheduler.ts";

beforeEach(() => {
  vi.useFakeTimers();
  _resetScheduler();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isPlaying / startSequence / endSequence", () => {
  it("isPlaying is false at rest", () => {
    expect(isPlaying()).toBe(false);
  });

  it("startSequence marks playing", () => {
    startSequence();
    expect(isPlaying()).toBe(true);
  });

  it("endSequence marks idle", () => {
    startSequence();
    endSequence();
    expect(isPlaying()).toBe(false);
  });
});

describe("setSpeed / getSpeed", () => {
  it("default speed is 1", () => {
    expect(getSpeed()).toBe(1);
  });

  it("setSpeed accepts positive numbers", () => {
    setSpeed(2);
    expect(getSpeed()).toBe(2);
    setSpeed(0.5);
    expect(getSpeed()).toBe(0.5);
  });

  it("setSpeed rejects 0 / negative / NaN", () => {
    setSpeed(2);
    setSpeed(0);
    expect(getSpeed()).toBe(2);
    setSpeed(-1);
    expect(getSpeed()).toBe(2);
    setSpeed(Number.NaN);
    expect(getSpeed()).toBe(2);
  });
});

describe("runBeat", () => {
  it("invokes the callback after the duration", () => {
    const cb = vi.fn();
    runBeat(100, cb);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("marks isPlaying while pending", () => {
    runBeat(100, () => {});
    expect(isPlaying()).toBe(true);
  });

  it("speed multiplier scales the wait", () => {
    setSpeed(0.5); // half wait
    const cb = vi.fn();
    runBeat(100, cb);
    vi.advanceTimersByTime(40);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10); // total 50ms = 100 * 0.5
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("calling runBeat again cancels the pending beat", () => {
    const a = vi.fn();
    const b = vi.fn();
    runBeat(100, a);
    runBeat(50, b);
    vi.advanceTimersByTime(100);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("callback errors don't break future beats; engine marked idle on throw", () => {
    runBeat(50, () => {
      throw new Error("boom");
    });
    vi.advanceTimersByTime(50);
    expect(isPlaying()).toBe(false);
  });
});

describe("cancelAll", () => {
  it("cancels a pending beat", () => {
    const cb = vi.fn();
    runBeat(100, cb);
    cancelAll();
    vi.advanceTimersByTime(200);
    expect(cb).not.toHaveBeenCalled();
  });

  it("marks isPlaying false", () => {
    runBeat(100, () => {});
    cancelAll();
    expect(isPlaying()).toBe(false);
  });
});
