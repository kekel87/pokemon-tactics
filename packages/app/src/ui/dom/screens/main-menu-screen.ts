import { PlayerController } from "@pokemon-tactic/core";
import { NetworkErrorCode, Room } from "@pokemon-tactic/network";
import {
  countAction,
  countScreen,
  TelemetryAction,
  TelemetryScreen,
} from "../../../analytics/telemetry";
import {
  type BattleResumeSave,
  battleResumeStore,
  isOnlineSave,
  isResumableOnlineSave,
} from "../../../app/battle-persistence";
import type { Navigate, Screen } from "../../../app/screen-manager";
import { getLanguage, setLanguage, t } from "../../../i18n";
import { Language, type TranslationKey } from "../../../i18n/types";
import { MAPS_REGISTRY } from "../../../maps/maps-registry";
import { networkErrorCodeOf } from "../../../network/network-error";
import { holdOnlineRoom, onlineRoomDeps, releaseOnlineRoom } from "../../../network/online-room";
import { bindScreenInput, el, menuButton } from "./elements";

const VERSION_TEXT = __APP_VERSION__;

/**
 * Entry point back into a battle interrupted by a reload (plan 181) — shown only when a save exists,
 * so the menu is unchanged for a player who has no battle waiting.
 *
 * The map name is spelled out in the label: the whole point of coming back here is not remembering
 * what was going on.
 */
/**
 * Les causes d'échec de reconnexion qui rendent la sauvegarde **définitivement** inutile.
 *
 * Le reste des causes la garde, et c'est le point : un échec transitoire ne doit pas coûter la
 * partie. `salon_plein` est notre propre fantôme d'adresse — mesuré à 110 ms après un départ propre
 * et jusqu'à 99 s après un départ brutal (décision #966) —, `connexion_impossible` et
 * `delai_depasse` sont des hoquets. Toutes trois se retentent.
 *
 * Les deux ci-dessous, non :
 * - `partie_commencee` — le salon est verrouillé et notre place n'y est plus attendue : le délai de
 *   grâce est passé, l'adversaire a déjà gagné (décision #954) ;
 * - `code_introuvable` — il n'y a **personne** à cette adresse. La partie s'est terminée et l'hôte a
 *   libéré son salon avec elle.
 *
 * ⚠️ Risque résiduel assumé : si les DEUX pairs s'absentent en même temps, celui qui revient le
 * premier lit `code_introuvable` et perd sa sauvegarde alors que l'autre allait peut-être revenir. Ça
 * n'enlève rien à personne en pratique — les deux chiens de garde auront de toute façon prononcé leur
 * forfait pendant l'absence croisée, donc la partie était déjà finie.
 */
const TERMINAL_RESUME_FAILURES = new Set<NetworkErrorCode>([
  NetworkErrorCode.PartieCommencee,
  NetworkErrorCode.CodeIntrouvable,
]);

