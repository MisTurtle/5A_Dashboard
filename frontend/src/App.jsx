import React, { useEffect, useState } from "react";
import { Loader2, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import "./App.css";
import { useToast } from "./providers/ToastProvider";

export default function HostsDashboard() {
  const [groups, setGroups] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [playbooks, setPlaybooks] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState("");
  const [playResult, setPlayResult] = useState("");
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const toast = useToast();

  useEffect(() => {
    fetch("/api/hosts")
      .then((res) => res.json())
      .then(setGroups)
      .catch(err => { console.error(err); toast(err); });
  }, []);

  useEffect(() => {
    fetch("/api/playbooks")
      .then((res) => res.json())
      .then((data) => setPlaybooks(data.playbooks || []))
      .catch(err => { console.error(err); toast(err); });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const eventSource = new EventSource("/api/status");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setStatuses((prev) => ({ ...prev, [data.host]: data }));
        } catch (e) {
          console.error("Invalid NDJSON data:", event.data);
          toast("Error when retrieving status: " + e);
        }
      };
      eventSource.onerror = () => { setLastUpdate(new Date()); eventSource.close(); }
      return () => eventSource.close();
    }, 10000);
    return () => clearInterval(interval);
  }, []);
  

  const handlePlay = async () => {
    if (!selectedHost || !selectedPlaybook) return;
    setLoadingPlay(true);
    setPlayResult("");

    const params = new URLSearchParams({
      ip: selectedHost.host,
      playbook: selectedPlaybook,
    });

    fetch(`/api/play?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setPlayResult(data.stdout || data.error || "No output");
      })
      .catch((err) => setPlayResult(`Error: ${err.message}`))
      .finally(() => setLoadingPlay(false));
  };

  return (
    <>
    <h1 className="dashboard-title">Dashboard</h1>
    <p className="dashboard-info">Last Update : {lastUpdate !== null ? lastUpdate.toLocaleString() : "N/A"}</p>
    <div className="hosts-dashboard">
      {groups.map((group) => (
        <div key={group.name} className="group-card">
          <h2 className="group-title">{group.name}</h2>
          <div className="hosts-list">
            {group.hosts.map((host) => {
              const status = statuses[host.ip];
              let statusClass = "host-row gray";
              let statusText = "Pinging...";
              let icon = <Loader2 className="spin" size={16} />;

              if (status) {
                if (status.alive) {
                  statusClass = "host-row online";
                  statusText = (
                    <span className="status online">
                      <motion.span
                        className="circle blink"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                      Online ({status.msAvg} ms)
                    </span>
                  );
                  icon = null;
                } else {
                  statusClass = "host-row offline";
                  statusText = (
                    <span className="status offline">
                      <Circle className="circle static" />
                      Offline
                    </span>
                  );
                  icon = null;
                }
              }

              return (
                <div
                  key={host.ip}
                  className={statusClass}
                  onClick={() => status?.alive && setSelectedHost(status)}
                >
                  <div className="host-info">
                    <p className="host-name">{host.name}</p>
                    <p className="host-ip">{host.ip}</p>
                  </div>
                  <div className="host-status">{icon || statusText}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedHost && (
        <div className="modal-overlay" onClick={() => setSelectedHost(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">
              Run Playbook on {selectedHost.hostname} ({selectedHost.host})
            </h3>
            <select
              className="dropdown"
              onChange={(e) => setSelectedPlaybook(e.target.value)}
              value={selectedPlaybook}
            >
              <option value="">Select a playbook</option>
              {playbooks.map((pb) => (
                <option key={pb} value={pb}>
                  {pb}
                </option>
              ))}
            </select>

            <textarea
              className="output"
              readOnly
              value={playResult}
              placeholder="Playbook output will appear here..."
            />

            <button
              className="submit-btn"
              disabled={!selectedPlaybook || loadingPlay}
              onClick={handlePlay}
            >
              {loadingPlay ? "Running..." : "Run Playbook"}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
