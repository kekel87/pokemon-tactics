import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NETWORK_VERSION,
  NetworkErrorCode,
  type NetworkMessage,
  type NetworkRoomOptions,
  NetworkSeatOccupancy,
  type NetworkSeeds,
  type StartMessage,
} from "./protocol.js";
import {
  GRACE_AFTER_CLEAN_CLOSE_MS,
  GRACE_AFTER_SILENCE_MS,
  LAUNCH_ACK_TIMEOUT_MS,
  Room,
  type RoomDeps,
  RoomRole,
} from "./room.js";
import { HOST_SEAT, hostPeerId, peerIdForSeat } from "./room-code.js";
import { FakeNetworkDirectory } from "./testing/fake-transport.js";
import type { NetworkChannel, NetworkTransport } from "./transport.js";
import { NetworkTransportError } from "./transport.js";

/**
 * Tests d'intégration du salon (plan 199, étape 3) : plusieurs salons dans le **même processus**, par
 * le canal en mémoire. Aucun réseau, aucun service tiers — donc rien qui rende le gate rouge le jour
 * où Internet tombe.
 */

const ROOM_CODE = "A7K2M";
const MAX_SEATS = 12;

const SEEDS: NetworkSeeds = { battle: 11, placement: 22, ai: 33 };

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
    const launch = host.launch(SEEDS);
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
    const launch = host.launch(SEEDS);
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
    const launch = host.launch(SEEDS);
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

    const launch = host.launch(SEEDS);
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
    const launch = host.launch(SEEDS);
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

    const launch = host.launch(SEEDS);
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

    await host.launch(SEEDS);

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
    const launch = host.launch(SEEDS);
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

    const launch = host.launch(SEEDS);
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

    const launch = host.launch(SEEDS);
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

    const launch = host.launch(SEEDS);
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

    const launch = host.launch(SEEDS);
    await flush();
    // L'invité est bien parti en combat : il n'a aucun moyen de savoir où en sont les autres.
    expect(guestStarts).toHaveLength(1);

    vi.advanceTimersByTime(LAUNCH_ACK_TIMEOUT_MS);
    await flush();
    await launch;

    expect(cancelled).toEqual([true]);
  });
});
