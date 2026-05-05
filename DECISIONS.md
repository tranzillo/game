# Decisions

Append-only log of meaningful choices and the reasoning behind them. Newest at the top. Don't edit past entries — add a new entry that supersedes them.

Format:

```
## YYYY-MM-DD — Short title
**Decision:** what we decided
**Why:** the reasoning
**Alternatives considered:** what else was on the table
**Supersedes:** (optional) link to a prior decision this replaces
```

---

## 2026-05-05 — Blue's three action-acquisition vectors locked; vector pattern as a design framework

**Decision (cluster):**

1. **Blue's deckbuilder verb is *copy*, not steal.** Blue observes actions and produces independent copies for its own deck. The verb never targets stealing or moving cards out of an opponent's deck — copies are independent instances.

2. **Three printable vectors for the *copy* verb:**
   - **Equipment** (canonical card: *Spellbook*) — wielder-defended, multi-charge (3 pages), copies enemy actions resolving at the wielder's location to your discard pile per page spent.
   - **Structure** (canonical card: *Forbidden Library*) — one-shot premium (≥3 Insight). Copies the next enemy action resolving here to your hand, then self-destructs.
   - **Persistent action** (canonical card: *Archeological Expedition*) — patient gamble. At end of cleanup, if any action resolved at this location this turn, copies a random one to your graveyard; Expedition itself goes to your graveyard.

3. **Variation lives in conditions, scope, and requirements** — not in changing the verb. Each vector has distinct trigger conditions, copy destinations, and timing windows; all express the same Blue verb.

4. **The vector pattern generalizes across all five conversion verbs.** Each color's verb (Recruit, Reroute, Convert, Stealswap, Research/Copy) can be expressed across multiple card-type vectors. Red's Recruit already has action-form (R4) and creature-form (Goblin Recruiter). Black's Stealswap has creature-form (Nightmare) and action-form. Blue's three-vector framework establishes the pattern; other colors' vectors will be designed similarly going forward.

5. **Color identity is preserved at the verb level; variety is created at the vector level.** Blue does not steal. Red does not corrupt. Black does not heal. The verb is the principle; the vectors are the printed expressions.

6. **Spellbook is equipment, not structure.** The earlier structure-only framing had only one neutralization path (structure-removal). Equipment-with-wielder gives the design space much richer interaction — kill wielder, displace wielder, equipment-removal, wielder-mobility — and tightens the theme (books are *carried*, not pinned to slabs).

7. **Enemy-only triggering for Spellbook and Forbidden Library** — both vectors specifically copy *opposing* actions, not the player's own. This structurally prevents the self-cast deck-building loophole (where a player casts their own cards repeatedly to spam copies). Theme tightens: Blue is *studying enemy intelligence*, not its own.

8. **Stat gating is via location-presence, not card-text targeting.** Spellbook's "≥2 Insight here" is checked at the location level (the location must have the required Insight in the side's totals). Equipment placement onto a creature is *placement*, not targeting — the player picks the host as a play-time decision, not a resolve-time targeting prompt (per Pillar 10).

9. **Wielder mobility carries Spellbook's "this location" trigger.** When the wielder moves (Shove, Disperse, Bodyswap), Spellbook's location reference updates. Equipment scope follows the host; the book is carried with the wielder.

**Why:** Blue's deckbuilder identity needed real action-acquisition paths. The Research-token-only model produces encounter-temporary copies that don't grow the deck — leaving Blue without a deckbuilder loop. Three vectors give Blue varied deck-building rhythms (in-encounter cycling via Spellbook, immediate hand access via Library, next-encounter investment via Expedition) while staying within the *copy* verb.

The equipment-as-vector reframe (vs. structure-only Spellbook) is critical: the wielder becomes the load-bearing defense, killing the wielder neutralizes the path, equipment-mobility means the book follows the wielder. Cross-color setup plays light up — White Bodyswap to protect, Green stealth to skip combat, Red walls in the column. Blue's acquisition tools require defense from other colors; built-in splash incentive matches Blue's existing brittle-mage identity.

The vector pattern as design framework is a generalizable principle for all colors. Future card design for any color's verb should ask: *which card types can express this verb? What conditions, scopes, and destinations differentiate the vectors?* Blue's three-vector spread is the template.

**Alternatives considered:**

- *Spellbook as a structure (original framing).* Rejected — equipment-with-wielder gives much richer interaction. The structure-only version had only one neutralization path.
- *Self-cast loophole tolerated* (Spellbook copies any action including yours). Rejected — players can self-build their decks via repeated self-casting. Enemy-only triggering structurally prevents this.
- *Forbidden Library as a re-skinned Spellbook.* Rejected — variety needs to come from conditions/scope/destination, not numerical re-skins. Library's hand destination + one-shot trigger + structural form are genuinely distinct (though flagged by the user for revisit if the variety isn't sharp enough at gameplay level).
- *Archeological Expedition with Pray-N channeling.* Rejected — Pray-N is White's mechanic. Blue does not pray. Expedition is a persistent action by nature, not a channeled action with N progress points.
- *Expedition triggers only on actions entering the graveyard.* Rejected — too combo-locked with Counterspell. Broad scope (any action resolving here) gives Expedition its own design space.
- *Per-color Blue resource (mana) gating Spellbook triggers.* Rejected — duplicates the presence model, multiplies cognitive load, and the existing mechanisms (charges, sacrifice, one-shot) cover Spellbook's needs cleanly. Mana would also be confused with general "pay to cast everything" by players — dangerous MTG association.

**Implications:**

- **Blue can grow its deck via three distinct rhythms.** Discard cycling (Spellbook), immediate hand (Library), next-encounter graveyard (Expedition).
- **Cross-color setup plays light up for Blue.** Wielder-defense is the natural splash incentive — White, Green, Red all contribute defensive tools.
- **Anti-Blue acquisition design space.** Equipment-removal targets Spellbook; structure-removal targets Library; action-slot pressure (Counterspell, Stifle, Curse migration) interferes with Expedition. White and Black are the natural anti-acquisition colors.
- **The vector pattern is a card-design framework.** Future per-color acquisition design should fan the verb across multiple printable vectors with distinct trigger conditions and timings.

**Revisit when:**

- Playtest reveals Spellbook-equipment is too hard to defend (mitigation: more pages, lower cost, Magnetic-style return-to-junkyard variants).
- Forbidden Library feels too similar to Spellbook in actual play (mitigation: redesign trigger or effect — flagged by the user as a likely revisit).
- Archeological Expedition's gamble is too punishing or too strong (mitigation: tune trigger condition narrower/broader, or change copy destination).
- Other colors' vector spreads need design (Red, Green, White, Black should each get a vector-spread treatment similar to Blue's).

---

## 2026-05-05 — Stealswap mechanic locked: cost-shape, whiff rule, acquisition path

**Decision (cluster):**

1. **The swap card is itself the cost.** Stealswap has *no payable stat-presence cost*. The currency is *the swap card moving to the enemy side*. Stat-presence requirements aren't what gates stealswap; the loss of the swap card is. This is structurally distinct from Recruit, Convert, Reroute, and Research — five distinct cost currencies across the conversion verbs.

2. **The whiff rule is universal across swap cards.** If no legal target exists at resolve time, the swap card *still* moves to the enemy side. Pure whiff = lost card + no acquisition + (for action-swap) potential damage to your own side. Brutal by design, *because* whiffing on purpose is sometimes a real play (deck-thinning).

3. **High-threat printing is the per-card cost-balancer.** The more powerful the swap card's printed stats and abilities, the better the trade can be (you can size up the steal target via threat-parity), but the worse the whiff scenario gets. Each stealswap card balances itself via its own printed threat.

4. **Card-type matching.** Creature-swap takes creatures, action-swap takes actions, structure-swap takes structures, equipment-swap takes equipment. No cross-type swaps.

5. **Multi-slot resistance is emergent.** Multi-slot creatures can't be stolen by single-slot swap cards (no slot symmetry). Free immunity from the multi-slot design space.

6. **Acquired card permanently joins the swapper's deck at encounter end.** Creatures reshuffle to swapper's deck; actions cycle in swapper's discard; structures and equipment join swapper's piles. The earlier working assumption of "reverts to original owner at encounter end" is rejected — the whole point is permanent acquisition through trade.

7. **Pillar 10 setup is the win condition.** Stealswap on a random target = coin flip. Stealswap on the only legal candidate = guaranteed grab. Cross-color setup tools (Bully push, Reroute counter, positional movement) enable precise targeting — Black's mechanic *forces splash setup*, which is itself a feature.

8. **Pillar 5 clean.** Faster cards resolving first is already legal. Swap intercepts the slower card's destination — no stack/response chain.

9. **Whiff-as-deck-thin is a real strategic option.** Pure-whiff permanently removes the swap card from your deck. Black runs lean by structure; deliberate whiffing is one of the lever-pulls that supports the lean identity.

