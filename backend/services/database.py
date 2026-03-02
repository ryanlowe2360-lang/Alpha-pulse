from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
from typing import List, Optional

from models.signals import SignalReport

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "signals.db")


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    conn = _get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS signal_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                generated_at TEXT NOT NULL,
                tickers_analyzed INTEGER NOT NULL,
                signals_json TEXT NOT NULL,
                model_used TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_reports_generated_at
            ON signal_reports (generated_at DESC)
        """)
        conn.commit()
    finally:
        conn.close()


# Initialize on module load
_init_db()


def _save_report_sync(report: SignalReport) -> int:
    conn = _get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO signal_reports (generated_at, tickers_analyzed, signals_json, model_used)
               VALUES (?, ?, ?, ?)""",
            (
                report.generated_at,
                report.tickers_analyzed,
                json.dumps([s.dict() for s in report.signals]),
                report.model_used,
            ),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def _get_latest_reports_sync(limit: int = 10) -> List[SignalReport]:
    conn = _get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM signal_reports ORDER BY generated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()

        reports: List[SignalReport] = []
        for row in rows:
            signals_data = json.loads(row["signals_json"])
            reports.append(SignalReport(
                id=row["id"],
                generated_at=row["generated_at"],
                tickers_analyzed=row["tickers_analyzed"],
                signals=signals_data,
                model_used=row["model_used"],
            ))
        return reports
    finally:
        conn.close()


async def save_report(report: SignalReport) -> int:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _save_report_sync, report)


async def get_latest_reports(limit: int = 10) -> List[SignalReport]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _get_latest_reports_sync, limit)
