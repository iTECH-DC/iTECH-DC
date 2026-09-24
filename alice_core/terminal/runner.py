import subprocess, shlex, os

# Visible, intentionally conservative starter allow-list.
# Expand only with explicit authorization and per-command validation.
ALLOWED = {
    "python", "py", "pip", "git", "dir", "ls", "pwd", "whoami",
    "where", "where.exe", "ver", "echo", "ipconfig", "systeminfo"
}

def run_command(command, timeout=15):
    command = command.strip()
    if not command:
        return {"ok": False, "stdout": "", "stderr": "Empty command."}

    try:
        first = shlex.split(command, posix=(os.name != "nt"))[0]
        first = os.path.basename(first).lower()
    except Exception:
        return {"ok": False, "stdout": "", "stderr": "Invalid command syntax."}

    if first not in ALLOWED:
        return {
            "ok": False, "stdout": "",
            "stderr": f"'{first}' is blocked by Alice's offline safety policy."
        }

    try:
        p = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=timeout)
        return {"ok": p.returncode == 0, "stdout": p.stdout, "stderr": p.stderr}
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": "Command timed out."}
