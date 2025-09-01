import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

function csvToDataShape(text: string) {
  const lines = text.trim().split(/\r?\n/);
  lines.shift(); // header: county,town,estate
  const data: Record<string, Record<string, string[]>> = {};
  for (const line of lines) {
    const [countyRaw, townRaw, estateRaw] = line.split(",");
    if (!countyRaw || !townRaw || !estateRaw) continue;
    const county = countyRaw.trim();
    const town = townRaw.trim();
    const estate = estateRaw.trim();
    if (!data[county]) data[county] = {};
    if (!data[county][town]) data[county][town] = [];
    if (!data[county][town].includes(estate)) data[county][town].push(estate);
  }
  return data;
}

export default function Home() {
  const router = useRouter();

  const fetchData = async () => {
    const res = await fetch("/data/estates.csv");
    if (!res.ok) return undefined;
    const text = await res.text();
    return csvToDataShape(text);
  };

  return (
    <CascadingSearch
      fetchData={fetchData}
      onNavigate={(path) => router.push(path)} // enables /county/town/estate
    />
  );
}
