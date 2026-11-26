"""`nordnet-mcp-setup`: one-shot setup and self-check, usable without Claude.

    nordnet-mcp-setup            create data folder + add the server to Claude Desktop
    nordnet-mcp-setup --check    read the exports in the data folder and print what was found
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

DEFAULT_DATA_DIR = Path.home() / "nordnet-data"


def desktop_config_path() -> Path:
    system = platform.system()
    if system == "Darwin":
        return Path.home() / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"
    if system == "Windows":
        return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "Claude" / "claude_desktop_config.json"
    return Path.home() / ".config" / "Claude" / "claude_desktop_config.json"


def server_command() -> str:
    exe = "nordnet-mcp.exe" if platform.system() == "Windows" else "nordnet-mcp"
    candidate = Path(sys.executable).parent / exe
    if candidate.exists():
        return str(candidate)
    found = shutil.which("nordnet-mcp")
    if found:
        return found
    raise SystemExit("Kunne ikke finde 'nordnet-mcp'-kommandoen. Er pakken installeret i dette Python-miljø?")


def add_to_claude_desktop(command: str, data_dir: Path) -> None:
    path = desktop_config_path()
    config: dict = {}
    if path.exists():
        raw = path.read_text(encoding="utf-8").strip()
        if raw:
            try:
                config = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{path} er ikke gyldig JSON ({exc}). Ret filen og kør igen.") from exc
        backup = path.with_name(f"{path.name}.backup-{datetime.now():%Y%m%d-%H%M%S}")
        shutil.copy2(path, backup)
        print(f"  Backup af Claude Desktop-config: {backup}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
    servers = config.setdefault("mcpServers", {})
    servers["nordnet"] = {"command": command, "env": {"NORDNET_DATA_DIR": str(data_dir)}}
    path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  Tilføjet 'nordnet' til {path}")


def add_to_claude_code(command: str, data_dir: Path) -> None:
    claude = shutil.which("claude")
    if not claude:
        print("  Claude Code ('claude') blev ikke fundet — springer over.")
        return
    subprocess.run([claude, "mcp", "remove", "nordnet", "--scope", "user"], capture_output=True)
    res = subprocess.run(
        [claude, "mcp", "add", "nordnet", "--scope", "user", "-e", f"NORDNET_DATA_DIR={data_dir}", "--", command],
        capture_output=True, text=True,
    )
    if res.returncode == 0:
        print("  Tilføjet 'nordnet' til Claude Code (scope: user)")
    else:
        print(f"  Claude Code-opsætning fejlede: {res.stderr.strip() or res.stdout.strip()}")


def _dk(x: float) -> str:
    """1234567.8 -> '1.234.567,80'"""
    return f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def check(data_dir: Path) -> int:
    from . import portfolio as pf
    from .parser import load_directory

    print(f"Datamappe: {data_dir}")
    if not data_dir.is_dir():
        print("  Mappen findes ikke. Kør 'nordnet-mcp-setup' først.")
        return 1
    txs, report = load_directory(data_dir)
    if not report:
        print("  Ingen .csv-filer endnu. Eksportér fra Nordnet: Konto -> Transaktioner og notaer -> Eksporter.")
        return 1
    for r in report:
        if r["status"] == "ok":
            print(f"  OK       {r['file']}: {r['rows']} rækker ({r['new_rows']} nye)")
        else:
            print(f"  SPRUNGET {r['file']}: {r['reason']}")
    if not txs:
        return 1
    dates = [t.date for t in txs if t.date]
    print(f"\n{len(txs)} transaktioner fra {min(dates)} til {max(dates)}")
    print("Depoter:", ", ".join(sorted({t.account for t in txs})))
    cats = Counter(t.category for t in pf.active(txs))
    print("Kategorier:", ", ".join(f"{k}={v}" for k, v in cats.most_common()))
    unknown = Counter(t.raw_type for t in pf.active(txs) if t.category == "other")
    if unknown:
        print("Ukendte transaktionstyper (tælles ikke med i indskud/udbytte):",
              ", ".join(f"'{k}' x{v}" for k, v in unknown.most_common()))
    holdings = pf.current_holdings(txs)
    print(f"\nBeholdning ({len(holdings)} papirer, kostpris i depotvaluta):")
    for p in holdings:
        warn = "  (!) kostpris ufuldstændig" if p.cost_unknown else ""
        print(f"  {p.account:>10}  {p.name[:40]:40} {_dk(p.quantity):>12} stk  kostpris {_dk(p.cost_basis):>14} {p.currency}{warn}")
    cash = pf.cash_balances(txs)
    print("\nKontanter:", ", ".join(f"{a}: {_dk(v)}" for a, v in cash.items()))
    print("\nSammenlign beholdningen med Nordnet. Passer den, er alt klar.")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(prog="nordnet-mcp-setup", description="Opsætning af Nordnet MCP-serveren")
    ap.add_argument("--data-dir", type=Path, default=Path(os.environ.get("NORDNET_DATA_DIR", DEFAULT_DATA_DIR)),
                    help=f"Mappe til Nordnet-eksporter (standard: {DEFAULT_DATA_DIR})")
    ap.add_argument("--check", action="store_true", help="Læs eksportfilerne og vis hvad der blev fundet")
    ap.add_argument("--no-desktop", action="store_true", help="Tilføj ikke til Claude Desktop")
    ap.add_argument("--claude-code", action="store_true", help="Tilføj også til Claude Code ('claude mcp add')")
    args = ap.parse_args()
    data_dir = args.data_dir.expanduser().resolve()

    if args.check:
        sys.exit(check(data_dir))

    print("Opsætter Nordnet MCP-server\n")
    data_dir.mkdir(parents=True, exist_ok=True)
    print(f"  Datamappe: {data_dir}")
    command = server_command()
    print(f"  Server: {command}")
    if not args.no_desktop:
        add_to_claude_desktop(command, data_dir)
    if args.claude_code:
        add_to_claude_code(command, data_dir)
    print(
        "\nNæste skridt:\n"
        "  1. Nordnet.dk -> Konto -> Transaktioner og notaer: vælg alle depoter og hele perioden -> Eksporter\n"
        f"  2. Gem filen i {data_dir}\n"
        "  3. Kør: nordnet-mcp-setup --check   (viser beholdningen, så du kan sammenligne med Nordnet)\n"
        "  4. Luk Claude Desktop helt (Cmd+Q / Afslut) og åbn den igen\n"
    )


if __name__ == "__main__":
    main()
