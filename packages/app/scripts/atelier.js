#!/usr/bin/env node

import { launchDevMode } from "./launch-dev-mode.js";

// Atelier des attaques (plan 233) : `pnpm dev:atelier ['{"move":"flamethrower","attacker":"charizard","target":"venusaur"}']`.
launchDevMode("VITE_ATELIER", "VITE_ATELIER_CONFIG");
