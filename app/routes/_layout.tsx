import { Outlet } from "react-router";
import type { Route } from "./+types/_layout";
import { getSampleDates } from "results/parse.server";
import { formatSamplePeriod } from "~/utils/format";
import { Footer } from "~/components/Footer";

export async function loader({}: Route.LoaderArgs) {
  const sampleDates = getSampleDates();
  const samplePeriod = formatSamplePeriod(sampleDates);
  return { samplePeriod };
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="max-w-240 mx-auto px-5 py-5">
      <Outlet />
      <Footer samplePeriod={loaderData.samplePeriod} />
    </div>
  );
}
