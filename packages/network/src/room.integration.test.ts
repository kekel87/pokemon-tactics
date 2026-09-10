import { type Action, ActionKind, Direction } from "@pokemon-tactic/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ActionMessage,
  type ForfeitMessage,
  NETWORK_VERSION,
  NetworkErrorCode,
  NetworkForfeitReason,
  type NetworkMessage,
  type NetworkRoomOptions,
  NetworkSeatOccupancy,
  type NetworkSeeds,
  type ResyncMessage,
  type StartMessage,
} from "./protocol.js";
import { Room } from "./room.js";
import { HOST_SEAT, hostPeerId, peerIdForSeat } from "./room-code.js";
import {
  BATTLE_GRACE_AFTER_SILENCE_MS,
  BATTLE_GRACE_SHORT_MS,
  GRACE_AFTER_CLEAN_CLOSE_MS,
  GRACE_AFTER_SILENCE_MS,
  HOST_REDIAL_INTERVAL_MS,
  LAUNCH_ACK_TIMEOUT_MS,
} from "./room-config.js";
import { type RoomDeps, RoomRole } from "./room-types.js";
import { FakeNetworkDirectory } from "./testing/fake-transport.js";
import type { NetworkChannel, NetworkTransport } from "./transport.js";
import {
  ChannelHealth,
  CLAIM_RETRY_DELAYS_MS,
  NetworkTransportError,
  REJOIN_RETRY_DELAYS_MS,
} from "./transport.js";

/**
 * Tests d'intégration du salon (plan 199, étape 3) : plusieurs salons dans le **même processus**, par
 * le canal en mémoire. Aucun réseau, aucun service tiers — donc rien qui rende le gate rouge le jour
 * où Internet tombe.
 */

const ROOM_CODE = "A7K2M";
const MAX_SEATS = 12;

const SEEDS: NetworkSeeds = { battle: 11, placement: 22, ai: 33 };
/**
 * Identifiant de partie du `start` (plan 204). Le paquet le transporte sans le lire, donc une
 * valeur figée suffit — sauf là où un test vérifie justement qu'il arrive intact chez l'invité.
 */
const BATTLE_ID = "b47f2c19";

function options(teamCount: number): NetworkRoomOptions {
  return { mapId: "plaine", teamCount, autoPlacement: true, damagePreview: false };
}

/** Laisse passer les micro-tâches : le canal factice livre en asynchrone, comme le vrai. */
async function flush(): Promise<void> {
  for (let hop = 0; hop < 20; hop += 1) {
    await Promise.resolve();
  }
}

function depsFor(directory: FakeNetworkDirectory): RoomDeps {
  return {
    transport: directory.createTransport(),
    maxSeats: MAX_SEATS,
    // Pas d'attente réelle sur les réessais de prise d'identifiant.
    sleep: async () => {
      /* aucune attente réelle en test */
    },
    generateCode: () => ROOM_CODE,
  };
}

/**
 * Un pair « nu » : un canal vers l'hôte, sans salon derrière. Sert à jouer ce qu'un `Room` ne sait
 * pas faire — se taire au lieu d'accuser, annoncer une mauvaise version.
 */
/**
 * Pousser un état de santé sur un canal factice.
 *
 * `NetworkChannel` ne l'expose pas, et ne doit pas : c'est le contrat de production, il n'a aucune
 * raison de porter une affordance de test. Le double, lui, en a une (`pushHealth`) parce qu'il n'y a
 * pas d'ICE derrière un canal en mémoire. Le transtypage est donc une frontière assumée, restreinte
 * au seul membre qu'on emprunte — et non un `as FakeChannel` qui ouvrirait tout le double.
 */
interface HealthPushable {
  pushHealth(health: ChannelHealth): void;
}

function asFake(channel: NetworkChannel): HealthPushable {
  return channel as unknown as HealthPushable;
}

async function rawGuest(
  directory: FakeNetworkDirectory,
  seat: number,
  networkVersion = NETWORK_VERSION,
): Promise<{ channel: NetworkChannel; received: NetworkMessage[]; transport: NetworkTransport }> {
  const transport = directory.createTransport();
  await transport.claim(peerIdForSeat(ROOM_CODE, seat));
  const channel = await transport.connect(hostPeerId(ROOM_CODE));
  const received: NetworkMessage[] = [];
  channel.onMessage((message) => received.push(message));
  channel.send({ type: "hello", networkVersion, seat });
  await flush();
  return { channel, received, transport };
}

