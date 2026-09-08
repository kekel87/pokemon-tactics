/**
 * Double de `peerjs`, pour `peer-connection.test.ts` (plan 199).
 *
 * `PeerJsChannel` est interne et `PeerJsTransport.claim` construit son `Peer` en dur : il n'y a
 * aucune injection, et en ajouter une pour un test serait un changement d'API. On remplace donc la
 * bibliothèque elle-même, par `vi.mock("peerjs")`, et on obtient le vrai canal en passant par
 * `claim()` puis `connect()`.
 *
 * Volontairement **absent de `testing/index.ts`** : un bouchon de bibliothèque tierce n'a rien à
 * faire dans `@pokemon-tactic/network/testing`, qui part dans le graphe de l'application.
 *
 * Trois traits reproduisent le vrai `peerjs` :
 *
 * 1. **L'ouverture arrive après coup.** `claim()` et `connect()` posent leurs écouteurs *après* la
 *    construction ; le double émet donc `open` dans une micro-tâche, ce qui suffit à débloquer les
 *    deux attentes sans réseau ni délai.
 * 2. **`send` rend `void | Promise<void>`.** En sérialisation binaire l'empaquetage peut être
 *    asynchrone et son rejet remonte à l'appelant : `sendResult` pilote les trois retours possibles.
 * 3. **La mort d'un canal est un événement**, pas un retour de fonction. `emitClose` et `emitError`
 *    jouent les deux que le constructeur de `PeerJsChannel` écoute.
 *
 * 🔴 `fakePeerjs.reset()` en `beforeEach` n'est pas de l'hygiène, c'est **obligatoire** : le registre
 * des pairs construits vit au niveau du module, et le projet `unit` tourne en `isolate: false` — le
 * module survit donc d'un fichier de test à l'autre dans le même worker.
 */

type FakeListener = (...payload: unknown[]) => void;

class FakeEventEmitter {
  private readonly listeners = new Map<string, Set<FakeListener>>();

  on(event: string, listener: FakeListener): void {
    const registered = this.listeners.get(event) ?? new Set<FakeListener>();
    registered.add(listener);
    this.listeners.set(event, registered);
  }

  off(event: string, listener: FakeListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  protected emit(event: string, ...payload: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      listener(...payload);
    }
  }
}

const createdPeers: FakePeer[] = [];

export class FakeDataConnection extends FakeEventEmitter {
  /** Ce qui est parti, dans l'ordre. */
  readonly sent: unknown[] = [];
  /** Les fermetures demandées, avec leurs options — `flush` en particulier. */
  readonly closeCalls: ({ flush?: boolean } | undefined)[] = [];
  /**
   * Retour du prochain `send`. Par défaut `void`, comme un empaquetage synchrone ; un test le
   * remplace par une promesse tenue ou rejetée.
   */
  sendResult: () => void | Promise<void> = () => undefined;

  constructor(
    readonly peer: string,
    readonly options: { reliable?: boolean } | undefined,
  ) {
    super();
    queueMicrotask(() => this.emit("open"));
  }

  send(data: unknown): void | Promise<void> {
    this.sent.push(data);
    return this.sendResult();
  }

  close(options?: { flush?: boolean }): void {
    this.closeCalls.push(options);
  }

  /** Le canal se referme, à l'initiative du pair distant ou de la bibliothèque. */
  emitClose(): void {
    this.emit("close");
  }

  /** Une erreur sur un canal déjà ouvert — pas un échec d'ouverture, que le pair porte. */
  emitError(): void {
    this.emit("error", { type: "not-open-yet" });
  }
}

export class FakePeer extends FakeEventEmitter {
  readonly connections: FakeDataConnection[] = [];
  destroyed = false;

  /**
   * Les options telles que `PeerJsTransport` les a passées, **littéralement**.
   *
   * Retenues pour qu'un test puisse affirmer qu'une option non renseignée est ABSENTE et non
   * présente à `undefined` : `peerjs` fusionne ses défauts par étalement, donc une clé à `undefined`
   * écrase le défaut. C'est ce qui rendait l'annuaire public injoignable (plan 201).
   */
  constructor(
    readonly id: string,
    readonly options: Record<string, unknown> = {},
  ) {
    super();
    createdPeers.push(this);
    queueMicrotask(() => this.emit("open"));
  }

  connect(peerId: string, options?: { reliable?: boolean }): FakeDataConnection {
    const connection = new FakeDataConnection(peerId, options);
    this.connections.push(connection);
    return connection;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export const fakePeerjs = {
  /** Oublie les pairs construits. Voir l'en-tête : à appeler en `beforeEach`, sans exception. */
  reset(): void {
    createdPeers.length = 0;
  },

  /** Le dernier pair construit — celui que la prise d'identifiant vient de créer. */
  lastPeer(): FakePeer {
    const peer = createdPeers.at(-1);
    if (peer === undefined) {
      throw new Error("aucun pair construit : `claim()` n'a pas été appelé");
    }
    return peer;
  },

  /**
   * La connexion que le dernier `connect()` a produite — celle qui est derrière le canal rendu par
   * `PeerJsTransport.connect`, seul moyen d'atteindre un `PeerJsChannel` sans l'exporter.
   */
  lastConnection(): FakeDataConnection {
    const connection = this.lastPeer().connections.at(-1);
    if (connection === undefined) {
      throw new Error("aucune connexion sortante : `connect()` n'a pas été appelé");
    }
    return connection;
  },
};
