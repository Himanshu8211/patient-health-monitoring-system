import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
} from 'recharts';
import {
  checkAlert,
  alertReasons,
  HR_LOW,
  HR_HIGH,
  TEMP_LOW,
  TEMP_HIGH,
  SPO2_LOW
} from './alertLogic';

export default function App() {
  const [records, setRecords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(700);
  const [confirmAlerts, setConfirmAlerts] = useState(false);

  // Consecutive abnormal readings per patient_id
  const patientStreaks = useRef(new Map());

  const [recentAlerts, setRecentAlerts] = useState([]);

  // Sliders for test panel
  const [testHr, setTestHr] = useState(75);
  const [testTemp, setTestTemp] = useState(36.7);
  const [testSpo2, setTestSpo2] = useState(97);

  // MQTT state
  const [topic, setTopic] = useState('himanshu-patient/monitor/data');
  const [mqttStatus, setMqttStatus] = useState('connecting');
  const [lastSubMessage, setLastSubMessage] = useState(null);
  const mqttClientRef = useRef(null);

  const [summary, setSummary] = useState(null);

  // Load CSV from public folder
  useEffect(() => {
    fetch('./patient_vitals_5000.csv')
      .then((res) => {
        if (!res.ok) return fetch('/patient_vitals_5000.csv').then((r) => r.text());
        return res.text();
      })
      .then((text) => {
        const lines = text.trim().split(/\r?\n/);
        const parsed = [];
        let totalHr = 0;
        let totalTemp = 0;
        let totalSpo2 = 0;
        let totalAlerts = 0;
        const channelCounts = {};

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i]) continue;
          const [ts, pid, hr, temp, spo2, ch, flag] = lines[i].split(',');
          const row = {
            timestamp: ts,
            patient_id: pid,
            heart_rate_bpm: Number(hr),
            body_temp_C: Number(temp),
            SpO2_pct: Number(spo2),
            comm_channel: ch,
            alert_flag: Number(flag)
          };
          parsed.push(row);

          totalHr += row.heart_rate_bpm;
          totalTemp += row.body_temp_C;
          totalSpo2 += row.SpO2_pct;
          if (row.alert_flag === 1) totalAlerts += 1;

          if (!channelCounts[ch]) {
            channelCounts[ch] = { total: 0, alerts: 0 };
          }
          channelCounts[ch].total += 1;
          if (row.alert_flag === 1) {
            channelCounts[ch].alerts += 1;
          }
        }

        setRecords(parsed);

        const n = parsed.length || 1;
        setSummary({
          totalRecords: parsed.length,
          alertCount: totalAlerts,
          alertRate: ((totalAlerts / n) * 100).toFixed(2),
          avgHr: (totalHr / n).toFixed(1),
          avgTemp: (totalTemp / n).toFixed(1),
          avgSpo2: (totalSpo2 / n).toFixed(1),
          channelStats: Object.keys(channelCounts).map((ch) => ({
            channel: ch,
            total: channelCounts[ch].total,
            alerts: channelCounts[ch].alerts,
            rate: ((channelCounts[ch].alerts / channelCounts[ch].total) * 100).toFixed(2)
          }))
        });
      })
      .catch((err) => {
        console.error('Failed to load dataset:', err);
      });
  }, []);

  // Connect to public broker over WebSocket
  useEffect(() => {
    const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
      clientId: 'client-' + Math.random().toString(16).substring(2, 8),
      clean: true,
      reconnectPeriod: 3000
    });

    mqttClientRef.current = client;

    client.on('connect', () => {
      setMqttStatus('connected');
      client.subscribe(topic);
    });

    client.on('message', (_t, message) => {
      try {
        const payload = JSON.parse(message.toString());
        setLastSubMessage(payload);
      } catch (e) {
        console.error('JSON parse error', e);
      }
    });

    client.on('close', () => setMqttStatus('disconnected'));
    client.on('reconnect', () => setMqttStatus('connecting'));
    client.on('error', () => setMqttStatus('disconnected'));

    return () => {
      if (client) client.end();
    };
  }, []);

  const handleTopicChange = (newTopic) => {
    const client = mqttClientRef.current;
    if (client && client.connected && topic !== newTopic) {
      client.unsubscribe(topic);
      client.subscribe(newTopic);
    }
    setTopic(newTopic);
  };

  const evaluateAlert = (row) => {
    if (!row) return { isAlert: false, reasons: [] };
    const baseAbnormal = checkAlert(row.heart_rate_bpm, row.body_temp_C, row.SpO2_pct) === 1;
    const reasons = alertReasons(row.heart_rate_bpm, row.body_temp_C, row.SpO2_pct);

    if (!confirmAlerts) {
      return { isAlert: baseAbnormal, reasons };
    }

    const prevStreak = patientStreaks.current.get(row.patient_id) || 0;
    const isAlert = baseAbnormal && prevStreak >= 1;
    return { isAlert, reasons };
  };

  // Replay timer
  useEffect(() => {
    if (!isPlaying || records.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % records.length);
    }, speed);

    return () => clearInterval(timer);
  }, [isPlaying, records.length, speed]);

  // Publish reading and log alerts on step
  useEffect(() => {
    if (records.length === 0) return;
    const row = records[currentIndex];
    if (!row) return;

    const baseAbnormal = checkAlert(row.heart_rate_bpm, row.body_temp_C, row.SpO2_pct) === 1;
    const currentStreak = patientStreaks.current.get(row.patient_id) || 0;
    const newStreak = baseAbnormal ? currentStreak + 1 : 0;
    patientStreaks.current.set(row.patient_id, newStreak);

    const isAlert = confirmAlerts ? baseAbnormal && currentStreak >= 1 : baseAbnormal;
    const reasons = alertReasons(row.heart_rate_bpm, row.body_temp_C, row.SpO2_pct);

    if (isAlert) {
      setRecentAlerts((prev) => {
        const item = {
          id: `${row.timestamp}-${row.patient_id}-${Math.random()}`,
          timestamp: row.timestamp,
          patient_id: row.patient_id,
          hr: row.heart_rate_bpm,
          temp: row.body_temp_C,
          spo2: row.SpO2_pct,
          reasons: reasons.join(', ')
        };
        return [item, ...prev.slice(0, 7)];
      });
    }

    const client = mqttClientRef.current;
    if (client && client.connected) {
      const payload = {
        timestamp: row.timestamp,
        patient_id: row.patient_id,
        heart_rate_bpm: row.heart_rate_bpm,
        body_temp_C: row.body_temp_C,
        SpO2_pct: row.SpO2_pct,
        comm_channel: row.comm_channel,
        alert_flag: isAlert ? 1 : 0,
        alert_reasons: reasons,
        is_simulated: true
      };
      client.publish(topic, JSON.stringify(payload));
    }
  }, [currentIndex, confirmAlerts, records, topic]);

  const currentRow = records[currentIndex] || {
    timestamp: '-',
    patient_id: '-',
    heart_rate_bpm: 0,
    body_temp_C: 0,
    SpO2_pct: 0,
    comm_channel: '-',
    alert_flag: 0
  };

  const { isAlert: currentIsAlert, reasons: currentReasons } = evaluateAlert(currentRow);

  const historyStart = Math.max(0, currentIndex - 39);
  const chartData = records.slice(historyStart, currentIndex + 1).map((r, i) => ({
    time: r.timestamp ? r.timestamp.slice(11) : `${i}`,
    hr: r.heart_rate_bpm,
    temp: r.body_temp_C,
    spo2: r.SpO2_pct
  }));

  const handleNextAlert = () => {
    if (records.length === 0) return;
    for (let i = currentIndex + 1; i < records.length; i++) {
      const r = records[i];
      const abnormal = checkAlert(r.heart_rate_bpm, r.body_temp_C, r.SpO2_pct) === 1;
      if (confirmAlerts) {
        const streak = patientStreaks.current.get(r.patient_id) || 0;
        if (abnormal && streak >= 1) {
          setCurrentIndex(i);
          return;
        }
      } else {
        if (abnormal) {
          setCurrentIndex(i);
          return;
        }
      }
    }
    for (let i = 0; i <= currentIndex; i++) {
      const r = records[i];
      const abnormal = checkAlert(r.heart_rate_bpm, r.body_temp_C, r.SpO2_pct) === 1;
      if (abnormal) {
        setCurrentIndex(i);
        return;
      }
    }
  };

  const testAlert = checkAlert(testHr, testTemp, testSpo2) === 1;
  const testReasons = alertReasons(testHr, testTemp, testSpo2);

  return (
    <div className="container">
      <header>
        <h1>Patient Health Monitoring Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge">SIMULATION</span>
          <span className={`badge ${mqttStatus}`}>MQTT: {mqttStatus.toUpperCase()}</span>
        </div>
      </header>

      {/* Controls */}
      <div className="controls">
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleNextAlert}>Next alert</button>
        <button onClick={() => setCurrentIndex(0)}>Restart</button>

        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          Speed:
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
          >
            <option value={1400}>Slow</option>
            <option value={700}>Normal</option>
            <option value={200}>Fast</option>
          </select>
        </label>

        <label className="toggle-label" style={{ marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={confirmAlerts}
            onChange={(e) => setConfirmAlerts(e.target.checked)}
          />
          Confirm alerts
        </label>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
        Record {currentIndex + 1} of {records.length} &bull; Patient: <b>{currentRow.patient_id}</b> &bull; Channel: <b>{currentRow.comm_channel}</b> &bull; Time: {currentRow.timestamp}
      </div>

      {/* Status Banner */}
      <div className={`banner ${currentIsAlert ? 'alert' : 'normal'}`}>
        <div>{currentIsAlert ? 'ALERT' : 'NORMAL'}</div>
        <div className="banner-reason">
          {currentIsAlert ? currentReasons.join(', ') : 'All vitals normal'}
        </div>
      </div>

      {/* Vitals Cards with Charts */}
      <div className="grid-3">
        <div className="card">
          <h2>Heart rate</h2>
          <div className="vital-value" style={{ color: currentRow.heart_rate_bpm < HR_LOW || currentRow.heart_rate_bpm > HR_HIGH ? 'var(--alert)' : 'inherit' }}>
            {currentRow.heart_rate_bpm}
            <span className="vital-unit">BPM</span>
          </div>
          <div className="vital-limit">alert below 50 or above 110 BPM</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" hide />
                <YAxis domain={[30, 150]} hide />
                <Tooltip />
                <ReferenceLine y={HR_LOW} stroke="#dc2626" strokeDasharray="3 3" />
                <ReferenceLine y={HR_HIGH} stroke="#dc2626" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="hr" stroke="#0284c7" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>Temperature</h2>
          <div className="vital-value" style={{ color: currentRow.body_temp_C < TEMP_LOW || currentRow.body_temp_C > TEMP_HIGH ? 'var(--alert)' : 'inherit' }}>
            {currentRow.body_temp_C.toFixed ? currentRow.body_temp_C.toFixed(1) : currentRow.body_temp_C}
            <span className="vital-unit">&deg;C</span>
          </div>
          <div className="vital-limit">alert below 35.5 or above 38 C</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" hide />
                <YAxis domain={[33, 41]} hide />
                <Tooltip />
                <ReferenceLine y={TEMP_LOW} stroke="#dc2626" strokeDasharray="3 3" />
                <ReferenceLine y={TEMP_HIGH} stroke="#dc2626" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="temp" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>SpO2</h2>
          <div className="vital-value" style={{ color: currentRow.SpO2_pct < SPO2_LOW ? 'var(--alert)' : 'inherit' }}>
            {currentRow.SpO2_pct}
            <span className="vital-unit">%</span>
          </div>
          <div className="vital-limit">alert below 94 %</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" hide />
                <YAxis domain={[80, 100]} hide />
                <Tooltip />
                <ReferenceLine y={SPO2_LOW} stroke="#dc2626" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="spo2" stroke="#16a34a" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts and MQTT */}
      <div className="grid-2">
        <div className="card">
          <h2>Recent alerts</h2>
          {recentAlerts.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
              None yet.
            </p>
          ) : (
            <ul className="alert-list">
              {recentAlerts.map((a) => (
                <li key={a.id}>
                  <div>
                    <b>{a.patient_id}</b>: {a.reasons}
                    <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      HR: {a.hr} BPM &bull; Temp: {a.temp}&deg;C &bull; SpO2: {a.spo2}%
                    </div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {a.timestamp.slice(11)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>MQTT messages</h2>
          <div className="input-row">
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Topic:</span>
            <input
              type="text"
              value={topic}
              onChange={(e) => handleTopicChange(e.target.value)}
              placeholder="patient/monitor/data"
            />
          </div>
          <div className="mqtt-box">
            {lastSubMessage
              ? JSON.stringify(lastSubMessage, null, 2)
              : 'Waiting for messages...'}
          </div>
        </div>
      </div>

      {/* Summary and Try the rule */}
      <div className="grid-2">
        {summary && (
          <div className="card">
            <h2>Summary</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-title">Records</div>
                <div className="stat-num">{summary.totalRecords.toLocaleString()}</div>
              </div>
              <div className="stat-item">
                <div className="stat-title">Alerts</div>
                <div className="stat-num">{summary.alertCount}</div>
              </div>
              <div className="stat-item">
                <div className="stat-title">Alert rate</div>
                <div className="stat-num">{summary.alertRate}%</div>
              </div>
              <div className="stat-item">
                <div className="stat-title">Avg heart rate</div>
                <div className="stat-num">{summary.avgHr} BPM</div>
              </div>
              <div className="stat-item">
                <div className="stat-title">Avg temperature</div>
                <div className="stat-num">{summary.avgTemp} &deg;C</div>
              </div>
              <div className="stat-item">
                <div className="stat-title">Avg SpO2</div>
                <div className="stat-num">{summary.avgSpo2}%</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
              {summary.channelStats.map((ch) => (
                <div key={ch.channel} className="stat-item">
                  <div className="stat-title">{ch.channel}</div>
                  <div className="stat-num" style={{ fontSize: '15px' }}>{ch.rate}%</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {ch.alerts} / {ch.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2>Try the rule</h2>
          <div className="slider-group">
            <div className="slider-header">
              <span>Heart rate: <b>{testHr} BPM</b></span>
            </div>
            <input
              type="range"
              min={30}
              max={160}
              value={testHr}
              onChange={(e) => setTestHr(Number(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>Temperature: <b>{testTemp.toFixed(1)} &deg;C</b></span>
            </div>
            <input
              type="range"
              min={34.0}
              max={41.0}
              step={0.1}
              value={testTemp}
              onChange={(e) => setTestTemp(Number(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span>SpO2: <b>{testSpo2} %</b></span>
            </div>
            <input
              type="range"
              min={80}
              max={100}
              value={testSpo2}
              onChange={(e) => setTestSpo2(Number(e.target.value))}
            />
          </div>

          <div className={`banner ${testAlert ? 'alert' : 'normal'}`} style={{ marginTop: '10px' }}>
            <div>{testAlert ? 'ALERT' : 'NORMAL'}</div>
            <div className="banner-reason">
              {testAlert ? testReasons.join(', ') : 'All vitals normal'}
            </div>
          </div>
        </div>
      </div>

      <footer>
        Academic prototype, not a medical device. Data is synthetic.
      </footer>
    </div>
  );
}