describe("Room — création et arrivée", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
  });

  it("fait de l'hôte la place 1, et annonce les autres comme LIBRES", async () => {
    const host = await Room.create(depsFor(directory), options(2));

    expect(host.role).toBe(RoomRole.Host);
    expect(host.seat).toBe(HOST_SEAT);
    expect(host.code).toBe(ROOM_CODE);
    // Libre et non « IA » : un salon en ligne ne doit pas ressembler à une partie solo. Prête
    // d'office quand même — personne n'y est, donc aucune confirmation à attendre.
    expect(host.view.seats).toEqual([
      { seat: 1, occupancy: NetworkSeatOccupancy.Human, ready: false },
      { seat: 2, occupancy: NetworkSeatOccupancy.Waiting, ready: true },
    ]);
  });

  it("réessaie sa propre place quand l'annuaire retient encore l'ancienne adresse", async () => {
    // Ce que fait l'annuaire réel pendant quelques secondes après une coupure.
    directory.linger(hostPeerId(ROOM_CODE));
    const deps = depsFor(directory);
    let slept = 0;
    const create = Room.create(
      {
        ...deps,
        sleep: async () => {
          slept += 1;
          if (slept === 1) {
            directory.release(hostPeerId(ROOM_CODE));
          }
        },
      },
      options(2),
    );

    await expect(create).resolves.toBeInstanceOf(Room);
    expect(slept).toBe(1);
  });

  it("laisse l'invité prendre la première place libre et la fait voir à tout le monde", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    expect(guest.seat).toBe(2);
    expect(guest.role).toBe(RoomRole.Guest);
    // L'hôte fait autorité : sa vue nomme la place 2 « distante », plus « IA ».
    expect(host.view.seats[1]).toEqual({
      seat: 2,
      occupancy: NetworkSeatOccupancy.Remote,
      ready: false,
    });
    // Et l'invité a reçu l'état, donc le format et la carte de l'hôte.
    expect(guest.view.options).toEqual(options(2));
    expect(guest.view.seats).toHaveLength(2);
  });

  it("alloue des places distinctes à deux arrivants — le refus de l'annuaire suffit", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const [first, second] = await Promise.all([
      Room.join(depsFor(directory), ROOM_CODE),
      Room.join(depsFor(directory), ROOM_CODE),
    ]);
    await flush();

    expect(new Set([first.seat, second.seat])).toEqual(new Set([2, 3]));
    expect(
      host.view.seats.filter((seat) => seat.occupancy === NetworkSeatOccupancy.Remote),
    ).toHaveLength(2);
  });

  it("maille les arrivants entre eux, pas seulement vers l'hôte", async () => {
    await Room.create(depsFor(directory), options(4));
    const first = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    const second = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    // Le second a joint le premier : son « prêt » lui parvient sans passer par l'hôte, ce qui est
    // ce qui fait qu'un hôte parti n'emporte pas les connexions des autres entre eux.
    second.setReady(true);
    await flush();
    expect(first.view.seats.find((seat) => seat.seat === second.seat)?.ready).toBe(true);
  });

  it("refuse une place au-delà du format — c'est l'hôte qui décide, lui seul connaît son format", async () => {
    await Room.create(depsFor(directory), options(2));
    // La place 2 prise par un premier invité, un second balaie jusqu'à 3 : hors format.
    await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const late = await rawGuest(directory, 3);
    expect(late.received.at(-1)).toMatchObject({ type: "welcome" });
    // Le `welcome` part quand même — il porte la version, seul moyen de distinguer les refus — puis
    // le canal se referme.
    let closed = false;
    late.channel.onClose(() => {
      closed = true;
    });
    await flush();
    expect(closed || late.received.length > 0).toBe(true);
  });

  it("refuse une version incompatible, en ayant d'abord dit laquelle il parle", async () => {
    await Room.create(depsFor(directory), options(2));
    const stranger = await rawGuest(directory, 2, NETWORK_VERSION + 1);

    const welcome = stranger.received.find((message) => message.type === "welcome");
    expect(welcome).toMatchObject({ networkVersion: NETWORK_VERSION });
  });

  it("dit « salon plein » quand aucune place n'est libre", async () => {
    await Room.create(depsFor(directory), options(2));
    // Toutes les adresses du balayage sont prises par des pairs nus.
    for (let seat = HOST_SEAT + 1; seat <= MAX_SEATS; seat += 1) {
      const transport = directory.createTransport();
      await transport.claim(peerIdForSeat(ROOM_CODE, seat));
    }

    await expect(Room.join(depsFor(directory), ROOM_CODE)).rejects.toMatchObject({
      code: NetworkErrorCode.SalonPlein,
    });
  });

  it("dit « code introuvable » quand personne n'est à cette adresse", async () => {
    await expect(Room.join(depsFor(directory), ROOM_CODE)).rejects.toBeInstanceOf(
      NetworkTransportError,
    );
  });
});

describe("Room — un pair ne parle que pour lui-même", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Relevé en revue de code : le salon lisait la place ANNONCÉE par le message au lieu de celle
  // dérivée de l'adresse d'annuaire. L'adresse est fiable (la prise d'identifiant est exclusive) ;
  // ce que le message raconte ne vaut rien.

  it("refuse une équipe posée au nom d'un autre — l'attaque la plus simple, et silencieuse", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    const liar = await rawGuest(directory, 2);
    await flush();

    // L'invité prétend composer l'équipe de l'HÔTE.
    liar.channel.send({
      type: "team_select",
      seat: 1,
      selection: { pokemonDefinitionIds: ["magikarp"] },
    });
    await flush();

    const starts: StartMessage[] = [];
    host.onStart((start) => starts.push(start));
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    vi.advanceTimersByTime(LAUNCH_ACK_TIMEOUT_MS);
    await flush();
    await launch;

    // L'hôte serait entré en combat avec Magikarp, son écran ayant affiché Florizarre jusqu'au bout.
    expect(host.view.seats).toHaveLength(2);
    const hostSeat = [...(starts[0]?.seats ?? [])].find((seat) => seat.seat === 1);
    expect(hostSeat?.selection.pokemonDefinitionIds ?? ["venusaur"]).toEqual(["venusaur"]);
  });

  it("refuse un accusé de lancement donné au nom d'un autre", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    // Deux pairs nus : aucun n'accuse de lui-même. C'est le cas que l'accusé existe pour attraper.
    await rawGuest(directory, 2);
    const liar = await rawGuest(directory, 3);
    await flush();

    const starts: StartMessage[] = [];
    host.onStart((start) => starts.push(start));
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();

    // Le menteur accuse pour LUI (légitime) et pour la place 2 (usurpé).
    liar.channel.send({ type: "start_ack", seat: 3 });
    liar.channel.send({ type: "start_ack", seat: 2 });
    await flush();

    // La place 2 n'a jamais accusé par son propre canal : le lancement doit être annulé.
    vi.advanceTimersByTime(LAUNCH_ACK_TIMEOUT_MS);
    await flush();
    await launch;

    expect(starts).toEqual([]);
    expect(host.view.locked).toBe(false);
  });

  it("refuse un état de salon qui ne vient pas de l'hôte", async () => {
    await Room.create(depsFor(directory), options(4));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const optionsBefore = guest.view.options;
    // Un pair du maillage joint l'invité directement et tente de lui réécrire son salon.
    const meshTransport = directory.createTransport();
    await meshTransport.claim(peerIdForSeat(ROOM_CODE, 4));
    const meshChannel = await meshTransport.connect(peerIdForSeat(ROOM_CODE, guest.seat));
    meshChannel.send({
      type: "room_state",
      options: { mapId: "faux", teamCount: 12, autoPlacement: false, damagePreview: true },
      seats: [],
      locked: true,
    });
    await flush();

    expect(guest.view.options).toEqual(optionsBefore);
    expect(guest.view.locked).toBe(false);
  });

  it("refuse un `bye` au nom d'un autre, qui raccourcirait son délai de grâce", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const silent = await rawGuest(directory, 2);
    const liar = await rawGuest(directory, 3);
    await flush();

    // Le menteur annonce le départ de la place 2, puis celle-ci se tait sans rien dire.
    liar.channel.send({ type: "bye", seat: 2 });
    await flush();
    silent.channel.close();
    await flush();

    // Le silence doit valoir 45 s, pas les 10 s d'un départ annoncé.
    expect(host.view.awaited).toEqual([{ seat: 2, cleanClose: false }]);
    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);
  });
});