10. **Action-stealswap acquired card resolves from new position.** A damage action that swaps to enemy side fires its damage at "the other side" (which is now the original caster's side). Per the universal damage-fall-through rule, if no creatures are present, damage falls through to the original caster's summoner.

11. **Acquired creatures retain pre-swap damage** ("you take it as it was"). Buffs and debuffs follow normal rules (encounter-scoped buffs persist if their printed duration covers the swap timing).

**Why:** Earlier doc passes had stealswap as a generic relocate-on-reveal subclass with several open questions (does damage carry, who owns the card on encounter end, etc.). Recent design work — including v3 prototype findings, the explicit conversion-verb framing (2026-05-03 entry), and the corrupt/reroute reframe that ceded the patient-acquisition mechanic to Green — reframes stealswap as **Black's primary acquisition verb, structurally distinct from any other color's**.

The cost-shape is genuinely unique: paying with the swap card itself, balanced by the card's own threat output, with whiff-as-real-strategy. This makes Black mechanically the *high-variance, high-stakes* color — gambling-as-color-identity, not just thematically claimed but mechanically expressed.

**Alternatives considered:**

- *Whiff makes the swap card return to your hand.* Rejected — eliminates the whiff penalty; makes stealswap free at worst. Whiffing must be a real cost.
- *Whiff fizzles entirely (card returns to discard or graveyard, no movement).* Rejected — same reason. Also breaks the deck-thinning-via-whiff strategy that depends on permanent removal of the whiffed card.
- *Stealswap pays through stat presence (e.g., ≥3 Spite here).* Rejected — collapses stealswap into the same cost-shape as Recruit/Convert, removes the unique high-stakes-trade identity, and removes the whiff-as-real-strategy lever.
- *Acquired card returns to original owner at encounter end.* Rejected — destroys stealswap as an acquisition verb; reduces it to temporary control-shift. The whole point is permanent acquisition through trade.
- *Stealswap targets across card types* (e.g., creature for action). Rejected — too freeform; type-matching is cleaner and naturally bounds the mechanic.
- *Cross-side equipment as the only acquisition vector for equipment.* Held open — equipment-stealswap is in the variants design space; whether it's the primary acquisition path for equipment is a separate question.

**Implications:**

- **Pillar-10 positional play matters more.** Setting up "exactly one legal target" is the primary skill of stealswap-heavy strategies. Cross-color setup tools become Black-enabling.
- **Anti-stealswap design space exists.** Parliament-style "cards cannot change sides here" location text, cards that punish whiffs harder, cards that suppress acquired cards' effects. White and Blue split this design space.
- **Swap variants are a rich design space.** Targeting-condition variants, stat-gated variants, conditional variants, friendly-fire variants, multi-card variants — all use the core rules with different printed text.
- **Engine implication:** state needs to track which cards have been "converted" (entered via stealswap, raise, recruit, etc.). At encounter end, converted cards go to the new owner's deck.
- **Black's two-path acquisition shape is now structural.** Stealswap (trade-now) + raise-from-any-graveyard (kill-then-claim) — two transactional shapes that share Black's identity but cover different strategic situations. Other colors generally have one acquisition path; Black having two is a deliberate asymmetry that reinforces "transactional engagement is its weapon."

**Revisit when:** playtest reveals (a) the cost-shape feels too brutal for non-experts (mitigation: tune Nightmare's Force lower, weaken whiff penalty), (b) whiffing-on-purpose is too rarely useful (mitigation: more cards that combo with deck-thinning), or (c) the acquired-card-permanent-acquisition rule produces snowballing strategies that need a cap.

**Supersedes:** the prior Stealswap section's "stays flipped, reshuffles to original owner's deck at encounter end" working assumption. All other Stealswap rules in DESIGN.md as of this date are consistent with this entry.

---

## 2026-05-03 — Junkyard as a separate zone; equipment piles destination follows host side; Magnetic as scope-shifting

**Decision (cluster):**

1. **The graveyard zone splits into two zones.** Creatures go to the **graveyard** when they die; structures and equipment go to the **junkyard** when they leave play. This is a real ontological separation reflecting card-type identity:
   - Graveyard = pile for *living things* (creatures).
   - Junkyard = pile for *built things* (structures, equipment).
   - Discard pile (existing) = pile for *actions*.

2. **Equipment piles destination follows the host's side at the moment of leaving play.**
   - Equipment goes to the junkyard of whichever side the host was on when the equipment leaves play.
   - Cross-side equipment (`Equip to a creature on the other side`) lost when host dies: the equipment goes to the *other side's* junkyard. **You lose the equipment forever.**
   - This is the cost-shape lever for cross-side equipment — playing equipment on enemies is a *one-shot consumed* play unless Magnetic.

3. **Magnetic equipment overrides the host-side rule.** A Magnetic equipment, when it leaves play, returns to *your* junkyard regardless of which side the host was on. This is the goblin-engineering "magnet" flavor — the equipment is yanked back via mechanical contraption.

4. **Magnetic on a structure scope-extends.** The same Magnetic keyword printed on a structure affects *all equipment leaving play at this location*. Every equipment leaving play here gets pulled to your junkyard, including equipment originally owned by the other side. **The structure becomes stealswap for equipment.** Same keyword, different scope, based on what card-type prints it.

5. **Equipment text can also override the host's piles destination.** A stealswap-equipment can print *"When the wielder dies, they go to your graveyard."* This makes the equipment a one-shot card-acquisition tool: equip to an enemy, kill the host, steal the body. Without Magnetic, you still lose the equipment itself.

**Why:** The earlier vocabulary swept "equipment dies with host" out and replaced it with "equipment goes to graveyard" — but *whose graveyard* needed pinning down. The host-side rule is the cleanest answer: equipment-piles-destination follows where the host actually was. This makes cross-side equipment a real cost-shape lever (you lose it unless protected by Magnetic) and makes Magnetic a meaningful keyword rather than a no-op.

The graveyard/junkyard split is forced by the side-fluidity of the game. Without the split, *all* equipment in graveyards would compete with *all* dead creatures for graveyard-recursion mechanics — which would be confusing and break Black's creature-recursion identity. Splitting them by card-type-role creates clean spaces for each kind of recursion mechanic.

The Magnetic-on-structure scope-shift is a powerful design pattern: **the same printed keyword has different scope based on the card type printing it.** A keyword on an equipment affects that equipment; on a structure, it affects all equipment in scope. This generalizes — future keywords might print on creatures, equipment, or structures with parallel scope-shifts. The pattern is *the same keyword carries different scope based on its host's natural scope*.

**Alternatives considered:**

- *Single graveyard for everything* (creatures + structures + equipment).* Rejected — collapses the design space for recursion mechanics; makes Black's "raise from graveyard" target equipment unintentionally.
- *Equipment goes to your junkyard regardless of host side* (always returns to the equipper). Rejected — removes the cost-shape of cross-side equipment; makes "Equip to a creature on the other side" strictly better than equipping on your side, since you keep the equipment either way.
- *Magnetic only as a structure keyword* (not a printable equipment keyword). Rejected — both directions are interesting, and the scope-shift between them is a *feature*, not a redundancy.
- *Junkyard reshuffles into the deck like the discard pile does.* Open question — held until reward-tier card design surfaces a need. For now: junkyard is a terminal zone (cards stay there until end of encounter).

**Implications:**

- **Black raise mechanics target the graveyard, not the junkyard.** Zombie-from-equipment doesn't exist; only zombie-from-creature.
- **Magnetic is a real keyword design space.** Printable on equipment (recovers itself), printable on structures (recovers all equipment in scope), printable on actions? (open — probably not, actions don't naturally have a recover-on-leave mechanic).
- **Cross-side equipment is now a viable design space.** Without the host-side rule + Magnetic, cross-side equipment was unbalanced (free or impossible). With them, it's a real cost-shape that creates interesting strategic choices.
- **Equipment text can override host's graveyard destination too.** This is the stealswap-equipment design space — equip to enemy, kill them, steal the body. New design surface.
- **Engine implications:** New zone (junkyard). Equipment-piles-destination logic at the moment equipment leaves play (read host's side). Magnetic-on-structure scope effect (intercepts all equipment-leaves-play events at the location).

**Supersedes:** the earlier informal reading that "equipment dies with host" or "equipment disappears." The actual rule is now: equipment goes to a junkyard, the host-side rule determines whose junkyard, Magnetic overrides.

**Revisit when:** card design surfaces an equipment with mechanics that don't fit the host-side rule cleanly, OR a recursion mechanic targets the junkyard in ways that re-merge it with the graveyard's purpose, OR a third zone is needed (e.g., a "broken" zone for permanently-destroyed structures distinct from junkyard).

---

## 2026-05-03 — Card rarity is a deployment property, not a printed property

**Decision:** A card's *rarity to the player* is determined by **where the card is deployed across the game's three card windows** (starter pool / enemy decks / neutral biome-natives), not by an intrinsic "rarity" property printed on the card.

**The rarity model:**

- **Starter pool.** A card in the starter pool is "rare to acquire via conversion" (since players already have starter cards in their decks; they don't need to acquire them). But it's "common at run start" if the player chose its color.
- **Enemy decks.** A card in many enemy decks is *common* — players see it often, can convert it often.
- **Neutral biome-natives.** A card in a single biome's neutral pool is *rare* — only encounterable by routing to that biome.

A card might appear in *only* one window (e.g., Nightmare in only the Black starter pool — never in enemy decks, never as a neutral). That makes it extremely rare for non-Black starters to ever encounter — they'd have to find Nightmare in a late-game Black-themed boss deck if we choose to deploy it there.

**Why:** The earlier card-design framing implicitly assumed each card had a fixed rarity tier (common / uncommon / rare). With the unified shared-pool model (starter / enemy decks / neutral biome-natives are windows on one pool), rarity becomes a *deployment choice* per card per window. This:
- Lets us print powerful cards (like Nightmare) and *control their accessibility* via deployment choices, not via "rarity tier" labels.
- Makes the run experience feel different across colors based on which cards are deployed where.
- Removes a layer of card-property complexity (no "rarity" field on cards).
- Aligns rarity with the *game-world experience* — a card is rare because you don't see it often in the world, not because the card has a marker that says "rare."

**Implications:**

- **Card data structures don't carry rarity.** Each card has its design (cost, stats, text, keywords). Rarity emerges from how it's deployed.
- **Deployment decisions are themselves a design space.** Where does this card live? Starter only? Mid-tier enemy decks? Boss decks? Specific biomes? Each card needs a deployment choice.
- **Rarity *to a specific player* depends on their run choices.** A Black-starter player has Nightmare from turn 1; a Green-starter player will likely never see Nightmare. Rarity is *experiential*, not absolute.
- **Power and rarity decouple at design time.** A weak common card (Brawler) lives in many enemy decks. A powerful starter-only card (Nightmare) lives nowhere else. The two axes are independent design levers.

**Alternatives considered:**

- *Print rarity on cards (common/uncommon/rare/mythic).* Rejected — duplicates information that's better expressed via deployment. A "mythic" tag tells you nothing about *where* you'd encounter the card; deployment does both.
- *Use deck-builder-style rarity for spawn rates within decks.* Rejected — same problem; just moves the rarity property to a different field. The deployment itself encodes rarity directly.

**Supersedes:** the implicit "common/rare/mythic" framing from earlier card discussions. Card rarity is now a deployment property.

**Revisit when:** card design or deployment surfaces a mechanic that *needs* a printed rarity (e.g., a card that says "if there are no rare cards in your deck..." — which would require a rarity tag). For now, no such mechanic is planned.

---

## 2026-05-03 — One shared card pool, three windows; conversion verbs as the only deck-modification path

**Decision (cluster):**

1. **One shared card pool.** Every card in the game lives in one pool. Cards appear to the player from three windows: (a) the **starter pool** (cards seeded into player decks at run start, biome-flavored per choice); (b) **enemy decks** (designer-curated, color-themed decks the AI runs); (c) **neutral biome-natives** (cards seeded into specific biomes/locations, encountered when the player arrives at that location). All three are drawn from one pool — the same Witch Hexer might be in a player's starter deck, in an enemy deck, or as a neutral in the right biome.

2. **No menu-based card acquisition or removal.** The player never picks cards from a list. All deck modification — adds, cuts, swaps, transformations — happens **via in-game mechanics targeting cards in play**. Per Pillar 10 (no on-resolve targeting), the targeting is *positional and stat-based* — the player commits a creature in a way that triggers the conversion.

3. **Per-color conversion verbs.** Each color has its own mechanic for bringing cards into the player's deck:
   - **Red — recruit/intimidate** (Force-check brings creatures across via fear/recruitment).
   - **Green — reroute/redirect** (Tempo-check intercepts incoming creatures via misdirection).
   - **Blue — research** (Insight produces *per-encounter token copies* that never enter the deck — different conversion direction).
   - **White — convert** (Resolve-driven overheal-into-flip — overheal an opposing creature beyond a Force-gated threshold to convert it).
   - **Black — corrupt/swap (Nightmare-class)** (Spite trades your card to the other side and brings a small creature in via current-Force-cap).

4. **Conversion-verb starter cards seed the verbs.** Each starter pool prints a weak narrow card that demonstrates its color's conversion verb. Black's is **Nightmare** (proposed). Other colors' conversion-verb starters are TBD.

5. **The Siren and other neutral-encounter rewards reframed.** Neutral cards aren't "menus" or "select-from" rewards. The neutral card *itself* is what the player can take into their deck via a conversion verb. Per its own text it may be a one-shot exile when used — efficient and temporary, matching the player's *circumstantial use* rather than the card's intended role.

**Why:** The earlier reward-pool / starter-pool split was a *codebase organization* (which cards seed starters vs. which are reward content). With this decision, the split becomes a **window-into-the-pool** distinction, not a card-population distinction. Three windows let us distribute cards naturally by *where they're encountered first*, not by *which artificial pool they belong to*.

The conversion verbs unify deck modification into the same Pillar-10 grammar as everything else in the game: positional commits, stat-checked targeting, no on-resolve menus. The player chooses *which encounter to engage with how* — and acquisition follows naturally from those choices.

This is also a major narrative win: every card the player ever has, they got because they *did something* in the game world. Compelling vs. opaque "select from list."

**Alternatives considered:**

- *Slay-the-Spire-style reward menus.* Rejected (already rejected in 2026-05-02 unified-encounter decision; this entry sharpens the grammar of the alternative).
- *Per-color conversion verbs use shared mechanics.* Rejected — each color's verb should reflect its identity (Force = recruit; Tempo = reroute; Insight = research; Resolve = convert; Spite = corrupt). Same conversion concept, distinct mechanical instantiations.
- *Conversion verbs are reward-tier only.* Rejected — every starter pool needs *some* access to its conversion verb, otherwise the player is locked out of deck-building based on starter color until they find a reward card. Starter-tier conversion verbs are weak narrow versions; reward-tier variants get bigger and weirder.
- *One universal "take a card" mechanic regardless of color.* Rejected — flattens color identity; misses the design-space-richness of five distinct conversion approaches.

**Implications:**

- **Card design unifies.** Every card is designed against the question "where in the world might the player encounter this?" — starter, enemy deck, neutral biome — and the conversion mechanics carry the player from encountering to owning.
- **Enemy deck design becomes reward-pool design.** What the AI plays *is* what the player can acquire. Enemy decks at different difficulty tiers populate different reward tiers naturally.
- **Map/biome design becomes neutral-card-seeding design.** Each biome's neutral cards reflect that biome's flavor; the player routes to biomes whose neutrals fit their developing deck.
- **Engine implication:** the engine needs to support "this creature on the board is now in player's deck/hand/discard mid-encounter" as a state transition. Major new state shape.
- **Black's Nightmare is the prototype of all conversion verbs.** Once Nightmare's mechanic is implemented, the others (Recruit, Reroute, Research, Convert) can ride the same engine pattern.

**Supersedes:** the implicit "starter pool and reward pool are distinct populations" framing. The two are now *windows on the same pool*, not separate sets. The 2026-05-02 starter-pool framework still applies for *what cards seed starting decks*; this decision adds *how cards flow between windows*.

**Revisit when:** the conversion verbs are implemented and we discover (a) some color's verb doesn't fit the unified mechanic shape (special-case warranted), (b) starter conversion verbs are too weak/strong relative to reward-tier variants, or (c) the three-windows model needs a fourth (e.g., persistent map structures the player builds and can later reabsorb).

---

## 2026-05-03 — Card text vocabulary: side-relative, drop "row," drop friendly/enemy/neutral

**Decision:** Card text uses **relational** language to describe sides and positions, never ownership-as-static-property. The vocabulary changes are:

**Side terms (replace friendly/enemy/neutral):**
- `your side` — the side controlling the speaker.
- `the other side` — the opposite side.
- `here` (default scope, often unprinted).
- `(here)` — explicit clarification when needed.

The words *enemy*, *friendly*, *neutral* are **retired** from card text. They conflate ownership with the actual relational state, which is mutable (creatures swap sides via Nightmare-class effects).

**Position terms (drop "row"):**
- `in front` (replaces "in the front row").
- `in back` (replaces "in the back row").
- `the creature in front of this` — directly forward in the same column.
- `left / right / middle` — column position, used only when grid geometry requires.

**Equipment defaults:**
- Equipment text starts with just `Equip.` — no side qualifier.
- The default rule: equipment attaches to a creature on your side.
- Cross-side equipment (rare exception) prints explicitly: `Equip to a creature on the other side.`

**Neutrals are biome-native cards, not a third side.** They sit in slots and contribute stats to whichever side they end up on. Their card text and color reflect the **biome** they live in. The shared card pool includes biome-themed cards available exclusively as neutrals.

**Why:** Card text needs to survive side-swaps (Nightmare and other Spite mechanics) cleanly. Saying "an enemy creature" is ambiguous after a swap — was the creature originally enemy-owned, or is it currently on the other side? Side-relative language describes the *relationship at resolve time*, which is what cost-checks and effects already use.

Position terms drop "row" because the word adds no information — *front* and *back* are already unambiguous. Card text becomes shorter and more readable.

The equipment-without-side-qualifier rule follows the design's existing default-local pattern (per Pillar 8): print the default by saying nothing; print the exception by being explicit. Equipment defaults to your side; cross-side equipment is the printed exception.

The neutral-as-biome-native framing replaces the earlier "third side" reading. Neutrals contribute stats normally to whichever side they're on. Their distinction is only that they're *seeded into the location*, not into either player's deck. They can be *converted into the player's deck* via conversion verbs, at which point they become normal cards on the player's side.

**Alternatives considered:**

- *Keep "enemy/friendly" and define them carefully (e.g., "enemy = currently on the other side at resolve").* Rejected — the words read as *static-ownership* in natural English; rules-defining away that intuition is more confusing than just using relational terms directly.
- *Use "your" and "their" as side modifiers.* Rejected — "their" reads as ownership ("their creature") which has the same problem as "enemy." "Your side" / "the other side" is unambiguous about *current relationship*.
- *Use "ally" and "foe" as side modifiers.* Rejected — same ownership-baggage problem; also less neutral-feeling than "your side / the other side."
- *Keep "row" in card text for clarity.* Rejected — "front" and "back" suffice; the extra word is rules-bloat.
- *Equipment must always specify side, including the default.* Rejected — verbose, repeats the default rule on every equipment card. Print the exception, not the default.

**Implications:**

- **Sweep card text across all docs.** All existing references to "enemy/friendly/neutral creature" in DESIGN.md and CARD_DESIGN.md need updating. Sweep planned alongside this decision.
- **Future card design uses the new grammar from day one.**
- **Reads naturally with side-swap mechanics** — Nightmare's swap doesn't break the targeting language of any other card.
- **Neutral handling clarifies.** Neutrals aren't a third-state edge case; they're cards that sit in slots and contribute stats normally, just seeded by biome rather than by deck.

**Supersedes:** the implicit ownership-language convention from earlier doc passes (which used "enemy creature," "friendly creature," "all enemies here," etc.). These now read as *legacy phrasings* and should be replaced when those sections are next edited.

**Revisit when:** card design surfaces a case where the side-relative grammar fails to express something cleanly (e.g., a card whose effect cares about *original ownership* before a swap — currently no such mechanic exists; if one is designed, special grammar may be needed).

---

## 2026-05-02 — Escalating cost as a new mechanic class (encounter-scoped, per-card-instance)

**Decision:** A card may print **escalating cost** — a base cost (typically 0) that increases with each cast of *that specific card instance* during an encounter. The escalation amount and stat are specified in card text. Example: Forage prints `Cost: 0 (escalating). Each cast: +1 Tempo here required.` First cast free; second cast requires ≥1T; third ≥2T; etc.

**Rules of the mechanic:**

- **Per-card-instance, not per-card-name.** Two copies of Forage in a deck track separately. Forage A on its 3rd cast is at ≥2T; Forage B on its 1st is still free. They don't share counters. *(Flavor: each forager exhausts their own patch of wilderness.)*
- **Encounter-scoped.** The counter resets at encounter end. Each new encounter, the card is back to its base cost.
- **Persists through discard cycle within an encounter.** A Forage cast twice, sent to discard, reshuffled, redrawn, retains its 2-cast counter. The counter rides with the card instance through deck/hand/discard zones.
- **Cost-check still uses standard rules.** The escalated cost is a normal stat-presence requirement at cast time and at resolve time, just with an inflated threshold. Cards still fizzle if presence doesn't meet the (inflated) threshold at resolve.
- **Card text spells out the escalation explicitly.** "Each cast: +1 Tempo here" or "+1 Force per previous cast" — the grammar should be readable per card. No global escalation rule; each card prints its own.

**Why:** Forage in its earlier draft (`≥1T flat cost`) had a structural problem: it would cycle through the discard pile and become an infinite ammo generator over a long encounter. The flat-cost version had no built-in cap; balance would have to come from external constraints (deck composition, slot pressure, action-slot occupancy) — fragile and indirect.

The escalating-cost framing solves this **structurally**: the card's *own* cost climbs as it gets reused, eventually outpacing the player's available stat presence and capping per-encounter usage organically. No external rule needed; the card balances itself.

It also opens a **new printable cost axis** that didn't exist in the design before. Earlier cost grammar was *state-checking* (does the location have ≥X stat right now?). Escalating cost is *history-tracking* (does the location have ≥X stat right now, given how many times this card has been cast already?). The encounter now has memory at the per-card level — a real generalization of cost-as-resource.

**Generalizes beyond Forage.** This mechanic class covers a real design space:

- **Black "growing curse"** — each upkeep tick, the curse's debuff grows by 1 *and* its maintenance cost grows by 1 Spite. Becomes harder for the caster to keep up.
- **Red "berserker rage"** — each combat the creature attacks, +1 Force *and* +1 Force cost to play other Red creatures here (the berserker's bloodlust depletes ally Force-printers).
- **Blue "spiral of insight"** — each cast in this slot, the *next* cast costs 1 less Insight, but the slot's resolved-action threshold grows. Acceleration with diminishing returns.
- **White "deepening prayer"** — each turn channeled, the payoff doubles *and* +1 Resolve required. The miracle becomes more powerful but harder to sustain.

The mechanic class is one printed grammar with many flavor expressions. Each color expresses escalation differently.

**Alternatives considered:**

- *Flat cost with hard per-encounter usage cap (e.g., "may be cast at most 3 times per encounter").* Rejected — feels arbitrary, doesn't compose with the discard cycle, and reads as a rules patch rather than a mechanic.
- *Per-card-name (shared) escalation across all copies in deck.* Rejected — punishes deckbuilding (more copies = strictly worse) and fights the natural intuition that two Forage cards in a deck should each be useful.
- *Run-scoped escalation (counter persists across encounters).* Rejected — too punishing, encounter-as-self-contained framing is cleaner.
- *Escalate by Force instead of by the card's themed stat.* Rejected — the escalation should match the card's flavor (Forage is about Tempo / reach / patience, so Tempo escalation is right). Each card picks the stat that fits.

**Engine implications:**

- New per-card-instance state field: `castsThisEncounter` (or similar). Initialized to 0; incremented on each successful resolve; reset at encounter end.
- Cost-check logic must read this counter and compute the inflated threshold dynamically.
- The counter must persist through deck → hand → discard → deck cycles within an encounter (it's part of the card instance, not the zone).
- UI implication: the displayed cost should reflect the *current* effective cost (e.g., "Forage — ≥2T" once the counter is at 2), not the printed base cost. Cost previews need to compute on-the-fly.

**Supersedes:** the implicit assumption that all action costs are state-checks-only. Escalating cost is the first history-tracking cost in the design.

**Revisit when:** (a) a card design surfaces a need for *non-encounter-scoped* escalation (cross-encounter persistence, like "this card permanently costs 1 more Tempo each run"), at which point the encounter-scoped rule becomes a default rather than a universal; (b) playtesting reveals escalating Forage feels too generous (first cast free is too easy) or too punishing (3rd cast is unreachable); (c) card design hits a case where per-card-name escalation would actually be the right rule (e.g., a tribal "the second X cast this encounter" effect).

**Revisit when:** card design surfaces a non-Forage application that wants different escalation semantics, OR playtesting reveals escalating costs feel uneven across cards.

---

## 2026-05-02 — Starter pool framework: Force-shaped universal starters with per-color flavor exposure

**Decision (cluster):**

1. **Starters live in their own card pool, separate from the reward pool.** Starter cards are never seen as rewards; reward cards are never seen in starting decks. The two pools are designed against different constraints.

2. **Universal starter shape: Force/Tempo only.** Every starter prints **Force** (mostly) and a small amount of **Tempo** in some cards. **No starter prints Insight, Resolve, or Spite.** The themed stats are scarce, themed, high-impact (per the existing stat doctrine) — they belong to the reward pool, not the starter pool. This means **every starter is combat-shaped**: the player learns the game by attacking and blocking, regardless of which color they chose.

3. **Stat-gated ramp creatures are universal.** Every color's starter includes mid-cost creatures gated by `≥1 Force here` or `≥2 Force here`, paid by free-cost recruits already in play. This teaches cost-as-presence (not consumption), the tempo of board development, and the foundational idea that earlier plays *enable* later plays.

4. **Per-color starter flavor exposes one mechanic per card, no themed-stat printing.** The way a starter expresses its color is *not* by printing themed stats but by printing a **single small thematic effect** that previews a mechanic the player will see expanded in rewards. Confirmed flavors:

   - **Red:** "+X Force when alone here" — conditional stat printing seed (lone-champion DNA).
   - **Green:** small movement keyword + "on flip-up: deal 1 damage to an enemy in the back row" — back-row interaction tease.
   - **White:** healing/restoration with positional targeting (next-to-or-in-front-of) — exposes positional-targeting vocabulary.
   - **Black:** "on flip-up: afflict -1 Force on an enemy in the front row here" — debuff-on-position seed.
   - **Blue:** "on flip-up: draw 1" creature, or starter Blue action with "draw 1." Teaches deck-cycling as Blue's economy identity. Mostly underwhelming on creatures (drawn cards usually discard at cleanup) but catches actions when it does — and Blue is the action color.

5. **Starter flavor effects must be small and easy to understand.** This is the tutorial difficulty layer. One mechanic per card, never stacked. By the time the player has played 2-3 encounters with their starter, they've been exposed to 4-5 distinct mechanic-classes through small, low-stakes examples.

6. **Red is the tutorial color.** Red is combat undiluted — the cleanest expression of the core combat loop. Other colors are combat + a small flavor seed. Players who pick Red learn the game's core loop with the fewest concepts on the table; players who pick other colors are previewing the direction they'll grow into.

7. **Biome-flavored choice at run start.** The player picks among 3 randomly-presented starting nodes (sketch — exact UX TBD), each tagged with a biome flavor that signals a color leaning. The chosen biome grants the corresponding starter pool. Future revisions may show all 5 colors as choices, or random-3-of-5, or some other framing — held open for now.

8. **Starter-to-reward ratio is a balance lever.** As the player adds reward cards, the ratio shifts. With ~10 starter cards and 1 reward, the reward shows up 1/10th of the time; with 5 rewards, it's 5/15ths. This naturally tunes how much each individual reward card "matters" as the run progresses. The starter pool size is set with this ratio in mind.

**Why:** A previous draft of the starter framing had per-color stat splashes (Resolve in White, Insight in Blue, Spite in Black). This was wrong on two axes:

- **A pure-Resolve starter can't pay any costs and can't deal damage.** Themed stats are scarce and high-impact; they don't function as starting economy. A starter must print universal currency (Force, Tempo) to be playable at all.
- **It would commodify reward-tier mechanics.** Spell economies, healing, persistence, recursion — these are the *flavor of acquiring color identity through play*. If they exist in starters, the reward pool loses the load-bearing role of "this is when your deck becomes itself."

The fix anchors on the existing doctrine: **Force/Tempo are silver and gold**, universal currency; the other three stats are themed-scarce. Every deck (starter or otherwise) needs Force/Tempo to function. Every color does combat at the start of a run because combat is the universal opening pacing. Color identity *as a mechanical capability* is acquired during the run, not at run-start.

The per-color flavor effects then serve as a **tutorial layer**: they're small enough to be fair starter cards, but each one previews a distinct piece of design vocabulary the player will see expanded in rewards. By the end of session 2 (starter design), the prototype has a small mechanical-vocabulary tutorial built into the opening of every run.

**Alternatives considered:**

- *Starters print themed stats matching their color.* Rejected — pure-themed-stat decks are unplayable; commodifies reward mechanics; misframes color identity as a starting capability instead of an acquired one.
- *All starters are literally identical (no per-color variation at all).* Rejected — biome choice should mean *something*. Even minor stat/flavor differences signal direction without committing identity.
- *Starters include weak versions of reward mechanics.* Rejected — deck-thinning, peek effects, draw-2-actions, mini-counterspells, etc. are still reward-tier in feel; starters need to be actively unsophisticated to leave room for rewards to feel impactful.
- *Damage actions in the generic pool ("deal 1 damage here" as a generic 1-cost action).* Rejected — direct damage actions, even at 1 damage, are structurally strong because they bypass combat geometry. Damage-as-spell is a reward-tier mechanic that justifies Blue's spell-deck identity. Putting it in generics commodifies it.

**Implications for design:**

- **Starter pool is its own design surface** — small (~5-7 cards × 5 colors = 25-35 cards total). Designed against the constraint of "weak, simple, on-flavor, no themed-stat printing."
- **Reward pool unlocks the full design vocabulary** — Spark, Counterspell, Provocation, Salvage, vehicles, Forge, healing, Pray-N, curses, recursion, Heralding Spark, etc. Every color flexes its full identity here.
- **Starter pool is mostly a tuning exercise**; reward pool is mostly a creative exercise.
- **Card design sessions follow this split:** session 2 designs all 5 starter pools (tuning); session 3+ designs reward pools per color (creative).

**Supersedes:** the brief (within-conversation) drafts of starter framings that included themed-stat splashes or generic damage actions. None had landed in the docs; this entry captures the locked-in framework.

**Revisit when:** session 2 produces the actual starter cards and we discover (a) the no-themed-stat rule produces too-bland starters and one or two need a careful exception, (b) the per-color flavor effects don't read as distinct enough to teach the mechanics, or (c) the starter-to-reward ratio in early runs feels off.

---

## 2026-05-02 — Exclusionary keyword family: Inert / Brute / Intellect / Pacifist (one-stat-only growth keywords)

**Decision:** Establish a small family of mutually-exclusive printed keywords that lock a card to gaining only one specific stat. **Inert** (existing) is reframed as one member of the family; three new members are added.

**The family:**

| Keyword | Can only gain | Flavor | Example cards |
|---|---|---|---|
| **Inert** | Spite | Walls, parked vehicles, sandbags, fortifications. Doesn't fight, doesn't think, doesn't believe. Sits and soaks; can grow defensive retaliation but nothing else. | Sandbag (existing), unmanned vehicle, Bulwark structure |
| **Brute** | Force | Mindless aggressors. Fights, but can't be made smarter, faster, or more pious. | Goblin Pyromaniac, ogre, troll, raised zombies |
| **Intellect** | Insight | Pure scholars / arcane constructs. Won't fight, isn't pious, isn't athletic. | Mage, scrying construct, lorekeeper |
| **Pacifist** | Resolve | Civilian healers, monks, refugees. Patient and faithful but won't take up arms. | Acolyte, Initiate, Healer |

**No Tempo version.** Tempo doesn't isolate a flavor the other four do — there's no creature concept that *only* moves fast and has no other identity. Pure-Tempo cards would be flavor-thin and the design space doesn't ask for one.

**Inert grows Spite (not "no stats").** Previously, Inert was defined as "this card cannot gain Force, Tempo, Insight, OR Resolve from any source" — effectively "no growth on the four active stats" with Spite implicitly locked too. The exclusionary-family framing makes Inert symmetric: each keyword grows *exactly one stat*, and Inert's stat is Spite. This unblocks the design space of *defensive retaliation-flavored obstructions* (thorned walls, spiked sandbags, retaliating fortifications). Durability is unaffected by the keyword — Inert structures can still be repaired or healed; only stat growth is locked.

**Inert-suspending mechanics still apply.** Pilot/Driver/Rider relationships suspend Inert on vehicles for the duration of the bond. The driver's stats flow through; Inert returns when the bond drops. This was already documented; the family reframing doesn't change it.

**Zombie as a special case of Brute.** Black's raise effect produces a creature that is **a Brute with all printed rules text removed**. So a Mage raised as a zombie loses its Intellect keyword and its Insight-printing text, gains Brute, and becomes a Force-only creature. This captures "the dead don't think anymore" mechanically and resolves the question of how raise interacts with utility creatures. The raise effect is itself the keyword swap (Intellect/Pacifist/etc. → Brute) plus rules text strip.

**Use as a balance lever.** Cheap utility cards (Mages, Acolytes, scribes, healers) print these keywords to lock their stat ceiling. Splash colors can't weaponize them — Mage with Intellect can't be pumped by Red Tactics; Acolyte with Pacifist can't gain Force from Salvage; Goblin Pyromaniac with Brute can't gain Insight from a Blue cost-reducer. **This makes utility cards safe to print cheaply** because their off-color combat ceiling is locked by keyword, not by hoping the player won't splash buffs.

**Why:** Two design tensions converge here:

- *(Existing tension)* Inert was clean as a primitive (no stats grow at all) but blocked thematically attractive cards like thorned walls. The hard rule was justified to avoid special cases.
- *(New tension)* Utility creatures across colors need a way to be cheap without becoming cross-color combat threats via splash buffs. A free Pacifist Acolyte that gains 4 Force from a Red equipment is a balance break.

The family reframing solves both: Inert's Spite-only growth becomes the *default member* of a family pattern, not a special case. The other three keywords give cheap utility cards a printed defense against splash-weaponization.

**Alternatives considered:**

- *Keep Inert as "no stats grow at all," design utility creatures one-off.* Rejected — every utility creature would need a custom anti-splash rules block, fragile and verbose.
- *Add a Tempo-only keyword (Scout / Skirmisher / etc.).* Rejected — Tempo doesn't isolate a flavor; pure-Tempo cards would be flavor-thin; the design didn't ask for one. Skirmishers and Scouts are Force+Tempo creatures, not Tempo-only.
- *Make these keywords printable on all card types (creatures + structures + actions).* Rejected — actions don't have growable stats in any meaningful sense (they resolve and exit). The keywords are creature/structure-only; equipment may inherit the host's keyword but doesn't print its own.
- *Allow stacking ("Brute and Intellect" on the same card).* Rejected — they're mutually exclusive by definition. A card prints at most one family keyword. Multi-color creatures (Force + Insight) print neither — they can grow either stat normally.

**Implications:**

- The **starter pool benefits immediately**: Mage-class starters (if/when designed) can print Intellect to prevent splash-Force pumping; Acolyte-class starters can print Pacifist similarly. This sharpens starter balance without requiring extensive playtesting.
- **Reward cards using these keywords are a new design space.** A "premium walled fortress" structure prints Inert with high Spite-printing capacity. A Pacifist healer that gains Resolve from supply lines but not Force from Tactics. A Brute champion that scales on raw Force but is locked out of Tempo-buffs.
- **Zombification gets its rules text grounded.** Raise is now mechanically: (a) reanimate creature from graveyard, (b) strip printed rules text, (c) apply Brute keyword. Three explicit operations, not a vague "the creature returns weaker."

**Supersedes:** The original Inert rule definition (which had Inert lock all four active stats including Spite). The new rule has Inert grow Spite only and joins three new family members.

**Revisit when:** card design surfaces a creature concept that wants to print a family keyword but the family doesn't have the right one (e.g., a "pure athlete" creature that only grows Tempo — would force reconsidering the no-Tempo-keyword decision).

---

## 2026-05-02 — Action graveyard, exile, and swap-displacement as deck-thinning levers

**Decision (cluster):**

1. **Three levers exist for pulling actions out of the discard cycle.** Most actions resolve to the discard pile (the default — they cycle back via reshuffle when the deck empties). When a card needs *not* to cycle back, the design has three levers:

   - **Graveyard** — pulls an action out of cycling for the rest of the encounter, but it can still be raised or recurred by another effect that targets the graveyard.
   - **Exile** — pulls an action out *permanently* for the encounter; no recursion can reach it.
   - **Swap-displacement** — used when one card recurs another from the graveyard, the recurring card displaces what it brings back (the recurring card enters the graveyard in the recurred action's place). Bounds recursion loops.

2. **Token-creating actions resolve to the graveyard, not the discard pile.** A token-generating action would otherwise cycle back via discard reshuffle and spam tokens infinitely (each cycle creates more permanents on the board). Sending it to the graveyard short-circuits the cycle for the rest of the encounter while preserving the option for graveyard-based recursion (e.g., a Black or Green card that recurs from graveyard could pull it back). This is the **first specific application** of the lever framework.

3. **Action recursion is a swap, not a copy.** A card that recurs an action from the graveyard back to your hand: the recurring action **enters the graveyard in the recurred action's place**. Net effect: one action moved out of graveyard, one moved in. This bounds recursion — you can't recur-recur-recur the same recurring card to spam graveyard pulls. This is the **second specific application** of the lever framework.

4. **Counterspell already uses the graveyard.** This isn't new — Counterspell sends the targeted action to the graveyard (not the discard pile), which is why action-graveyard is already a real concept in the design. The lever framework names what was previously implicit and adds two new use cases.

5. **The deeper rule: "watch out for 1-card decks."** Any action that *thins the deck while staying playable* risks becoming a one-card-deck loop. The design discipline is: **before printing any action that could be a deck-thinner, ask which lever applies.** Most actions stay in the discard cycle (the default — most actions are *meant* to cycle, that's how Blue's spell economy and White's repeated-Prayer-attrition work). A handful land in the graveyard. Premium one-shots land in exile. Recursion mechanics use swap-displacement to bound their own loops.

**Why:** As the design grew, two separate concerns about action-recursion converged:

- *Token-creating actions can spawn permanents indefinitely* if they cycle back through the discard pile every few turns. A starting deck heavy on token-creators becomes a "play 1 action per turn, get 1-3 tokens per turn" engine that quickly fills the board with free permanent stat-presence.
- *Recursion-from-graveyard mechanics need bounds* or they become "play the recurring card, recur the recurring card, recur it again" infinite-engine cards. Bounding the loop via swap-displacement turns recursion into a *one-time switcheroo* (one action moved in, one moved out) rather than a stacking accumulator.

Both concerns share a pattern: **certain action shapes need extra rules to prevent unbounded card-economy loops.** The lever framework names the three tools (graveyard, exile, swap-displacement) and the design discipline (apply the right lever per card). It doesn't *resolve* every future case but it gives the design a vocabulary to reason about each one.

**Examples of how the levers apply:**

- **Spark** (existing Blue damage action): discard cycle (default). Spell decks need this card to recycle — that's the whole point of Blue's spell economy.
- **Counterspell** (existing Blue persistent action): graveyard on resolve. The countered action *and* the Counterspell itself go to the graveyard. (Counterspell's existing rule.)
- **Hypothetical token-creator action** ("create a Sandbag token at this location"): graveyard on resolve. Bounds the token spam.
- **Hypothetical Green recursion action** ("return an action from your graveyard to your hand"): the recurring card displaces what it brings back — the action returns to hand, and the Green recursion card enters the graveyard.
- **Hypothetical premium one-shot** ("destroy all enemy permanents at this location"): exile on resolve. Played once per encounter, no recursion can bring it back.

**Alternatives considered:**

- *Hard rule: all token-creating actions exile on resolve.* Rejected — exile is too strong a constraint. Some token-creators are *meant* to cycle (a Blue Mirror Image action might cycle every 4 turns and be balanced for that cadence). The right lever depends on the card's intended cadence.
- *Hard rule: all recursion is swap-displacement, full stop, regardless of color.* Considered seriously, almost adopted. The user's framing pushed back: the deeper rule is *vocabulary, not universal application*. Some recursion mechanics may be designed to genuinely bypass swap-displacement (e.g., a premium White Pray-action that resurrects a friendly creature without displacing — the cost is in stat-presence, not in graveyard accounting). Keeping swap-displacement as a *lever* lets the design choose per card.
- *Add a fourth lever: per-encounter cap on action-castings.* Rejected as too heavyweight — adds bookkeeping per card and doesn't compose well with the lever framework.

**Supersedes:** the implicit "all actions resolve to discard" rule that was the v0/v1/v2 default. The default still holds for most actions, but the design now explicitly recognizes three other destinations and provides a discipline for choosing.

**Revisit when:** card design surfaces an action that needs a fifth lever (something none of the three existing tools cleanly capture), or when playtesting reveals a token-creator or recursion card that breaks the framework's assumptions.

---

## 2026-05-02 — Damage fall-through to summoner is a universal rule (combat + spells unified)

**Decision:** Damage looks for a creature target at the location it's resolving at; if no valid target exists, the damage falls through to the opposing summoner. This is a *universal damage-resolution rule* that applies the same way regardless of source — combat damage from a creature, spell damage from an action, deathwish damage, anything that prints "deal X damage to a creature" follows the same rule.

**Specifics:**

- **Single-target damage** with no valid creature target → X damage to the opposing summoner.
- **Multi-target damage** ("deal X to each enemy creature here") with no valid creature targets → X damage to the opposing summoner *once* (one fall-through instance per location, not per phantom creature).
- **Scope-extended damage** ("at each of your locations") falls through *per-location independently*. Empty location → X damage to opposing summoner from that location. Loaded location → random pick at that location. A scope-effect on an empty board hits the summoner once *per empty location*.
- **Combat damage** continues to follow this rule unchanged (attacker with no creature in front swings through to summoner). The unification is in framing, not new combat behavior.
- **Non-damage effects do NOT fall through.** Buffs, debuffs, stat-reductions, destroys, returns-to-hand, etc. with no valid target simply *fizzle*. The summoner has no stats to buff/debuff and isn't a creature to destroy. Fall-through is **damage-specific**.

**Why:** Two parallel systems were quietly diverging in earlier doc passes:

1. *Combat* damage from creatures had the swing-through-to-summoner rule from v0/v1.
2. *Spell* damage with no target was set to *fizzle* — wasted card.

This created the "I have Insight and a Spark but no enemies on the board" stalemate scenario. The player can do nothing useful with their hand, the AI can't lose, the encounter drags. Worse: it asymmetrically penalized spell decks compared to creature decks, since creatures could always pressure the summoner via combat but spells couldn't.

The fix unifies both under one rule. Cards never need to print "to the summoner" as a special clause — it's implicit in the damage-resolution model. **Creatures *block* spell damage at their location** the same way they block combat damage. The summoner is the *fallback target* for any damage that can't find a creature.

This also enables **spell decks as real win conditions**. A player who runs out of creatures but still generates Insight (via remaining Mages, structures, etc.) can spell-down the opposing summoner directly. The "I'm out of creatures" moment isn't a loss — it's a transition to a different game shape.

**Alternatives considered:**

- *Keep spells fizzling on no-target.* Rejected — creates stalemate scenarios, asymmetrically penalizes spell decks, contradicts the combat-fall-through pattern that was already in place.
- *Print "to the summoner" as flavor text on each damage spell.* Rejected — verbose, repeated on every damage card, unnecessary if the rule is universal.
- *Multi-target AOE deals damage per-phantom-creature on empty board (e.g., 4-creature-AOE = 4 hits to summoner).* Rejected — too strong, creates degenerate one-shot kill scenarios. One fall-through per location is the cap.
- *Friendly-fire AOE doesn't fall through* (cleave-on-empty fizzles). Rejected as inconsistent with the rule's spirit. Working interpretation: friendly-fire damage falls through to **both** summoners. Worth playtesting before locking. (See DESIGN.md open question.)

**Supersedes:** the implicit "spells with no target fizzle" assumption from earlier doc passes and v1 prototype behavior. The new universal rule covers all damage from all sources.

**Revisit when:** playtesting reveals (a) the multi-location summoner-pressure shape is too strong (mitigation: cap fall-through damage per turn, or restrict scope-extended damage cards from fall-through per location); (b) the friendly-fire fall-through-to-both question needs a definitive answer (current working assumption: yes, both summoners take it); (c) heal-fall-through (the symmetric question for friendly-creature heals) needs to be clarified — current working assumption: yes, heals fall through to friendly summoner by parity with damage.

**Now-active rule** — applies to v2 prototype starting today.

---

## 2026-05-02 — AI retreat as encounter-end condition for non-boss hostile encounters (future rule, v3+)

**Decision:** Most non-boss hostile encounters end by **AI retreat**, not by reducing a summoner to 0 Durability. When the AI's forces at a contested location are effectively spent and can no longer threaten anything for several consecutive turns, the encounter ends — the player is the encounter-victor, the location is neutralized, the player advances. **The boss-encounter at the exit is the exception** — it ends only by the boss-summoner's Durability reaching 0; no retreat option there.

**Working retreat heuristic:** the AI retreats when:

- **No creatures in play** at any of the encounter's locations.
- **No payable cards in hand** (every hand card fails its cost-check at every location given current presence).
- **No realistic recovery path** (empty deck or near-empty with no compatible cost-enablers).
- Sustained over **2-3 consecutive zero-play turns** to avoid premature retreat from a brief lull.

Exact thresholds tune via playtesting.

**Why:** The "AI ran out of stuff to do but can still make empty turns forever" scenario is real and observable as soon as the AI's deck composition drifts (spell-heavy decks without Insight enablers stall hard once their creatures die). Without a retreat condition, an AI in this state would drag the encounter out indefinitely with no path to summoner damage — there is no AI summoner at non-boss nodes, and even with the new damage fall-through rule, the *AI doesn't have a summoner-as-creature* at non-boss encounters.

The retreat framing also reflects how the simulation is supposed to work conceptually: the AI is a *faction spreading across the map*, not a single-summoner opponent. When the faction's forces at a contested node are spent, the faction *withdraws* from that node rather than dying. The encounter ends; the player advances. The boss alone is structurally different — a summoner with Durability — and gets the original kill-to-win condition.

This sharpens the asymmetry between encounter types:

- **Non-boss hostile encounters:** end by AI retreat. Win by *clearing the threat*, not killing a summoner.
- **Boss encounter:** ends by summoner Durability to 0. Win by *finishing the kill*. No retreat.
- **Pure neutral encounters** (no AI presence): end when the player chooses to end the encounter (or all engageable neutrals have resolved), per the unified-encounter framework.

**Alternatives considered:**

- *AI has a faction-Durability tally per encounter / per run that the player must reduce to 0.* Rejected as redundant with the retreat condition — if the AI runs out of cards, the tally would just be a re-skin of "out of plays." Adds bookkeeping, no design value.
- *No retreat condition; rely on AI deck design to never reach unrecoverable stall states.* Rejected — fragile, requires perfect deck balancing, and breaks the "AI is a faction" framing. Even balanced AI decks can have bad-luck hands or extended unfavorable game states.
- *Player can also retreat.* Rejected (working assumption). The player initiated the encounter and is committed to it. They win, lose, or accept partial-engagement (engaging some neutrals while ignoring others); they don't withdraw.

**Implications:**

- Spell decks that pressure the AI's hand and creature board accelerate retreat by depleting the AI's playable cards. Blue's Counterspell / Stifle become not just denial tools but encounter-ending tools.
- Per the damage fall-through rule, summoner-damage spells need a target to fall through to. **At non-boss encounters, the AI has no summoner-as-creature**; working interpretation is that spell damage targeting the "AI summoner" instead either contributes to forcing retreat or hits a per-encounter faction Durability pool. Pass 2 detail to pin down. **At the boss encounter, spell fall-through hits the boss-summoner's Durability normally.**
- AI structures left behind on retreat: working assumption *vanish* (the faction took them with them). Open question — could they remain as captured neutral terrain? Probably cleaner if they vanish.

**Supersedes:** nothing yet (no prior decision). Captures the encounter-end-condition question as the design works out the v3+ map structure.

**Originally scheduled for v4; promoted to v3 on 2026-05-02 during build.** The first v3 playtest surfaced the stall scenario the design predicted: a hostile encounter where the AI's deck cycled into actions it couldn't pay for (no Insight in play) and its only remaining presence was a structure (immune to combat damage by design). Without a retreat condition the encounter was unwinnable; the player had no structure-removal cards (nor should v3 have to add them — that's a deck-design pass, not a system mechanic).

**v3 implementation (refined twice during build):**

- *First attempt:* zero-play counter (retreat after N consecutive turns of AI placing nothing). Rejected — too generous and missed the framing. The condition isn't about *plays*, it's about *living presence*.
- *Second attempt:* immediate retreat the moment AI creature count reaches zero. Rejected — too narrow. Could fire mid-turn before the AI got its main-phase reinforcement chance.
- *Final:* **end-of-turn evaluation.** Retreat fires at end of cleanup if zero AI creatures are present at any encounter location. By then, the AI's main-phase placement window has closed and combat has resolved; "no living presence at end of turn" implicitly means "AI also failed to bring in reinforcements this turn" because pending is empty. Structures are not living presence (they're infrastructure, by design definition); a faction with only buildings has been beaten. Boss exempt.

This framing also clarifies the *structures-are-not-presence* rule: structures occupy a separate slot type, are by-design excluded from combat, and are not living beings. They don't count as "the AI is still in the fight."

**Revisit when:** playtesting reveals (a) the retreat threshold is too generous (player wins too easily by stalling), (b) too strict (encounters drag), or (c) the spell-damage-to-AI-faction question needs a concrete implementation choice (see DESIGN.md open question).

---

## 2026-05-02 — Unified hostile/neutral encounter framework; neutrals are on-board puzzles, not reward menus

**Decision (cluster):**

1. **One encounter system.** Every player overworld move triggers an encounter, processed through the same multi-location simultaneous-commit Tempo-ordered engine the rest of the game uses. There is no separate "neutral movement" path or reward menu. Hostile combat, neutral puzzle engagement, and empty locations are all variations of the same encounter shape — possibly mixed across locations within a single encounter.

2. **Neutral encounters are on-board puzzles.** Authored as **neutral cards** placed at the location by map generation (similar to how strategic location text is authored). Neutral cards are face-down to the player at encounter start and flip up at end of round 1 upkeep along with everything else. They are a *third party* on the board — owned by neither player, contributing to neither side's stat totals, but legal targets for both sides' effects.

3. **Engagement is the cost of reward.** Neutral cards do not pay out for free. The puzzle is structured so that *only by committing player resources to the neutral location* does the player extract the reward. With limited hand cards and limited slots, in encounters with multiple neutrals + hostile combat, the player must choose which puzzles to engage with and which to skip. Stretched-thin-by-choice is the puzzle.

4. **AI consumption rule (overworld):** when the AI plays into a node during its overworld mini-turn, the act of playing there *consumes* the neutral encounter at that node. The neutral cards are removed; the location becomes hostile. The player will never see the lost reward. This is the load-bearing tempo pressure of the run — every neutral the AI eats is a permanent reward loss, making routing a continuous tactical-stakes decision.

5. **AI contesting rule (in-encounter):** during an encounter that's already underway, the AI may still play cards into a neutral location, mirroring the overworld adjacency rule — *if the AI has presence at any other location in the same encounter, then any neutral location in that encounter is a legal play target for the AI's commits.* Neutral cards are not removed by AI in-encounter commits (different rule from overworld consumption). The AI uses this to *race* the reward (sharing in a random pick) or *deny* it (slot pressure / dilution / interference).

6. **Neutral cards can be destroyed by either side.** Typically printed with high Durability so the puzzle is engaged with, not bypassed — but a player with the right answer can blow up a neutral card before it triggers, or vice versa.

7. **Per-card "another creature here" defaults to non-neutral creatures only.** A siren never accidentally consumes a sister-siren at the same location. Neutral cards may explicitly include other neutrals if the designer intends, but the default is non-neutral-only.

8. **Per-biome / per-color / per-reward-type puzzle archetype matrix.** Initial canonical archetypes captured in DESIGN.md: Siren (Blue, deck-thin), Wishing Well (White, summoner heal), Forge (Red, stat-bump), Bramble Patch (Green, card-evolve), Cursed Altar (Black, sacrifice-for-deck-add). Long-tail authoring fills in the matrix over time. Cross-color expressions (e.g., Cathedral Forge = White+Red) are valid.

**Why:** The previous design implicitly assumed Slay-the-Spire-style reward menus for neutral encounters — a moment where the game pauses, presents a list, the player picks. **This violated Pillar 10 (no on-resolve targeting)**, the spine of the entire design. Pillar 10 said "no menus, the strategic skill is setting up board state for the right resolution." Reward menus contradicted that entirely.

The unified-encounter framework collapses the contradiction. Pillar 10 now applies *uniformly* across the whole game — there is no remaining mode of play where the player picks from a list. Everything is position-and-commit.

Beyond fixing the inconsistency, the framework adds:

- **Code reuse.** The existing multi-location combat engine *is* the neutral-encounter engine. No separate flow to build.
- **Cross-location synergy as a real design surface.** Disperse-to-siren, dump-bad-card-at-siren, ferry-to-healing-neutral, pull-to-neutral, token-feed-the-neutral. All emergent tactics that fall out of the rules.
- **Tempo tension becomes immediate and visible.** Routing decisions have continuous, quantifiable stakes — every delayed neutral is a potential lost reward. Pillar 6 becomes concrete instead of abstract.
- **Map gen becomes more interesting.** Two structurally similar maps with different puzzle distributions play very differently. Replayability through puzzle pool, not just deck composition.
- **Long-tail content authoring with low marginal cost.** Each neutral encounter is a small content unit (a few stats + one rule). The matrix has room for hundreds of archetypes.
- **The mechanic-families pay off again.** Lurk, Coward, Pull, deathwish, vehicles, stealth, dispersal — every keyword has natural neutral-encounter expressions.

**Alternatives considered:**

- *Slay-the-Spire-style reward menus.* Rejected — violates Pillar 10, breaks design coherence, makes neutral encounters feel like a separate game.
- *Neutral nodes are completely empty (no reward at all).* Rejected — defeats the purpose of routing variety; runs converge on "go straight to boss."
- *Reward menus but gated by stat-presence requirements ("play X Resolve here for option A").* Was the previous working assumption (see DESIGN.md before today). Rejected — still a menu at heart, just with a stat gate; the player still picks from a list at resolve time.
- *Neutral cards belong to the player by default.* Rejected — the third-party framing is mechanically richer (AI can contest, neutral cards can target both sides at random per Pillar 10, etc.).
- *Single neutral card per encounter.* Rejected as artificial constraint — multiple neutrals at *different* locations within the same encounter is the puzzle's whole point.

**Supersedes:** the implicit "neutral encounters use reward menus" framing in earlier doc passes. The previous Open Question *"Neutral encounter design space — what other shapes do they take?"* is resolved by this framework. The Run Loop section's encounter-resolution paragraph is updated to point at the unified framework.

**Revisit when:** v3 prototype implements the first neutral-encounter archetypes and playtesting reveals (a) puzzles feel too solvable (mitigation: tighter slot/hand pressure or more aggressive AI contesting); (b) puzzles feel too punishing (mitigation: fewer neutrals per encounter or higher base reward value); (c) AI consumption feels too aggressive or too lenient (mitigation: tune AI spread heuristic priority for high-value neutrals).

---

## 2026-05-01 — Stat names locked in: Force / Tempo / Insight / Resolve / Spite (and HP renamed to Durability)

**Decision:** The five stats are renamed from D&D-placeholder labels to abstract-evocative names that carry color flavor directly into the stat name:

- **STR / Strength → Force** (Red). Force = intensity, brute pressure, raw application.
- **DEX / Dexterity → Tempo** (Green). Tempo = speed, timing, rhythm.
- **INT / Intelligence → Insight** (Blue). Insight = perception, understanding, the act of seeing through.
- **FAITH → Resolve** (White). Resolve = steadfastness, conviction, holding fast.
- **VIT / Vitality → Spite** (Black). Spite = malice held over time, vengeance carried through pain.

Additionally: **HP → Durability** as the standard label for the damage-soaking value on creatures and structures. Durability was already used as the *concept* in the doc; this aligns the numeric label with the concept name.

**Why:** The old D&D placeholders were neutral labels — STR/DEX/etc. could mean anything in any game. The new names *commit* to color identity at the label level. When a card prints "1 Spite cost," the player reads "this needs malice/persistence in play." When a card prints "+1 Force," the player reads "more pressure," not just "more strength." The stat name *paints the deck* in the color's flavor before any rules text is parsed. This sharpens identity coherence across all card design and removes the "STR/DEX feel like a different game" friction that was creeping in.

The rename is purely vocabulary — no design implications, no rules changes. Existing rules, mechanics, and color identities are unchanged; only the label moves from placeholder to canonical.

Durability replaces HP for similar reasons: HP is a generic computer-game label, while Durability captures the broader concept (cards have durability whether they're creatures, structures, or Inert obstructions; an Inert wall has Durability but doesn't have "HP" in any meaningful sense).

**Alternatives considered:**
- *Hold off on renaming until theme work is more developed.* Rejected — the working set is stable enough to use and the doc inconsistency was a real friction point. CLAUDE.md previously said "don't lock in" but the conversation has settled on these names confidently.
- *Use Force / Edge / Bulwark / Insight / Resolve* (the earlier "leading direction" set). Rejected — Edge and Bulwark are weaker fits for Green and Black than Tempo and Spite. Tempo specifically captures Green's whole identity (the timing-and-rhythm color); Spite captures Black's transactional malice better than the static "Bulwark."

**Supersedes:** the "Don't lock in stat names yet" guidance in CLAUDE.md and the Open Question in DESIGN.md tagged *(high)* about stat naming. Both have been updated.

**Revisit when:** playtesting reveals one of the names doesn't read well in context, or theme work uncovers a sharper alternative for a specific stat. The set is locked in for the working design and the prototype, not necessarily for marketing/final-product naming.

---

## 2026-05-01 — Unified face-down rule; stealth as economic+combat disruption; encounter-start fog as universal stealth

**Decision (cluster):**

1. **One face-down rule.** A face-down card on the battlefield is inert: no stat presence, no combat, not a legal target, no triggers fire. The slot is occupied but the card is dormant. Flip-up at end of current phase activates it fully. This single rule applies to just-committed cards, mid-encounter stealth, and the encounter-start fog reveal.

2. **Stealth re-scoped.** Stealth (a card effect that flips a face-up in-play card back to face-down for the rest of the current phase) now removes stat presence, combat participation, targetability, and trigger activity — *not just combat*. This makes stealth both an economic disruption tool (can fizzle action costs that depend on the stealthed card's stats) and a combat disruption tool. Trade-off: only one phase, only one card at a time per stealth source, and the friendly stealth use also removes its own blocking utility.

3. **Encounter-start fog as universal stealth.** When the player arrives at an encounter, every enemy card present at the encounter's locations gains stealth as a universal rule (no card text required). Those cards flip up at end of round 1 upkeep — the same flip-up-at-end-of-current-phase rule that handles in-encounter stealth. The player gets one phase of suspense, then sees the AI's full committed state before round 1 main.

4. **AI overworld cards are face-up real game state, hidden by UI only.** AI cards on uncontested overworld nodes contribute stats, accumulate upkeep buffs, run their flip-up and ongoing triggers — same as any in-play state. Fog of war is a UI/presentation layer, not a separate game state. At the moment of player arrival, the universal stealth rule converts those cards to genuine face-down state, and round 1 upkeep flips them up — at which point flip-up triggers fire *again* (flip-up is not a fires-once event; it fires on every face-down → face-up transition). What lands and what fizzles depends per-card on the trigger's target: self/friendly/summoner/token/environment-target flip-ups land fully on round 1; outward-board-target flip-ups fizzle on round 1 because the player has nothing committed yet.

6. **One reveal-trigger keyword: flip-up.** There is no distinct "on-enter" trigger that fires only at slot entry. Every reveal event is a flip-up event. This unifies the rules across (a) just-committed-then-flipped cards, (b) cards re-flipped after mid-encounter stealth, and (c) AI cards re-flipped on encounter-start reveal. Card text uses "flip-up" exclusively; legacy "on reveal" text in earlier doc passages should be read as flip-up.

5. **Stealth color homes.** Green (predator stillness, vanish-and-reappear) is the primary owner. Blue (illusion, misdirection) is the secondary. Black is plausible for a "lurk" variant. Red and White do not stealth — Red presses forward, White stands fast.

6. **Flip-up vs flip-down.** *Flip-up* is the keyword for face-down → face-up transitions and the only on-flip trigger keyword. There is no separate "flip-down" keyword; stealth is the existing primitive that *is* a flip-down. Stealth is also a one-way primitive: cards re-flip-up automatically at end of current phase, so multi-phase stealth would require explicit print text.

**Why:** The previous stealth design said face-down cards still contributed stats, which made stealth a pure combat tool with no economic teeth. That made fog of war and stealth two separate systems that did related-but-different things. The unified rule collapses them: encounter-start fog reveal, just-committed cards, and mid-encounter stealth all share *one* face-down state with consistent semantics. This:

- Eliminates a special "fog reveal" rule machinery; round 1 upkeep flip-up does it automatically.
- Gives stealth economic bite (can fizzle action costs), expanding the design space beyond combat denial.
- Makes face-down trivially understandable: the card is occupying its slot and waiting; it's not "kind of in play."
- Cleans up Pillar 4 ("fog of war is mechanical") to one rule rather than two cases with different stat treatments.
- Preserves the AI's bookkeeping needs without leaking into the player-facing encounter rules.

**Alternatives considered:**
- *Keep face-down stat contribution.* Rejected — kept stealth as combat-only, kept fog and stealth as separate systems, complicated the on-arrival reveal.
- *Stealth removes combat but not stats (preserve old rule).* Rejected — the asymmetry was confusing and made stealth's defensive use awkward (the friendly is "kind of there but kind of not").
- *Encounter-start: flip everything up immediately on arrival.* Rejected — loses the one-phase suspense moment, also requires a special "fog reveal" rule rather than reusing flip-up at end of phase.
- *Encounter-start: keep enemy cards face-up but with hidden identities ("blank silhouettes").* Rejected — adds a third rendering state and breaks unified face-down semantics.

**Supersedes:** parts of the 2026-04-29 stealth and ephemeral face-down decisions. Specifically, the rule that "face-down cards still contribute stats" is replaced by the unified inert-while-face-down rule. The Tempo-spent principle and the iterative-vs-atomic-reflip Open Question are both unchanged.

**Revisit when:** playtesting reveals (a) stealth feels too strong as economic disruption (mitigation: cost up Green's stealth cards, or restrict economic-fizzle to specific high-cost stealth variants); (b) the round 1 upkeep "see-then-commit" moment feels too generous to the player (mitigation: the universal stealth could flip up *during* round 1 main reveal instead of round 1 upkeep, compressing the suspense); (c) the wrinkle for AI bookkeeping creates engineering complexity (mitigation: simplify to "AI overworld face-down is also inert, AI logic uses a separate hidden-state model").

---

## 2026-04-29 — Ranged combat and ammo as the first consumable resource

**Decision (cluster):**

1. **Front row vs back row combat semantics.** The 2x2 creature grid splits into front and back rows with distinct combat behavior:
   - **Front-row creatures** auto-attack each combat phase using their attack pattern (typically melee, hitting the space directly in front).
   - **Front row acts as a blocker** for the back row: when the opposing front row is empty (relevant column / position TBD in Pass 2), front-row attackers can reach the opposing back row directly.
   - **Back-row creatures are inactive in combat by default.** They contribute stats and triggers but do not auto-attack unless they have a **ranged** attack pattern (printed or granted by equipment).
   - **Back-row ranged creatures** auto-fire each combat phase given a ranged pattern and available ammo.

2. **Ranged attack rules.**
   - Ranged attacks **bypass thorns** (no melee retaliation possible).
   - Ranged attacks are **not blocked by front-row creatures** — they shoot over.
   - Ranged attacks **consume ammo** (working assumption: 1 per shot as the global rule; specific cards may print higher costs).

3. **Ammo as the first consumable resource.** Stats are presence (not consumed). Slots are physical/temporal (not consumed). Ammo is *consumed on use* — a new resource type. Ammo is a per-side, per-location stockpile; generated by infrastructure (creatures with on-reveal ammo-add, structures with per-upkeep generation, terrain that prints ammo); has no natural regeneration. Out of ammo = no ranged attack from that creature this combat. Ammo distribution among multiple ranged creatures: fastest Tempo fires first and consumes; slower may end up dry.

4. **Two flavors of ranged combatant.**
   - **Printed-ranged creatures** (e.g., rock slinger): use Force as ranged damage. Buffable by Tactics.
   - **Equipment-armed creatures** (e.g., archer + bow): the equipment **sets** the wielder's ranged power explicitly, overriding Force. Tactics buffs to Force don't scale the bow's printed damage.

5. **Equipment as modifier vs replacement (a new equipment mechanic class).**
   - **Modifier equipment** (default): adds to existing capabilities. Buffs scale through.
   - **Replacement equipment** (the "sets" class): overrides an aspect of the host. The bow IS the attack. Buffs to the replaced stat are irrelevant.

6. **Color attribution (working).** Green: precision ranged (archery, slings). Red: brute ranged (catapults, throwers). Black: not native ranged but signature *anti-ranged* color (destroy ammo, force engagement). Blue stays in spell-damage lane. White probably no native ranged.

**Why:** Ranged combat answers a long-standing open question (how to cleanly kill Black creatures — ranged bypasses thorns), pulls front/back row from cosmetic to load-bearing (front row matters as a blocker even when not the strongest threat), and opens a genuinely fresh design space (locations as ammo stockpiles, infrastructure that produces ammo, anti-ranged effects). Ammo earns its place as the first consumable resource because it solves a specific problem the presence model can't handle alone: rate-limiting ranged combat so it doesn't dominate over melee (ranged bypasses thorns + ignores front-row blocking + can hit back row directly — without ammo, ranged would be unconditionally better than melee). The equipment-sets-power class formalizes a real mechanical distinction: weapons that *define* the wielder vs. weapons that *augment* them. The bow archer's damage scaling decoupled from Force is the canonical example.

**Alternatives considered:**
- *Ranged attacks free (no ammo).* Rejected — ranged would be unconditionally better than melee, since it bypasses thorns and front-row blocking already.
- *Per-creature ammo (each archer carries a quiver).* Rejected — bookkeeping nightmare. Per-location stockpile is cleaner and creates infrastructure design space.
- *Multiple consumable resources (one per color: mana, faith stockpile, etc.).* Rejected — duplicates the presence model, multiplies cognitive load, fights against stats-as-vocabularies. Ammo is the only consumable until a specific design problem demands another.
- *Ranged equipment as Force-modifier (additive) only.* Rejected — loses the design space where the weapon defines the wielder ("the bow IS the attack"). The replacement class is a real addition.
- *Back-row creatures auto-attack via melee at the back row.* Rejected — collapses the front/back distinction. Back row's value is utility/ranged or staying out of melee.

**Revisit when:** playtest reveals ammo bookkeeping is too heavy (mitigation: simpler ammo flow, e.g., shared between both sides, or fewer ammo-generation sources); ranged feels too dominant (mitigation: lower default ammo generation rates, more anti-ranged effects in non-Black colors); ranged feels too weak (mitigation: more reliable ammo sources, or some ranged attacks not requiring ammo).

## 2026-04-29 — Activation actions: actions that interact with permanents replace activated abilities

**Decision:** There are no "activated abilities" printed on permanents. Instead, a design class within the action vocabulary handles the same expressive space: **activation actions** — actions whose value depends on what permanents the player has on the board. The permanent IS the prerequisite for the action; the action does nothing without compatible setup.

Canonical examples:
- **Volley** (Green / Red) — your ranged-pattern back-row creatures here fire (off-cycle, outside combat phase). Cost: stat presence + ammo per shot.
- **Charge** (Red) — a friendly front-row creature here attacks (off-cycle melee). Cost: Force presence.
- **Inspire** (White) — friendly creatures here gain +X Force through their next combat. Cost: Resolve presence.
- **Drain** (Black) — a friendly creature here takes 1 damage; opposing summoner takes 2. Cost: Spite presence.

**The general design rule:** *creatures are passive contributors; actions activate them.* Reserve creature card text for passive contributions (stats, attack patterns, on-reveal / on-damage / on-death triggers). Active effects belong on action cards. When tempted to print an activated ability on a creature, the right move is almost always to print an action that does that thing instead.

The class needs a short label for design discipline. Working name: *activation actions*. Alternatives: *triggered actions*, *permanent-dependent actions*. Final choice tracked under Open Questions.

**Why:** This is a substantial design simplification. The "activated abilities" approach would have required new mechanics (resource types, activation timing rules, per-creature activated text) and added cognitive load (every creature potentially has an activatable text to track). Collapsing activated abilities into the existing action vocabulary uses systems already in place — card economy, action slot occupancy, stat-presence cost, action queue ordering — to gate everything that activated abilities would have done. Properties that fall out:
- The permanent IS the cost-prerequisite, layered on top of stat presence.
- Card economy gates everything; no new resource types needed (no per-color "mana").
- Splash-friendly: a Red Charge can activate any color's front-row creature; a Green Volley can fire any color's ranged-pattern back-row creature.
- Setup matters: a deck full of activation actions with no compatible permanents is dead in your hand.
- The action queue is the natural sequencer; multiple activation actions resolve in Tempo order via existing rules.

This also dissolves the previous "Activated abilities" Open Question.

**Alternatives considered:**
- *Activated abilities printed on creatures, gated by per-color consumable resources (mana, fury, etc.).* Rejected — multiplies resource types, fragments colors into separate machinery against the stats-as-vocabularies pillar, and adds cognitive load without solving a problem the existing systems can't.
- *Activated abilities gated by durability cost (creature takes self-damage to activate).* Rejected — leads to creatures destroying themselves and feels punitive rather than tactical.
- *Activated abilities gated by per-turn limits.* Rejected — feels like a cheap shortcut; doesn't integrate with the rest of the cost system.
- *Activated abilities printed on creatures, gated by stat-presence cost only.* Rejected as the headline approach — collapsing into action cards is cleaner because card economy adds another natural rate-limit (you only have so many activations in hand) and keeps creature card text focused on passive contributions.

**Revisit when:** playtest reveals a specific design need that activation actions can't capture cleanly. Most likely pressure point: an effect that should be available *constantly* and not consumed from hand. Mitigation paths if so: passive triggers on permanents, structure-based aura effects, or (last resort) a narrow class of true activated abilities reintroduced for that need.

## 2026-04-29 — No on-resolve targeting; effects pick at random from legal candidates

**Decision:** Card effects do not prompt the player to choose a target at resolve time. Card text narrows the candidate pool ("a friendly creature," "a creature here," "the front-most enemy") but the actual recipient is selected **at random** from cards meeting the printed condition. The strategic skill is *setting up* a board where exactly one card qualifies — or accepting random outcomes when it doesn't. Specificity is a printed cost: broad effects are cheaper but less reliable; narrow effects are more expensive but predictable.

This is now **Pillar 10**.

Distinction: **play-time placement** decisions (which slot a creature occupies, which permanent equipment attaches to) are not "targeting" and remain player choices. The rule applies specifically to *effect resolution*.

**Why:** This rule does several things at once:
- Removes player decision-making from effect resolution, simplifying play flow and matching the no-priority-chain pillar (Pillar 5).
- Creates a power-vs-reliability tuning lever for card design: a strong effect can be cheap if its target is broad and might miss.
- Rewards positioning and play-sequencing as the primary strategic skill; setting up "exactly one legal target" moments is a real form of competence.
- Keeps the AI evaluable: the AI doesn't need to make resolve-time targeting decisions because the system makes them randomly.
- Makes Green's flip primitive and stealth more strategically valuable, since manipulating which creatures qualify shapes which effects can hit them.

**Alternatives considered:**
- *Player picks the target on resolve.* Rejected — slows play, requires AI heuristic for target selection, blunts the design space where unreliability is itself a balance lever.
- *Deterministic resolution rule per card (e.g., "always the front-most").* Rejected — over-specifies card text and removes the chaos that makes specificity feel valuable. (Some cards may still print such conditions where flavor demands.)
- *No targeting at all (effects must be all-or-nothing).* Rejected — too restrictive for many useful card patterns (heals, single-target buffs).

**Revisit when:** playtest reveals random targeting feels frustrating or cheats players in ways that matter. Most likely mitigation: tighter target-condition vocabulary (more printed-condition forms to narrow legal candidates), not abandonment of the rule.

## 2026-04-29 — Action queue model; actions resolve to discard pile (cycling); exile as opt-out keyword

**Decision (cluster):**

1. **Action slots are a queue, not positioned slots.** Actions are not placed into specific slots by the player. They enter the location's action queue in the order they are committed: first action played here goes into slot 1, second into slot 2, etc. When an action resolves and exits, persistent actions in higher slots **shift up** to fill the gap. A migrating Curse goes to the first available enemy slot at the same location — fully deterministic, no random selection.

2. **Permanents occupy physical space; actions occupy time.** Creature and structure slots have player-chosen positioning (front/back row, column) because position is a combat resource. Action slots have queue-determined ordering because actions abstract *time*, not *space*. Equipment is in between: it occupies no slot, but the player chooses its host at play time (placement, not targeting).

3. **Resolved actions go to the discard pile, not the graveyard.** The discard pile reshuffles into the deck when the deck runs out, so actions cycle back into the player's hand over the course of an encounter. Actions are tactical, repeated tools designed to cycle multiple times. Permanents (creatures, structures) still go to the graveyard when destroyed; creatures reshuffle into the deck *between* encounters at a slower cadence.

4. **The exile zone is the opt-out keyword.** Premium one-shot effects that should not recycle can print "exiled when this resolves," sending the card to exile instead of discard. Exile cards do not return during the encounter. This is the design space for rare powerful effects that need a per-encounter cap.

**Why:** The queue model resolves several questions at once. Actions don't have positions because positioning was never a strategic resource for them; queue ordering is the natural alternative and makes Curse migration trivially deterministic. The discard cycling makes spell-focused win paths viable — without recycling, Blue's direct damage is gated by deck size, capping total damage per encounter. The cycling is naturally limited by other mechanics (stat presence, slot occupancy, Resolve retention, vulnerability of stat-printers), so it doesn't bypass existing controls. Exile gives the design space for "premium one-shot" effects that need to bypass the cycle.

**Alternatives considered:**
- *Actions go to graveyard like permanents.* Rejected — caps spell-focused win paths at deck composition, makes Blue's identity mechanically inviable.
- *Actions cycle freely with no exile keyword.* Rejected — removes the design space for premium one-shot effects.
- *Player chooses which action slot to play into.* Rejected — adds bookkeeping with no strategic value, since positioning doesn't matter for actions the way it does for creatures.
- *Migrating Curse picks a random enemy slot.* Rejected — queue-determinate is simpler and consistent with the queue model.

**Revisit when:** playtest reveals balance issues. Most likely: repeatable damage Spells overperform (mitigation: more "exiled when this resolves" cards in the damage line, or cost increases); discard cycling feels too generous for the AI (mitigation: AI deck stratification adjustments).

## 2026-04-29 — Tempo ordering and combat sequence hierarchy

**Decision:** Combat sequence within a phase is determined by a deterministic four-level hierarchy. **No randomness** at this layer — random selection only enters at effect-resolution targeting (Pillar 10), not at combat sequence.

1. **Tempo descending.** Higher Tempo always acts first. **Negative Tempo is a legal printing** (e.g., Black curses with "creatures here have Tempo -1") — pushes a creature behind the Tempo-0 baseline.
2. **Within a Tempo tier: per location**, in battlefield order (left-to-right across rendered locations). One location's qualifying creatures resolve fully before the next location's begin.
3. **Within a location, within a Tempo tier: by position.** Front-to-back, left-to-right within each side's grid.
4. **Side priority** — when both sides have qualifying creatures within the same location and Tempo tier, the side with the **higher local Tempo total** at that location resolves first. If local Tempo totals are tied, **priority alternates per overworld turn**: whichever side did not have priority last turn gets it this turn.

For action slots specifically, slot order tiebreaks Tempo ties (slot 1 reveals before slot 2 within the same Tempo tier).

**Why:** Most non-Green creatures will print 0 Tempo, so tie-breaking is the *primary* ordering rule for many encounters. Three properties were required:
- **Deterministic so players can plan.** Random combat order would feel chaotic in a way that hurts the planning loop.
- **Neither player a default winner.** Rules that assigned permanent priority to one side would feel unfair.
- **Green should be doubly rewarded** for Tempo investment: individual creature initiative *and* local-Tempo-total-driven side priority.

The four-level hierarchy delivers all three. The local-Tempo-total rule rewards Green investment at locations the player cares about. The alternating-per-turn fallback prevents "always first" advantage when Tempo totals are tied. The location-and-position ordering anchors the variable-adjacency battlefield UI mechanically.

**Alternatives considered:**
- *Random within a Tempo tier.* Rejected — combat planning needs determinism; random combat sequence would feel chaotic in encounters where most creatures share Tempo 0.
- *Active-player or attacker-first as side priority.* Rejected — assigns a permanent advantage to one side.
- *Pure alternating priority (no local Tempo consideration).* Rejected — flattens out the value of Tempo investment beyond individual initiative.

**Revisit when:** playtest reveals the rule feels too complex to track, or that local Tempo investment is too dominant. Mitigation paths: simplify to pure alternating, or weaken the local-Tempo-total swing.

## 2026-04-29 — Color identity additions: White's second mechanical idea, Blue's two-archetype control, Curse design discipline

**Decision (cluster):**

1. **White's second mechanical idea: healing and protective intervention.** Beyond Prayer, White's signature themes are **healing, restoration, and divine intervention**. The canonical patterns:
   - **Healing** restores creature durability — patches damage that would otherwise interrupt Resolve creatures' Prayer channeling.
   - **Divine shield** is a cheap pray-1 protective effect granting a *single-instance damage absorber*. The pattern: drop a divine shield first to protect your channeling Resolve creature, then commit a bigger Prayer behind it. The shield deflects the channel-cancellation hit; the bigger Prayer keeps progressing.
   - **White is the color that patches its own seams.** Where Blue is structurally brittle (mage death = strategy collapse), White prints the exact tools to repair the damage that would interrupt it.

2. **Blue's two-archetype control suite: Counterspell and Stifle.** Blue's denial tools split into two distinct attack angles:
   - **Counterspell** removes actions from slots. Race-dependent against one-shots, always works against persistent actions. The high-risk single-hit option.
   - **Stifle** prevents reveals and clogs slots. Symmetric (affects both sides). Punishes timing-locked plays specifically by forcing them to miss their phase trigger. The patient grinder option.
   - Together they cover the full denial space: remove (Counterspell) or delay-and-clog (Stifle).

3. **Curse design discipline: static board auras or player-direct effects.** Curse effects split cleanly into two design lanes that both sidestep the random-targeting issue:
   - **Static board auras.** Apply to *all* qualifying creatures simultaneously ("friendly creatures here have -1 Force"). No per-tick targeting roll. Stack cleanly.
   - **Player-direct effects.** Target the opposing summoner ("during upkeep, opposing summoner discards a card"). Summoner is always a unique target. Black attacks the *player*, not the *board*, across many turns of attrition.
   - **Triggered single-target board effects** ("during upkeep, deal 1 damage to a creature here") are *avoided* — they would require a fresh random roll each tick, which feels unsatisfying for a multi-turn debuff.

**Why:** White's second mechanical idea was a high-priority Open Question. The healing-and-protection direction gives White an in-color answer to its own structural vulnerability (damage to Resolve creatures interrupts channeling), creating a mechanically tight identity: White patches its own seams. Blue's Stifle is a meaningful expansion of its denial space — Counterspell alone treats all denials as removal, which is too narrow; Stifle covers the timing-disruption angle that Blue's perception-and-foresight identity demands. Curse design discipline pre-bakes the no-targeting pillar into Black card design, giving designers two productive lanes and one to avoid.

**Alternatives considered:**
- *White as a generic "buff" color.* Rejected — overlaps Red's combat-buff Tactics. Healing and divine shield are more thematically specific.
- *Blue with Counterspell only.* Rejected — flattens Blue's denial design space; doesn't punish timing-locked plays specifically.
- *Curse effects as triggered single-target by default.* Rejected — produces unsatisfying per-tick random rolls. Static auras and player-direct effects are cleaner.

**Revisit when:** playtest reveals White feels monotonous (mitigation: more variety within healing + divine shield space, or a third White mechanical idea). Stifle balance pressure (mitigation: cost increase, or asymmetric variant where Stifle hurts the caster less). Curse pressure: too many static auras feel undifferentiated (mitigation: more variety in player-direct hand-disruption effects).

## 2026-04-29 — Action card type rename + resolution mechanics

**Decision (cluster):**

1. **The card type previously called *Spell* is renamed to *Action*** — a neutral umbrella covering all non-permanent plays. Each color has a flavor subtype: **Spell** (Blue), **Prayer** (White), **Curse** (Black), **Maneuver** (Green, placeholder name), **Tactic** (Red, placeholder name). The subtype-name structure preserves color-specific vocabulary while letting the type name itself cover non-magical effects.

2. **Cost-check happens twice: at cast and at resolve.** When committing a card to a slot, costs are checked against the caster's currently visible stat state. When the action resolves (end of cast phase for immediate actions; later for delayed-timing actions), costs are re-checked against the now-current state. If conditions changed (a stat-printer died, an opponent's comparative stats moved), the action **fizzles**. Comparative-vs-opponent components bind at resolve, when the opponent's stats are visible. The longer the cast-to-resolve gap, the more exposed the action is — designers tune power-vs-exposure per card.

3. **Face-down state is ephemeral within an encounter.** Cards do not stay face-down across phases. During a phase's input window, played cards are face-down "pending"; at end of phase they enter and flip face-up. **Cards flip at the end of *any* phase they are face-down in.** (AI cards on uncontested overworld nodes are an exception — face-down to the player but active in AI bookkeeping between encounters.) Face-down cards still contribute their printed stats to per-side totals; fog-of-war hides identity from the *opposing* side, not the owner.

4. **Stealth and re-flip mechanics.** Several Maneuver effects flip face-up cards back to face-down. Per the auto-flip rule, stealthed cards re-reveal at end of phase. Stealth's two main jobs: re-trigger powerful on-reveal effects (offensive use) and skip combat for the stealthed creature (defensive use, since face-down creatures don't attack, block, or get targeted). The defensive use is the game's analog to MTG fog + phasing, with an upside MTG suppressed: re-reveal can trigger ETB effects.

5. **Tempo-spent principle.** A creature that has already used its Tempo initiative this turn — by acting in Tempo order during combat, or by revealing in Tempo order at end of a phase — does not reclaim that initiative on a re-flip. Stealth-driven re-reveals drop to the back of the Tempo order. Generalizes beyond stealth: any future "re-use" mechanic should obey the same rule. "Initiative is spent once per turn" is load-bearing for the speed system.

**Why:** The *Spell* name was magical-only and didn't fit Prayers, Curses, Green movement, or Red combat tactics. *Action* is neutral; subtypes preserve flavor specificity. The double cost-check + ephemeral face-down + stealth model give a unified framework for action resolution that supports both immediate and delayed-timing actions, fits the no-in-phase-response-chain pillar (fizzling resolves between phases, not within one), and gives Green stealth a clean mechanical home as both offensive (re-trigger) and defensive (skip combat) primitive. The Tempo-spent rule prevents stealth + re-flip from being a tempo refund, which would have allowed degenerate combo loops.

**Alternatives considered:**
- *Keep "Spell" as the umbrella name.* Rejected — carries unwanted magical flavor.
- *No flavor subtypes; just rename to Action.* Rejected — color-identity vocabulary (Curse, Prayer) is too useful.
- *Single cost-check at cast.* Rejected — would prevent fizzling and remove a coherent disruption layer (combat damage as queued-action disruption).
- *Persistent face-down state across phases as the default.* Rejected — adds bookkeeping complexity. Pass 2 may revisit a "deep stealth" override keyword.
- *Re-flips reclaim Tempo initiative.* Rejected — would let stealth + re-flip refund tempo, allowing degenerate combo loops.

**Revisit when:** playtest reveals whether iterative-vs-atomic re-reveal chains need a definitive rule (currently held as Open Question); whether per-color action subtype names (Maneuver, Tactic) should be finalized differently.

## 2026-04-29 — Resource model: stats are presence, slots are scarce; equipment as slotless release valve

**Decision (cluster):**

1. **Stats are presence, slots are the actual scarce resource.** Cards have stat *requirements*, not stat *costs*; presence is not consumed (already in *Cost-payment is a presence check*, 2026-04-27 — sharpened here). The actual limiting resource is *slots*: creature, structure, and action slots are bounded per location. Filling slots with permanents generates stats, but a fully-filled board produces stat presence with nowhere to put it.

2. **Action-leaning colors (Blue, White) cycle slots fluidly** because actions resolve and exit. **Combat-leaning colors (Red, Black, partly Green) hit slot-cap pressure mid-encounter** because their permanents stay on the board. Persistent actions (Prayer, Curse) worsen slot pressure for White and Black specifically.

3. **Equipment is a new card type — the *modifier* type.** Creatures and structures *do things*; actions *make things happen*; equipment *changes how something does its thing*. Rules:
   - Equipment occupies no slot of its own.
   - It attaches to a permanent (creature OR structure) — card text specifies which host type.
   - It modifies the host (changes attack pattern, adds stats, adds keywords, adds utility).
   - When the host leaves play, attached equipment leaves with it.
   - Equipment is destroyable only by specific equipment-removal effects (parallel to structure-removal). Combat damage does not strip equipment.

4. **Equipment is the slotless release valve** that resolves the slot-cap problem. It remains playable when all permanent slots are filled, providing an output channel for excess stat presence. Equipment skews toward combat colors (Red, Black, partly Green) because they hit slot-cap most acutely. Encounters develop a natural arc: build → fill → equip.

5. **Creature equipment vs. structure equipment.** Creature equipment modifies combat behavior (e.g., a sword changing attack pattern). Structure equipment provides utility / aura / conditional effects local to the structure (e.g., an "intruder alarm" preventing face-down stealth at this location). Structures still do *not* enter combat regardless of any equipment attached — equipment cannot weaponize a structure into the dex-ordered combat system.

**Why:** Naming slots as the limiting resource sharpens design vocabulary and explains why combat colors need a release valve while spell colors don't. Equipment was already on the roadmap as a Pass 2 sketch; pulling it forward and giving it the slotless-release-valve role unifies its mechanical purpose with its design role. Allowing equipment on structures opens a fresh design space (most card games equip only creatures) without breaking the structure / creature combat separation.

**Alternatives considered:**
- *Equipment occupies a creature slot or its own equipment slot.* Rejected — defeats the slotless-release-valve purpose; collapses to "another creature with a different name."
- *Equipment attaches only to creatures.* Rejected — structures benefit from being equipped for utility/aura plays, and structure-equipment is genuinely fresh design space.
- *Equipment can be destroyed by combat damage.* Rejected — would conflate equipment-removal with combat-removal and erase a clean color-pie axis (parallel to structures).
- *Structures gain combat capability when equipped.* Rejected — preserves the clean creature-combat / structure-utility separation; structure equipment is for utility, not weaponization.

**Revisit when:** playtest shows whether equipment is consistently the right answer to slot-cap pressure or whether the per-permanent equipment cap, multi-equip rules, and cost balancing need re-tuning.

## 2026-04-29 — Color identity sharpening: cost-shape, Red as the *now* color, Green non-stacking

**Decision (cluster):**

1. **Blue and White differ by cost-shape, not just flavor.**
   - **Blue** is *front-loaded*: spells require heavy Insight presence at cast time. The Blue mage *is* the spell economy at the location. Killing the mage fizzles queued Blue actions. Blue is **tempo-fragile** — one combat hit on the mage can shut down a strategy.
   - **White** is *deferred*: Prayers have **no stat-presence requirement to cast**. The channel cost is paid over multiple turns by Resolve creatures arriving at the location. Damage to a Resolve creature pauses that creature's contribution this turn but doesn't break the Prayer. White is **tempo-resilient** — chip damage delays, doesn't break.
   - Prayers can be *speculatively pre-positioned* (drop without resources, channel later); Blue spells cannot.

2. **Resolve is card retention, not bigger hand.** Resolve's real value is keeping the right card for the right phase — especially because end-of-turn discard structurally punishes timing-locked plays. This is the underlying reason for **Blue+White affinity**: Blue's natural play pattern (timing-locked spells) gets discarded by cleanup; Resolve retention solves it. The colors are *mechanically complementary across the cleanup phase*, not just "spell-leaning together."

3. **Red is the *now* color.** Red's identity is impulse, locality, intensity — answering the previously-open structural-weakness question:
   - **Negative space:** no persistent actions (Curse, Prayer, Counterspell are colored elsewhere); no wide presence (signature lone-champion bonuses break with multiple creatures); no supply-line scaling (Red structures are "here"-scoped only — they persist on the map but their text contributes nothing elsewhere).
   - **Positive space:** *conditional stat printing* as a new mechanic class ("+5 Force while alone here"), impulse-scoped action effects (combat / end-of-turn / end-of-phase only), here-scoped structures.
   - **Splash friction:** Red's friendly-fire / cleave attack patterns damage allied creatures. Splashing protective creatures from other colors gets them killed by Red's own attacks. **Red is locked into purer tempo strategies by mechanics, not by rules.**
   - **Red+Black mixed synergy:** Red's friendly-fire feeds Black's death-feeder cards (graveyard recursion, sacrifice payoffs) but is punished by Black's thorns. Card-level negotiation, not flat affinity.

4. **Conditional stat printing as a new mechanic class.** Cards may print stats keyed off board state ("+X STAT while [condition]"). When the condition holds, the conditional stat counts as real stat presence — paying costs, contributing to combat, satisfying comparative inequalities. When the condition breaks, the conditional stats vanish. This is Red's signature: a *temporary local resource spike* mechanic, distinct from Blue/White's *residual global persistent* effects.

5. **Green effects don't double up on the same card.** Boolean keyword grants don't compound (you have double-strike or you don't). Numeric grants stack but Green's numerics are tuned modest. The flip-spam combo ceiling without cross-color support is bounded; the biggest combo upside comes from cross-color stackable payloads (Red's "+2 Force on reveal," Blue's "deal X damage on reveal," etc.). Unifies with the Tempo-spent principle: Green is the color of *one window per turn* — manipulating timing and positioning, not piling value.

6. **Don't think of colors monolithically.** Reaffirming the existing stats-as-vocabularies decision (2026-04-29): cards are cards with their printings; decks are emergent multi-color blends. "Mono-X" and "splash color" framings drift back into faction-thinking and should be avoided. Cross-color combinations are the strongest plays but the most economically demanding; pure-color decks are functional but not the ideal pattern.

**Why:** The previous color profiles under-specified Blue vs White mechanically and left Red's structural weakness open. The cost-shape model gives Blue and White genuinely different breakage profiles from the same "weak creatures supporting strong actions" theme — answering "why splash one when you could play either?" Red's *now*-color identity answers the structural-weakness question by exclusion (no persistent actions, no wide, no supply lines) while providing a positive complement (conditional stat printing as a tempo lever). Green's non-stacking rule gates iterative-stealth combos to cross-color splash plays, where the additional cost is the natural balancer.

**Alternatives considered:**
- *Blue and White's spell economies treated identically.* Rejected — produces nearly-interchangeable colors. Cost-shape distinction makes them mechanically distinct.
- *Red's weakness as "weak Insight/Resolve distribution" or some economic gap.* Rejected — produces a reactive, defensive Red, contrary to identity. Exclusion from spell-slot meta + lone-champion ramp + splash friction is a tighter answer.
- *Green's effects stack uniformly with themselves.* Rejected — produces degenerate flip-spam combos without splash cost. Boolean non-stacking + modest numeric tuning gates the combo ceiling at cross-color.
- *Resolve as "bigger hand" without the retention reframe.* Rejected — flattens Resolve into raw card volume. The retention angle preserves volume incidentally but anchors the value to *which* cards are kept, not how many.

**Revisit when:** playtest reveals tuning issues. Most likely: Red feels too lonely (mitigation: tune cleave damage and conditional bonuses); Blue's spell economy feels too brittle (mitigation: more Insight-printing creatures or mage durability tuning); White feels monotonous (still depends on the Open Question of what White does besides Prayer).

## 2026-04-29 — Combat attack patterns; cleave as pattern, not keyword

**Decision:**

- The default creature attack pattern is **damage to one space directly in front of the attacker** (the precise "in front" geometry in a 2x2 grid is deferred to Pass 2).
- Cards may print **custom attack patterns**: multi-target, AOE, ranged-into-back-row, side-hitting.
- **Cleave is not a separate keyword.** It is an attack pattern that happens to include same-side spaces. The same primitive that gives Red an AOE-into-wide-opponents answer also produces Red's friendly-fire / self-cleaning behavior.
- Equipment can modify a creature's attack pattern (e.g., a Red sword turning a single-target striker into a cleaver).

**Why:** Treating cleave as a separate keyword would have created two unrelated mechanics ("AOE damage into enemies" and "damages your own creatures"). Treating both as variants of a single design surface — printed attack patterns — unifies them: anti-wide tooling and friendly-fire are the same thing seen from different sides. This produces a clean substrate for equipment to modify (changing the pattern itself rather than adding a side effect) and gives Red a coherent combat-design space.

**Alternatives considered:**
- *Cleave as a keyword that triggers AOE.* Rejected — duplicates the attack-pattern primitive.
- *Friendly-fire as a separate "self-damage" subsystem.* Rejected — same reason; attack patterns subsume it cleanly.
- *Default attack pattern is single-target without geometric direction.* Rejected — loses the directional positioning that makes Pass 2 combat (front/back row, melee/ranged) meaningful.

**Revisit when:** Pass 2 detailed combat is being designed (front-row vs back-row, ranged, ammo). The high-level "patterns are printed per card" rule should hold; the geometry will firm up.

## 2026-04-29 — Stats are vocabularies, not deck identities

**Decision:** Stats (and their associated colloquial colors) are mechanical *vocabularies of effect*, not deck-construction identities. The player cannot pre-commit to a "color." Decks are emergent multi-color blends built run-by-run from neutral encounter rewards.

**Why:** The game is a roguelike deckbuilder where the player accumulates cards opportunistically through a run. There is no class-locked card pool. The system must work — and be fun — at any stat distribution. Treating stats as factions creates commitment-trap design patterns (a single Red card in an Insight deck would be dead weight) that break the roguelike loop. Reframing stats as *axes the card pool varies along* removes that trap and makes cross-stat synergy a primary design goal rather than a tradeoff.

**Implications:**
- No stat can be a pure commitment trap. Single off-color cards must contribute meaningfully.
- Force and Tempo are connective-tissue stats appearing across all flavors ("gold and silver"), gluing decks together economically.
- The *colors* (Red/Green/Blue/White/Black) are colloquial labels for stat flavors, not enforced deck-construction rules.
- Card design discipline now includes: "does this card contribute meaningfully when spliced into a foreign-flavor deck?"

**Alternatives considered:** MTG-style color identity with hard or soft commitment. Rejected — violates the roguelike loop where the player can't choose their pool.

## 2026-04-29 — Card types and combat-vs-non-combat permanents

**Decision (cluster):**

1. **Three slot types per location:** creatures, structures, spells. Each holds its corresponding card type.
2. **Creatures have printed durability (Durability)** as a separate value, not derived from any stat. Every creature has durability, regardless of whether it has any other stats.
3. **Combat-as-violence is decoupled from existence-as-attackable.** A creature with no Force exists in a slot, has durability, can be targeted by combat damage, and is destroyed when durability reaches 0 — but does *not* deal damage itself. Force-less creatures are a deliberate design space (utility creatures, Insight/Resolve stat-printers, etc.).
4. **Structures have no durability and are not in the combat damage system.** They are destroyed only by specific effects ("destroy a structure"). Structure-removal is a designed, color-flavored capability rather than a side effect of combat. Structures persist on the map across encounters (supply lines).
5. **Spells are events.** Default behavior: played in any phase, resolve at end of phase, exit to graveyard. Subtype: *persistent spells* override the exit rule (see separate decision).
6. **Spell-slot occupancy is a real strategic resource** because persistent spells stay in their slot across turns.
7. **Equipment** attaches to creatures rather than occupying a slot. Detailed rules deferred to Pass 2.

**Why:** The conflation of "engages in combat" and "exists on the battlefield" was preventing legitimate utility-creature designs. Separating them gives a clean rule (every creature has Durability, not every creature has Force) and unlocks a whole tier of cards (the weak utility creature that prints stats and triggers effects but doesn't fight). Excluding structures from combat targeting means structure-removal becomes a distinct color-pie capability rather than an automatic combat side-effect — which preserves design space for structures as long-game investments.

**Alternatives considered:**
- *Structures as combat targets with their own Durability.* Rejected — would conflate structure-removal with combat-removal and erase a clean color-pie axis.
- *Creature Durability derived from Spite.* Rejected previously; reaffirmed here. (Original rejection: would force every creature to print 1 Spite or be DOA.)
- *Universal combat-style removal of all card types.* Rejected — kills the meaningful distinction between persistent (structures) and volatile (creatures) permanents.

## 2026-04-29 — Persistent spells: Prayer, Curse, Counterspell

**Decision (cluster):** Three named persistent-spell archetypes are core to the design. Each occupies its spell slot across multiple turns rather than resolving and exiting at end of phase.

1. **Prayer (White / Resolve):** played by you into your own slot. Has a `pray N` channel cost. Each turn, Resolve-printing creatures on your side at this location automatically contribute 1 per Resolve point to channel progress. Damage to a contributing creature interrupts that creature's contribution this turn (but not other creatures' contributions). Resolves when remaining cost = 0 *and* the printed timing trigger fires that turn. Effects are above the curve for one-shot spells; the multi-turn channel is the cost-justification. Multiple prayers at one location each receive the full local Resolve contribution per turn (Resolve is presence, not a consumable).
2. **Curse (Black / Spite):** played by you into your own slot. *On reveal, migrates to the opposing side's spell slot* at the same location, where it persists as a debuff. If enemy slots are full at migration, the curse fails to migrate and stays in the caster's slot — the caster is stuck with their own debuff. Slow Curses (low Tempo) reveal *after* enemy spells have resolved and exited, finding empty slots more reliably; fast Curses are *worse*. This is the rare mechanic where low Tempo is strictly desirable.
3. **Counterspell (Blue / Insight):** working name. On resolve, all spells currently in spell slots at this location are sent to the graveyard (Counterspell exempts itself). Hard counter to Prayers and Curses regardless of how long they've been channeling. Tempo order matters for one-shot spells (fast spells resolve before counterspell catches them) but not for persistent spells (always in the slot when counterspell fires).

The three archetypes form a **three-way spell-slot tension**: White wants to occupy its own slots (Prayer), Black wants to occupy enemy slots (Curse), Blue wants to clear all slots (Counterspell).

**Why:** Persistent spells turn the spell slot into a strategic resource over time. They give White a unique cost-justification mechanic (channeling) that lets it print powerful effects without flooding the game with one-shot bombs. They give Black a non-combat way to project pressure (curses tick every turn from inside the enemy's slots). They give Blue a meaningful counter-play role (counterspell is a hard answer to both). The three colors' interaction in the spell economy creates rich strategic decisions across deck design and play timing. The slow-is-good inversion for Curses is mechanically distinctive and gives Black a real reason to print low Tempo.

**Alternatives considered:**
- *No persistent spells; all spells one-shot.* Rejected — flattens spell design and removes the most distinctive tools for White and Black.
- *Persistent spells as a separate card type, not a spell subtype.* Rejected — adds taxonomy complexity without payoff; the slot occupancy rule does the work.
- *Counterspell as a stack-style interrupt during the play queue.* Rejected — violates Pillar 5 (no in-phase response chains). Counterspell is a normal spell that resolves in Tempo order; its power comes from clearing slots, not from interrupting plays.

**Revisit when:** playtest reveals balance issues. Most likely pressure points: Counterspell too oppressive (mitigation: rarity, Insight cost), Prayer channel-time too long to feel rewarding (mitigation: tune cost values down), Curse migration-failure rule too punishing (mitigation: failed-migration alternatives).

## 2026-04-29 — Comparative costs (opponent-relative)

**Decision:** Card costs may be expressed as comparative inequalities against the opponent's stat presence at the same location. Examples: "requires more Force here than your opponent," "requires less Resolve here than your opponent," compounds.

**Why:** Comparative costs add a strategic axis that absolute-only inequality costs miss. They enable rivalry-themed cards, underdog-power cards (only playable when losing the local stat war — self-balancing), make enemy stats informationally relevant beyond combat math, and discourage uncritical stat over-stacking.

**Working assumption (Open Question to confirm):** Comparative-cost checks happen at end-of-phase reveal, when both sides' totals are visible. If a card's comparative cost isn't met at reveal, the card fizzles. This avoids the fog-of-war problem of needing to know hidden enemy stats at play time.

**Alternatives considered:** Costs only allow absolute inequalities (≥ X, ≤ Y, = X). Rejected as strictly less expressive, with no offsetting design benefit.

## 2026-04-29 — Zombification (Black recursion gating)

**Decision:** When a creature returns to play from the graveyard via a Black "raise" / "resurrect" / equivalent effect, all stats other than Force and Spite clamp to 0 for the duration of that play. Such creatures are themed as **zombies**.

**Why:** Uncontrolled graveyard recursion would let any color's expensive creatures be replayed cheaply, breaking the resource-cost system. Clamping non-Force/non-Spite stats prevents Black from being a free splash for any other color's economy (raised Blue spellcasters can't fuel further Blue spells). It forces Black recursion to be combat-focused, reinforces the Black + Red affinity (Red creatures keep most of their value when raised; Blue/White/Green creatures come back as shadows), and aligns rule with theme (zombies are physical and tough, not smart, pious, or fast).

**Working assumption (Open Question to confirm):** zombification is an in-encounter status, not a permanent card state. Once the encounter ends and creatures shuffle back into the deck, raised creatures revert to printed stats. Otherwise a Black-heavy deck would worsen across a run from its own raise effects.

**Alternatives considered:**
- *No clamping; raised creatures return at full stats.* Rejected — breaks resource economy.
- *Raised creatures return at half-stats or with -1/-1.* Rejected — rule is harder to remember and doesn't produce the clean color-affinity pattern.
- *Zombification permanent across the run.* Held as Pass-2 question, but disfavored — would actively punish Black-heavy strategies as the run progresses.

## 2026-04-28 — AI architecture: heuristic + curated deck + shared card pool with player-only/AI-only flags

**Decision (cluster):**

1. **The AI is a heuristic system, not a search-based or learned system.** No MCTS, no neural nets, no minimax. Conventional scripted/scored play.
2. **Insight is split across three places:** designer-authored deck composition (the biggest lever, and pure data), card-level play hints (metadata on each card), and a small global scoring function (low hundreds of LOC) that picks card-target pairs by greedy score.
3. **Card pool is shared between player and AI**, with `playerOk` / `aiOk` flags on each card. Most cards (~80–90%) are shared. Player-only cards (~10–15%) handle effects that need human judgment. AI-only cards (~5–10%) handle boss/monster-flavored content that does not read as player content.
4. **Card design carries an explicit AI-evaluability discipline.** Every card is checked against four questions (player-decision-dependence, local-evaluability, target-legibility, multi-turn-planning) and tagged accordingly.
5. **Difficulty comes from transparent cheating, not clever play.** The AI is allowed earlier access to higher-rarity versions of shared cards, curated draw order, and head-start tempo. The AI is a *force-of-nature* opponent, not a peer player.

**Why:** The design has already eliminated the things that make game AI hard — no in-phase response chains, deterministic combat, no multi-turn hand planning, no attacker/blocker selection, no hand-information warfare. What's left ("given my hand and the map state, where do I play each card") is heuristically solvable. The shared-pool-with-flags model preserves the elegance of "symmetric roles, asymmetric agency" without forcing every player card to be AI-evaluable. Splitting intelligence across deck composition, per-card metadata, and a small scoring function keeps the engineering work small and shifts the burden to content authoring (which is where it belongs in this genre).

**Alternatives considered:**
- *Custom AI deck (separate card pool entirely).* Easier to AI, but breaks shared vocabulary between sides and feels like two different games. Rejected.
- *Fully-shared card pool with no flags.* Maximally elegant, but forces every card design to be AI-playable, which throttles player-side design space. Rejected.
- *Search-based AI (MCTS / lookahead).* Tractable for this game's branching factor but overkill for a hobby project, and produces behavior that is hard for the player to *read*. Game design wants legible AI habits; search-based AI works against that. Rejected for the foreseeable future.
- *RL / trained AI.* Wrong tool for hobby scale and wrong tool for legibility. Rejected.

**Revisit when:** playtest reveals the AI feels dumb in specific, repeatable ways. Most likely fixes are (a) more sanity-check rules layered on the heuristic, (b) richer per-card hints, (c) better deck stratification — in that order. Search-based augmentation is held in reserve and almost certainly will not be needed.

## 2026-04-27 — Stats-as-resources, scoped effects, summoners have Durability only

**Decision (cluster):** Adopting a unified resource model and scope rule that replaces an MTG-mana-style economy:

1. **Summoners (player and boss) have Durability only.** No personal stats.
2. **Stats live on permanents and on location terrain.** Per-location per-side stat totals are summed from both sources. Both contribute to all uses of the stat.
3. **Reading A — baseline integration.** Terrain stats and permanent stats sum together for *all* purposes: cost-paying, combat math, and global economy modifiers.
4. **Stats triple-duty:** combat math (Force/Tempo/Spite), global economy modifiers (Insight → draw, Resolve → hand size), and local cost-paying (every card has a stat-presence requirement at the location it's played).
5. **Costs may be inequalities in either direction:** ≥, ≤, =, possibly compound. Cards can require *low* stat presence as well as high.
6. **No separate resource currency.** "Lands" do not exist as a card type. Free-cost cards that print small amounts of stat fill that role.
7. **Spite is damage reduction, not Durability.** Creature Durability is a separately printed value.
8. **Scope of effects is local by default.** Card effects apply at the source's location unless the card text explicitly extends scope (`supply line`, `all your locations`, `everywhere`, etc.). Locations themselves are local-only by definition.
9. **Terrain is destructible only by rare premium effects, and only partially.** No combat or normal effect destroys location terrain. A small number of premium card effects can wipe a location's stat line and/or rules text. **Card-slot profile (the grid shape and slot counts) is never destructible** — it is structurally part of the battlefield. Terrain destruction is a designed escape valve, not the default; it produces a featureless-arena version of the location while preserving how the space is rendered.

**Why:** This collapses the entire game economy into one mental model — *what stats are present where, and how much does each side want each stat to be high or low at each place* — which does combat, deckbuilding, cost-paying, draw economy, and hand size simultaneously. It encodes the supply-line pillar mechanically (a far structure with `supply line`-scoped Insight really is feeding your draw economy) instead of treating supply lines as flavor. It rewards positional commitment, makes locations feel meaningfully different, and creates rich emergent tension: every removal makes a hole; every kill of a stat-bearing permanent damages the opponent's economy *and* opens space for them to play something bigger next round.

**Alternatives considered:**
- *Reading B (baseline-only-for-cost-paying).* Terrain enables plays but doesn't count toward global economy. Would have made cards the sole economic engine. Rejected because Reading A creates more strategic counter-play (terrain is locally dominant but only matters in encounters that include the location, so it self-limits without needing a special rule).
- *MTG-style separate resource cards.* Rejected — having both "resource cards" and "stat-printing cards" would have duplicated systems. Free-cost stat-printers do the job with a single card type.
- *Spite = +1 max Durability.* Rejected — would require every creature print at least 1 Spite or be DOA, awkward.

**Revisit when:** prototype reveals tuning issues. Likeliest pressure points: terrain stat values are too strong (because unremovable), or the inequality cost system creates unworkable card-design overhead.

## 2026-04-26 — Provisional: AI graveyard follows player rules

**Decision:** For the prototype, the AI's graveyard works the same as the player's: the graveyard is per-encounter; at encounter end, the graveyard recycles back into the AI's deck.

**Why:** Cleanest, most consistent rule. Matches the user's instinct ("AI plays the same card game"). The genuine concerns — pointless lategame turns playing weak chaff vs. AI running out of meaningful threats — are empirically answerable from a playtest, not from first principles. We don't yet know how often AI permanents die, how long encounters last, or how many cards the AI draws per overworld turn, so optimizing this rule before having a prototype would be guessing.

**Alternatives considered:**
- *Model A — Graveyard gone forever (per-run).* AI deck strictly thins across the run. "Attrition" feel. Risk: lategame AI is too weak if the player has destroyed too much.
- *Model C — Tiered graveyard.* Cheap cards die in the graveyard; designer-tagged "lategame-eligible" cards recycle. Solves both failure modes but adds tagging overhead.
- *Model D — Two-tier deck.* Structurally split: cheap finite cards used for spread, rarer recycling cards for lategame threats. Maps cleanly to the desired difficulty shape but adds deck-composition complexity.

**Revisit when:** the first playable encounter exists. Specifically, watch for: (a) does the AI play obviously junk turns? (b) does the AI run out of meaningful threats before the boss is reached? Either symptom is a signal to revisit toward Model C or D.

## 2026-04-26 — Defer JS framework choice

**Decision:** No framework chosen yet. Will revisit after a vertical-slice prototype (one card type, one player action, one AI response) is working.

**Why:** Picking a framework before we can describe one full turn of the game biases the design toward whatever the framework makes easy. Better to learn the real shape of the state model from a tiny working prototype, then choose the tool that fits.

**Alternatives considered:** Pick Svelte / React / Vue / vanilla up front. Rejected for now — premature.

## 2026-04-26 — Browser-native, DOM-rendered, static-hostable

**Decision:** The game runs entirely in the browser as static HTML/JS/CSS. Cards are rendered as DOM elements with CSS transitions and HTML5 drag-and-drop. No canvas/WebGL, no backend.

**Why:** Single-player turn-based game with no real-time pressure — DOM is more than fast enough, and DOM is dramatically easier to style, animate, and inspect than canvas. Static hosting means the game can live at a domain name with zero server cost.

**Alternatives considered:** Canvas/WebGL (overkill, harder tooling), Electron/desktop (rejected — accessibility-by-URL is a stated goal).

## 2026-04-26 — Hobby cadence, design-first

**Decision:** Document the concept in `DESIGN.md` before writing code. Keep `DECISIONS.md` as the durable memory across sessions.

**Why:** Project is a long-running hobby across many short sessions. Without written context, each session re-litigates earlier choices. The docs are the handoff between sessions.
