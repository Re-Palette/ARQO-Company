import type { ActorType } from "@friday/core";

export interface Actor {
  type: ActorType;
  id: string;
}

export const CEO: Actor = { type: "ceo", id: "ceo" };
export const SYSTEM: Actor = { type: "system", id: "system" };
export const agentActor = (id: string): Actor => ({ type: "agent", id });
export const clientActor = (id: string): Actor => ({ type: "client", id });
export const actorKey = (a: Actor) => (a.type === "agent" || a.type === "client" ? `${a.type}:${a.id}` : a.type);