describe("Room — rejoindre une partie déjà lancée", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
  });

  // Relevé en revue de code : `waitForWelcome` n'écoutait pas la fermeture, donc l'arrivant attendait
  // le délai de garde en entier — dix secondes d'écran muet — pour finir sur « plus de réponse ».
  it("dit « partie déjà commencée » tout de suite, sans attendre le délai de garde", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    guest.setReady(true);
    await flush();
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;
    expect(host.view.locked).toBe(true);

    const late = Room.join(depsFor(directory), ROOM_CODE);
    const outcome = late.then(
      () => "entré",
      (error: unknown) => (error as { code?: string }).code,
    );
    await flush();

    await expect(outcome).resolves.toBe(NetworkErrorCode.PartieCommencee);
  });
});

describe("Room — paramètres de partie", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
  });

  it("laisse l'hôte changer un paramètre, et le fait suivre chez l'invité", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    host.setOptions({ damagePreview: true });
    await flush();

    expect(guest.view.options.damagePreview).toBe(true);
  });

  it("gèle les paramètres quand l'HÔTE se déclare prêt — pas quand un invité le fait", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    // Le « prêt » d'un invité ne retire rien à l'hôte : ce n'est pas sa décision.
    guest.setReady(true);
    await flush();
    host.setOptions({ damagePreview: true });
    await flush();
    expect(host.view.options.damagePreview).toBe(true);
    expect(guest.view.options.damagePreview).toBe(true);

    // Sa propre confirmation, en revanche, l'engage : on ne change plus la règle après.
    host.setReady(true);
    await flush();
    host.setOptions({ damagePreview: false });
    await flush();
    expect(host.view.options.damagePreview).toBe(true);

    // Et le gel est réversible — « Pas prêt » lui rend la main.
    host.setReady(false);
    await flush();
    host.setOptions({ damagePreview: false });
    await flush();
    expect(host.view.options.damagePreview).toBe(false);
    expect(guest.view.options.damagePreview).toBe(false);
  });

  it("refuse à l'invité de changer les paramètres", async () => {
    await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    expect(() => guest.setOptions({ damagePreview: true })).toThrow();
  });

  it("laisse l'hôte basculer une ligne libre en IA, et la marque prête d'office", async () => {
    const host = await Room.create(depsFor(directory), options(4));

    host.setSeatOccupancy(3, NetworkSeatOccupancy.Ai);
    expect(host.view.seats[2]).toEqual({
      seat: 3,
      occupancy: NetworkSeatOccupancy.Ai,
      ready: true,
    });

    // Et le retour : la place se rouvre à un joueur, toujours prête d'office puisque personne n'y est.
    host.setSeatOccupancy(3, NetworkSeatOccupancy.Waiting);
    expect(host.view.seats[2]).toEqual({
      seat: 3,
      occupancy: NetworkSeatOccupancy.Waiting,
      ready: true,
    });
  });

  it("refuse de poser « humain » sur une place que personne ne tient — c'était une impasse", async () => {
    const host = await Room.create(depsFor(directory), options(4));

    /*
     * `Human` posait `ready: false` pour une confirmation que personne ne pouvait donner : « Lancer »
     * restait mort, et l'écran ne rendait plus la main sur cette ligne. Le salon n'avait plus d'issue
     * que d'être quitté. La place reste donc libre, et libre veut déjà dire « j'attends un joueur ».
     */
    host.setSeatOccupancy(3, NetworkSeatOccupancy.Human);
    expect(host.view.seats[2]).toEqual({
      seat: 3,
      occupancy: NetworkSeatOccupancy.Waiting,
      ready: true,
    });
    expect(host.view.seats.every((seat) => seat.ready || seat.seat === HOST_SEAT)).toBe(true);
  });

  it("ne bascule pas une place tenue par un joueur distant sous ses pieds", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    host.setSeatOccupancy(2, NetworkSeatOccupancy.Ai);
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);
  });
});

describe("Room — départs", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("n'agit sur aucun départ avant la fin du délai de grâce", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    guest.leave();
    await flush();

    // Le pair s'est annoncé partant : la place est « attendue », pas encore rendue.
    expect(host.view.awaited).toEqual([{ seat: 2, cleanClose: true }]);
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);

    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS - 1);
    await flush();
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);
  });

  it("libère la place au bout du délai court quand le départ était propre", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    guest.leave();
    await flush();
    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();

    // Libre plutôt qu'IA : l'hôte voit qu'elle peut réaccueillir quelqu'un. Prête d'office, sinon
    // l'absence du partant bloquerait le lancement pour toujours.
    expect(host.view.seats[1]).toEqual({
      seat: 2,
      occupancy: NetworkSeatOccupancy.Waiting,
      ready: true,
    });
    expect(host.view.awaited).toEqual([]);
  });

  it("attend le délai long quand le pair s'est tu sans prévenir", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const silent = await rawGuest(directory, 2);
    await flush();

    // Fermeture sans `bye` : c'est le téléphone dont l'écran se verrouille.
    silent.channel.close();
    await flush();
    expect(host.view.awaited).toEqual([{ seat: 2, cleanClose: false }]);

    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);

    vi.advanceTimersByTime(GRACE_AFTER_SILENCE_MS - GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Waiting);
  });

  it("annule le délai si le pair revient avant la fin — un silence n'est pas un départ", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const silent = await rawGuest(directory, 2);
    await flush();

    silent.channel.close();
    silent.transport.destroy();
    await flush();
    vi.advanceTimersByTime(GRACE_AFTER_SILENCE_MS / 2);

    // Il réclame la même place, à une adresse que tout le monde connaît déjà.
    await rawGuest(directory, 2);
    await flush();
    expect(host.view.awaited).toEqual([]);

    vi.advanceTimersByTime(GRACE_AFTER_SILENCE_MS);
    await flush();
    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);
  });

  it("ramène l'invité à l'écran de départ quand l'hôte ne revient pas", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const errors: NetworkErrorCode[] = [];
    guest.onError((code) => errors.push(code));

    host.leave();
    await flush();
    // Rien tout de suite : l'hôte est **forcément** allé coller son code ailleurs, c'est dans le flux.
    expect(errors).toEqual([]);

    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();
    expect(errors).toEqual([NetworkErrorCode.CodeIntrouvable]);
  });
});

