import { describe, it, expect, beforeEach } from "vitest";
import {
  firePresentSubscribers,
  registerPresentHandler,
  type PresentEvent,
} from "../src/engine/triggers.ts";
import { placeAt } from "../src/engine/slots.ts";
import { getCard } from "../src/engine/cards.ts";
import {
  resetEngine,
  registerCreatureDef,
  registerStructureDef,
  makeSingleLocationState,
  makeMultiLocationState,
  spawn,
} from "./helpers.ts";

beforeEach(resetEngine);

function makeEvent(card: ReturnType<typeof getCard>, side: "player" | "ai", loc: string): PresentEvent {
  return { card, side, loc, cardType: "creature" };
}

describe("firePresentSubscribers — scope filtering", () => {
  it("this-location: fires when event loc matches subscriber loc", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [{ scope: "this-location", handler: "ping" }],
    });
    const state = makeSingleLocationState();
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    // Don't actually place it; just call the dispatcher directly to verify firing.
    firePresentSubscribers(state, makeEvent(flipper, "player", "L0"));
    expect(fired).toBe(1);
  });

  it("this-location: does NOT fire when event loc differs from subscriber loc", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [{ scope: "this-location", handler: "ping" }],
    });
    const state = makeMultiLocationState(["L0", "L1"]);
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    firePresentSubscribers(state, makeEvent(flipper, "player", "L1"));
    expect(fired).toBe(0);
  });

  it("this-side: fires when event side matches subscriber side", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [{ scope: "this-side", handler: "ping" }],
    });
    const state = makeMultiLocationState(["L0", "L1"]);
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    // Same side, different loc — fires.
    firePresentSubscribers(state, makeEvent(flipper, "player", "L1"));
    expect(fired).toBe(1);

    // Other side, same loc — does NOT fire.
    firePresentSubscribers(state, makeEvent(flipper, "ai", "L0"));
    expect(fired).toBe(1);
  });

  it("opposing-side: fires when event side differs from subscriber side", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [{ scope: "opposing-side", handler: "ping" }],
    });
    const state = makeSingleLocationState();
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    firePresentSubscribers(state, makeEvent(flipper, "ai", "L0"));
    expect(fired).toBe(1);

    firePresentSubscribers(state, makeEvent(flipper, "player", "L0"));
    expect(fired).toBe(1);
  });

  it("anywhere: fires regardless of side or location", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [{ scope: "anywhere", handler: "ping" }],
    });
    const state = makeMultiLocationState(["L0", "L1"]);
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    firePresentSubscribers(state, makeEvent(flipper, "ai", "L1"));
    firePresentSubscribers(state, makeEvent(flipper, "player", "L0"));
    expect(fired).toBe(2);
  });
});

describe("firePresentSubscribers — type filtering", () => {
  it("filter.cardType: only fires when event card type matches", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [
        { scope: "this-location", filter: { cardType: "creature" }, handler: "ping" },
      ],
    });
    const state = makeSingleLocationState();
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    registerCreatureDef("flipperCreature");
    const flipper = getCard(state.cards, spawn(state, "flipperCreature"));
    firePresentSubscribers(state, makeEvent(flipper, "player", "L0"));
    expect(fired).toBe(1);

    // An action event should NOT fire creature-filtered subscription.
    firePresentSubscribers(state, { ...makeEvent(flipper, "player", "L0"), cardType: "action" });
    expect(fired).toBe(1);
  });

  it("filter.excludeSelf: a card's own flip does not trigger its own subscription", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [
        { scope: "this-location", filter: { excludeSelf: true }, handler: "ping" },
      ],
    });
    const state = makeSingleLocationState();
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, false);

    // Self-event: should NOT fire.
    firePresentSubscribers(state, makeEvent(subscriber, "player", "L0"));
    expect(fired).toBe(0);

    // Other card's flip at same loc: should fire.
    registerCreatureDef("other");
    const other = getCard(state.cards, spawn(state, "other"));
    firePresentSubscribers(state, makeEvent(other, "player", "L0"));
    expect(fired).toBe(1);
  });
});

describe("firePresentSubscribers — face-down cards do not subscribe", () => {
  it("subscribing card must be face-up to react", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerCreatureDef("sub", {
      onPresent: [{ scope: "this-location", handler: "ping" }],
    });
    const state = makeSingleLocationState();
    const subscriber = getCard(state.cards, spawn(state, "sub"));
    // faceDown=true → subscriber is inert per unified face-down rule.
    placeAt(state, "player", "L0", "creature", ["r0c0"], subscriber, true);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    firePresentSubscribers(state, makeEvent(flipper, "player", "L0"));
    expect(fired).toBe(0);
  });
});

describe("firePresentSubscribers — counter-style accumulator", () => {
  it("subscribing card accumulates state per matched event", () => {
    registerPresentHandler("countCreatureFlips", (ctx) => {
      // Stash a counter on the subscriber's instance state. Use a free-form field.
      (ctx.subscriber as unknown as { creatureFlipsHere?: number }).creatureFlipsHere =
        ((ctx.subscriber as unknown as { creatureFlipsHere?: number }).creatureFlipsHere ?? 0) + 1;
    });
    registerCreatureDef("counter", {
      onPresent: [
        {
          scope: "this-location",
          filter: { cardType: "creature", excludeSelf: true },
          handler: "countCreatureFlips",
        },
      ],
    });
    const state = makeSingleLocationState();
    const counter = getCard(state.cards, spawn(state, "counter"));
    placeAt(state, "player", "L0", "creature", ["r0c0"], counter, false);

    registerCreatureDef("flipper");
    const a = getCard(state.cards, spawn(state, "flipper"));
    const b = getCard(state.cards, spawn(state, "flipper"));
    firePresentSubscribers(state, makeEvent(a, "player", "L0"));
    firePresentSubscribers(state, makeEvent(b, "ai", "L0"));
    expect((counter as unknown as { creatureFlipsHere?: number }).creatureFlipsHere).toBe(2);
  });
});

describe("firePresentSubscribers — structure subscribers", () => {
  it("structures with onPresent fire too (not just creatures)", () => {
    let fired = 0;
    registerPresentHandler("ping", () => {
      fired += 1;
    });
    registerStructureDef("watchtower", {
      onPresent: [{ scope: "this-location", handler: "ping" }],
    });
    const state = makeSingleLocationState();
    const tower = getCard(state.cards, spawn(state, "watchtower"));
    placeAt(state, "player", "L0", "structure", ["r0c0"], tower, false);

    registerCreatureDef("flipper");
    const flipper = getCard(state.cards, spawn(state, "flipper"));
    firePresentSubscribers(state, makeEvent(flipper, "player", "L0"));
    expect(fired).toBe(1);
  });
});

describe("firePresentSubscribers — duplicate registration rejected", () => {
  it("registering same tag twice throws", () => {
    registerPresentHandler("dup", () => {});
    expect(() => registerPresentHandler("dup", () => {})).toThrow(/Duplicate/);
  });
});
