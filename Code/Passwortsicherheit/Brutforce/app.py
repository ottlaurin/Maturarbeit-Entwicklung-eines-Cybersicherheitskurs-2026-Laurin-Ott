# /// script
# requires-python = ">=3.14"
# dependencies = [
#     "flask>=3.1.3",
#     "numba>=0.68.0",
#     "numpy>=2.5.4",
# ]
# ///

# -*- coding: utf-8 -*-
import time
import numpy as np
import numba
from numba import njit, prange
from flask import Flask, render_template, request

app = Flask(__name__)

# Globaler Zeichensatz
CHARS = (
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
    "!@#$%^&*()_+-=[]{}|;:',.<>?/`~ "
)
CHAR_ARRAY = np.array([ord(c) for c in CHARS], dtype=np.int32)

# ══════════════════════════════════════════════════════
# OPTIMIERTER & PARALLELER NUMBA-KERN
# ══════════════════════════════════════════════════════
@njit(parallel=True, fastmath=True)
def crack_core_numba_parallel(target_array, char_array):
    target_len = len(target_array)
    num_chars = len(char_array)
    
    if target_len == 0:
        return True

    found_flag = np.zeros(1, dtype=np.int32)

    for prefix_idx in prange(num_chars):
        if found_flag[0] == 1:
            continue
            
        indices = np.zeros(target_len, dtype=np.int64)
        guess = np.empty(target_len, dtype=np.int32)
        
        indices[0] = prefix_idx
        guess[0] = char_array[prefix_idx]
        
        for i in range(1, target_len):
            guess[i] = char_array[0]
            
        total = num_chars ** (target_len - 1)
        for _ in range(total):
            if found_flag[0] == 1:
                break

            match = True
            for i in range(target_len):
                if guess[i] != target_array[i]:
                    match = False
                    break
            
            if match:
                found_flag[0] = 1
                break
                
            pos = target_len - 1
            while pos > 0:
                indices[pos] += 1
                if indices[pos] < num_chars:
                    guess[pos] = char_array[indices[pos]]
                    break
                else:
                    indices[pos] = 0
                    guess[pos] = char_array[0]
                    pos -= 1

    return found_flag[0] == 1

def warmup_numba():
    dummy_target = np.array([ord('a'), ord('b')], dtype=np.int32)
    crack_core_numba_parallel(dummy_target, CHAR_ARRAY)

def run_bruteforce(pwd):
    if not pwd:
        return "Kein Passwort angegeben.", 0, False
        
    for c in pwd:
        if ord(c) not in CHAR_ARRAY:
            return f"Zeichen '{c}' ist nicht im Zeichensatz enthalten.", 0, False

    target_array = np.array([ord(c) for c in pwd], dtype=np.int32)
    
    start_zeit = time.time()
    found = crack_core_numba_parallel(target_array, CHAR_ARRAY)
    dauer = time.time() - start_zeit
    
    if found:
        return "Erfolgreich geknackt!", dauer, True
    else:
        return "Nicht im Zeichensatz gefunden.", dauer, False

# ══════════════════════════════════════════════════════
# FLASK ROUTEN
# ══════════════════════════════════════════════════════
@app.route("/", methods=["GET", "POST"])
def index():
    pwd = ""
    result = ""
    dauer_str = ""
    revealed_pwd = None
    
    if request.method == "POST":
        pwd = request.form.get("pwd", "")
        result_text, dauer, is_found = run_bruteforce(pwd)
        
        if is_found:
            result = result_text
            revealed_pwd = pwd
            dauer_str = f"{dauer:.4f}"
            
    return render_template("index.html", pwd=pwd, result=result, revealed_pwd=revealed_pwd, dauer=dauer_str)
    
if __name__ == '__main__':
    print("Kompiliere Numba-Kern (Warmup)...")
    warmup_numba()
    print("Warmup abgeschlossen. Starte Webserver auf http://127.0.0.1:5000 ...")
    app.run(debug=False, port=5000)