describe("Room — lancement", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
  });

  it("grave la partie et fait entrer les deux camps avec le même setup", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    guest.setSeatSelection(2, { pokemonDefinitionIds: ["charizard"] });
    guest.setReady(true);
    await flush();

    const hostStarts: StartMessage[] = [];
    const guestStarts: StartMessage[] = [];
    host.onStart((start) => hostStarts.push(start));
    guest.onStart((start) => guestStarts.push(start));

    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;

    expect(guestStarts).toHaveLength(1);
    expect(hostStarts).toHaveLength(1);
    // Le même setup des deux côtés : c'est toute la raison d'être du lot.
    expect(guestStarts[0]).toEqual(hostStarts[0]);
    // Les trois graines, sans lesquelles deux pairs auraient deux plateaux avant le premier tour.
    expect(hostStarts[0]?.seeds).toEqual(SEEDS);
    expect(hostStarts[0]?.seats).toEqual([
      { seat: 1, controller: "human", selection: { pokemonDefinitionIds: ["venusaur"] } },
      { seat: 2, controller: "human", selection: { pokemonDefinitionIds: ["charizard"] } },
    ]);
    // L'identifiant **stable** de carte, jamais une URL : une URL dépend de la base de déploiement.
    expect(hostStarts[0]?.options.mapId).toBe("plaine");
    // 🔴 L'identifiant de partie de l'hôte arrive INTACT chez l'invité (plan 204). C'est lui qui
    // fait que les deux pairs déclarent la même partie à la télémétrie au lieu de deux.
    expect(guestStarts[0]?.battleId).toBe(BATTLE_ID);
    expect(hostStarts[0]?.battleId).toBe(BATTLE_ID);
  });

  it("laisse l'hôte composer les équipes de ses lignes IA, et refuse celles des autres", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    guest.setSeatSelection(2, { pokemonDefinitionIds: ["charizard"] });
    guest.setReady(true);
    await flush();

    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    host.setSeatSelection(3, { pokemonDefinitionIds: ["blastoise"] });
    // La place 2 est tenue par un joueur distant : elle ne se compose pas d'ici.
    host.setSeatSelection(2, { pokemonDefinitionIds: ["pikachu"] });

    const starts: StartMessage[] = [];
    host.onStart((start) => starts.push(start));
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;

    expect(starts[0]?.seats.map((seat) => seat.selection.pokemonDefinitionIds)).toEqual([
      ["venusaur"],
      ["charizard"],
      ["blastoise"],
      [],
    ]);
  });

  it("verrouille le salon dès « Lancer » — plus aucune connexion acceptée", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    guest.setReady(true);
    await flush();

    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;

    expect(host.view.locked).toBe(true);
    const late = await rawGuest(directory, 3);
    await flush();
    // Le canal est refermé sans même un `welcome` : le salon n'existe plus pour les arrivants.
    expect(late.received).toEqual([]);
  });

  it("part en combat sans attendre personne quand toutes les autres places sont des IA", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const starts: StartMessage[] = [];
    host.onStart((start) => starts.push(start));

    await host.launch(SEEDS, BATTLE_ID);

    expect(starts).toHaveLength(1);
    expect(starts[0]?.seats.map((seat) => seat.controller)).toEqual(["human", "ai", "ai", "ai"]);
  });

  it("compose une place IA en « ai » et un joueur distant en « human »", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    guest.setReady(true);
    await flush();

    const starts: StartMessage[] = [];
    host.onStart((start) => starts.push(start));
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;

    expect(starts[0]?.seats.map((seat) => seat.controller)).toEqual(["human", "human", "ai", "ai"]);
  });
});

describe("Room — lancement annulé", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("annule quand un accusé manque, plutôt que de laisser un pair attendre un tour qui ne viendra jamais", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    // Un pair nu : il reçoit le `start` et **n'accuse pas**. C'est exactement le cas que l'accusé
    // existe pour attraper.
    const mute = await rawGuest(directory, 2);
    await flush();

    const starts: StartMessage[] = [];
    const errors: NetworkErrorCode[] = [];
    host.onStart((start) => starts.push(start));
    host.onError((code) => errors.push(code));

    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    expect(host.view.locked).toBe(true);
    expect(mute.received.some((message) => message.type === "start")).toBe(true);

    vi.advanceTimersByTime(LAUNCH_ACK_TIMEOUT_MS);
    await flush();
    await launch;

    // L'hôte n'est pas parti en combat, et il le dit.
    expect(starts).toEqual([]);
    expect(errors).toEqual([NetworkErrorCode.DelaiDepasse]);
    // Le salon est déverrouillé : c'est **le** message d'annulation du protocole.
    expect(host.view.locked).toBe(false);
    expect(mute.received.at(-1)).toMatchObject({ type: "room_state", locked: false });
  });

  it("abandonne dès la fermeture d'un pair attendu, sans laisser courir les 15 secondes", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const mute = await rawGuest(directory, 2);
    await flush();

    const errors: NetworkErrorCode[] = [];
    host.onError((code) => errors.push(code));

    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    expect(host.view.locked).toBe(true);

    // Le pair se referme : son accusé n'arrivera jamais, et on le sait déjà. Aucun temps n'avance
    // ici — c'est tout l'objet du test, l'annulation ne doit rien devoir au minuteur.
    mute.transport.destroy();
    await flush();
    await launch;

    expect(errors).toEqual([NetworkErrorCode.DelaiDepasse]);
    expect(host.view.locked).toBe(false);
  });

  it("solde le lancement quand l'hôte quitte pendant l'attente, au lieu d'une promesse éternelle", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    await rawGuest(directory, 2);
    await flush();

    const starts: StartMessage[] = [];
    const errors: NetworkErrorCode[] = [];
    host.onStart((start) => starts.push(start));
    host.onError((code) => errors.push(code));

    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();

    /*
     * `leave()` coupe le minuteur d'accusé. Sans solder la promesse, elle n'avait plus **aucun**
     * dénouement : `launch()` restait suspendue pour toujours, retenant le salon avec elle.
     */
    host.leave();
    await flush();
    await launch;

    // Ni entrée en combat, ni salon rouvert : il n'y a plus de salon à rouvrir.
    expect(starts).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("rappelle l'invité déjà parti en combat, faute de troisième message dans le protocole", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    // Une seconde place distante qui, elle, n'accusera jamais.
    await rawGuest(directory, 3);
    await flush();

    const cancelled: true[] = [];
    const guestStarts: StartMessage[] = [];
    guest.onLaunchCancelled(() => cancelled.push(true));
    guest.onStart((start) => guestStarts.push(start));

    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    // L'invité est bien parti en combat : il n'a aucun moyen de savoir où en sont les autres.
    expect(guestStarts).toHaveLength(1);

    vi.advanceTimersByTime(LAUNCH_ACK_TIMEOUT_MS);
    await flush();
    await launch;

    expect(cancelled).toEqual([true]);
  });
});