function resumeEntry(
  save: BattleResumeSave,
  navigate: Navigate,
  onNetworkFailure: (code: NetworkErrorCode) => void,
): HTMLButtonElement {
  const map = MAPS_REGISTRY.find((entry) => entry.url === save.mapUrl);
  const mapName = map?.displayName[getLanguage()];
  const label = mapName ? `${t("menu.resumeBattle")} — ${mapName}` : t("menu.resumeBattle");
  const button = menuButton(label, () => {
    // La reprise du plan 181 est-elle voulue ? Ce compteur ne dit qu'« acceptée » ; le refus se
    // déduit de l'écart avec « proposée », donc il n'a pas de compteur à lui (plan 196).
    // ⚠️ Aucun `battle_started` ici : une reprise n'ouvre pas une nouvelle partie, sinon une partie
    // reprise trois fois compterait pour quatre.
    countAction(TelemetryAction.ResumeAccepted);
    if (!isResumableOnlineSave(save)) {
      navigate("combat", { mapUrl: save.mapUrl, setup: save.setup, resume: save });
      return;
    }
    /*
     * Reprise d'une partie EN LIGNE (plan 202, étape 5) : on rappelle le salon **avant** de
     * naviguer, et c'est l'ordre qui compte.
     *
     * `holdOnlineRoom` place le salon hors des écrans, donc `wireOnlineBattle` le trouvera par
     * `getOnlineRoom()` sans changer de signature — c'est précisément pour ça que le porteur de
     * salon existe (plan 199, correctif de revue). Naviguer d'abord monterait un combat en ligne
     * sans salon, c'est-à-dire un hot-seat sur les deux camps.
     */
    /*
     * 🔴 Désarmé pendant l'attente (correctif de revue). La reconnexion prend plusieurs secondes —
     * jusqu'à 4,6 s de réessais d'annuaire, puis 10 s de poignée de main — et le bouton ne montrait
     * RIEN. Sur une fenêtre de retour de 30 s, un joueur qui ne voit rien reclique : deux
     * `Room.rejoin` concurrents réclament la même adresse, le second échoue, et `holdOnlineRoom`
     * referme le salon que le premier venait de poser.
     */
    button.disabled = true;
    button.textContent = t("menu.resumeBattle.connecting");
    void (async () => {
      try {
        /*
         * Les places qui ont le droit de nous rappeler, reconstruites depuis la sauvegarde : les
         * camps HUMAINS autres que le nôtre. Les places tenues par l'IA sont exclues — elles ne se
         * connectent jamais, leur tour se joue des deux côtés (décision #901), et les attendre
         * ferait forfaiter un adversaire qui n'existe pas.
         *
         * La place *n* est le camp d'index *n − 1* : l'invariant qui court de `room.ts` au placement.
         */
        const awaitedSeats = save.setup.teams
          .map((team, index) => ({ seat: index + 1, controller: team.controller }))
          .filter(
            (entry) =>
              entry.controller === PlayerController.Human && entry.seat !== save.setup.localSeat,
          )
          .map((entry) => entry.seat);
        const room = await Room.rejoin(
          onlineRoomDeps(),
          save.setup.roomCode,
          save.setup.localSeat,
          awaitedSeats,
        );
        holdOnlineRoom(room);
        // Le numérateur du ratio qui dira si le délai de grâce est bien réglé : beaucoup de forfaits
        // pour absence face à peu de reprises réussies veut dire qu'on coupe trop tôt (plan 202).
        countAction(TelemetryAction.ReconnectSucceeded);
      } catch (error) {
        /*
         * L'échec est un chemin NORMAL, pas un écran figé : grâce expirée, hôte parti pour de bon,
         * pare-feu.
         *
         * 🔴 **Mais on ne jette la sauvegarde que sur `partie_commencee`** (correctif de revue).
         *
         * La version d'avant la jetait sur TOUTE cause, donc un échec transitoire perdait la partie
         * pour de bon — et le transitoire est le cas le plus probable : l'annuaire de PeerJS retient
         * l'ancienne adresse (jusqu'à ~1 min observée, `backlog-delai-liberation-peerjs-cloud`) alors
         * que `claimOwnIdentity` n'insiste que 4,6 s. Un premier essai qui tape `salon_plein` doit
         * pouvoir être retenté, pas condamner la partie.
         *
         * `partie_commencee` est la seule cause qui dit « cette place ne t'attend plus » : le salon
         * verrouillé n'admet que les places dont la grâce court (décision #954), donc ce refus
         * signifie que le délai est passé. Là, garder la sauvegarde serait promettre une reprise
         * impossible.
         */
        const code = networkErrorCodeOf(error);
        if (TERMINAL_RESUME_FAILURES.has(code)) {
          battleResumeStore().clear();
        }
        countAction(TelemetryAction.ReconnectFailed);
        onNetworkFailure(code);
        return;
      } finally {
        // Réarmé quoi qu'il arrive : sur un échec retentable, le joueur doit pouvoir recliquer.
        button.disabled = false;
        button.textContent = label;
      }
      navigate("combat", { mapUrl: save.mapUrl, setup: save.setup, resume: save });
    })();
  });
  return button;
}

/**
 * DOM port of MainMenuScene: title, 5 entries (Aventure disabled) plus a 6th when a battle is waiting
 * to be resumed, version, language toggle.
 */
