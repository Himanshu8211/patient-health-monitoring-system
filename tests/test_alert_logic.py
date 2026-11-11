import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
from alert_logic import check_alert, alert_reasons


def test_normal():
    assert check_alert(75, 36.7, 97) == 0


def test_heart_rate_limits():
    assert check_alert(50, 36.7, 97) == 0
    assert check_alert(49, 36.7, 97) == 1
    assert check_alert(110, 36.7, 97) == 0
    assert check_alert(111, 36.7, 97) == 1


def test_temperature_limits():
    assert check_alert(75, 35.5, 97) == 0
    assert check_alert(75, 35.4, 97) == 1
    assert check_alert(75, 38.0, 97) == 0
    assert check_alert(75, 38.1, 97) == 1


def test_spo2_limit():
    assert check_alert(75, 36.7, 94) == 0
    assert check_alert(75, 36.7, 93) == 1


def test_reasons():
    assert alert_reasons(120, 36.7, 90) == ["heart rate high", "SpO2 low"]
