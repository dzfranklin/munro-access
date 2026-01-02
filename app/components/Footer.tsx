import { Link } from "react-router";

interface FooterProps {
  samplePeriod: string;
}

export function Footer({ samplePeriod }: FooterProps) {
  return (
    <footer className="mt-10 p-5 bg-gray-50 border border-gray-300 text-[13px] leading-relaxed">
      <p className="m-0 mb-3 text-gray-600">
        <strong>Note:</strong> Always verify current timetables. This site uses
        sample itineraries from {samplePeriod}.
      </p>

      <p className="m-0 mb-6 text-gray-600">
        An{" "}
        <a
          href="https://github.com/dzfranklin/munro-access"
          className="underline text-theme-navy-700"
        >
          open-source
        </a>{" "}
        personal project by{" "}
        <a
          href="https://dfranklin.dev"
          className="underline text-theme-navy-700"
        >
          Daniel Franklin
        </a>
        .{" "}
        <a
          href="https://github.com/dzfranklin/munro-access/issues"
          className="underline text-theme-navy-700"
        >
          Report an issue
        </a>
        .
      </p>

      <h3 className="text-base font-bold text-gray-800 m-0 mb-3">Browse</h3>
      <ul className="m-0 pl-0 list-none text-gray-600 space-y-2 mb-6">
        <li>
          <Link to="/munros" className="text-theme-navy-700 underline">
            View by Munro
          </Link>
        </li>
        <li>
          <Link to="/targets" className="text-theme-navy-700 underline">
            View by route starting point
          </Link>
        </li>
      </ul>

      <h3 className="text-base font-bold text-gray-800 m-0 mb-3">
        Data Sources
      </h3>
      <ul className="m-0 pl-0 list-none text-gray-600 space-y-2">
        <li>
          Route data from{" "}
          <a
            href="http://walkhighlands.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            walkhighlands
          </a>
          . Data will be outdated, any errors introduced are mine. My goal is to
          help you find interesting routes to look into further on{" "}
          <a
            href="http://walkhighlands.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            walkhighlands.co.uk
          </a>
          .
        </li>
        <li>
          Rail data from{" "}
          <a
            href="https://wiki.openraildata.com/index.php/About_the_National_Rail_Feeds"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            National Rail Enquiries
          </a>
        </li>
        <li>
          Bus data from{" "}
          <a
            href="https://www.bus-data.dft.gov.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            bus-data.dft.gov.uk
          </a>
        </li>
        <li>
          Streets data from{" "}
          <a
            href="https://download.geofabrik.de/europe/united-kingdom/scotland.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            OpenStreetMap
          </a>
        </li>
        <li>
          Elevation data from{" "}
          <a
            href="https://www.ordnancesurvey.co.uk/products/os-terrain-50"
            target="_blank"
            rel="noopener noreferrer"
            className="text-theme-navy-700 underline"
          >
            Ordnance Survey
          </a>
        </li>
      </ul>
      <div className="mt-4 flex items-center">
        <img
          src="/NRE_Powered_logo.png"
          alt="Powered by National Rail Enquiries"
          className="h-8"
        />
      </div>
    </footer>
  );
}
