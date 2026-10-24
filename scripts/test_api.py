"""
ReachInbox Email Scheduler - Python API Verification & Benchmark Tool
Requires the Python virtual environment: .\\venv\\Scripts\\Activate.ps1
"""

import sys

# Ensure UTF-8 output encoding on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import requests
from rich.console import Console
from rich.table import Table

console = Console(highlight=False)
BASE_URL = "http://localhost:5000/api"

def run_tests():
    console.print("\n[bold cyan]Starting ReachInbox Python API Verification Tool...[/bold cyan]\n")
    table = Table(title="ReachInbox API Endpoint Verification")
    table.add_column("Endpoint", style="cyan", no_wrap=True)
    table.add_column("Method", style="magenta")
    table.add_column("Status Code", style="green")
    table.add_column("Result", style="bold")

    # 1. Healthcheck Test
    try:
        res = requests.get(f"{BASE_URL}/health", timeout=3)
        if res.status_code == 200 and res.json().get("status") == "ok":
            table.add_row("/api/health", "GET", str(res.status_code), "[green]PASS[/green]")
        else:
            table.add_row("/api/health", "GET", str(res.status_code), "[red]FAIL[/red]")
    except Exception as e:
        table.add_row("/api/health", "GET", "ERR", f"[yellow]OFFLINE ({e.__class__.__name__})[/yellow]")

    # 2. Demo Auth Test
    token = None
    try:
        res = requests.post(f"{BASE_URL}/auth/demo", timeout=5)
        if res.status_code == 200 and res.json().get("success"):
            token = res.json()["data"]["token"]
            table.add_row("/api/auth/demo", "POST", str(res.status_code), "[green]PASS[/green]")
        else:
            table.add_row("/api/auth/demo", "POST", str(res.status_code), "[red]FAIL[/red]")
    except Exception as e:
        table.add_row("/api/auth/demo", "POST", "ERR", f"[yellow]OFFLINE ({e.__class__.__name__})[/yellow]")

    # 3. Senders Test
    if token:
        try:
            res = requests.get(f"{BASE_URL}/senders", headers={"Authorization": f"Bearer {token}"}, timeout=5)
            if res.status_code == 200 and res.json().get("success"):
                table.add_row("/api/senders", "GET", str(res.status_code), "[green]PASS[/green]")
            else:
                table.add_row("/api/senders", "GET", str(res.status_code), "[red]FAIL[/red]")
        except Exception as e:
            table.add_row("/api/senders", "GET", "ERR", f"[yellow]OFFLINE ({e.__class__.__name__})[/yellow]")

    console.print(table)
    console.print("\n[bold green]Test execution complete.[/bold green]\n")

if __name__ == "__main__":
    run_tests()
