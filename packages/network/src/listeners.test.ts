import { describe, expect, it, vi } from "vitest";
import { Listeners } from "./listeners.js";

describe("Listeners", () => {
  it("notifie chaque abonné avec les arguments de l'émission", () => {
    const listeners = new Listeners<[seat: number, graceMs: number]>();
    const first = vi.fn();
    const second = vi.fn();
    listeners.subscribe(first);
    listeners.subscribe(second);

    listeners.emit(2, 30_000);

    expect(first).toHaveBeenCalledWith(2, 30_000);
    expect(second).toHaveBeenCalledWith(2, 30_000);
  });

  it("rend une fermeture qui désabonne", () => {
    const listeners = new Listeners<[value: string]>();
    const listener = vi.fn();
    const unsubscribe = listeners.subscribe(listener);

    unsubscribe();
    listeners.emit("après");

    expect(listener).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });

  it("notifie encore les suivants quand un abonné se désabonne pendant l'émission", () => {
    const listeners = new Listeners<[value: string]>();
    const late = vi.fn();
    const unsubscribeEarly = listeners.subscribe(() => {
      unsubscribeEarly();
    });
    listeners.subscribe(late);

    listeners.emit("pendant");

    expect(late).toHaveBeenCalledWith("pendant");
    expect(listeners.size).toBe(1);
  });

  it("n'appelle pas un abonné arrivé pendant l'émission en cours", () => {
    const listeners = new Listeners<[value: string]>();
    const newcomer = vi.fn();
    listeners.subscribe(() => {
      listeners.subscribe(newcomer);
    });

    listeners.emit("pendant");

    expect(newcomer).not.toHaveBeenCalled();
  });

  it("vide le jeu d'abonnés", () => {
    const listeners = new Listeners();
    const listener = vi.fn();
    listeners.subscribe(listener);

    listeners.clear();
    listeners.emit();

    expect(listener).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