describe("Room — les actions de combat (Lot B2)", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const endTurn = (pokemonId: string): Action => ({
    kind: ActionKind.EndTurn,
    pokemonId,
    direction: Direction.North,
  });

  it("porte l'action d'un camp jusqu'à l'autre, avec son index", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const received: ActionMessage[] = [];
    guest.onAction((message) => received.push(message));

    host.sendAction(0, endTurn("p1-venusaur"));
    await flush();

    expect(received).toHaveLength(1);
    expect(received[0]?.seat).toBe(HOST_SEAT);
    expect(received[0]?.actionIndex).toBe(0);
    expect(received[0]?.action).toEqual(endTurn("p1-venusaur"));
  });

  it("porte les actions dans les deux sens — personne n'arbitre le combat", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const atHost: ActionMessage[] = [];
    host.onAction((message) => atHost.push(message));

    guest.sendAction(1, endTurn("p2-charizard"));
    await flush();

    expect(atHost).toHaveLength(1);
    expect(atHost[0]?.seat).toBe(2);
    expect(atHost[0]?.actionIndex).toBe(1);
  });

  // Même famille que l'équipe posée au nom d'un autre, avec un enjeu plus gros : sans la
  // confrontation de `isSpokenFor`, un pair jouerait le tour d'un camp qui n'est pas le sien.
  it("ignore une action posée au nom d'un autre camp", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    await rawGuest(directory, 2);
    const liar = await rawGuest(directory, 3);
    await flush();

    const atHost: ActionMessage[] = [];
    host.onAction((message) => atHost.push(message));

    liar.channel.send({
      type: "action",
      seat: 2,
      actionIndex: 0,
      action: endTurn("p2-charizard"),
    });
    await flush();

    expect(atHost).toEqual([]);
  });

  // 🔴 Le message tronqué qui tuait le salon : `isNetworkMessage` ne validait que l'enveloppe, donc
  // le contenu absent partait jusqu'au consommateur et l'exception remontait d'un rappel `onMessage`.
  it("ignore un message d'action tronqué, sans tomber", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const liar = await rawGuest(directory, 2);
    await flush();

    const atHost: ActionMessage[] = [];
    host.onAction((message) => atHost.push(message));

    liar.channel.send({ type: "action" } as unknown as NetworkMessage);
    liar.channel.send({ type: "action", seat: 2 } as unknown as NetworkMessage);
    liar.channel.send({
      type: "action",
      seat: 2,
      actionIndex: 0,
      action: { kind: "use_move", pokemonId: "p2-charizard" },
    } as unknown as NetworkMessage);
    await flush();

    expect(atHost).toEqual([]);
    expect(host.view.seats).toHaveLength(2);
  });

  // L'intéressé doit savoir qu'il est éliminé, et pourquoi : sans ce message il jouerait seul dans
  // le vide jusqu'au chien de garde du Lot B3.
  it("dit au camp éliminé qu'il l'est, et pourquoi", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const atGuest: ForfeitMessage[] = [];
    guest.onForfeit((message) => atGuest.push(message));

    host.sendForfeit(2, NetworkForfeitReason.EtatDivergent);
    await flush();

    expect(atGuest).toEqual([
      {
        type: "forfeit",
        seat: HOST_SEAT,
        forfeitedSeat: 2,
        reason: NetworkForfeitReason.EtatDivergent,
      },
    ]);
  });

  // À plusieurs, les camps qui restent doivent savoir POURQUOI un joueur disparaît de la partie.
  it("prévient aussi les camps tiers, pas seulement l'intéressé", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    const second = await Room.join(depsFor(directory), ROOM_CODE);
    const third = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const atThird: ForfeitMessage[] = [];
    third.onForfeit((message) => atThird.push(message));

    host.sendForfeit(second.seat, NetworkForfeitReason.EtatDivergent);
    await flush();

    expect(atThird).toHaveLength(1);
    expect(atThird[0]?.forfeitedSeat).toBe(second.seat);
    expect(atThird[0]?.reason).toBe(NetworkForfeitReason.EtatDivergent);
  });

  it("ignore un constat signé au nom d'un autre camp", async () => {
    const host = await Room.create(depsFor(directory), options(4));
    await rawGuest(directory, 2);
    const liar = await rawGuest(directory, 3);
    await flush();

    const atHost: ForfeitMessage[] = [];
    host.onForfeit((message) => atHost.push(message));

    liar.channel.send({ type: "forfeit", seat: 2, forfeitedSeat: 1, reason: "diverged" });
    await flush();

    expect(atHost).toEqual([]);
  });

  /*
   * 🔴 Le bug le plus vicieux du lot, et il ne demandait AUCUNE malveillance.
   *
   * Les deux pairs n'entrent pas en combat au même instant : l'écran charge sa carte et ses atlas.
   * Le salon, lui, reçoit déjà. Une action arrivée avant que l'écran ne branche son écouteur était
   * jetée en silence — puis l'index du pair lent restait en retard d'un cran à chaque action, donc
   * trois refus `desynced_index` et il éliminait un joueur parfaitement honnête.
   */
  it("garde une action reçue avant que personne n'écoute, et la livre au premier abonné", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    host.sendAction(0, endTurn("p1-venusaur"));
    host.sendAction(1, endTurn("p1-venusaur"));
    await flush();

    const received: ActionMessage[] = [];
    guest.onAction((message) => received.push(message));

    expect(received.map((message) => message.actionIndex)).toEqual([0, 1]);
  });

  it("ne livre les actions gardées qu'une fois", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    host.sendAction(0, endTurn("p1-venusaur"));
    await flush();

    const premier: ActionMessage[] = [];
    const second: ActionMessage[] = [];
    guest.onAction((message) => premier.push(message));
    guest.onAction((message) => second.push(message));

    expect(premier).toHaveLength(1);
    expect(second).toEqual([]);
  });

  it("livre normalement dès qu'un écouteur existe, sans passer par le tampon", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const received: ActionMessage[] = [];
    guest.onAction((message) => received.push(message));
    host.sendAction(0, endTurn("p1-venusaur"));
    await flush();

    expect(received).toHaveLength(1);
  });

  it("rend une fonction de désinscription, comme les autres écouteurs", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();

    const received: ActionMessage[] = [];
    const unsubscribe = guest.onAction((message) => received.push(message));
    unsubscribe();

    host.sendAction(0, endTurn("p1-venusaur"));
    await flush();

    expect(received).toEqual([]);
  });
});

