import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function TempChart() {
  const [dataPoints, setDataPoints] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("http://localhost:8000/api/temperature/");
      const json = await res.json();
  
      const formatted = json.map((d) => ({
        value: d.value,
        time: new Date(d.created_at).toLocaleTimeString(), // 👈️ используем created_at
      }));
  
      setDataPoints(formatted.reverse());
    };
  
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);
  

  return (
    <div className="p-6 text-white">
      <h2 className="text-xl mb-4">Температура</h2>
      <Line
        data={{
          labels: dataPoints.map((d) => d.time),
          datasets: [
            {
              label: "Температура °C",
              data: dataPoints.map((d) => d.value),
              borderColor: "lime",
              backgroundColor: "rgba(0,255,0,0.3)",
              tension: 0.3,
            },
          ],
        }}
        options={{ scales: { y: { beginAtZero: false } }, plugins: { legend: { display: true } } }}
      />
    </div>
  );
}