export function createMainMenuScreen(navigate: Navigate): Screen<"main-menu"> {
  let root: HTMLElement | null = null;
  let unbindScreenInput: (() => void) | null = null;
  /** Pourquoi la dernière tentative de reprise en ligne a échoué. `null` = rien à dire. */
  let resumeFailure: NetworkErrorCode | null = null;

  const showResumeFailure = (code: NetworkErrorCode): void => {
    resumeFailure = code;
    if (root?.parentElement) {
      render(root.parentElement);
    }
  };

  const render = (host: HTMLElement): void => {
    root?.remove();
    root = el("div", "mn-screen");

    const title = el("h1", "mn-title");
    title.textContent = "POKEMON TACTICS";

    const buttons = el("nav", "mn-buttons");
    // Read on every render (including the language toggle's re-render), so a battle abandoned from the
    // combat screen stops being offered without any cross-screen plumbing.
    const save = battleResumeStore().load();
    /*
     * Une partie en ligne SE REPREND depuis le Lot B3 (plan 202) — elle ne se reprenait pas seule
     * jusqu'ici (décision D4 du plan 201), faute de pouvoir rappeler le salon.
     *
     * Ce qui la rend reprenable est le code de salon dans la sauvegarde : sans lui il n'y a aucune
     * adresse à joindre, et rendre la main aux deux camps ferait un hot-seat déguisé. Une sauvegarde
     * en ligne SANS code n'est donc toujours pas offerte — ce qui ne peut arriver qu'à une
     * sauvegarde d'un autre schéma, que `SAVE_VERSION` jette déjà.
     */
    if (save && (!isOnlineSave(save) || isResumableOnlineSave(save))) {
      countAction(TelemetryAction.ResumeOffered);
      buttons.append(resumeEntry(save, navigate, showResumeFailure));
    }
    if (resumeFailure !== null) {
      const failure = el("p", "mn-error", "resume-error");
      /*
       * Les causes de refus du SALON ne se lisent pas pareil sur le chemin de la REPRISE (retour de
       * recette 2026-09-09). « Cette partie est complète » parle d'un salon plein — or c'est SA
       * partie, et personne ne l'a remplie : `salon_plein` veut dire ici que l'annuaire de mise en
       * relation retient encore son ancienne adresse, ce qui se règle en réessayant. Afficher le
       * message du salon envoyait le joueur chercher un problème qui n'existe pas.
       */
      failure.textContent = t(
        (resumeFailure === NetworkErrorCode.SalonPlein
          ? "menu.resumeBattle.error.addressBusy"
          : `room.error.${resumeFailure}`) as TranslationKey,
      );
      buttons.append(failure);
    }
    buttons.append(
      menuButton(t("menu.adventure")),
      menuButton(t("menu.battle"), () => navigate("battle-mode", undefined)),
      menuButton(t("menu.teamBuilder"), () => navigate("my-teams", undefined)),
      menuButton(t("menu.settings"), () => navigate("settings", undefined)),
      menuButton(t("menu.credits"), () => navigate("credits", undefined)),
    );

    const version = el("span", "mn-version", "app-version");
    version.textContent = VERSION_TEXT;

    const language = el("button", "tb-btn mn-lang", "language-toggle");
    language.type = "button";
    language.textContent = getLanguage().toUpperCase();
    language.addEventListener("click", () => {
      setLanguage(getLanguage() === Language.French ? Language.English : Language.French);
      render(host);
    });

    root.append(title, buttons, version, language);
    host.append(root);
  };

  return {
    mount(host) {
      countScreen(TelemetryScreen.MainMenu);
      /*
       * Toute retombée au menu principal met fin à une éventuelle session en ligne (plan 199).
       *
       * C'est le point de fermeture qui **couvre tous les cas** : le salon appartient à la session
       * et non à l'écran qui le crée — pour que l'accusé de lancement ait le temps de partir — et
       * `combat` ne transite que vers ici (`SCREEN_TRANSITIONS`). Quitter un combat en ligne, ou
       * l'abandonner, referme donc le canal sans que l'écran de combat ait à connaître le réseau.
       * Sans effet quand on jouait en local.
       */
      releaseOnlineRoom();
      render(host);
      // Sans « retour » (c'est le premier écran), mais les flèches doivent y naviguer comme partout.
      unbindScreenInput = bindScreenInput();
    },
    dispose() {
      unbindScreenInput?.();
      unbindScreenInput = null;
      root?.remove();
      root = null;
    },
  };
}