describe("Room — départs une fois la partie lancée (Lot B3)", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function launchedWithRawGuest(): Promise<{
    host: Room;
    guest: Awaited<ReturnType<typeof rawGuest>>;
  }> {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await rawGuest(directory, 2);
    guest.channel.send({
      type: "team_select",
      seat: 2,
      selection: { pokemonDefinitionIds: ["charizard"] },
    });
    guest.channel.send({ type: "ready", seat: 2, ready: true });
    await flush();
    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    guest.channel.send({ type: "start_ack", seat: 2 });
    await flush();
    await launch;
    return { host, guest };
  }

  it("attend la marge complète avant de déclarer un silence absent", async () => {
    const { host, guest } = await launchedWithRawGuest();
    const absent: number[] = [];
    host.onPeerAbsent((seat) => absent.push(seat));

    guest.channel.close();
    guest.transport.destroy();
    await flush();
    vi.advanceTimersByTime(BATTLE_GRACE_AFTER_SILENCE_MS - 1);
    await flush();
    expect(absent).toEqual([]);

    vi.advanceTimersByTime(1);
    await flush();
    expect(absent).toEqual([2]);
  });

  it("attend plus longtemps qu'un salon — 45 s tomberait sur l'expiration d'un chrono honnête", async () => {
    const { host, guest } = await launchedWithRawGuest();
    const absent: number[] = [];
    host.onPeerAbsent((seat) => absent.push(seat));

    guest.channel.close();
    guest.transport.destroy();
    await flush();
    vi.advanceTimersByTime(GRACE_AFTER_SILENCE_MS);
    await flush();

    expect(absent).toEqual([]);
  });

  it("ne rend pas la place libre en combat — le camp perd ses tours, il ne s'efface pas", async () => {
    const { host, guest } = await launchedWithRawGuest();
    host.onPeerAbsent(() => undefined);

    guest.channel.close();
    guest.transport.destroy();
    await flush();
    vi.advanceTimersByTime(BATTLE_GRACE_AFTER_SILENCE_MS);
    await flush();

    expect(host.view.seats[1]?.occupancy).toBe(NetworkSeatOccupancy.Remote);
  });

  it("raccourcit le délai à la deuxième chute de la même place", async () => {
    const { host, guest } = await launchedWithRawGuest();
    const absent: number[] = [];
    host.onPeerAbsent((seat) => absent.push(seat));

    guest.channel.close();
    guest.transport.destroy();
    await flush();
    vi.advanceTimersByTime(BATTLE_GRACE_AFTER_SILENCE_MS - 1);
    await flush();

    const returning = await rawGuest(directory, 2);
    await flush();
    expect(host.view.awaited).toEqual([]);

    returning.channel.close();
    returning.transport.destroy();
    await flush();
    vi.advanceTimersByTime(BATTLE_GRACE_SHORT_MS);
    await flush();

    expect(absent).toEqual([2]);
  });

  it("laisse 30 s au revenant après une fermeture d'onglet, pas les 10 s du salon", async () => {
    const { host, guest } = await launchedWithRawGuest();
    const absent: number[] = [];
    host.onPeerAbsent((seat) => absent.push(seat));

    guest.channel.send({ type: "bye", seat: 2 });
    await flush();
    guest.channel.close();
    guest.transport.destroy();
    await flush();

    // Le délai du SALON ne s'applique plus en combat : fermer sa fenêtre n'y est pas une déclaration
    // d'abandon — le menu l'est (révision de recette 2026-09-09).
    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();
    expect(absent).toEqual([]);

    vi.advanceTimersByTime(BATTLE_GRACE_SHORT_MS - GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();
    expect(absent).toEqual([2]);
  });
});

