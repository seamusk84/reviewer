import dynamic from "next/dynamic";

const CascadingSearch = dynamic(() => import("../components/CascadingSearch"), { ssr: false });

export default function Home() {
  return (
    <div>
      <CascadingSearch />
    </div>
  );
}
