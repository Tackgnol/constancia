# Constancia

Constancia coordinates tabletop campaign preparation and live play across the GM-facing Play View, the backend, and Discord.

## Language

**Campaign**:
The game shared by a GM group and its Discord guild, with one selected Game System and campaign-owned channels, characters, Events, and journal content.
_Avoid_: Workspace, tenant

**Game System**:
The rules adapter selected by a Campaign, including its character-data schema, test configuration, system-specific pipeline blocks, and NPC system block definitions.
_Avoid_: Ruleset map, system switch

**Event**:
A prepared live-play cue whose persisted pipeline can be fired by a GM or completed with player input.
_Avoid_: Trigger, command

**Pipeline block**:
An executable step in an Event pipeline. Common pipeline blocks belong to the platform; system-specific pipeline blocks belong to a Game System.
_Avoid_: NPC block, component

**NPC system block**:
Passive, system-specific metadata attached to an NPC. It is never executed as part of an Event pipeline.
_Avoid_: Pipeline block

**Event execution**:
One idempotent backend run of an Event pipeline, including any wait for player input, but excluding Discord transport itself.
_Avoid_: Fire request, bot execution

**Execution receipt**:
The durable record of an Event execution and its current delivery state, returned for repeated requests with the same idempotency key.
_Avoid_: Fire response

**Delivery job**:
A durable request for the bot to render Event output in Discord. A failed attempt remains retryable without rerunning the Event execution.
_Avoid_: Fire-and-forget message

**Test instance**:
The Discord-facing prompt created when a test Event awaits one player's resolved score.
_Avoid_: Roll
