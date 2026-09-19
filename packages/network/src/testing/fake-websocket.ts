/**
 * Double de `WebSocket`, pour `relay-connection.test.ts` (plan 216, bug 1).
 *
 * `RelayTransport` prend déjà son constructeur de socket en option (`openSocket`), donc rien n'a
 * besoin d'être remplacé globalement : le test injecte ce double et pilote la vie de la connexion à
 * la main.
 *
 * Volontairement **absent de `testing/index.ts`** : un bouchon de plateforme n'a rien à faire dans
 * `@pokemon-tactic/network/testing`, qui part dans le graphe de l'application. Même parti pris que
 * `fake-peerjs.ts`.
 *
 * Trois traits reproduisent la vraie `WebSocket`, et chacun couvre un défaut que le transport a
 * réellement eu :
 *
 * 1. **L'ouverture arrive APRÈS coup.** Rien ne s'ouvre à la construction : c'est le test qui joue
 *    `emitOpen()`. Sans cette latence, `destroy()` pendant l'ouverture — le cas qui laissait une
 *    socket vivante sur un transport mort — serait inatteignable.
 * 2. **`close()` ne notifie pas tout de suite.** La vraie socket passe par `CLOSING` puis émet
 *    `close` plus tard ; le double dépose donc l'événement en micro-tâche. C'est cette fenêtre qui
 *    rend observable le garde « socket pas `OPEN` » de l'émission.
 * 3. **`readyState` porte les valeurs de la plateforme** (`WebSocket.OPEN` vaut `1`), parce que le
 *    transport les compare à la constante globale et non à une des siennes.
 */

/** Les quatre états de `WebSocket`, recopiés : le double n'hérite pas de la classe du navigateur. */
export const FakeSocketState = {
  Connecting: 0,
  Open: 1,
  Closing: 2,
  Closed: 3,
} as const;

export type FakeSocketState = (typeof FakeSocketState)[keyof typeof FakeSocketState];

/** Ce qu'un appelant a demandé en fermant — le transport annonce `1000` / « bye » sur un départ propre. */
export interface FakeSocketCloseCall {
  code: number | undefined;
  reason: string | undefined;
}

type FakeSocketListener = (event: unknown) => void;

export class FakeWebSocket {
  readyState: number = FakeSocketState.Connecting;
  /** Les trames émises, dans l'ordre, telles qu'elles sont parties sur le fil. */
  readonly sent: string[] = [];
  /** Les fermetures demandées PAR le transport — vide si personne n'a raccroché de notre côté. */
  readonly closeCalls: FakeSocketCloseCall[] = [];
  private readonly listeners = new Map<string, Set<FakeSocketListener>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: FakeSocketListener): void {
    const registered = this.listeners.get(type) ?? new Set<FakeSocketListener>();
    registered.add(listener);
    this.listeners.set(type, registered);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    if (this.readyState === FakeSocketState.Closed) {
      return;
    }
    this.readyState = FakeSocketState.Closing;
    queueMicrotask(() => this.emitClose(code ?? 1000));
  }

  /** Ce que le transport reçoit : le double est passé par `openSocket`, qui rend une `WebSocket`. */
  asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }

  /** La poignée de main a abouti. */
  emitOpen(): void {
    this.readyState = FakeSocketState.Open;
    this.dispatch("open", {});
  }

  /** Une trame arrive du relais. `data` non chaîne sert à couvrir le refus du binaire. */
  emitMessage(data: unknown): void {
    this.dispatch("message", { data });
  }

  /** La socket meurt, d'où que vienne la fermeture. Idempotent, comme l'événement réel. */
  emitClose(code = 1006): void {
    if (this.readyState === FakeSocketState.Closed) {
      return;
    }
    this.readyState = FakeSocketState.Closed;
    this.dispatch("close", { code });
  }

  private dispatch(type: string, event: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }
}
