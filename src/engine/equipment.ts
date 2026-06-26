// Equipment attach / detach.
//
// Contract: ENGINE_SKETCH.md Phase B, REBUILD_PLAN §29.
//
// Equipment doesn't take its own slot — it attaches to a host (creature or structure with an
// available equipment slot). On attach, the equipment's `grantsStats` apply to the host as
// equipped-scope buffs (set + add kinds, see below). On detach, those buffs are swept atomically.
//
// `grantsStats` has two kinds:
//   - "add" — additive buff. Stored as a Buff with scope "equipped".
//   - "set" — sets the host's effective stat to a specific value. NOT stored as a Buff; tracked
//     separately on the host as a `grantedSetOverrides` list. `effectiveStat` consults this list
//     to override the running total. See §B's effectiveStat algorithm.
//
// V1 design discipline: avoid multiple set-grants for the same stat (engine doesn't define
// a tiebreaker; content avoids the case).

import { getCardDef } from "./cards.ts";
import { applyBuff, sweepEquippedBuffs } from "./buffs.ts";
import type {
  CardInstance,
  CardRegistry,
  EquipmentGrant,
  GameState,
  InstId,
  StatKind,
} from "./types.ts";

// ---------- Set-override tracking ----------
//
// `grantedSetOverrides` is a per-host array. Each entry says: "this stat is set to amount,
// from this equipment source." On detach, entries matching the equipment's instId are removed.
// Effective stat reads consult this list AFTER summing other layers, applying the set if any.

export interface SetOverride {
  stat: StatKind;
  amount: number;
  sourceInstId: InstId;
}

// We use a property on CardInstance via a Map keyed by the host. Storing on the instance directly
// keeps the model simple. (CardInstance type doesn't declare this field yet — adding it.)

declare module "./types.ts" {
  interface CardInstance {
    grantedSetOverrides?: SetOverride[];
  }
}

// ---------- Attach ----------

export function attachEquipment(
  state: GameState,
  equipment: CardInstance,
  host: CardInstance,
): void {
  if (equipment.attachedTo != null) {
    throw new Error(`attachEquipment: ${equipment.instId} already attached`);
  }
  host.equipment.push(equipment.instId);
  equipment.attachedTo = host.instId;

  const def = getCardDef(equipment.defKey);

  // Apply grantsStats: add-kind become equipped-scope buffs; set-kind go into grantedSetOverrides.
  if (def.grantsStats) {
    for (const grant of def.grantsStats) {
      applyEquipmentGrant(state, host, equipment.instId, grant);
    }
  }

  // Apply grantsAttackPatterns: pushed onto host.grantedPatterns, source-tagged.
  if (def.grantsAttackPatterns) {
    for (const pattern of def.grantsAttackPatterns) {
      host.grantedPatterns.push({ pattern, sourceInstId: equipment.instId });
    }
  }
}

function applyEquipmentGrant(
  state: GameState,
  host: CardInstance,
  equipmentInstId: InstId,
  grant: EquipmentGrant,
): void {
  if (grant.kind === "add") {
    applyBuff(state, host, {
      stat: grant.stat,
      amount: grant.amount,
      scope: "equipped",
      sourceInstId: equipmentInstId,
    });
  } else {
    // set
    if (!host.grantedSetOverrides) host.grantedSetOverrides = [];
    host.grantedSetOverrides.push({
      stat: grant.stat,
      amount: grant.amount,
      sourceInstId: equipmentInstId,
    });
  }
}

// ---------- Detach ----------

export function detachEquipment(cards: CardRegistry, equipment: CardInstance): void {
  if (equipment.attachedTo == null) return;
  const host = cards[equipment.attachedTo];
  if (host) {
    // Remove this equipment from host's equipment list
    host.equipment = host.equipment.filter((id) => id !== equipment.instId);
    // Sweep equipped-scope buffs sourced from this equipment
    sweepEquippedBuffs(cards, equipment.instId);
    // Remove set-overrides sourced from this equipment
    if (host.grantedSetOverrides) {
      host.grantedSetOverrides = host.grantedSetOverrides.filter(
        (o) => o.sourceInstId !== equipment.instId,
      );
      if (host.grantedSetOverrides.length === 0) {
        delete host.grantedSetOverrides;
      }
    }
    // Remove granted attack patterns sourced from this equipment
    host.grantedPatterns = host.grantedPatterns.filter(
      (g) => g.sourceInstId !== equipment.instId,
    );
  }
  delete equipment.attachedTo;
}

// ---------- Read helpers ----------

/**
 * Returns the active set-override for a stat, if any. Used by effectiveStat to apply the
 * "set" semantics last.
 */
export function getActiveSetOverride(host: CardInstance, stat: StatKind): SetOverride | null {
  if (!host.grantedSetOverrides) return null;
  for (const o of host.grantedSetOverrides) {
    if (o.stat === stat) return o;
  }
  return null;
}
