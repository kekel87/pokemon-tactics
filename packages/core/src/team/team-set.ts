import type { TeamFormat } from "./team-format";
import type { TeamSlot } from "./team-slot";

export interface TeamSet {
  id: string;
  name: string;
  format?: TeamFormat;
  slots: TeamSlot[];
  createdAt: number;
  updatedAt: number;
}