describe("Room — reconnexion et rattrapage (Lot B3)", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function launchedPair(): Promise<{ host: Room; guest: Room }> {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    guest.setSeatSelection(2, { pokemonDefinitionIds: ["charizard"] });
    guest.setReady(true);
    await flush();
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;
    return { host, guest };
  }

  const endTurn = (pokemonId: string): Action => ({
    kind: ActionKind.EndTurn,
    pokemonId,
    direction: Direction.North,
  });

  it("laisse revenir la place attendue, et refuse toutes les autres", async () => {
    const { guest } = await launchedPair();
    guest.leave();
    await flush();

    const returning = await Room.rejoin(depsFor(directory), ROOM_CODE, 2, [HOST_SEAT]);
    await flush();

    expect(returning.seat).toBe(2);
    expect(returning.view.locked).toBe(true);
    // La place 3 n'est attendue par personne : le salon reste fermé pour elle.
    await expect(Room.join(depsFor(directory), ROOM_CODE)).rejects.toMatchObject({
      code: NetworkErrorCode.PartieCommencee,
    });
  });

  it("annonce le retour à ceux qui l'attendaient", async () => {
    const { host, guest } = await launchedPair();
    const returned: number[] = [];
    host.onPeerReturned((seat) => returned.push(seat));

    guest.leave();
    await flush();
    await Room.rejoin(depsFor(directory), ROOM_CODE, 2);
    await flush();

    expect(returned).toEqual([2]);
  });

  it("porte la queue du journal au revenant, et rien de plus", async () => {
    const { host, guest } = await launchedPair();
    guest.leave();
    await flush();
    const returning = await Room.rejoin(depsFor(directory), ROOM_CODE, 2, [HOST_SEAT]);
    await flush();

    const requests: number[] = [];
    host.onResyncRequest((message) => {
      requests.push(message.actionIndex);
      host.sendResync(message.actionIndex, [endTurn("p1-venusaur"), endTurn("p2-charizard")]);
    });
    const received: ResyncMessage[] = [];
    returning.onResync((message) => received.push(message));

    returning.sendResyncRequest(3);
    await flush();

    expect(requests).toEqual([3]);
    expect(received).toHaveLength(1);
    expect(received[0]?.fromIndex).toBe(3);
    expect(received[0]?.actions).toHaveLength(2);
  });

  it("garde le rattrapage arrivé avant que le combat n'écoute", async () => {
    const { host, guest } = await launchedPair();
    guest.leave();
    await flush();
    const returning = await Room.rejoin(depsFor(directory), ROOM_CODE, 2, [HOST_SEAT]);
    await flush();

    host.sendResync(0, [endTurn("p1-venusaur")]);
    await flush();

    const received: ResyncMessage[] = [];
    returning.onResync((message) => received.push(message));

    expect(received).toHaveLength(1);
  });

  it("ignore un rattrapage qu'un pair prétend envoyer au nom d'un autre", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await rawGuest(directory, 2);
    guest.channel.send({
      type: "team_select",
      seat: 2,
      selection: { pokemonDefinitionIds: ["charizard"] },
    });
    guest.channel.send({ type: "ready", seat: 2, ready: true });
    await flush();
    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    guest.channel.send({ type: "start_ack", seat: 2 });
    await flush();
    await launch;

    const requests: number[] = [];
    host.onResyncRequest((message) => requests.push(message.actionIndex));

    // La place 2 se présente comme la place 1 : l'adresse d'annuaire dit le contraire, donc le
    // message est ignoré en silence. C'est l'invariant `isSpokenFor` du Lot B2, étendu au rattrapage.
    guest.channel.send({ type: "resync_request", seat: 1, actionIndex: 7 });
    await flush();
    expect(requests).toEqual([]);

    guest.channel.send({ type: "resync_request", seat: 2, actionIndex: 7 });
    await flush();
    expect(requests).toEqual([7]);
  });
});

describe("Room — retour de l'hôte (Lot B3)", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function launchedPair(): Promise<{ host: Room; guest: Room }> {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await Room.join(depsFor(directory), ROOM_CODE);
    await flush();
    host.setSeatSelection(1, { pokemonDefinitionIds: ["venusaur"] });
    guest.setSeatSelection(2, { pokemonDefinitionIds: ["charizard"] });
    guest.setReady(true);
    await flush();
    const launch = host.launch(SEEDS, BATTLE_ID);
    await flush();
    await launch;
    return { host, guest };
  }

  it("ne renvoie plus l'invité à l'écran de départ quand l'hôte s'absente en pleine partie", async () => {
    const { host, guest } = await launchedPair();
    const errors: NetworkErrorCode[] = [];
    guest.onError((code) => errors.push(code));

    host.leave();
    await flush();
    vi.advanceTimersByTime(GRACE_AFTER_CLEAN_CLOSE_MS);
    await flush();

    // En salon, ce départ vaut `code_introuvable` et ramène au `lobby`. En COMBAT, la partie est en
    // cours : c'est un forfait à prononcer, pas un salon à quitter.
    expect(errors).toEqual([]);
  });

  it("rappelle l'hôte pendant sa grâce, parce que lui ne rappelle personne", async () => {
    const { host, guest } = await launchedPair();
    const awaited: number[] = [];
    guest.onPeerAwaited((seat) => awaited.push(seat));

    host.leave();
    await flush();
    expect(awaited).toEqual([HOST_SEAT]);

    // L'hôte revient à sa propre adresse, et se contente d'écouter : c'est l'invité qui compose.
    const returningHost = await Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2]);
    await flush();

    const returned: number[] = [];
    guest.onPeerReturned((seat) => returned.push(seat));
    vi.advanceTimersByTime(HOST_REDIAL_INTERVAL_MS);
    await flush();

    expect(returned).toEqual([HOST_SEAT]);
    expect(returningHost.view.locked).toBe(true);
  });

  it("l'hôte revenu ACCEPTE l'invité qui le rappelle", async () => {
    const { host, guest } = await launchedPair();
    const returned: number[] = [];
    guest.onPeerReturned((seat) => returned.push(seat));

    host.leave();
    await flush();

    /*
     * 🔴 Le cas que la recette a cassé (2026-09-09). Le salon du revenant est NEUF : il n'a aucun
     * délai de grâce en cours, alors qu'`attachIncoming` n'admet, sur un salon verrouillé, que les
     * places dont une grâce court. L'hôte refermait donc le canal de son invité à chaque tentative
     * de rappel — l'invité rappelait en boucle, l'hôte refusait en boucle, et la partie mourait au
     * bout du délai. Le trou ne se voyait pas en testant le retour de l'INVITÉ, dont l'hôte, lui,
     * avait bien une grâce en cours.
     */
    await Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2]);
    await flush();
    vi.advanceTimersByTime(HOST_REDIAL_INTERVAL_MS);
    await flush();

    expect(returned).toEqual([HOST_SEAT]);
  });

  it("l'hôte revenu répond à la présentation de son invité, au lieu de le rejeter", async () => {
    const { host, guest } = await launchedPair();
    host.leave();
    await flush();

    const returningHost = await Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2]);
    await flush();
    vi.advanceTimersByTime(HOST_REDIAL_INTERVAL_MS);
    await flush();

    /*
     * 🔴 Le canal doit RESTER ouvert. Un salon revenu n'a pas d'état de places — seul `create`
     * appelle `initializeHostSeats` — et `handleHello` refuse toute place absente de `seats` : l'hôte
     * acceptait donc le canal (la grâce de la place 2 courait) puis le refermait à la présentation.
     * L'invité se rebranchait, se faisait éjecter, rappelait, et son bandeau d'attente clignotait
     * jusqu'au forfait (recette 2026-09-09).
     */
    expect(returningHost.view.seats.map((entry) => entry.seat)).toEqual([HOST_SEAT, 2]);
    expect(returningHost.view.awaited).toEqual([]);

    // Et le lien porte : une action de l'hôte revenu parvient à l'invité.
    const received: ActionMessage[] = [];
    guest.onAction((message) => received.push(message));
    returningHost.sendAction(0, {
      kind: ActionKind.EndTurn,
      pokemonId: "p1-venusaur",
      direction: Direction.North,
    });
    await flush();
    expect(received).toHaveLength(1);
  });

  it("l'hôte revenu forfait l'invité qui ne revient jamais", async () => {
    const { host, guest } = await launchedPair();
    host.leave();
    await flush();
    guest.leave();
    await flush();

    const returningHost = await Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2]);
    const absent: number[] = [];
    returningHost.onPeerAbsent((seat) => absent.push(seat));
    await flush();

    // La fenêtre d'accueil est bornée : sans elle, un hôte revenu attendrait pour toujours un
    // invité qui a fermé son onglet pour de bon.
    vi.advanceTimersByTime(BATTLE_GRACE_SHORT_MS);
    await flush();

    expect(absent).toEqual([2]);
  });

  it("cesse de rappeler dès que la grâce est résolue", async () => {
    const { host, guest } = await launchedPair();
    const absent: number[] = [];
    guest.onPeerAbsent((seat) => absent.push(seat));

    host.leave();
    await flush();
    vi.advanceTimersByTime(BATTLE_GRACE_SHORT_MS);
    await flush();
    expect(absent).toEqual([HOST_SEAT]);

    // Plus de grâce : les tentatives suivantes ne doivent rien rouvrir.
    const returningHost = await Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2]);
    await flush();
    const returned: number[] = [];
    guest.onPeerReturned((seat) => returned.push(seat));
    vi.advanceTimersByTime(HOST_REDIAL_INTERVAL_MS * 3);
    await flush();

    expect(returned).toEqual([]);
    returningHost.leave();
  });
});

