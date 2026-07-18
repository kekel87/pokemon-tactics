import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

export function handleRecoil(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Recoil }>;
  const pokemon = context.attacker;

  const ability = context.abilityRegistry?.getForPokemon(pokemon);
  if (ability?.blocksIndirectDamage || ability?.blocksRecoil) {
    return [];
  }

  // Métalaser (steel-beam): recoil is a fraction of the user's MAX HP, independent of damage dealt.
  const base = effect.ofMaxHp === true ? pokemon.maxHp : context.shared.lastDamageDealt;
  const damage = Math.max(1, Math.floor(base * effect.fraction));
  pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);

  const events: BattleEvent[] = [
    {
      type: BattleEventType.DamageDealt,
      targetId: pokemon.id,
      amount: damage,
      effectiveness: 1,
      recoil: true,
    },
  ];

  if (pokemon.currentHp <= 0) {
    events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
  }

  return events;
}
