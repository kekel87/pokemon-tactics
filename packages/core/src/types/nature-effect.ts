import type { StatName } from "../enums/stat-name";

export interface NatureEffect {
  boost: StatName | null;
  lowered: StatName | null;
}
