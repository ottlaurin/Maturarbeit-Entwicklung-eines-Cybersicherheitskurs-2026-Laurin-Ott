# -*- coding: utf-8 -*-
# Starten mit: py -3.14 passwort_bruteforce.py
import multiprocessing
import numpy as np
import numba
import time


# ══════════════════════════════════════════════════════
#  OPTIMIERTER NUMBA-KERN
#  Verbesserungen gegenüber alter Version:
#  1. np.empty() NUR EINMAL vor der Schleife → kein Heap-Alloc mehr pro Versuch
#  2. Odometer-Methode statt Modulo/Division   → keine teure Integer-Division mehr
#     Funktioniert wie ein Kilometerzähler:
#     [a,a,a] → [a,a,b] → ... → [a9246,z,z] → [b,a,a] → ...
# ══════════════════════════════════════════════════════
@numba.njit(fastmath=True)
def crack_core_numba(target_array, char_array, target_len, prefix_idx):
    num_chars = len(char_array)

    # --- Sonderfall: 1-stelliges Passwort ---
    if target_len == 1:
        return char_array[prefix_idx] == target_array[0]

    # --- Einmalige Allokation VOR der Schleife ---
    indices = np.zeros(target_len, dtype=np.int64)   # Positions-Zeiger (Odometer)
    guess   = np.empty(target_len, dtype=np.int32)   # Aktueller Versuch (ASCII)

    # Ersten Buchstaben fixieren (zugeteilt vom Worker-Prozess)
    indices[0] = prefix_idx
    guess[0]   = char_array[prefix_idx]

    # Rest auf erstes Zeichen initialisieren
    for i in range(1, target_len):
        guess[i] = char_array[0]

    total = num_chars ** (target_len - 1)

    for _ in range(total):

        # --- Vergleich ---
        match = True
        for i in range(target_len):
            if guess[i] != target_array[i]:
                match = False
                break
        if match:
            return True

        # --- Odometer hochzählen (von rechts, Position 0 ist fixiert) ---
        # Kein Modulo, keine Division – nur Vergleich und Inkrement
        pos = target_len - 1
        while pos > 0:
            indices[pos] += 1
            if indices[pos] < num_chars:
                guess[pos] = char_array[indices[pos]]
                break          # Übertrag fertig
            else:
                indices[pos] = 0
                guess[pos]   = char_array[0]
                pos -= 1       # Übertrag eine Stelle weiter links

    return False


# ══════════════════════════════════════════════════════
#  WORKER  –  läuft in eigenem Prozess (CPU-Kern)
#  Zieht Aufgaben (prefix_idx) aus der Queue und
#  bricht ab sobald ein anderer Kern das PW gefunden hat
# ══════════════════════════════════════════════════════
def worker(task_queue, target_array, char_array, result_dict, target_len):
    while not result_dict['found']:
        try:
            prefix_idx = task_queue.get_nowait()
        except Exception:
            break

        if crack_core_numba(target_array, char_array, target_len, prefix_idx):
            result_dict['found'] = True
            break


# ══════════════════════════════════════════════════════
#  HAUPTPROGRAMM
# ══════════════════════════════════════════════════════
if __name__ == '__main__':

    chars = (
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        "!@#$%^&*()_+-=[]{}|;:',.<>?/`~"
    )
    char_array = np.array([ord(c) for c in chars], dtype=np.int32)

    pwd = input("Geben Sie ein Passwort (beliebige Länge) ein: ")
    target_array = np.array([ord(c) for c in pwd], dtype=np.int32)
    target_len   = len(pwd)

    # --- Numba Warmup (Kompilierung beim ersten Aufruf, nicht in der Zeitmessung) ---
    print("Kompiliere Numba-Kern (einmalig, dauert ~5s)...", flush=True)
    _dummy = np.array([ord('a')], dtype=np.int32)
    crack_core_numba(_dummy, char_array, 1, 0)
    print("Kompilierung fertig.\n", flush=True)

    # --- Aufgaben-Queue: ein Eintrag pro Startzeichen ---
    # Kein nested loop mehr über Längen – wir suchen NUR target_len
    manager    = multiprocessing.Manager()
    task_queue = manager.Queue()
    result_dict = manager.dict({'found': False})

    for prefix_idx in range(len(char_array)):
        task_queue.put(prefix_idx)

    num_cores = multiprocessing.cpu_count()
    total_kombinationen = len(char_array) ** target_len
    print(f"Passwort-Länge   : {target_len}")
    print(f"Zeichensatz      : {len(char_array)} Zeichen ({len(chars)} unique)")
    print(f"Kombinationen    : {total_kombinationen:,}")
    print(f"CPU-Kerne        : {num_cores}")
    print(f"Methode          : Odometer (kein Modulo/Division, kein Heap-Alloc)")
    print("-" * 55)
    print(f"Starte Brute-Force auf {num_cores} Kernen ...\n", flush=True)

    start_zeit = time.time()

    procs = []
    for _ in range(num_cores):
        p = multiprocessing.Process(
            target=worker,
            args=(task_queue, target_array, char_array, result_dict, target_len)
        )
        procs.append(p)
        p.start()

    for p in procs:
        p.join()

    dauer = time.time() - start_zeit

    print(f"Fertig in {dauer:.4f} Sekunden.")
    if result_dict['found']:
        print(f"Passwort '{pwd}' (Länge: {target_len}) erfolgreich berechnet!")
    else:
        print("Passwort wurde im Zeichensatz nicht gefunden.")