describe("Room — santé du chemin ICE (Lot B3)", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
  });

  it("remonte une dégradation du chemin avec la place concernée", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await rawGuest(directory, 2);
    await flush();

    const observed: { seat: number; health: ChannelHealth }[] = [];
    host.onPeerHealth((seat, health) => observed.push({ seat, health }));

    // Il n'y a pas d'ICE derrière un canal en mémoire : c'est au test de dire quand le chemin se
    // dégrade. Sans ce scénario, le fan-out d'`attachChannel` n'était couvert par rien — seul le
    // faux salon des tests de l'application simulait le signal, donc le contrat et non le code.
    asFake(guest.channel).pushHealth(ChannelHealth.Uncertain);
    asFake(guest.channel).pushHealth(ChannelHealth.Healthy);

    expect(observed).toEqual([
      { seat: 2, health: ChannelHealth.Uncertain },
      { seat: 2, health: ChannelHealth.Healthy },
    ]);
  });

  it("cesse de remonter après désabonnement", async () => {
    const host = await Room.create(depsFor(directory), options(2));
    const guest = await rawGuest(directory, 2);
    await flush();

    const observed: ChannelHealth[] = [];
    const unsubscribe = host.onPeerHealth((_seat, health) => observed.push(health));
    unsubscribe();
    asFake(guest.channel).pushHealth(ChannelHealth.Uncertain);

    expect(observed).toEqual([]);
  });
});

describe("Room — patience de la reconnexion (Lot B3)", () => {
  let directory: FakeNetworkDirectory;

  beforeEach(() => {
    directory = new FakeNetworkDirectory();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * Trouvé en recette (2026-09-09) : un hôte qui ferme son onglet puis clique « Reprendre le combat »
   * se voyait refuser SA propre adresse, l'annuaire la retenant encore. Les 4,6 s de
   * `CLAIM_RETRY_DELAYS_MS` sont taillées pour un fantôme de quelques centaines de millisecondes.
   *
   * 🔴 On compte les TENTATIVES et non le temps écoulé : `depsFor` rend un `sleep` instantané, donc
   * les réessais brûlent tous au même instant et une assertion sur l'horloge ne prouverait rien.
   * C'est de toute façon le nombre de tentatives qui distingue les deux barèmes — les délais, eux,
   * ne se vérifient qu'en lisant la constante.
   */
  it("insiste bien plus longtemps qu'à la création pour reprendre sa propre adresse", async () => {
    directory.linger(hostPeerId(ROOM_CODE));
    // Libérée juste après le budget de la création : un `Room.create` aurait déjà renoncé ici.
    directory.releaseAfterAttempts(hostPeerId(ROOM_CODE), CLAIM_RETRY_DELAYS_MS.length + 2);

    const room = await Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2]);

    expect(room.seat).toBe(HOST_SEAT);

    /*
     * Sur le BUDGET DE TEMPS et non sur le nombre d'essais : c'est ce que la constante promet, et
     * c'est ce qui décide si un départ propre est absorbé — mesuré à 110 ms de libération d'adresse
     * sur le service public, contre 99 s pour un départ brutal qu'aucun budget ne rattrape
     * (décision #966).
     */
    const total = (delays: readonly number[]): number =>
      delays.reduce((sum, delay) => sum + delay, 0);
    expect(total(REJOIN_RETRY_DELAYS_MS)).toBeGreaterThan(3 * total(CLAIM_RETRY_DELAYS_MS));
  });

  it("renonce quand l'adresse ne se libère jamais", async () => {
    directory.linger(hostPeerId(ROOM_CODE));

    await expect(Room.rejoin(depsFor(directory), ROOM_CODE, HOST_SEAT, [2])).rejects.toMatchObject({
      code: NetworkErrorCode.SalonPlein,
    });
  });
});
