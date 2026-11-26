import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    """A data folder containing the Danish sample export encoded like Nordnet does (UTF-16, tabs)."""
    text = (FIXTURES / "transactions_dk.tsv").read_text(encoding="utf-8")
    (tmp_path / "transaktioner.csv").write_bytes(text.encode("utf-16"))
    return tmp_path
